const express = require("express");
const { listConversations, listMessagesByWaId } = require("../services/inboxStore");

const router = express.Router();

router.get("/conversations", async (req, res) => {
  try {
    const data = await listConversations({
      limit: req.query.limit,
      q: req.query.q,
    });
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("GET /api/conversations failed:", err);
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err || "failed to list conversations"),
    });
  }
});

router.get("/messages", async (req, res) => {
  const waId = (req.query.wa_id || "").trim();
  if (!waId) {
    return res.status(400).json({ ok: false, error: "wa_id is required" });
  }

  try {
    const data = await listMessagesByWaId(waId, {
      limit: req.query.limit,
      before: req.query.before,
    });
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("GET /api/messages failed:", err);
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err || "failed to list messages"),
    });
  }
});

module.exports = router;
