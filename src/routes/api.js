const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireWorkspaceContext } = require("../middleware/workspaceContext");
const {
  listConversations,
  listMessagesByWaId,
  saveOutboundMessage,
  getConversationWindowStatus,
} = require("../services/inboxStore");
const { sendTextMessage, sendTemplateMessage, listMessageTemplates } = require("../services/whatsappApi");
const {
  ChannelError,
  listWorkspaceChannels,
  createWorkspaceChannel,
  updateWorkspaceChannel,
  getWorkspaceChannelRuntime,
} = require("../services/channelStore");

const router = express.Router();
let templatesCache = {
  // cache key => { at, data }
};
const TEMPLATE_CACHE_TTL_MS = 60 * 1000;

router.use(requireAuth);
router.use(requireWorkspaceContext);

function getRequestedChannelId(req) {
  const raw = req.get("X-Channel-Id") || req.query.channel_id || req.body?.channel_id || null;
  const id = Number(raw || 0);
  return id > 0 ? id : null;
}

async function getWorkspaceChannelRuntimeFromRequest(req) {
  return getWorkspaceChannelRuntime({
    workspaceId: req.workspace.id,
    channelId: getRequestedChannelId(req),
  });
}

function parseBodyTemplateMeta(template) {
  const components = Array.isArray(template?.components) ? template.components : [];
  const body = components.find((c) => String(c?.type || "").toUpperCase() === "BODY");
  const bodyText = typeof body?.text === "string" ? body.text : "";

  const placeholderMatches = [...bodyText.matchAll(/{{\s*(\d+)\s*}}/g)];
  const indexes = [...new Set(placeholderMatches.map((m) => Number(m[1])).filter(Number.isFinite))].sort(
    (a, b) => a - b
  );

  let exampleValues = [];
  const bodyExample = body?.example?.body_text;
  if (Array.isArray(bodyExample)) {
    if (Array.isArray(bodyExample[0])) {
      exampleValues = bodyExample[0].map((x) => String(x ?? ""));
    } else {
      exampleValues = bodyExample.map((x) => String(x ?? ""));
    }
  }

  return {
    bodyText: bodyText || null,
    bodyParamCount: indexes.length,
    bodyParamKeys: indexes.map((n) => `{{${n}}}`),
    bodyParamIndexes: indexes,
    bodyParamExampleValues: exampleValues,
  };
}

router.get("/conversations", async (req, res) => {
  try {
    const data = await listConversations({
      limit: req.query.limit,
      q: req.query.q,
      workspaceId: req.workspace.id,
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
      workspaceId: req.workspace.id,
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

router.get("/integrations/wa-channels", async (req, res) => {
  try {
    const data = await listWorkspaceChannels(req.workspace.id);
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err || "failed to list wa channels"),
    });
  }
});

router.post("/integrations/wa-channels", async (req, res) => {
  try {
    const data = await createWorkspaceChannel({
      workspaceId: req.workspace.id,
      actorUserId: Number(req.auth?.sub || 0) || null,
      payload: req.body || {},
    });
    return res.status(201).json({ ok: true, data });
  } catch (err) {
    if (err instanceof ChannelError) {
      return res.status(err.status).json({ ok: false, code: err.code, error: err.message });
    }
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err || "failed to create wa channel"),
    });
  }
});

router.patch("/integrations/wa-channels/:id", async (req, res) => {
  try {
    const channelId = Number(req.params.id || 0);
    if (!channelId) {
      return res.status(400).json({ ok: false, error: "invalid channel id" });
    }

    const data = await updateWorkspaceChannel({
      workspaceId: req.workspace.id,
      channelId,
      actorUserId: Number(req.auth?.sub || 0) || null,
      payload: req.body || {},
    });
    return res.json({ ok: true, data });
  } catch (err) {
    if (err instanceof ChannelError) {
      return res.status(err.status).json({ ok: false, code: err.code, error: err.message });
    }
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err || "failed to update wa channel"),
    });
  }
});

router.get("/templates", async (req, res) => {
  const now = Date.now();
  const force = String(req.query.force || "") === "1";

  try {
    const runtime = await getWorkspaceChannelRuntimeFromRequest(req);
    const cacheKey = `${req.workspace.id}:${runtime.channel.id}`;
    const cached = templatesCache[cacheKey];

    if (!force && cached?.data?.length > 0 && now - cached.at < TEMPLATE_CACHE_TTL_MS) {
      return res.json({
        ok: true,
        source: "cache",
        data: cached.data,
      });
    }

    const result = await listMessageTemplates({ runtime });
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
        ...parseBodyTemplateMeta(t),
      }))
      .sort((a, b) => a.templateName.localeCompare(b.templateName));

    templatesCache[cacheKey] = { at: now, data: templates };
    return res.json({
      ok: true,
      source: "meta",
      data: templates,
      channel_id: runtime.channel.id,
    });
  } catch (err) {
    if (err instanceof ChannelError) {
      return res.status(err.status).json({ ok: false, code: err.code, error: err.message });
    }
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
    let runtime;
    try {
      runtime = await getWorkspaceChannelRuntimeFromRequest(req);
    } catch (err) {
      if (err instanceof ChannelError) {
        return res.status(err.status).json({ ok: false, code: err.code, error: err.message });
      }
      throw err;
    }

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
      runtime,
    });

    const messageId = waResponse?.messages?.[0]?.id;
    if (!messageId) {
      throw new Error("message id missing from WhatsApp response");
    }

    await saveOutboundMessage({
      waId: to,
      phoneNumberId: runtime.channel.phone_number_id || process.env.PHONE_NUMBER_ID || "",
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
        channel_id: runtime.channel.id,
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
    let runtime;
    try {
      runtime = await getWorkspaceChannelRuntimeFromRequest(req);
    } catch (err) {
      if (err instanceof ChannelError) {
        return res.status(err.status).json({ ok: false, code: err.code, error: err.message });
      }
      throw err;
    }

    const waResponse = await sendTemplateMessage({
      to,
      templateName,
      languageCode,
      bodyParams,
      runtime,
    });

    const messageId = waResponse?.messages?.[0]?.id;
    if (!messageId) {
      throw new Error("message id missing from WhatsApp response");
    }

    await saveOutboundMessage({
      waId: to,
      phoneNumberId: runtime.channel.phone_number_id || process.env.PHONE_NUMBER_ID || "",
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
        channel_id: runtime.channel.id,
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
