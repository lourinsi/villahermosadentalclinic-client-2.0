import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fetchWithTimeout,
  FetchTimeoutError,
  NetworkError,
  HttpServerError,
  DEFAULT_PATIENT_FETCH_TIMEOUT_MS,
} from "../lib/api-fetch.js";
import {
  getTelemetryMetrics,
  resetTelemetryMetrics,
} from "../lib/telemetry.js";

describe("fetchWithTimeout Unit Tests", () => {
  it("should complete successfully within timeout", async () => {
    resetTelemetryMetrics();
    const originalFetch = global.fetch;

    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const res = await fetchWithTimeout("http://localhost:3001/api/patients", {
        timeoutMs: 1000,
      });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.success, true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("should throw FetchTimeoutError and track telemetry on timeout", async () => {
    resetTelemetryMetrics();
    const originalFetch = global.fetch;

    global.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    }) as typeof fetch;

    try {
      await fetchWithTimeout("http://localhost:3001/api/patients", {
        timeoutMs: 100,
      });
      assert.fail("Should have thrown FetchTimeoutError");
    } catch (err) {
      assert.ok(err instanceof FetchTimeoutError, "Expected FetchTimeoutError");
      assert.equal((err as FetchTimeoutError).timeoutMs, 100);

      const metrics = getTelemetryMetrics();
      assert.equal(metrics.patientTimeouts, 1, "Expected 1 patient timeout metric");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("should throw NetworkError and track telemetry on fetch rejection", async () => {
    resetTelemetryMetrics();
    const originalFetch = global.fetch;

    global.fetch = (async () => {
      throw new Error("Failed to fetch");
    }) as typeof fetch;

    try {
      await fetchWithTimeout("http://localhost:3001/api/patients", {
        timeoutMs: 1000,
      });
      assert.fail("Should have thrown NetworkError");
    } catch (err) {
      assert.ok(err instanceof NetworkError, "Expected NetworkError");

      const metrics = getTelemetryMetrics();
      assert.equal(metrics.networkFailures, 1, "Expected 1 network failure metric");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("should throw HttpServerError on 5xx status", async () => {
    resetTelemetryMetrics();
    const originalFetch = global.fetch;

    global.fetch = (async () => {
      return new Response("Internal Server Error", { status: 503 });
    }) as typeof fetch;

    try {
      await fetchWithTimeout("http://localhost:3001/api/patients", {
        timeoutMs: 1000,
      });
      assert.fail("Should have thrown HttpServerError");
    } catch (err) {
      assert.ok(err instanceof HttpServerError, "Expected HttpServerError");
      assert.equal((err as HttpServerError).status, 503);

      const metrics = getTelemetryMetrics();
      assert.equal(metrics.networkFailures, 1, "Expected network failure metric on 503");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("should differentiate HTTP 500 status from gateway errors", async () => {
    const originalFetch = global.fetch;

    global.fetch = (async () => {
      return new Response("Prisma Database Error", { status: 500 });
    }) as typeof fetch;

    try {
      await fetchWithTimeout("http://localhost:3001/api/patients", {
        timeoutMs: 1000,
      });
      assert.fail("Should have thrown HttpServerError");
    } catch (err) {
      assert.ok(err instanceof HttpServerError, "Expected HttpServerError");
      assert.equal((err as HttpServerError).status, 500);
      assert.equal([502, 503, 504].includes((err as HttpServerError).status), false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
