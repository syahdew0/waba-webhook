function extractEvents(payload) {
  const events = [];

  if (!payload || payload.object !== "whatsapp_business_account") {
    return events;
  }

  const entry = payload.entry || [];

  for (const e of entry) {
    const changes = e.changes || [];

    for (const ch of changes) {
      const value = ch.value || {};
      const metadata = value.metadata || {};
      const phone_number_id = metadata.phone_number_id;

      const msgs = value.messages || [];
      for (const m of msgs) {
        const wa_id = value.contacts?.[0]?.wa_id || m.from;
        const dedupe_key = m.id ? `msg:${m.id}` : undefined;

        events.push({
          kind: "message",
          dedupe_key,
          phone_number_id,
          wa_id,
          message: m,
          contacts: value.contacts || [],
          raw_value: value,
        });
      }

      const sts = value.statuses || [];
      for (const s of sts) {
        const wa_id = s.recipient_id;
        const statusId = s.id;
        const statusTs = s.timestamp || "";
        const statusName = s.status || "unknown";
        const dedupe_key = statusId
          ? `st:${statusId}:${statusName}:${statusTs}`
          : undefined;

        events.push({
          kind: "status",
          dedupe_key,
          phone_number_id,
          wa_id,
          status: s,
          raw_value: value,
        });
      }
    }
  }

  return events;
}

module.exports = { extractEvents };
