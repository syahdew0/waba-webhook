const express = require("express");
const {
  listConversations,
  listMessagesByWaId,
  saveOutboundMessage,
  getConversationWindowStatus,
} = require("../services/inboxStore");
const { sendTextMessage, sendTemplateMessage, listMessageTemplates } = require("../services/whatsappApi");

const router = express.Router();
let templatesCache = {
  at: 0,
  data: [],
};
const TEMPLATE_CACHE_TTL_MS = 60 * 1000;

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

router.get("/templates", async (req, res) => {
  const now = Date.now();
  const force = String(req.query.force || "") === "1";

  if (!force && templatesCache.data.length > 0 && now - templatesCache.at < TEMPLATE_CACHE_TTL_MS) {
    return res.json({
      ok: true,
      source: "cache",
      data: templatesCache.data,
    });
  }

  try {
    const result = await listMessageTemplates();
    const rows = Array.isArray(result?.data) ? result.data : [];
    const templates = rows
      .filter((t) => t?.name && t?.language)
      .map((t) => ({
        key: `${t.name}_${t.language}`,
        label: `${t.name} (${t.language})`,
        templateName: t.name,
        languageCode: t.language,
        status: t.status || null,
        category: t.category || null,
      }))
      .sort((a, b) => a.templateName.localeCompare(b.templateName));

    templatesCache = { at: now, data: templates };
    return res.json({
      ok: true,
      source: "meta",
      data: templates,
    });
  } catch (err) {
    const upstream = err?.response?.data;
    console.error("GET /api/templates failed:", upstream || err);
    return res.status(err?.response?.status || 500).json({
      ok: false,
      error: upstream?.error?.message || String(err?.message || err || "failed to list templates"),
      upstream: upstream || null,
    });
  }
});

router.post("/messages/send", async (req, res) => {
  const to = String(req.body?.to || "").trim();
  const type = String(req.body?.type || "text").trim();
  const text = req.body?.text;
  const replyToMessageId = req.body?.reply_to_message_id
    ? String(req.body.reply_to_message_id).trim()
    : null;

  if (!to) {
    return res.status(400).json({ ok: false, error: "to is required" });
  }
  if (type !== "text") {
    return res.status(400).json({ ok: false, error: "only text type is supported in phase 1" });
  }
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ ok: false, error: "text is required" });
  }

  try {
    const windowStatus = await getConversationWindowStatus(to);
    if (!windowStatus.is_open) {
      return res.status(409).json({
        ok: false,
        code: "OUTSIDE_24H_WINDOW",
        error:
          "Conversation window 24 jam sudah tutup. Gunakan template message untuk memulai percakapan.",
        data: {
          to,
          window: windowStatus,
        },
      });
    }

    const waResponse = await sendTextMessage({
      to,
      body: text.trim(),
      replyToMessageId,
    });

    const messageId = waResponse?.messages?.[0]?.id;
    if (!messageId) {
      throw new Error("message id missing from WhatsApp response");
    }

    await saveOutboundMessage({
      waId: to,
      phoneNumberId: process.env.PHONE_NUMBER_ID || "",
      messageId,
      messageType: "text",
      body: text.trim(),
      contextMessageId: replyToMessageId,
      rawMessage: {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text.trim() },
        context: replyToMessageId ? { message_id: replyToMessageId } : undefined,
        wa_response: waResponse,
      },
    });

    return res.json({
      ok: true,
      data: {
        message_id: messageId,
        to,
        type: "text",
      },
    });
  } catch (err) {
    const upstream = err?.response?.data;
    const status = err?.response?.status || 500;
    console.error("POST /api/messages/send failed:", upstream || err);
    return res.status(status).json({
      ok: false,
      error: upstream?.error?.message || String(err?.message || err || "failed to send message"),
      upstream: upstream || null,
    });
  }
});

router.post("/messages/send-template", async (req, res) => {
  const to = String(req.body?.to || "").trim();
  const templateName = String(req.body?.template_name || "").trim();
  const languageCode = String(req.body?.language_code || "en").trim();
  const bodyParams = Array.isArray(req.body?.body_params)
    ? req.body.body_params.map((x) => String(x)).filter((x) => x.length > 0)
    : [];

  if (!to) {
    return res.status(400).json({ ok: false, error: "to is required" });
  }
  if (!templateName) {
    return res.status(400).json({ ok: false, error: "template_name is required" });
  }

  try {
    const waResponse = await sendTemplateMessage({
      to,
      templateName,
      languageCode,
      bodyParams,
    });

    const messageId = waResponse?.messages?.[0]?.id;
    if (!messageId) {
      throw new Error("message id missing from WhatsApp response");
    }

    await saveOutboundMessage({
      waId: to,
      phoneNumberId: process.env.PHONE_NUMBER_ID || "",
      messageId,
      messageType: "template",
      body: `[template:${templateName}]`,
      contextMessageId: null,
      rawMessage: {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          body_params: bodyParams,
        },
        wa_response: waResponse,
      },
    });

    return res.json({
      ok: true,
      data: {
        message_id: messageId,
        to,
        type: "template",
        template_name: templateName,
        language_code: languageCode,
      },
    });
  } catch (err) {
    const upstream = err?.response?.data;
    const status = err?.response?.status || 500;
    console.error("POST /api/messages/send-template failed:", upstream || err);
    return res.status(status).json({
      ok: false,
      error: upstream?.error?.message || String(err?.message || err || "failed to send template"),
      upstream: upstream || null,
    });
  }
});

module.exports = router;
