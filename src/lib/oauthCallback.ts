import { resolvePostAuthRoute, type AuthRole } from "@/lib/authRouting";

const OAUTH_NONCE_KEY = "oauth_callback_nonce";
const OAUTH_INTENDED_PATH_KEY = "oauth_callback_intended_path";

const isBrowser = () => typeof window !== "undefined";

const getSessionStorage = () => {
  if (!isBrowser()) return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const createNonce = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

export const createOAuthCallbackState = (intendedPath?: string | null) => {
  const nonce = createNonce();
  const storage = getSessionStorage();

  storage?.setItem(OAUTH_NONCE_KEY, nonce);
  if (intendedPath) {
    storage?.setItem(OAUTH_INTENDED_PATH_KEY, intendedPath);
  } else {
    storage?.removeItem(OAUTH_INTENDED_PATH_KEY);
  }

  return nonce;
};

export const readOAuthCallbackState = () => {
  const storage = getSessionStorage();
  const nonce = storage?.getItem(OAUTH_NONCE_KEY) ?? null;
  const intendedPath = storage?.getItem(OAUTH_INTENDED_PATH_KEY) ?? null;

  return { nonce, intendedPath };
};

export const clearOAuthCallbackState = () => {
  const storage = getSessionStorage();
  storage?.removeItem(OAUTH_NONCE_KEY);
  storage?.removeItem(OAUTH_INTENDED_PATH_KEY);
};

export const clearOAuthCallbackUrl = () => {
  if (!isBrowser()) return;
  window.history.replaceState({}, document.title, "/auth/callback");
};

export const resolveOAuthCallbackNextPath = (role: AuthRole | null, fallbackPath?: string | null) =>
  resolvePostAuthRoute(role, fallbackPath);
