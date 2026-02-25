const crypto = require("crypto");

function getMasterKey() {
  const raw = String(process.env.CREDENTIALS_ENCRYPTION_KEY || "");
  if (!raw) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY missing");
  }

  // Derive a stable 32-byte key from any input format (plain text/hex/base64).
  return crypto.createHash("sha256").update(raw).digest();
}

function getKeyId() {
  return String(process.env.CREDENTIALS_ENCRYPTION_KEY_ID || "local-v1");
}

function encryptString(plaintext) {
  const value = String(plaintext || "");
  if (!value) throw new Error("plaintext is required");

  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    key_id: getKeyId(),
  };
}

function decryptString({ ciphertext, iv, tag }) {
  if (!ciphertext || !iv || !tag) throw new Error("encrypted payload incomplete");

  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(String(iv), "base64")
  );
  decipher.setAuthTag(Buffer.from(String(tag), "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(String(ciphertext), "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

module.exports = {
  encryptString,
  decryptString,
  getKeyId,
};

