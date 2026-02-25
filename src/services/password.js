const crypto = require("crypto");

const HASH_PREFIX = "scrypt";

function hashPassword(password) {
  const value = String(password || "");
  if (!value) {
    throw new Error("password is required");
  }

  const salt = crypto.randomBytes(16).toString("base64");
  const derivedKey = crypto.scryptSync(value, salt, 64).toString("base64");
  return `${HASH_PREFIX}$${salt}$${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  const value = String(password || "");
  const hash = String(storedHash || "");

  if (!value || !hash) return false;
  const parts = hash.split("$");
  if (parts.length !== 3 || parts[0] !== HASH_PREFIX) return false;

  const salt = parts[1];
  const expected = Buffer.from(parts[2], "base64");
  const actual = crypto.scryptSync(value, salt, expected.length);

  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = {
  hashPassword,
  verifyPassword,
};

