"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Notification } from "@/lib/notification-types";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import { fetchSnapshotFromLogs } from "@/lib/appointmentSnapshots";

type AppointmentSnapshotCandidate = {
  id?: string;
  appointmentId?: string;
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
  changedAt?: string;
  [key: string]: any;
};

const getAppointmentIdFromSnapshot = (snapshot?: AppointmentSnapshotCandidate | null) =>
  String(snapshot?.id || snapshot?.appointmentId || snapshot?._id || "");

const getNotificationSnapshotDate = (notification: Notification) => {
  const metadata = notification.metadata as any;

  return (
    metadata?.logDate ||
    metadata?.appointmentSnapshot?.changedAt ||
    metadata?.changedFields?.changedAt ||
    metadata?.changedFields?.updatedAt ||
    metadata?.paymentDate ||
    notification.updatedAt ||
    notification.createdAt ||
    ""
  );
};

const fetchAppointmentSnapshot = async (appointmentId: string) => {
  const response = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}`), {
    credentials: "include",
    headers: getAuthHeaders(),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "Appointment not found");
  }

  return payload.data;
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const normalizeChangeField = (field: unknown) =>
  String(field || "").trim().toLowerCase().replace(/[\s_-]+/g, "");

const getChangeValue = (value: any, side: "from" | "to") => {
  if (!isRecord(value)) return side === "to" ? value : undefined;
  return side === "from"
    ? value.from ?? value.old ?? value.previous ?? value.before
    : value.to ?? value.new ?? value.next ?? value.after;
};

const getNotificationChangePairs = (metadata: any) => {
  if (!isRecord(metadata)) return [];

  const summary = Array.isArray(metadata.changeSummary)
    ? metadata.changeSummary.map((change: any) => ({
        field: change?.field || change?.label,
        from: change?.from,
        to: change?.to,
      }))
    : [];

  const fields = isRecord(metadata.changedFields)
    ? Object.entries(metadata.changedFields).map(([field, value]) => ({
        field,
        from: getChangeValue(value, "from"),
        to: getChangeValue(value, "to"),
      }))
    : [];

  return [...summary, ...fields].filter((change) => change.field && (change.from !== undefined || change.to !== undefined));
};

const setMissingSnapshotValue = (state: Record<string, any>, field: unknown, value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === "") return false;

  const normalizedField = normalizeChangeField(field);
  const setIfMissing = (key: string) => {
    if (state[key] !== undefined && state[key] !== null && String(state[key]).trim() !== "") return false;
    state[key] = value;
    return true;
  };

  switch (normalizedField) {
    case "patient":
    case "patientname":
      return setIfMissing("patientName");
    case "doctor":
    case "doctorname":
      return setIfMissing("doctor");
    case "payment":
    case "paymentstatus":
      return setIfMissing("paymentStatus");
    case "status":
      return setIfMissing("status");
    case "treatment":
    case "service":
    case "customtype":
      return setIfMissing("customType");
    case "price":
      return setIfMissing("price");
    case "balance":
      return setIfMissing("balance");
    case "notes":
    case "remarks":
      return setIfMissing("notes");
    default:
      return false;
  }
};

const enrichSnapshotWithNotificationChanges = (snapshot: any, metadata: any, appointmentId: string) => {
  if (!isRecord(snapshot)) return snapshot;

  const changes = getNotificationChangePairs(metadata);
  if (!changes.length) return snapshot;

  const snapshotBase = { ...snapshot };
  delete snapshotBase.previousState;
  delete snapshotBase.newState;

  const previousState = isRecord(snapshot.previousState) ? { ...snapshot.previousState } : {};
  const newState = isRecord(snapshot.newState) ? { ...snapshot.newState } : snapshotBase;
  let changed = false;

  changes.forEach((change) => {
    changed = setMissingSnapshotValue(previousState, change.field, change.from) || changed;
    changed = setMissingSnapshotValue(newState, change.field, change.to) || changed;
  });

  if (!changed) return snapshot;

  return {
    ...snapshot,
    id: getAppointmentIdFromSnapshot(snapshot) || appointmentId,
    previousState,
    newState,
  };
};

export function useNotificationAppointmentSnapshot(appointments: AppointmentSnapshotCandidate[] = []) {
  const [isAppointmentHistoryOpen, setIsAppointmentHistoryOpen] = useState(false);
  const [appointmentSnapshot, setAppointmentSnapshot] = useState<any | null>(null);
  const [appointmentSnapshotLogDate, setAppointmentSnapshotLogDate] = useState("");
  const [appointmentSnapshotIsHistorical, setAppointmentSnapshotIsHistorical] = useState(false);
  const [appointmentSnapshotNotificationId, setAppointmentSnapshotNotificationId] = useState("");
  const [appointmentSnapshotNotificationDeleted, setAppointmentSnapshotNotificationDeleted] = useState(false);

  const findLocalAppointment = (appointmentId: string) =>
    appointments.find((appointment) => String(appointment.id) === String(appointmentId));

  const resetAppointmentSnapshot = () => {
    setAppointmentSnapshot(null);
    setAppointmentSnapshotLogDate("");
    setAppointmentSnapshotIsHistorical(false);
    setAppointmentSnapshotNotificationId("");
    setAppointmentSnapshotNotificationDeleted(false);
  };

  const handleViewCurrentSnapshot = async (appointmentId: string) => {
    if (!appointmentId) return;

    try {
      const snapshot = findLocalAppointment(appointmentId) || await fetchAppointmentSnapshot(appointmentId);

      setAppointmentSnapshot(snapshot);
      setAppointmentSnapshotLogDate(snapshot?.updatedAt || snapshot?.createdAt || new Date().toISOString());
      setAppointmentSnapshotIsHistorical(false);
      setAppointmentSnapshotNotificationId("");
      setAppointmentSnapshotNotificationDeleted(false);
      setIsAppointmentHistoryOpen(true);
    } catch (error) {
      console.error("[Notifications] Failed to load current appointment snapshot:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load appointment snapshot");
    }
  };

  const handleViewAppointment = (appointment: AppointmentSnapshotCandidate) => {
    if (!appointment) return;

    setAppointmentSnapshot(appointment);
    setAppointmentSnapshotLogDate(appointment.updatedAt || appointment.createdAt || new Date().toISOString());
    setAppointmentSnapshotIsHistorical(false);
    setAppointmentSnapshotNotificationId("");
    setAppointmentSnapshotNotificationDeleted(false);
    setIsAppointmentHistoryOpen(true);
  };

  const handleViewAppointmentSnapshot = async (appointmentId: string, notification: Notification) => {
    if (!appointmentId) {
      toast.error("No appointment is linked to this notification");
      return;
    }

    const metadata = notification.metadata as any;
    const logDate = getNotificationSnapshotDate(notification);
    let snapshot = metadata?.appointmentSnapshot || null;
    let snapshotLogDate = logDate;
    // Treat as historical only when the snapshot explicitly marks itself as historical,
    // or when the notification is a log and there is no attached appointmentSnapshot.
    // This prevents showing "Log" when the notification is marked as a log but
    // the snapshot we have is actually the current/latest appointment data.
    let isHistorical = Boolean(
      metadata?.appointmentSnapshot?._isHistorical || (notification.isLog && !metadata?.appointmentSnapshot)
    );

    try {
      // If we have a logDate, try reconstructing a snapshot from appointment logs first
    if (!snapshot && logDate) {
        try {
          const fromLogs = await fetchSnapshotFromLogs(appointmentId, logDate);
          if (fromLogs) {
            snapshot = fromLogs;
            snapshotLogDate = fromLogs.changedAt || logDate;
            isHistorical = Boolean(notification.isLog || (fromLogs as any)._isHistorical);
          }
        } catch (logError) {
          console.warn("[Notifications] Failed to build notification snapshot from logs:", logError);
        }
      }

      // If still no snapshot, but the notification suggests this was a log (isLog, isRequest, or has changedFields),
      // attempt to reconstruct using the notification timestamps as a fallback logDate.
      if (!snapshot && !(logDate)) {
        const shouldTryLogsFallback = Boolean(notification.isLog || metadata?.isRequest || (metadata && (metadata.changeSummary || metadata.changedFields)));
        if (shouldTryLogsFallback) {
          const fallbackLogDate = notification.updatedAt || notification.createdAt || new Date().toISOString();
          try {
            const fromLogs = await fetchSnapshotFromLogs(appointmentId, fallbackLogDate);
            if (fromLogs) {
              snapshot = fromLogs;
              snapshotLogDate = fromLogs.changedAt || fallbackLogDate;
              isHistorical = Boolean(notification.isLog || (fromLogs as any)._isHistorical);
            }
          } catch (err) {
            console.warn('[Notifications] Failed to build notification snapshot from logs (fallback):', err);
          }
        }
      }

      if (!snapshot) {
        snapshot = findLocalAppointment(appointmentId) || await fetchAppointmentSnapshot(appointmentId);
        snapshotLogDate = snapshot?.updatedAt || snapshot?.createdAt || new Date().toISOString();

        // If we fell back to the current appointment record but the notification
        // contains change data or was marked as a log, preserve the historical
        // intent so the snapshot view can render the previous/new state derived
        // from the notification metadata (via enrichSnapshotWithNotificationChanges).
        try {
          const changes = getNotificationChangePairs(metadata || {});
          if (changes.length > 0 || notification.isLog) {
            isHistorical = true;
          } else {
            isHistorical = false;
          }
        } catch (e) {
          isHistorical = false;
        }
      }

      if (!snapshot) {
        throw new Error("No appointment snapshot is available for this notification");
      }

      if (isHistorical && !snapshot._isHistorical) {
        snapshot = { ...snapshot, _isHistorical: true };
      }

      if (!getAppointmentIdFromSnapshot(snapshot)) {
        snapshot = { ...snapshot, id: appointmentId };
      }

      snapshot = enrichSnapshotWithNotificationChanges(snapshot, metadata, appointmentId);

      setAppointmentSnapshot(snapshot);
      setAppointmentSnapshotLogDate(snapshotLogDate || snapshot?.changedAt || snapshot?.updatedAt || snapshot?.createdAt || new Date().toISOString());
      setAppointmentSnapshotIsHistorical(isHistorical);
      setAppointmentSnapshotNotificationId(notification.id);
      setAppointmentSnapshotNotificationDeleted(Boolean(notification.deleted));
      setIsAppointmentHistoryOpen(true);
    } catch (error) {
      console.error("[Notifications] Error loading appointment snapshot:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load appointment snapshot");
    }
  };

  return {
    isAppointmentHistoryOpen,
    setIsAppointmentHistoryOpen,
    appointmentSnapshot,
    appointmentSnapshotId: getAppointmentIdFromSnapshot(appointmentSnapshot),
    appointmentSnapshotLogDate,
    appointmentSnapshotIsHistorical,
    appointmentSnapshotNotificationId,
    appointmentSnapshotNotificationDeleted,
    handleViewCurrentSnapshot,
    handleViewAppointmentSnapshot,
    handleViewAppointment,
    resetAppointmentSnapshot,
  };
}
