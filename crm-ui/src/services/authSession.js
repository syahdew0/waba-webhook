const STORAGE_KEY = "crm_auth_session_v1";

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadAuthSession() {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = typeof parsed?.token === "string" ? parsed.token.trim() : "";
    const workspaceId = Number(parsed?.workspaceId || 0);
    if (!token) return null;
    return {
      token,
      workspaceId: workspaceId > 0 ? workspaceId : null,
      user: parsed?.user || null,
      workspaces: Array.isArray(parsed?.workspaces) ? parsed.workspaces : []
    };
  } catch {
    return null;
  }
}

export function saveAuthSession(data) {
  if (!canUseStorage()) return null;
  const token = String(data?.token || "").trim();
  const workspaceId = Number(data?.workspaceId || data?.defaultWorkspaceId || 0);
  if (!token) return null;

  const session = {
    token,
    workspaceId: workspaceId > 0 ? workspaceId : null,
    user: data?.user || null,
    workspaces: Array.isArray(data?.workspaces) ? data.workspaces : []
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearAuthSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function hasAuthSession() {
  const session = loadAuthSession();
  return !!session?.token;
}

