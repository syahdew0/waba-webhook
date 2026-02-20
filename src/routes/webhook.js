const express = require("express");
const verifySignature = require("../middleware/verifySignature");
const { extractEvents } = require("../utils/extract");
const { logEvent } = require("../services/eventLogger");
const {
  insertWebhookEvent,
  markWebhookProcessed,
  markWebhookFailed,
  processMessageEvent,
  processStatusEvent,
} = require("../services/eventStore");
const { handleIncomingMessage } = require("../handlers/messages");
const { handleStatus } = require("../handlers/statuses");

const router = express.Router();

router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

router.post("/", verifySignature, async (req, res) => {
  // Acknowledge quickly to avoid retries.
  res.sendStatus(200);

  let webhookEventId = null;

  try {
    const raw = req.body;
    const signature = req.get("X-Hub-Signature-256") || null;

    webhookEventId = await insertWebhookEvent(raw, signature);
    await logEvent(raw);

    const events = extractEvents(raw);

    for (const ev of events) {
      if (ev.kind === "message") {
        const processed = await processMessageEvent(ev);
        if (!processed) continue;
        await handleIncomingMessage(ev);
      } else if (ev.kind === "status") {
        const processed = await processStatusEvent(ev);
        if (!processed) continue;
        await handleStatus(ev);
      }
    }

    if (webhookEventId) {
      await markWebhookProcessed(webhookEventId);
    }
  } catch (err) {
    if (webhookEventId) {
      try {
        await markWebhookFailed(webhookEventId, err);
      } catch (markErr) {
        console.error("Failed to mark webhook event as failed:", markErr);
      }
    }
    console.error("Webhook processing error:", err);
  }
});

module.exports = router;
