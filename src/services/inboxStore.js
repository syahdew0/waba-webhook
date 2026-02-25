const { getDb } = require("./db");

function toNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

const WINDOW_24H_MS = 24 * 60 * 60 * 1000;

async function listConversations(options = {}) {
  const db = getDb();
  const limit = Math.min(Math.max(toNumber(options.limit, 50), 1), 200);
  const q = (options.q || "").trim();
  const queryValue = `%${q}%`;
  const workspaceId = Number(options.workspaceId || 0) || null;
  const [rows] = await db.raw(
    `
      SELECT
        wm.wa_id,
        MAX(COALESCE(wm.message_ts, wm.created_at)) AS last_message_at,
        COUNT(*) AS total_messages
      FROM wa_messages wm
      WHERE
        (? IS NULL OR EXISTS (
          SELECT 1
          FROM wa_channels ch
          WHERE ch.workspace_id = ?
            AND ch.phone_number_id = wm.phone_number_id
        ))
        AND
        (? = '' OR wm.wa_id LIKE ? OR EXISTS (
          SELECT 1
          FROM wa_contacts c
          WHERE c.wa_id = wm.wa_id
            AND c.profile_name LIKE ?
        ))
      GROUP BY wm.wa_id
      ORDER BY last_message_at DESC
      LIMIT ?
    `,
    [workspaceId, workspaceId, q, queryValue, queryValue, limit]
  );

  return Promise.all(
    rows.map(async (row) => {
      const waId = row.wa_id;
      const contact = await db("wa_contacts").select("profile_name").where({ wa_id: waId }).first();

      const lastMessage = await db("wa_messages")
        .select(
          "message_id",
          "direction",
          "message_type",
          "text_body",
          "interactive_title",
          "message_ts",
          "created_at"
        )
        .where({ wa_id: waId })
        .modify((qb) => {
          if (workspaceId) {
            qb.whereIn(
              "phone_number_id",
              db("wa_channels").select("phone_number_id").where({ workspace_id: workspaceId })
            );
          }
        })
        .orderByRaw("COALESCE(message_ts, created_at) DESC")
        .first();

      const latestStatus = await db("wa_message_status_latest as l")
        .select("l.latest_status", "l.latest_status_ts")
        .join("wa_messages as m", "m.message_id", "l.message_id")
        .where("m.wa_id", waId)
        .modify((qb) => {
          if (workspaceId) {
            qb.whereIn(
              "m.phone_number_id",
              db("wa_channels").select("phone_number_id").where({ workspace_id: workspaceId })
            );
          }
        })
        .orderBy("l.latest_status_ts", "desc")
        .first();

      return {
        wa_id: waId,
        profile_name: contact?.profile_name || null,
        total_messages: Number(row.total_messages || 0),
        last_message_at: row.last_message_at || null,
        last_message: lastMessage
          ? {
              message_id: lastMessage.message_id,
              direction: lastMessage.direction,
              message_type: lastMessage.message_type,
              text:
                lastMessage.text_body ||
                (lastMessage.interactive_title ? `[${lastMessage.interactive_title}]` : null),
              ts: lastMessage.message_ts || lastMessage.created_at || null,
            }
          : null,
        latest_status: latestStatus?.latest_status || null,
        latest_status_ts: latestStatus?.latest_status_ts || null,
      };
    })
  );
}

async function listMessagesByWaId(waId, options = {}) {
  const db = getDb();
  const limit = Math.min(Math.max(toNumber(options.limit, 100), 1), 500);
  const before = options.before ? new Date(options.before) : null;
  const workspaceId = Number(options.workspaceId || 0) || null;

  const query = db("wa_messages")
    .select(
      "message_id",
      "direction",
      "phone_number_id",
      "wa_id",
      "message_type",
      "text_body",
      "interactive_type",
      "interactive_id",
      "interactive_title",
      "context_message_id",
      "message_ts",
      "created_at",
      "raw_message"
    )
    .where({ wa_id: waId });

  if (workspaceId) {
    query.whereIn(
      "phone_number_id",
      db("wa_channels").select("phone_number_id").where({ workspace_id: workspaceId })
    );
  }

  if (before && !Number.isNaN(before.getTime())) {
    query.andWhereRaw("COALESCE(message_ts, created_at) < ?", [before]);
  }

  const rows = await query.orderByRaw("COALESCE(message_ts, created_at) DESC").limit(limit);
  const sortedRows = rows.reverse();
  const messageIds = sortedRows.map((r) => r.message_id);

  const statusRows = messageIds.length
    ? await db("wa_message_status_latest").select("message_id", "latest_status", "latest_status_ts").whereIn(
        "message_id",
        messageIds
      )
    : [];

  const statusByMessageId = new Map(statusRows.map((s) => [s.message_id, s]));

  return sortedRows.map((row) => {
    const st = statusByMessageId.get(row.message_id) || null;
    return {
      message_id: row.message_id,
      direction: row.direction,
      message_type: row.message_type,
      text: row.text_body || null,
      interactive_type: row.interactive_type || null,
      interactive_id: row.interactive_id || null,
      interactive_title: row.interactive_title || null,
      context_message_id: row.context_message_id || null,
      ts: row.message_ts || row.created_at || null,
      status: st?.latest_status || null,
      status_ts: st?.latest_status_ts || null,
      raw_message: row.raw_message,
    };
  });
}

async function upsertContact(waId, profileName) {
  if (!waId) return;
  const db = getDb();
  await db("wa_contacts")
    .insert({
      wa_id: waId,
      profile_name: profileName || null,
    })
    .onConflict("wa_id")
    .merge({
      profile_name: profileName || null,
      updated_at: db.fn.now(3),
    });
}

async function saveOutboundMessage({
  waId,
  phoneNumberId,
  messageId,
  messageType,
  body,
  contextMessageId,
  rawMessage,
}) {
  const db = getDb();
  await upsertContact(waId, null);

  await db("wa_messages")
    .insert({
      message_id: messageId,
      direction: "outbound",
      phone_number_id: phoneNumberId || "",
      wa_id: waId,
      message_type: messageType || "text",
      text_body: body || null,
      context_message_id: contextMessageId || null,
      message_ts: new Date(),
      raw_message: rawMessage || {},
    })
    .onConflict("message_id")
    .merge({
      text_body: body || null,
      context_message_id: contextMessageId || null,
      raw_message: rawMessage || {},
      message_ts: new Date(),
    });
}

async function getLastInboundMessageTime(waId) {
  const db = getDb();
  const row = await db("wa_messages")
    .select("message_ts", "created_at")
    .where({ wa_id: waId, direction: "inbound" })
    .orderByRaw("COALESCE(message_ts, created_at) DESC")
    .first();

  if (!row) return null;
  return row.message_ts || row.created_at || null;
}

async function getConversationWindowStatus(waId) {
  const lastInboundAt = await getLastInboundMessageTime(waId);
  if (!lastInboundAt) {
    return {
      is_open: false,
      has_inbound: false,
      last_inbound_at: null,
      hours_since_last_inbound: null,
    };
  }

  const last = new Date(lastInboundAt);
  const diffMs = Date.now() - last.getTime();
  const hours = diffMs / (60 * 60 * 1000);
  const isOpen = diffMs <= WINDOW_24H_MS;

  return {
    is_open: isOpen,
    has_inbound: true,
    last_inbound_at: last.toISOString(),
    hours_since_last_inbound: Number(hours.toFixed(2)),
  };
}

module.exports = {
  listConversations,
  listMessagesByWaId,
  saveOutboundMessage,
  getConversationWindowStatus,
};
