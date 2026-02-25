const { getDb } = require("./db");
const { hashPassword, verifyPassword } = require("./password");

class AuthError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toWorkspaceSlug(seed) {
  return String(seed || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

async function generateWorkspaceSlug(trx, seed) {
  const base = toWorkspaceSlug(seed) || "workspace";
  for (let i = 0; i < 50; i += 1) {
    const suffix = i === 0 ? "" : `-${Math.floor(Math.random() * 99999)}`;
    const slug = `${base}${suffix}`.slice(0, 80);
    const exists = await trx("workspaces").select("id").where({ slug }).first();
    if (!exists) return slug;
  }
  throw new AuthError("SLUG_GENERATION_FAILED", "failed to generate workspace slug", 500);
}

async function listUserWorkspaces(dbOrTrx, userId) {
  return dbOrTrx("workspace_members as wm")
    .select("w.id", "w.name", "w.slug", "w.status", "wm.role")
    .join("workspaces as w", "w.id", "wm.workspace_id")
    .where("wm.user_id", userId)
    .orderBy("w.id", "asc");
}

async function registerUser(payload) {
  const db = getDb();
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password || "");
  const fullName = String(payload?.full_name || "").trim() || null;
  const workspaceName = String(payload?.workspace_name || "").trim() || null;

  if (!email || !isValidEmail(email)) {
    throw new AuthError("INVALID_EMAIL", "email is invalid", 400);
  }
  if (password.length < 8) {
    throw new AuthError("WEAK_PASSWORD", "password minimal 8 karakter", 400);
  }

  return db.transaction(async (trx) => {
    const existing = await trx("users").select("id").where({ email }).first();
    if (existing) {
      throw new AuthError("EMAIL_ALREADY_USED", "email already registered", 409);
    }

    const passwordHash = hashPassword(password);
    const userInsert = await trx("users").insert({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      global_role: "user",
      is_active: true,
    });
    const userId = Array.isArray(userInsert) ? userInsert[0] : userInsert;

    const workspaceSlug = await generateWorkspaceSlug(trx, workspaceName || email.split("@")[0]);
    const workspaceInsert = await trx("workspaces").insert({
      name: workspaceName || `${email.split("@")[0]}'s workspace`,
      slug: workspaceSlug,
      status: "active",
    });
    const workspaceId = Array.isArray(workspaceInsert) ? workspaceInsert[0] : workspaceInsert;

    await trx("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: "owner",
      invited_by_user_id: userId,
    });

    const user = await trx("users")
      .select("id", "email", "full_name", "global_role", "is_active", "created_at")
      .where({ id: userId })
      .first();
    const workspaces = await listUserWorkspaces(trx, userId);

    return {
      user,
      workspaces,
      default_workspace_id: workspaceId,
    };
  });
}

async function loginUser(payload) {
  const db = getDb();
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password || "");

  if (!email || !password) {
    throw new AuthError("INVALID_CREDENTIALS", "email/password required", 400);
  }

  const user = await db("users")
    .select("id", "email", "password_hash", "full_name", "global_role", "is_active")
    .where({ email })
    .first();

  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
    throw new AuthError("INVALID_CREDENTIALS", "email or password is invalid", 401);
  }

  await db("users").where({ id: user.id }).update({
    last_login_at: db.fn.now(3),
    updated_at: db.fn.now(3),
  });

  const workspaces = await listUserWorkspaces(db, user.id);
  return {
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      global_role: user.global_role,
      is_active: user.is_active,
    },
    workspaces,
    default_workspace_id: workspaces[0]?.id || null,
  };
}

async function getMe(userId) {
  const db = getDb();
  const user = await db("users")
    .select("id", "email", "full_name", "global_role", "is_active", "last_login_at", "created_at")
    .where({ id: userId })
    .first();

  if (!user || !user.is_active) {
    throw new AuthError("UNAUTHORIZED", "user not found", 401);
  }

  const workspaces = await listUserWorkspaces(db, userId);
  return {
    user,
    workspaces,
    default_workspace_id: workspaces[0]?.id || null,
  };
}

module.exports = {
  AuthError,
  registerUser,
  loginUser,
  getMe,
};

