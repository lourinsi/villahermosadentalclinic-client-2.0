import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
};

export async function fetchSnapshotFromLogs(appointmentId: string, logDate?: string): Promise<any | null> {
  if (!appointmentId) return null;

  const res = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}/logs`), {
    credentials: "include",
    headers: getAuthHeaders(),
  });

  const payload = (await res.json().catch(() => ({}))) as ApiResponse<any[]>;
  if (!res.ok) {
    throw new Error(payload.message || `Failed to load logs for ${appointmentId}`);
  }

  const logs = Array.isArray(payload.data) ? payload.data : [];
  if (!logs.length) return null;

  // Sort ascending by changedAt
  const sorted = logs.slice().sort((a: any, b: any) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());

  let matched: any = null;

  if (logDate) {
    // Normalize transaction time. If logDate is date-only (YYYY-MM-DD) treat as end of day.
    let txTime = Date.parse(String(logDate));
    if (Number.isNaN(txTime) && /^\d{4}-\d{2}-\d{2}$/.test(String(logDate))) {
      txTime = Date.parse(`${logDate}T23:59:59`);
    }
    if (Number.isNaN(txTime)) return null;

    // Pick the newest log with changedAt <= txTime
    for (const l of sorted) {
      const t = new Date(l.changedAt).getTime();
      if (!Number.isNaN(t) && t <= txTime) matched = l;
      if (t > txTime) break;
    }
  } else {
    // No logDate provided: prefer the most recent non-payment log (updates/status changes),
    // falling back to the latest log if none found. This helps reconstruct snapshots for
    // notifications that don't include an explicit logDate but were generated from an
    // appointment change (e.g., reservation requests or status updates).
    for (let i = sorted.length - 1; i >= 0; i--) {
      const l = sorted[i];
      if (String(l.changeType || "").toLowerCase() !== "payment") {
        matched = l;
        break;
      }
    }
    if (!matched) matched = sorted[sorted.length - 1];
  }

  if (!matched) return null;

  const snapshotState = matched.newState ?? matched.previousState ?? null;
  if (!snapshotState) return null;

  const snapshot = {
    ...snapshotState,
    id: snapshotState.id || appointmentId,
    previousState: matched.previousState,
    newState: matched.newState,
    changeType: matched.changeType,
    logType: matched.logType,
    changedAt: matched.changedAt,
    changedByName: matched.changedByName,
    _isHistorical: sorted[sorted.length - 1] !== matched,
  };

  return snapshot;
}

export default fetchSnapshotFromLogs;
