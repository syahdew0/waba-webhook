const { verifyJwt } = require("../services/jwt");

function requireAuth(req, res, next) {
  try {
    const raw = String(req.get("Authorization") || "");
    const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : "";
    if (!token) {
      return res.status(401).json({ ok: false, error: "missing bearer token" });
    }

    const payload = verifyJwt(token);
    req.auth = payload;
    return next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      error: String(err?.message || "unauthorized"),
    });
  }
}

module.exports = { requireAuth };

