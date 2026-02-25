const { getDb } = require("../services/db");

async function requireWorkspaceContext(req, res, next) {
  try {
    const db = getDb();
    const userId = Number(req.auth?.sub || 0);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "invalid auth context" });
    }

    const workspaceIdRaw =
      req.get("X-Workspace-Id") ||
      req.query.workspace_id ||
      req.body?.workspace_id ||
      req.auth?.default_workspace_id ||
      null;

    const workspaceId = Number(workspaceIdRaw || 0);
    if (!workspaceId) {
      return res.status(400).json({ ok: false, error: "workspace_id is required" });
    }

    const membership = await db("workspace_members as wm")
      .select("wm.workspace_id", "wm.role", "w.name", "w.slug", "w.status")
      .join("workspaces as w", "w.id", "wm.workspace_id")
      .where("wm.user_id", userId)
      .andWhere("wm.workspace_id", workspaceId)
      .first();

    if (!membership) {
      return res.status(403).json({ ok: false, error: "workspace access denied" });
    }
    if (membership.status !== "active") {
      return res.status(403).json({ ok: false, error: "workspace is not active" });
    }

    req.workspace = {
      id: membership.workspace_id,
      role: membership.role,
      name: membership.name,
      slug: membership.slug,
      status: membership.status,
    };
    return next();
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err || "failed to resolve workspace context"),
    });
  }
}

module.exports = { requireWorkspaceContext };

