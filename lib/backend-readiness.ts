import { apiUrl } from "@/lib/api";

const HEALTH_POLL_INTERVAL_MS = 4_000;
const HEALTH_REQUEST_TIMEOUT_MS = 4_000;
export const BACKEND_STARTUP_TIMEOUT_MS = 90_000;

export type BackendReadinessResult = "ready" | "timed-out" | "aborted";

type HealthCheckResult = "ready" | "not-ready" | "aborted";

const waitForNextCheck = (delayMs: number, signal: AbortSignal) =>
  new Promise<boolean>((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };

    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, delayMs);

    signal.addEventListener("abort", onAbort, { once: true });
  });

export async function checkBackendHealth(
  signal: AbortSignal,
  timeoutMs = HEALTH_REQUEST_TIMEOUT_MS
): Promise<HealthCheckResult> {
  if (signal.aborted) return "aborted";

  const requestController = new AbortController();
  const abortRequest = () => requestController.abort();
  const timeout = window.setTimeout(abortRequest, Math.max(1, timeoutMs));
  signal.addEventListener("abort", abortRequest, { once: true });

  try {
    const response = await fetch(apiUrl("/health"), {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      signal: requestController.signal,
    });

    // The deployed contract is 204, while accepting any successful 2xx keeps
    // the readiness client tolerant during a rolling frontend/backend deploy.
    return response.ok ? "ready" : "not-ready";
  } catch {
    return signal.aborted ? "aborted" : "not-ready";
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", abortRequest);
  }
}

export async function waitForBackendReady({
  signal,
  onWaiting,
  timeoutMs = BACKEND_STARTUP_TIMEOUT_MS,
}: {
  signal: AbortSignal;
  onWaiting?: () => void;
  timeoutMs?: number;
}): Promise<BackendReadinessResult> {
  const deadline = Date.now() + timeoutMs;
  let waitingWasReported = false;

  while (!signal.aborted && Date.now() < deadline) {
    const attemptStartedAt = Date.now();
    const remainingMs = deadline - attemptStartedAt;
    const result = await checkBackendHealth(
      signal,
      Math.min(HEALTH_REQUEST_TIMEOUT_MS, remainingMs)
    );

    if (result === "ready") return "ready";
    if (result === "aborted") return "aborted";

    if (!waitingWasReported) {
      waitingWasReported = true;
      onWaiting?.();
    }

    const delayUntilNextAttempt = Math.min(
      Math.max(0, HEALTH_POLL_INTERVAL_MS - (Date.now() - attemptStartedAt)),
      Math.max(0, deadline - Date.now())
    );

    if (
      delayUntilNextAttempt > 0 &&
      !(await waitForNextCheck(delayUntilNextAttempt, signal))
    ) {
      return "aborted";
    }
  }

  return signal.aborted ? "aborted" : "timed-out";
}
