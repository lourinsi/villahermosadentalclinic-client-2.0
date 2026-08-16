/**
 * Lightweight Telemetry & Logging Utility
 * Tracks patient fetch timeouts, network failures, session restoration attempts, and fallback refreshes.
 */

export interface TelemetryMetrics {
  patientTimeouts: number;
  networkFailures: number;
  sessionRestores: number;
  refreshFallbacks: number;
}

const metrics: TelemetryMetrics = {
  patientTimeouts: 0,
  networkFailures: 0,
  sessionRestores: 0,
  refreshFallbacks: 0,
};

export type TelemetryEventType =
  | "patient_timeout"
  | "network_failure"
  | "session_restore"
  | "refresh_fallback";

export function trackTelemetryEvent(
  eventType: TelemetryEventType,
  details?: Record<string, unknown>
): void {
  switch (eventType) {
    case "patient_timeout":
      metrics.patientTimeouts += 1;
      break;
    case "network_failure":
      metrics.networkFailures += 1;
      break;
    case "session_restore":
      metrics.sessionRestores += 1;
      break;
    case "refresh_fallback":
      metrics.refreshFallbacks += 1;
      break;
  }

  const timestamp = new Date().toISOString();
  console.log(`[Telemetry] [${timestamp}] ${eventType}`, details ? details : "");
}

export function getTelemetryMetrics(): Readonly<TelemetryMetrics> {
  return { ...metrics };
}

export function resetTelemetryMetrics(): void {
  metrics.patientTimeouts = 0;
  metrics.networkFailures = 0;
  metrics.sessionRestores = 0;
  metrics.refreshFallbacks = 0;
}
