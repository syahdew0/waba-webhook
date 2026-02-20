async function handleStatus(ev) {
  const { wa_id, status } = ev;

  console.log("===== STATUS UPDATE =====");
  console.log("to:", wa_id);
  console.log("message_id:", status.id);
  console.log("status:", status.status);
  console.log("timestamp:", status.timestamp);

  if (status.errors?.length) {
    console.log("errors:", status.errors);
  }

  if (status.pricing) {
    console.log("pricing:", status.pricing);
  }

  if (status.conversation) {
    console.log("conversation:", status.conversation);
  }
}

module.exports = { handleStatus };
