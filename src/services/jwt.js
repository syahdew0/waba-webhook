const crypto = require("crypto");

function base64urlEncode(input) {
  const buff = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  return buff
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64urlDecode(input) {
  const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;
  return Buffer.from(padded, "base64").toString("utf8");
}

function getJwtSecret() {
  return process.env.JWT_SECRET || "";
}

function signJwt(payload, options = {}) {
  const secret = getJwtSecret();
  if (!secret) throw new Error("JWT_SECRET missing");

  const nowSec = Math.floor(Date.now() / 1000);
  const ttlSec = Number(options.ttlSec || process.env.JWT_TTL_SEC || 86400);
  const expSec = nowSec + ttlSec;

  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    ...payload,
    iat: nowSec,
    exp: expSec,
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedBody = base64urlEncode(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const signature = crypto.createHmac("sha256", secret).update(signingInput).digest();
  const encodedSignature = base64urlEncode(signature);
  return `${signingInput}.${encodedSignature}`;
}

function verifyJwt(token) {
  const secret = getJwtSecret();
  if (!secret) throw new Error("JWT_SECRET missing");

  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("invalid token");

  const [encodedHeader, encodedBody, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(signingInput).digest();
  const actualSignature = Buffer.from(
    encodedSignature.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (encodedSignature.length % 4)) % 4),
    "base64"
  );

  if (actualSignature.length !== expectedSignature.length) {
    throw new Error("invalid signature");
  }
  if (!crypto.timingSafeEqual(actualSignature, expectedSignature)) {
    throw new Error("invalid signature");
  }

  const payload = JSON.parse(base64urlDecode(encodedBody));
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && Number(payload.exp) < nowSec) {
    throw new Error("token expired");
  }

  return payload;
}

module.exports = {
  signJwt,
  verifyJwt,
};

