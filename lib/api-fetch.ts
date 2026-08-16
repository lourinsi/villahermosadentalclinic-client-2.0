import { trackTelemetryEvent } from "@/lib/telemetry";

export class FetchTimeoutError extends Error {
  timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = "FetchTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class NetworkError extends Error {
  originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = "NetworkError";
    this.originalError = originalError;
  }
}

export class HttpServerError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpServerError";
    this.status = status;
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
}

export const DEFAULT_PATIENT_FETCH_TIMEOUT_MS = 5_000;

/**
 * Fetch wrapper with deterministic timeout and clear error differentiation.
 * Aborts requests exceeding timeoutMs (default 5s) and tracks telemetry.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_PATIENT_FETCH_TIMEOUT_MS, signal: parentSignal, ...fetchInit } = init;

  const controller = new AbortController();
  let timedOut = false;

  const onParentAbort = () => {
    controller.abort();
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...fetchInit,
      signal: controller.signal,
    });

    if (!response.ok && response.status >= 500) {
      trackTelemetryEvent("network_failure", {
        url: String(input),
        status: response.status,
      });
      throw new HttpServerError(`HTTP ${response.status} server error`, response.status);
    }

    return response;
  } catch (err) {
    if (timedOut) {
      trackTelemetryEvent("patient_timeout", {
        url: String(input),
        timeoutMs,
      });
      throw new FetchTimeoutError(`Request timed out after ${timeoutMs}ms`, timeoutMs);
    }

    if (err instanceof FetchTimeoutError || err instanceof HttpServerError) {
      throw err;
    }

    // If caller aborted explicitly from parent signal
    if (parentSignal?.aborted && !timedOut) {
      throw err;
    }

    trackTelemetryEvent("network_failure", {
      url: String(input),
      error: err instanceof Error ? err.message : String(err),
    });

    throw new NetworkError(
      `Network failure fetching ${String(input)}`,
      err instanceof Error ? err : undefined
    );
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener("abort", onParentAbort);
    }
  }
}
