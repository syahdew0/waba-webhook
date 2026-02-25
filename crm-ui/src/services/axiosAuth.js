import axios from "axios";
import { loadAuthSession, clearAuthSession } from "./authSession";

let interceptorsRegistered = false;

function isApiPath(url) {
  if (typeof url !== "string") return false;
  return url.startsWith("/api");
}

function isAuthPath(url) {
  if (typeof url !== "string") return false;
  return url.startsWith("/auth");
}

function normalizeHeaders(config) {
  if (!config.headers) config.headers = {};
  return config.headers;
}

export function setupAxiosAuthInterceptors() {
  if (interceptorsRegistered) return;
  interceptorsRegistered = true;

  axios.interceptors.request.use((config) => {
    const session = loadAuthSession();
    if (!session?.token) return config;

    const headers = normalizeHeaders(config);
    if (!headers.Authorization) {
      headers.Authorization = `Bearer ${session.token}`;
    }

    if (session.workspaceId && isApiPath(config.url) && !headers["X-Workspace-Id"]) {
      headers["X-Workspace-Id"] = String(session.workspaceId);
    }

    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status;
      const url = error?.config?.url || "";
      if (status === 401 && !isAuthPath(url)) {
        clearAuthSession();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          const next = `${window.location.pathname}${window.location.search || ""}`;
          const params = new URLSearchParams();
          if (next && next !== "/") params.set("redirect", next);
          window.location.assign(`/login${params.toString() ? `?${params.toString()}` : ""}`);
        }
      }
      return Promise.reject(error);
    }
  );
}

