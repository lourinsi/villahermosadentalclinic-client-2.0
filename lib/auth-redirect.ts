import { isReceptionistLevelRole } from "@/lib/management-routes";

const AUTH_RETURN_TO_KEY = "villahermosa-auth-return-to";
const AUTH_MESSAGE_KEY = "villahermosa-auth-message";

export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";

const canUseSessionStorage = () => typeof window !== "undefined";

const isSafeLocalPath = (path: string) =>
  path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");

export function rememberAuthRedirect(path: string, message?: string) {
  if (!canUseSessionStorage() || !isSafeLocalPath(path)) return;

  try {
    sessionStorage.setItem(AUTH_RETURN_TO_KEY, path);
    if (message) {
      sessionStorage.setItem(AUTH_MESSAGE_KEY, message);
    } else {
      sessionStorage.removeItem(AUTH_MESSAGE_KEY);
    }
  } catch {
    // Navigation still works when storage is blocked; only return-path recovery is lost.
  }
}

export function consumeAuthMessage() {
  if (!canUseSessionStorage()) return null;

  try {
    const message = sessionStorage.getItem(AUTH_MESSAGE_KEY);
    sessionStorage.removeItem(AUTH_MESSAGE_KEY);
    return message;
  } catch {
    return null;
  }
}

export function consumeSafeManagementReturnPath(role?: string | null) {
  if (!canUseSessionStorage()) return null;

  try {
    const path = sessionStorage.getItem(AUTH_RETURN_TO_KEY);
    sessionStorage.removeItem(AUTH_RETURN_TO_KEY);

    if (!path || !isSafeLocalPath(path)) return null;
    if (role === "admin" && /^\/admin(?:\/|$)/.test(path)) return path;
    if (
      isReceptionistLevelRole(role) &&
      /^\/(?:admin|receptionist)(?:\/|$)/.test(path)
    ) {
      return path;
    }

    return null;
  } catch {
    return null;
  }
}

export function clearPendingAuthRedirect() {
  if (!canUseSessionStorage()) return;

  try {
    sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
    sessionStorage.removeItem(AUTH_MESSAGE_KEY);
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}
