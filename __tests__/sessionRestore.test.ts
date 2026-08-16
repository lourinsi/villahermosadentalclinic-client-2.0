import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  triggerSessionRestore,
  registerSessionRestoreListener,
  triggerFallbackRefresh,
  clearRefreshFallbackGuard,
} from "../lib/session-restore.js";
import {
  getTelemetryMetrics,
  resetTelemetryMetrics,
} from "../lib/telemetry.js";

describe("sessionRestore & Fallback Integration Tests", () => {
  it("should deduplicate concurrent session restore triggers into single execution", async () => {
    resetTelemetryMetrics();
    let callCount = 0;

    const unregister = registerSessionRestoreListener(async () => {
      callCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    try {
      // Trigger multiple concurrent restore requests
      const p1 = triggerSessionRestore("test_timeout_1");
      const p2 = triggerSessionRestore("test_timeout_2");
      const p3 = triggerSessionRestore("test_timeout_3");

      await Promise.all([p1, p2, p3]);

      assert.equal(callCount, 1, "Listener should only be executed once due to deduplication");
      const metrics = getTelemetryMetrics();
      assert.equal(metrics.sessionRestores, 1, "Expected 1 session restore telemetry event");
    } finally {
      unregister();
    }
  });

  it("should enforce refresh guard preventing repeated fallback refreshes", () => {
    resetTelemetryMetrics();
    clearRefreshFallbackGuard();

    // Mock window & sessionStorage if running in Node test runner
    if (typeof globalThis.window === "undefined") {
      const mockStorage: Record<string, string> = {};
      (globalThis as unknown as { window: unknown }).window = {
        location: { reload: () => {} },
      };
      (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, val: string) => { mockStorage[key] = val; },
        removeItem: (key: string) => { delete mockStorage[key]; },
      };
    }

    try {
      const firstTrigger = triggerFallbackRefresh("backend_down_1");
      assert.equal(firstTrigger, true, "First refresh trigger should succeed");

      const secondTrigger = triggerFallbackRefresh("backend_down_2");
      assert.equal(secondTrigger, false, "Second refresh trigger should be blocked by guard");

      const metrics = getTelemetryMetrics();
      assert.equal(metrics.refreshFallbacks, 1, "Expected 1 refresh fallback metric logged");
    } finally {
      clearRefreshFallbackGuard();
    }
  });
});
