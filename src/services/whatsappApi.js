const axios = require("axios");

function getConfig(overrides = {}) {
  const accessToken = process.env.ACCESS_TOKEN || "";
  const phoneNumberId = process.env.PHONE_NUMBER_ID || "";
  const wabaId = process.env.WABA_ID || "";
  const graphVersion = process.env.WA_GRAPH_VERSION || "v22.0";

  return {
    accessToken: overrides.accessToken || accessToken,
    phoneNumberId: overrides.phoneNumberId || phoneNumberId,
    wabaId: overrides.wabaId || wabaId,
    graphVersion: overrides.graphVersion || graphVersion,
  };
}

function assertConfig(overrides = {}) {
  const { accessToken, phoneNumberId } = getConfig(overrides);
  if (!accessToken) {
    throw new Error("ACCESS_TOKEN missing");
  }
  if (!phoneNumberId) {
    throw new Error("PHONE_NUMBER_ID missing");
  }
}

function assertTemplateListConfig(overrides = {}) {
  const { accessToken, wabaId } = getConfig(overrides);
  if (!accessToken) {
    throw new Error("ACCESS_TOKEN missing");
  }
  if (!wabaId) {
    throw new Error("WABA_ID missing");
  }
}

function toRuntimeConfig(runtime) {
  if (!runtime) return {};
  return {
    accessToken: runtime.credentials?.access_token || runtime.accessToken || "",
    phoneNumberId: runtime.channel?.phone_number_id || runtime.phoneNumberId || "",
    wabaId: runtime.channel?.waba_id || runtime.wabaId || "",
    graphVersion: runtime.graphVersion || process.env.WA_GRAPH_VERSION || "v22.0",
  };
}

async function sendTextMessage({ to, body, replyToMessageId, runtime }) {
  const cfgOverrides = toRuntimeConfig(runtime);
  assertConfig(cfgOverrides);
  const { accessToken, phoneNumberId, graphVersion } = getConfig(cfgOverrides);

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      preview_url: false,
      body,
    },
  };

  if (replyToMessageId) {
    payload.context = { message_id: replyToMessageId };
  }

  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });

  return response.data;
}

async function sendTemplateMessage({ to, templateName, languageCode, bodyParams = [], runtime }) {
  const cfgOverrides = toRuntimeConfig(runtime);
  assertConfig(cfgOverrides);
  const { accessToken, phoneNumberId, graphVersion } = getConfig(cfgOverrides);
  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode || "en" },
    },
  };

  if (Array.isArray(bodyParams) && bodyParams.length > 0) {
    payload.template.components = [
      {
        type: "body",
        parameters: bodyParams.map((text) => ({
          type: "text",
          text: String(text),
        })),
      },
    ];
  }

  const requestConfig = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  };

  try {
    const response = await axios.post(url, payload, requestConfig);
    return response.data;
  } catch (err) {
    const code = err?.response?.data?.error?.code;
    const details = String(err?.response?.data?.error?.error_data?.details || "");
    const isParamCountMismatch = code === 132000 && details.includes("expected number of params (0)");

    // Fallback: some templates have no body placeholders; retry once without body params.
    if (isParamCountMismatch && payload.template?.components) {
      const retryPayload = {
        ...payload,
        template: {
          ...payload.template,
        },
      };
      delete retryPayload.template.components;
      const retryResponse = await axios.post(url, retryPayload, requestConfig);
      return retryResponse.data;
    }

    throw err;
  }
}

async function listMessageTemplates({ runtime } = {}) {
  const cfgOverrides = toRuntimeConfig(runtime);
  assertTemplateListConfig(cfgOverrides);
  const { accessToken, wabaId, graphVersion } = getConfig(cfgOverrides);

  const url = `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`;
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    params: {
      limit: 200,
      fields: "name,language,status,category,components",
    },
    timeout: 15000,
  });

  return response.data;
}

module.exports = {
  sendTextMessage,
  sendTemplateMessage,
  listMessageTemplates,
};
