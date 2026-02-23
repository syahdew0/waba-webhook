const crypto = require("crypto");
const { getDb } = require("./db");

const ttlMs = Number(process.env.DEDUPE_TTL_MS || 86400000);
const cleanupIntervalMs = Number(process.env.DEDUPE_CLEANUP_INTERVAL_MS || 600000);
let cleanupTimer;
const ALLOWED_STATUSES = new Set(["sent", "delivered", "read", "failed"]);
const STATUS_RANK_SQL =
  "CASE status WHEN 'read' THEN 4 WHEN 'delivered' THEN 3 WHEN 'sent' THEN 2 WHEN 'failed' THEN 1 ELSE 0 END";

function fromUnixSeconds(value) {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Date(n * 1000);
}

function hashPayload(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function insertWebhookEvent(payload, signature) {
  const db = getDb();
  const row = {
    object: payload?.object || null,
    payload,
    payload_hash: hashPayload(payload),
    signature: signature || null,
    processed: false,
  };

  const result = await db("webhook_events").insert(row);
  return Array.isArray(result) ? result[0] : result;
}

async function markWebhookProcessed(id) {
  const db = getDb();
  await db("webhook_events").where({ id }).update({ processed: true, process_error: null });
}

async function markWebhookFailed(id, err) {
  const db = getDb();
  await db("webhook_events")
    .where({ id })
    .update({ processed: false, process_error: String(err?.message || err || "unknown error") });
}

async function claimDedupeKey(trx, dedupeKey) {
  const expiresAt = new Date(Date.now() + ttlMs);

  const [result] = await trx.raw(
    "INSERT IGNORE INTO dedupe_keys (dedupe_key, expires_at) VALUES (?, ?)",
    [dedupeKey, expiresAt]
  );

  return result.affectedRows > 0;
}

async function upsertContact(trx, waId, profileName) {
  if (!waId) return;
  await trx("wa_contacts")
    .insert({ wa_id: waId, profile_name: profileName || null })
    .onConflict("wa_id")
    .merge({
      profile_name: profileName || null,
      updated_at: trx.fn.now(3),
    });
}

async function upsertMessageFromIncoming(trx, ev) {
  const m = ev.message || {};
  const contact = ev.contacts?.[0] || {};
  const waId = ev.wa_id || m.from || null;
  const messageId = m.id;
  if (!messageId || !waId) return;

  await upsertContact(trx, waId, contact.profile?.name);

  const it = m.interactive || {};
  let interactiveType = null;
  let interactiveId = null;
  let interactiveTitle = null;

  if (m.type === "interactive") {
    interactiveType = it.type || null;
    if (it.type === "button_reply") {
      interactiveId = it.button_reply?.id || null;
      interactiveTitle = it.button_reply?.title || null;
    } else if (it.type === "list_reply") {
      interactiveId = it.list_reply?.id || null;
      interactiveTitle = it.list_reply?.title || null;
    }
  }

  const row = {
    message_id: messageId,
    direction: "inbound",
    phone_number_id: ev.phone_number_id || "",
    wa_id: waId,
    message_type: m.type || "unknown",
    text_body: m.text?.body || null,
    interactive_type: interactiveType,
    interactive_id: interactiveId,
    interactive_title: interactiveTitle,
    context_message_id: m.context?.id || null,
    message_ts: fromUnixSeconds(m.timestamp),
    raw_message: m,
  };

  await trx("wa_messages").insert(row).onConflict("message_id").merge({
    wa_id: row.wa_id,
    phone_number_id: row.phone_number_id,
    message_type: row.message_type,
    text_body: row.text_body,
    interactive_type: row.interactive_type,
    interactive_id: row.interactive_id,
    interactive_title: row.interactive_title,
    context_message_id: row.context_message_id,
    message_ts: row.message_ts,
    raw_message: row.raw_message,
  });
}

async function ensureMessageForStatus(trx, ev) {
  const s = ev.status || {};
  const messageId = s.id;
  const waId = ev.wa_id || s.recipient_id;
  if (!messageId || !waId) return;

  await upsertContact(trx, waId, null);

  await trx("wa_messages")
    .insert({
      message_id: messageId,
      direction: "outbound",
      phone_number_id: ev.phone_number_id || "",
      wa_id: waId,
      message_type: "unknown",
      message_ts: fromUnixSeconds(s.timestamp),
      raw_message: { inferred_from_status: true },
    })
    .onConflict("message_id")
    .ignore();
}

async function insertStatusEvent(trx, ev) {
  const s = ev.status || {};
  if (!s.id || !s.status) return;
  if (!ALLOWED_STATUSES.has(s.status)) return;

  await ensureMessageForStatus(trx, ev);

  const row = {
    message_id: s.id,
    status: s.status,
    recipient_wa_id: ev.wa_id || s.recipient_id || null,
    status_ts: fromUnixSeconds(s.timestamp),
    conversation: s.conversation || null,
    pricing: s.pricing || null,
    errors: s.errors || null,
    raw_status: s,
  };

  await trx("wa_message_status_events")
    .insert(row)
    .onConflict(["message_id", "status", "status_ts"])
    .ignore();

  const latest = await trx("wa_message_status_events")
    .select("status", "status_ts")
    .where({ message_id: row.message_id })
    .orderByRaw("COALESCE(status_ts, '1970-01-01 00:00:00') DESC")
    .orderByRaw(`${STATUS_RANK_SQL} DESC`)
    .first();

  if (!latest) return;

  await trx("wa_message_status_latest")
    .insert({
      message_id: row.message_id,
      latest_status: latest.status,
      latest_status_ts: latest.status_ts,
    })
    .onConflict("message_id")
    .merge({
      latest_status: latest.status,
      latest_status_ts: latest.status_ts,
      updated_at: trx.fn.now(3),
    });
}

async function processMessageEvent(ev) {
  const db = getDb();
  if (!ev?.dedupe_key) return false;

  return db.transaction(async (trx) => {
    const claimed = await claimDedupeKey(trx, ev.dedupe_key);
    if (!claimed) return false;

    await upsertMessageFromIncoming(trx, ev);
    return true;
  });
}

async function processStatusEvent(ev) {
  const db = getDb();
  if (!ev?.dedupe_key) return false;

  return db.transaction(async (trx) => {
    const claimed = await claimDedupeKey(trx, ev.dedupe_key);
    if (!claimed) return false;

    await insertStatusEvent(trx, ev);
    return true;
  });
}

async function cleanupExpiredDedupeKeys() {
  const db = getDb();
  return db("dedupe_keys").whereNotNull("expires_at").andWhere("expires_at", "<", db.fn.now()).del();
}

function startDedupeCleanupJob() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(async () => {
    try {
      await cleanupExpiredDedupeKeys();
    } catch (err) {
      console.error("Failed to cleanup dedupe_keys:", err);
    }
  }, cleanupIntervalMs);

  cleanupTimer.unref();
}

async function getDbHealthSnapshot() {
  const db = getDb();
  const now = new Date();

  await db.raw("SELECT 1 AS ok");

  const [
    totalWebhookEventsRes,
    pendingWebhookEventsRes,
    dedupeActiveRes,
    dedupeExpiredRes,
    totalMessagesRes,
    totalStatusEventsRes,
  ] = await Promise.all([
    db("webhook_events").count({ c: "*" }),
    db("webhook_events").where({ processed: 0 }).count({ c: "*" }),
    db("dedupe_keys").where("expires_at", ">", db.fn.now()).count({ c: "*" }),
    db("dedupe_keys").whereNotNull("expires_at").andWhere("expires_at", "<=", db.fn.now()).count({ c: "*" }),
    db("wa_messages").count({ c: "*" }),
    db("wa_message_status_events").count({ c: "*" }),
  ]);

  return {
    checked_at: now.toISOString(),
    db: "up",
    stats: {
      webhook_events_total: Number(totalWebhookEventsRes[0].c || 0),
      webhook_events_pending: Number(pendingWebhookEventsRes[0].c || 0),
      dedupe_keys_active: Number(dedupeActiveRes[0].c || 0),
      dedupe_keys_expired: Number(dedupeExpiredRes[0].c || 0),
      wa_messages_total: Number(totalMessagesRes[0].c || 0),
      wa_message_status_events_total: Number(totalStatusEventsRes[0].c || 0),
      queue_backlog: null,
    },
  };
}

module.exports = {
  insertWebhookEvent,
  markWebhookProcessed,
  markWebhookFailed,
  processMessageEvent,
  processStatusEvent,
  startDedupeCleanupJob,
  cleanupExpiredDedupeKeys,
  getDbHealthSnapshot,
};
