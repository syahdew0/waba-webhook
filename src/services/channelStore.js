const { getDb } = require("./db");
const { encryptString, decryptString, getKeyId } = require("./secretsVault");

class ChannelError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function cleanString(value) {
  return String(value || "").trim();
}

async function listWorkspaceChannels(workspaceId) {
  const db = getDb();
  return db("wa_channels")
    .select(
      "id",
      "workspace_id",
      "name",
      "provider",
      "waba_id",
      "phone_number_id",
      "display_phone_number",
      "status",
      "created_by_user_id",
      "created_at",
      "updated_at"
    )
    .where({ workspace_id: workspaceId })
    .orderBy("id", "asc");
}

async function createWorkspaceChannel({ workspaceId, actorUserId, payload }) {
  const db = getDb();
  const name = cleanString(payload?.name);
  const wabaId = cleanString(payload?.waba_id);
  const phoneNumberId = cleanString(payload?.phone_number_id);
  const displayPhoneNumber = cleanString(payload?.display_phone_number) || null;
  const accessToken = cleanString(payload?.access_token);
  const appSecret = cleanString(payload?.app_secret) || null;

  if (!name) throw new ChannelError("INVALID_NAME", "name is required", 400);
  if (!wabaId) throw new ChannelError("INVALID_WABA_ID", "waba_id is required", 400);
  if (!phoneNumberId) throw new ChannelError("INVALID_PHONE_NUMBER_ID", "phone_number_id is required", 400);
  if (!accessToken) throw new ChannelError("INVALID_ACCESS_TOKEN", "access_token is required", 400);

  return db.transaction(async (trx) => {
    const exists = await trx("wa_channels").select("id").where({ phone_number_id: phoneNumberId }).first();
    if (exists) {
      throw new ChannelError(
        "PHONE_NUMBER_ID_ALREADY_USED",
        "phone_number_id already connected to another channel",
        409
      );
    }

    const insertRes = await trx("wa_channels").insert({
      workspace_id: workspaceId,
      name,
      provider: "whatsapp_cloud_api",
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone_number: displayPhoneNumber,
      status: "active",
      created_by_user_id: actorUserId || null,
    });
    const channelId = Array.isArray(insertRes) ? insertRes[0] : insertRes;

    const tokenEnc = encryptString(accessToken);
    const appSecretEnc = appSecret ? encryptString(appSecret) : null;

    await trx("channel_credentials_encrypted").insert({
      channel_id: channelId,
      access_token_ciphertext: tokenEnc.ciphertext,
      access_token_iv: tokenEnc.iv,
      access_token_tag: tokenEnc.tag,
      app_secret_ciphertext: appSecretEnc?.ciphertext || null,
      app_secret_iv: appSecretEnc?.iv || null,
      app_secret_tag: appSecretEnc?.tag || null,
      encryption_key_id: getKeyId(),
      updated_by_user_id: actorUserId || null,
      rotated_at: trx.fn.now(3),
    });

    return trx("wa_channels").where({ id: channelId }).first();
  });
}

async function updateWorkspaceChannel({ workspaceId, channelId, actorUserId, payload }) {
  const db = getDb();
  const updates = {};

  if (payload.name !== undefined) {
    const name = cleanString(payload.name);
    if (!name) throw new ChannelError("INVALID_NAME", "name cannot be empty", 400);
    updates.name = name;
  }
  if (payload.waba_id !== undefined) {
    const wabaId = cleanString(payload.waba_id);
    if (!wabaId) throw new ChannelError("INVALID_WABA_ID", "waba_id cannot be empty", 400);
    updates.waba_id = wabaId;
  }
  if (payload.phone_number_id !== undefined) {
    const phoneNumberId = cleanString(payload.phone_number_id);
    if (!phoneNumberId) throw new ChannelError("INVALID_PHONE_NUMBER_ID", "phone_number_id cannot be empty", 400);
    updates.phone_number_id = phoneNumberId;
  }
  if (payload.display_phone_number !== undefined) {
    updates.display_phone_number = cleanString(payload.display_phone_number) || null;
  }
  if (payload.status !== undefined) {
    const status = cleanString(payload.status);
    if (!["active", "disabled"].includes(status)) {
      throw new ChannelError("INVALID_STATUS", "status must be active/disabled", 400);
    }
    updates.status = status;
  }

  const accessToken = payload.access_token !== undefined ? cleanString(payload.access_token) : null;
  const appSecretProvided = payload.app_secret !== undefined;
  const appSecret = appSecretProvided ? cleanString(payload.app_secret) : null;

  return db.transaction(async (trx) => {
    const current = await trx("wa_channels")
      .select("*")
      .where({ id: channelId, workspace_id: workspaceId })
      .first();
    if (!current) {
      throw new ChannelError("CHANNEL_NOT_FOUND", "channel not found", 404);
    }

    if (updates.phone_number_id && updates.phone_number_id !== current.phone_number_id) {
      const dup = await trx("wa_channels")
        .select("id")
        .where({ phone_number_id: updates.phone_number_id })
        .andWhereNot({ id: channelId })
        .first();
      if (dup) {
        throw new ChannelError(
          "PHONE_NUMBER_ID_ALREADY_USED",
          "phone_number_id already connected to another channel",
          409
        );
      }
    }

    if (Object.keys(updates).length) {
      await trx("wa_channels")
        .where({ id: channelId })
        .update({
          ...updates,
          updated_at: trx.fn.now(3),
        });
    }

    if (accessToken || appSecretProvided) {
      const prevCreds = await trx("channel_credentials_encrypted").where({ channel_id: channelId }).first();
      if (!prevCreds) {
        throw new ChannelError("CREDENTIALS_NOT_FOUND", "channel credentials not found", 500);
      }

      const tokenEnc = accessToken
        ? encryptString(accessToken)
        : {
            ciphertext: prevCreds.access_token_ciphertext,
            iv: prevCreds.access_token_iv,
            tag: prevCreds.access_token_tag,
          };

      let appSecretEnc;
      if (appSecretProvided) {
        if (appSecret) {
          appSecretEnc = encryptString(appSecret);
        } else {
          appSecretEnc = { ciphertext: null, iv: null, tag: null };
        }
      } else {
        appSecretEnc = {
          ciphertext: prevCreds.app_secret_ciphertext,
          iv: prevCreds.app_secret_iv,
          tag: prevCreds.app_secret_tag,
        };
      }

      await trx("channel_credentials_encrypted")
        .where({ channel_id: channelId })
        .update({
          access_token_ciphertext: tokenEnc.ciphertext,
          access_token_iv: tokenEnc.iv,
          access_token_tag: tokenEnc.tag,
          app_secret_ciphertext: appSecretEnc.ciphertext,
          app_secret_iv: appSecretEnc.iv,
          app_secret_tag: appSecretEnc.tag,
          encryption_key_id: getKeyId(),
          updated_by_user_id: actorUserId || null,
          rotated_at: trx.fn.now(3),
          updated_at: trx.fn.now(3),
        });
    }

    return trx("wa_channels").where({ id: channelId }).first();
  });
}

async function getWorkspaceChannelRuntime({ workspaceId, channelId = null }) {
  const db = getDb();

  let query = db("wa_channels as c")
    .select(
      "c.id",
      "c.workspace_id",
      "c.name",
      "c.provider",
      "c.waba_id",
      "c.phone_number_id",
      "c.display_phone_number",
      "c.status",
      "creds.access_token_ciphertext",
      "creds.access_token_iv",
      "creds.access_token_tag",
      "creds.app_secret_ciphertext",
      "creds.app_secret_iv",
      "creds.app_secret_tag"
    )
    .join("channel_credentials_encrypted as creds", "creds.channel_id", "c.id")
    .where("c.workspace_id", workspaceId)
    .where("c.status", "active");

  if (channelId) {
    query = query.andWhere("c.id", channelId);
  } else {
    query = query.orderBy("c.id", "asc");
  }

  const row = await query.first();
  if (!row) {
    throw new ChannelError(
      "CHANNEL_NOT_CONFIGURED",
      "No active WhatsApp channel found for this workspace",
      409
    );
  }

  return {
    channel: {
      id: row.id,
      workspace_id: row.workspace_id,
      name: row.name,
      provider: row.provider,
      waba_id: row.waba_id,
      phone_number_id: row.phone_number_id,
      display_phone_number: row.display_phone_number,
      status: row.status,
    },
    credentials: {
      access_token: decryptString({
        ciphertext: row.access_token_ciphertext,
        iv: row.access_token_iv,
        tag: row.access_token_tag,
      }),
      app_secret:
        row.app_secret_ciphertext && row.app_secret_iv && row.app_secret_tag
          ? decryptString({
              ciphertext: row.app_secret_ciphertext,
              iv: row.app_secret_iv,
              tag: row.app_secret_tag,
            })
          : "",
    },
  };
}

module.exports = {
  ChannelError,
  listWorkspaceChannels,
  createWorkspaceChannel,
  updateWorkspaceChannel,
  getWorkspaceChannelRuntime,
};

