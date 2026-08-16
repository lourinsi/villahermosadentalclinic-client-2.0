import { toast } from "sonner";
import { trackTelemetryEvent } from "@/lib/telemetry";

const REFRESH_GUARD_KEY = "villahermosa_refresh_attempted";
const REFRESH_GUARD_TIMEOUT_MS = 60_000; // Reset guard after 1 minute

type SessionRestoreListener = () => Promise<void> | void;

const listeners: Set<SessionRestoreListener> = new Set();
let activeRestorePromise: Promise<void> | null = null;
let lastToastTime = 0;

export function registerSessionRestoreListener(listener: SessionRestoreListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Triggers session restore flow across registered listeners (ProtectedRoute / AuthContext).
 * Deduplicates concurrent calls so multiple patient queries timing out simultaneously
 * cause only ONE restore attempt.
 */
export async function triggerSessionRestore(reason?: string): Promise<void> {
  if (activeRestorePromise) {
    console.log("[SessionRestore] Reusing active restore-session flow.");
    return activeRestorePromise;
  }

  const now = Date.now();
  if (now - lastToastTime > 5_000) {
    lastToastTime = now;
    toast.info("Connection delayed. Re-verifying server connection...", {
      id: "session-restore-toast",
      duration: 4000,
    });
  }

  trackTelemetryEvent("session_restore", { reason });

  activeRestorePromise = (async () => {
    try {
      console.log(`[SessionRestore] Initiating restore flow due to: ${reason || "patient fetch issue"}`);
      const promises = Array.from(listeners).map((listener) => {
        try {
          return Promise.resolve(listener());
        } catch (err) {
          console.error("[SessionRestore] Error in restore listener:", err);
          return Promise.resolve();
        }
      });
      await Promise.all(promises);
    } finally {
      activeRestorePromise = null;
    }
  })();

  return activeRestorePromise;
}

/**
 * Executes a single full-page refresh fallback when the backend is confirmed unreachable/unavailable,
 * protected against infinite refresh loops via sessionStorage guard.
 */
export function triggerFallbackRefresh(reason?: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const rawGuard = sessionStorage.getItem(REFRESH_GUARD_KEY);
    if (rawGuard) {
      const guardTime = parseInt(rawGuard, 10);
      if (!isNaN(guardTime) && Date.now() - guardTime < REFRESH_GUARD_TIMEOUT_MS) {
        console.warn("[SessionRestore] Refresh guard active; suppressing repeated page reload.");
        return false;
      }
    }

    sessionStorage.setItem(REFRESH_GUARD_KEY, String(Date.now()));
  } catch {
    // Continue with refresh if storage is restricted
  }

  trackTelemetryEvent("refresh_fallback", { reason });
  toast.error("Unable to reconnect. Refreshing page...", { duration: 3000 });

  console.warn(`[SessionRestore] Executing full page refresh fallback due to: ${reason || "backend unavailable"}`);
  setTimeout(() => {
    window.location.reload();
  }, 1000);

  return true;
}

export function clearRefreshFallbackGuard(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(REFRESH_GUARD_KEY);
  } catch {
    // Ignore storage issues
  }
}
