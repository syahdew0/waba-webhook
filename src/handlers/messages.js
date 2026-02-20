function describeMessage(m) {
  const type = m.type;

  if (type === "text") {
    return { type, text: m.text?.body || "" };
  }

  if (type === "button") {
    return { type, payload: m.button?.payload, text: m.button?.text };
  }

  if (type === "interactive") {
    const it = m.interactive || {};

    if (it.type === "button_reply") {
      return {
        type,
        interactive: "button_reply",
        id: it.button_reply?.id,
        title: it.button_reply?.title,
      };
    }

    if (it.type === "list_reply") {
      return {
        type,
        interactive: "list_reply",
        id: it.list_reply?.id,
        title: it.list_reply?.title,
      };
    }

    return { type, interactive: it.type };
  }

  return { type };
}

async function handleIncomingMessage(ev) {
  const { wa_id, message } = ev;
  const summary = describeMessage(message);

  console.log("===== INCOMING MESSAGE =====");
  console.log("from:", wa_id);
  console.log("message_id:", message.id);
  console.log("timestamp:", message.timestamp);
  console.log("summary:", summary);
}

module.exports = { handleIncomingMessage };
