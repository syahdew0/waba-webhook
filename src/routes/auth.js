const express = require("express");
const { AuthError, registerUser, loginUser, getMe } = require("../services/authStore");
const { signJwt } = require("../services/jwt");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function buildAuthResponse(data) {
  const token = signJwt({
    sub: data.user.id,
    email: data.user.email,
    default_workspace_id: data.default_workspace_id || null,
    role: data.user.global_role,
  });

  return {
    token,
    user: data.user,
    workspaces: data.workspaces,
    default_workspace_id: data.default_workspace_id || null,
  };
}

router.post("/register", async (req, res) => {
  try {
    const data = await registerUser(req.body || {});
    return res.status(201).json({
      ok: true,
      data: buildAuthResponse(data),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({
        ok: false,
        code: err.code,
        error: err.message,
      });
    }
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err || "register failed"),
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const data = await loginUser(req.body || {});
    return res.json({
      ok: true,
      data: buildAuthResponse(data),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({
        ok: false,
        code: err.code,
        error: err.message,
      });
    }
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err || "login failed"),
    });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.auth?.sub || 0);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "invalid token payload" });
    }

    const data = await getMe(userId);
    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({
        ok: false,
        code: err.code,
        error: err.message,
      });
    }
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err || "failed to fetch profile"),
    });
  }
});

module.exports = router;

