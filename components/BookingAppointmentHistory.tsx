import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Eye, History } from "lucide-react";
import {
  formatBookingHistoryStatusLabel,
  formatBookingPaymentAdjustmentAmountLabel,
  formatBookingPaymentAdjustmentDetail,
  formatBookingPaymentDateLabel,
  getBookingHistoryNotes,
  getBookingHistoryPaymentStatusChange,
  getBookingPaymentAdjustment,
  isSignificantBookingPaymentStatus,
  normalizeBookingDoctorName,
  normalizeBookingPaymentDate,
  shouldShowBookingHistoryLog,
} from "./sharedBookingLogic";

type BookingHistoryLog = any & {
  logType: "appointment" | "payment";
  changedAt: string;
};

type HistoryBadge = {
  label: string;
  tone: "appointment" | "payment" | "amount" | "adjustment";
};

interface BookingAppointmentHistoryProps {
  appointmentLogs: any[];
  paymentLogs: any[];
  appointmentToEdit?: any;
  onViewSnapshot: (snapshot: any, isHistorical: boolean) => void;
  triggerVariant?: "icon" | "section";
  userRole?: string;
  className?: string;
}

export const getMergedBookingLogs = (appointmentLogs: any[], paymentLogs: any[]): BookingHistoryLog[] => {
  const combinedLogs: BookingHistoryLog[] = [
    ...appointmentLogs.map((log) => ({ ...log, logType: "appointment" as const })),
    ...paymentLogs.map((log) => ({ ...log, logType: "payment" as const })),
  ].filter((log) => Boolean(log.changedAt));

  const sorted = combinedLogs.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  const mergedLogs: BookingHistoryLog[] = [];

  for (const current of sorted) {
    const previous = mergedLogs[mergedLogs.length - 1];
    const shouldMerge =
      previous &&
      Math.abs(new Date(current.changedAt).getTime() - new Date(previous.changedAt).getTime()) < 3000 &&
      current.logType !== previous.logType;

    if (shouldMerge) {
      const currentAmount = Number(current.amount || 0);
      const previousAmount = Number(previous.amount || 0);
      const maxAmount = Math.max(currentAmount, previousAmount);
      const appointmentLog = current.logType === "appointment" ? current : previous;
      const paymentLog = current.logType === "payment" ? current : previous;

      appointmentLog.amount = maxAmount;
      appointmentLog.paymentMethod = paymentLog.paymentMethod || appointmentLog.paymentMethod;
      appointmentLog.newBalance = paymentLog.newBalance ?? appointmentLog.newBalance;
      appointmentLog.paymentStatus = paymentLog.paymentStatus || appointmentLog.paymentStatus;

      if (previous.logType !== "appointment") {
        mergedLogs[mergedLogs.length - 1] = appointmentLog;
      }
      continue;
    }

    mergedLogs.push(current);
  }

  return mergedLogs.filter(shouldShowBookingHistoryLog);
};

const isInitialHistoryLog = (log: BookingHistoryLog) =>
  !log.previousState?.id || log.previousState?.status === "none";

const formatHistoryTimestamp = (changedAt: string) =>
  new Date(changedAt).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getHistoryDoctorChange = (log: BookingHistoryLog) => {
  const previousDoctor = normalizeBookingDoctorName(log.previousState?.doctor);
  const nextDoctor = normalizeBookingDoctorName(log.newState?.doctor);

  return {
    changed: Boolean(nextDoctor && nextDoctor !== previousDoctor),
  };
};

const getHistoryPaymentAmount = (log: BookingHistoryLog) => Number(log.amount || 0);

const getHistoryActor = (log: BookingHistoryLog) => log.changedByName || log.changedBy || "";

const getHistoryBadges = (log: BookingHistoryLog): HistoryBadge[] => {
  const badges: HistoryBadge[] = [];
  const paymentStatusChange = getBookingHistoryPaymentStatusChange(log);
  const appointmentStatus = log.newState?.status || log.previousState?.status || (isInitialHistoryLog(log) ? "new" : "");

  if (appointmentStatus) {
    badges.push({
      label: formatBookingHistoryStatusLabel(appointmentStatus),
      tone: "appointment",
    });
  }

  const paymentStatus = paymentStatusChange.nextStatus || log.paymentStatus;
  if (isSignificantBookingPaymentStatus(paymentStatus)) {
    badges.push({
      label: formatBookingHistoryStatusLabel(paymentStatus),
      tone: "payment",
    });
  }

  const adjustment = getBookingPaymentAdjustment(log);
  if (adjustment.isAdjustment) {
    badges.push({
      label: "Adjusted",
      tone: "adjustment",
    });
    badges.push({
      label: formatBookingPaymentAdjustmentAmountLabel(log),
      tone: "amount",
    });
    return badges;
  }

  const amount = getHistoryPaymentAmount(log);
  if (amount > 0) {
    badges.push({
      label: `PHP ${amount.toLocaleString()}`,
      tone: "amount",
    });
  }

  return badges;
};

const getHistoryBadgeClass = (tone: HistoryBadge["tone"]) => {
  if (tone === "payment") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (tone === "amount") return "bg-green-100 text-green-700 border-green-200";
  if (tone === "adjustment") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-blue-100 text-blue-700 border-blue-200";
};

const getHistoryTitle = (log: BookingHistoryLog) => {
  const paymentStatusChange = getBookingHistoryPaymentStatusChange(log);
  const amount = getHistoryPaymentAmount(log);

  if (getBookingPaymentAdjustment(log).isAdjustment) return "Payment adjusted";

  if (log.logType === "payment") {
    return amount > 0 ? "Payment recorded" : "Payment status updated";
  }
  if (isInitialHistoryLog(log)) return "Appointment created";

  if (
    (log.newState?.date && log.newState.date !== log.previousState?.date) ||
    (log.newState?.time && log.newState.time !== log.previousState?.time)
  ) {
    return "Schedule updated";
  }

  if (log.newState?.status && log.newState.status !== log.previousState?.status) return "Status updated";
  if (amount > 0) return "Payment recorded";
  if (paymentStatusChange.changed) return "Payment status updated";
  if (getHistoryDoctorChange(log).changed) return "Doctor updated";

  return "Appointment updated";
};

const getHistoryDetail = (log: BookingHistoryLog, userRole?: string) => {
  const paymentStatusChange = getBookingHistoryPaymentStatusChange(log);
  const amount = getHistoryPaymentAmount(log);
  const adjustment = getBookingPaymentAdjustment(log);
  const scheduleChanged = Boolean(
    (log.newState?.date && log.newState.date !== log.previousState?.date) ||
    (log.newState?.time && log.newState.time !== log.previousState?.time)
  );
  const treatmentChanged = Boolean(
    (log.newState?.type && log.previousState && String(log.newState.type) !== String(log.previousState.type)) ||
    (log.newState?.customType && log.previousState && String(log.newState.customType) !== String(log.previousState.customType))
  );
  const doctorChanged = getHistoryDoctorChange(log).changed;
  const statusChanged = Boolean(log.newState?.status && log.newState.status !== log.previousState?.status);

  if (adjustment.isAdjustment) return formatBookingPaymentAdjustmentDetail(log);

  if (log.logType === "payment") {
    if (amount > 0) return "Payment recorded";
    if (paymentStatusChange.changed) return "Payment status updated";
    return "Payment updated";
  }

  if (isInitialHistoryLog(log)) {
    const actor = getHistoryActor(log);
    if (amount > 0) return "Payment recorded";
    if (userRole === "patient") return "Appointment record created";
    return actor ? `Created by ${actor}` : "Appointment record created";
  }

  const details: string[] = [];
  if (scheduleChanged) details.push("Schedule changed");
  if (doctorChanged) details.push("Doctor changed");
  if (treatmentChanged) details.push("Treatment changed");

  const prev = log.previousState;
  const next = log.newState;
  const patientChanged = (() => {
    if (!prev || !next) return false;
    const resolvePatient = (state: any) => {
      if (!state) return "";
      if (typeof state.patient === "string") return state.patient;
      if (state.patient?.id) return String(state.patient.id);
      if (state.patient?.name) return String(state.patient.name);
      if (state.patientId) return String(state.patientId);
      if (state.patientName) return String(state.patientName || state.patient_name);
      const first = state.patientFirstName || state.patient?.firstName;
      const last = state.patientLastName || state.patient?.lastName;
      if (first || last) return [first, last].filter(Boolean).join(" ");
      return "";
    };

    const previousPatient = String(resolvePatient(prev) || "").trim();
    const nextPatient = String(resolvePatient(next) || "").trim();
    return Boolean(previousPatient && nextPatient && previousPatient !== nextPatient);
  })();
  if (patientChanged) details.push("Patient changed");

  const prevPrice = prev ? Number(prev.price ?? prev.amount ?? 0) : null;
  const nextPrice = next ? Number(next.price ?? next.amount ?? 0) : null;
  const priceChanged = prevPrice !== null && nextPrice !== null && Number(prevPrice) !== Number(nextPrice);
  if (priceChanged) details.push("Price changed");

  if (statusChanged) details.push("Appointment status updated");
  if (paymentStatusChange.changed) details.push("Payment status updated");
  if (amount > 0) details.push("Payment recorded");

  if (details.length > 0) return details.slice(0, 5).join(" - ");

  const actor = getHistoryActor(log);
  return actor ? `Updated by ${actor}` : "Details were updated";
};

const getHistoryPaymentDateLabel = (log: BookingHistoryLog) => {
  if (!getBookingPaymentAdjustment(log).isAdjustment && getHistoryPaymentAmount(log) <= 0) return "";

  const paymentDate = normalizeBookingPaymentDate(
    log.paymentDate ||
    log.newState?.paymentDate ||
    log.previousState?.paymentDate
  );

  return formatBookingPaymentDateLabel(paymentDate);
};

export default function BookingAppointmentHistory({
  appointmentLogs,
  paymentLogs,
  appointmentToEdit,
  onViewSnapshot,
  triggerVariant = "section",
  userRole,
  className = "",
}: BookingAppointmentHistoryProps) {
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const mergedHistoryLogs = useMemo(
    () => getMergedBookingLogs(appointmentLogs, paymentLogs),
    [appointmentLogs, paymentLogs]
  );

  if (mergedHistoryLogs.length === 0) return null;

  const openSnapshot = (log: BookingHistoryLog, index: number) => {
    const changedBy = log.changedByName || log.changedBy;
    const historicalData =
      log.logType === "appointment" && log.newState && Object.keys(log.newState).length > 3
        ? {
            ...appointmentToEdit,
            ...log.newState,
            amount: log.amount,
            paymentStatus: log.paymentStatus || log.newState?.paymentStatus,
            previousState: log.previousState,
            newState: log.newState,
            changeType: log.changeType,
            logType: log.logType,
            changedAt: log.changedAt,
            changedByName: changedBy,
          }
        : {
            ...appointmentToEdit,
            ...log.previousState,
            amount: log.amount,
            paymentStatus: log.paymentStatus || log.newState?.paymentStatus || log.previousState?.paymentStatus,
            previousState: log.previousState,
            newState: log.newState,
            changeType: log.changeType,
            logType: log.logType,
            changedAt: log.changedAt,
            changedByName: changedBy,
          };

    setIsHistoryDialogOpen(false);
    onViewSnapshot(historicalData, index !== 0);
  };

  const trigger = triggerVariant === "icon" ? (
    <button
      type="button"
      onClick={() => setIsHistoryDialogOpen(true)}
      className={`relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-all hover:bg-blue-50 hover:text-blue-600 ${className}`}
      title="View appointment history"
      aria-label="View appointment history"
    >
      <History className="h-4.5 w-4.5" />
      <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-black text-white shadow-sm">
        {mergedHistoryLogs.length}
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setIsHistoryDialogOpen(true)}
      className={`flex w-full items-center justify-between rounded-2xl border border-blue-100 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/40 ${className}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <History className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-black text-blue-800">Appointment History</span>
          <span className="block truncate text-xs font-semibold text-gray-500">Recent appointment and payment changes</span>
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
        {mergedHistoryLogs.length} logs
      </span>
    </button>
  );

  return (
    <>
      {trigger}

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-xl overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl">
          <DialogHeader className="border-b bg-gray-50 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                <History className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-gray-900">Appointment History</DialogTitle>
                <DialogDescription className="text-sm font-semibold text-gray-500">
                  Recent appointment and payment changes
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto bg-white p-6 pr-4 custom-scrollbar">
            {mergedHistoryLogs.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50 p-8 text-center">
                <p className="text-sm font-black text-gray-900">No history yet</p>
                <p className="mt-1 text-xs font-semibold text-gray-400">Changes will appear here after this appointment is updated.</p>
              </div>
            ) : (
              mergedHistoryLogs.map((log, index) => {
                const badges = getHistoryBadges(log);
                const changedBy = log.changedByName || log.changedBy;
                const historyNotes = getBookingHistoryNotes(log);
                const paymentDateLabel = getHistoryPaymentDateLabel(log);

                return (
                  <div key={log.id || `${log.logType}-${log.changedAt}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-gray-900">{getHistoryTitle(log)}</p>
                          {badges.map((badge) => (
                            <span
                              key={`${badge.tone}-${badge.label}`}
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-tight ${getHistoryBadgeClass(badge.tone)}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-gray-500">{getHistoryDetail(log, userRole)}</p>
                        {historyNotes && (
                          <p className="mt-1 truncate text-xs font-semibold text-gray-500" title={historyNotes}>
                            Notes: {historyNotes}
                          </p>
                        )}
                        {paymentDateLabel && (
                          <p className="mt-1 text-xs font-semibold text-gray-500">
                            Payment date: {paymentDateLabel}
                          </p>
                        )}
                        <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          <Clock className="h-3 w-3" />
                          <span>{formatHistoryTimestamp(log.changedAt)}</span>
                          {changedBy ? <span>- {changedBy}</span> : null}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openSnapshot(log, index)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-gray-400 transition-colors hover:border-blue-100 hover:bg-white hover:text-blue-600"
                        title="View snapshot"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
