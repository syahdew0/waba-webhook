const crypto = require("crypto");

module.exports = function verifySignature(req, res, next) {
  const appSecret = process.env.APP_SECRET || "";
  if (!appSecret) return res.status(500).send("APP_SECRET missing");

  const sig = req.get("X-Hub-Signature-256");
  if (!sig || !sig.startsWith("sha256=")) return res.sendStatus(401);

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", appSecret)
      .update(req.rawBody || Buffer.from(""))
      .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return res.sendStatus(401);

  const ok = crypto.timingSafeEqual(a, b);
  if (!ok) return res.sendStatus(401);

  next();
};
