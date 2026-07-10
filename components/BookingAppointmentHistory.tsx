import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Eye, History, X } from "lucide-react";
import { CurrencyText } from "./CurrencyAmount";
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
  normalizeBookingHistoryStatus,
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
  showTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
      const maxAmount = Math.abs(currentAmount) >= Math.abs(previousAmount) ? currentAmount : previousAmount;
      const appointmentLog = current.logType === "appointment" ? current : previous;
      const paymentLog = current.logType === "payment" ? current : previous;

      appointmentLog.amount = maxAmount;
      appointmentLog.paymentMethod = paymentLog.paymentMethod || appointmentLog.paymentMethod;
      appointmentLog.paymentDate = paymentLog.paymentDate || paymentLog.date || appointmentLog.paymentDate;
      appointmentLog.paymentId = paymentLog.paymentId || paymentLog.paymentRecordId || appointmentLog.paymentId;
      appointmentLog.paymentRecordId = paymentLog.paymentRecordId || paymentLog.paymentId || appointmentLog.paymentRecordId;
      appointmentLog.transactionId = paymentLog.transactionId || appointmentLog.transactionId;
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

const isDeletedAppointmentState = (state: any) => {
  const status = normalizeBookingHistoryStatus(state?.status);
  if (state?.deleted === true || status === "deleted") return true;
  if (state?.deleted === false || status) return false;
  return Boolean(state?.deletedAt);
};

const getAppointmentLifecycleAction = (log: BookingHistoryLog): "deleted" | "restored" | "" => {
  if (log.logType !== "appointment") return "";

  const wasDeleted = isDeletedAppointmentState(log.previousState);
  const isDeleted = isDeletedAppointmentState(log.newState);

  if (!wasDeleted && isDeleted) return "deleted";
  if (wasDeleted && !isDeleted) return "restored";
  return "";
};

const getPaymentLifecycleAction = (log: BookingHistoryLog): "deleted" | "restored" | "" => {
  const notes = String(log.notes || "").trim().toLowerCase();
  if (notes.includes("payment deleted")) return "deleted";
  if (notes.includes("payment restored")) return "restored";
  return "";
};

const getPaymentLifecycleSnapshot = (log: BookingHistoryLog) => {
  const amount = Math.abs(getHistoryPaymentAmount(log));
  if (amount <= 0) return undefined;

  const paymentAction = getPaymentLifecycleAction(log);
  const paymentDate =
    log.paymentDate ||
    log.newState?.paymentDate ||
    log.previousState?.paymentDate ||
    log.date ||
    log.changedAt;
  const paymentMethod =
    log.paymentMethod ||
    log.newState?.paymentMethod ||
    log.previousState?.paymentMethod ||
    log.method ||
    "";
  const paymentRecordId =
    log.paymentId ||
    log.paymentRecordId ||
    log.newState?.paymentId ||
    log.newState?.paymentRecordId ||
    log.previousState?.paymentId ||
    log.previousState?.paymentRecordId ||
    "";
  const transactionId =
    log.transactionId ||
    log.newState?.transactionId ||
    log.previousState?.transactionId ||
    log.id;

  return {
    id: paymentRecordId || transactionId || log.id,
    paymentId: paymentRecordId,
    paymentRecordId,
    transactionId,
    amount,
    paymentAmount: amount,
    date: paymentDate,
    paymentDate,
    method: paymentMethod,
    paymentMethod,
    changedAt: log.changedAt,
    notes: log.notes,
    _paymentHistoryAction: paymentAction || undefined,
  };
};

const getPaymentAdjustmentDate = (log: BookingHistoryLog) => {
  const source =
    log?.paymentAdjustment ||
    log?.paymentAdjustmentDetails ||
    log?.newState?.paymentAdjustment ||
    log?.newState?._paymentAdjustment ||
    log?.appointmentSnapshot?.paymentAdjustment ||
    log?.transaction?.paymentAdjustment ||
    {};

  return normalizeBookingPaymentDate(
    source.newPaymentDate ||
    source.updatedPaymentDate ||
    source.paymentDate ||
    log.paymentDate ||
    log.newState?.paymentDate ||
    log.newState?.paymentDetails?.date ||
    log.newState?.transaction?.date ||
    log.previousState?.paymentDate ||
    log.date ||
    log.changedAt
  );
};

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
      label: `\u20b1${amount.toLocaleString()}`,
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
  const lifecycleAction = getAppointmentLifecycleAction(log);
  const paymentLifecycleAction = getPaymentLifecycleAction(log);

  if (getBookingPaymentAdjustment(log).isAdjustment) return "Payment adjusted";
  if (lifecycleAction === "deleted") return "Appointment deleted";
  if (lifecycleAction === "restored") return "Appointment restored";
  if (paymentLifecycleAction === "deleted") return "Payment deleted";
  if (paymentLifecycleAction === "restored") return "Payment restored";

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
  const lifecycleAction = getAppointmentLifecycleAction(log);
  const paymentLifecycleAction = getPaymentLifecycleAction(log);
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
  if (lifecycleAction === "deleted") return "Appointment moved to deleted records";
  if (lifecycleAction === "restored") return "Appointment restored from deleted records";
  if (paymentLifecycleAction === "deleted") return "Payment deleted";
  if (paymentLifecycleAction === "restored") return "Payment restored";

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

  const paymentDate = getBookingPaymentAdjustment(log).isAdjustment
    ? getPaymentAdjustmentDate(log)
    : normalizeBookingPaymentDate(
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
  showTrigger = true,
  open,
  onOpenChange,
}: BookingAppointmentHistoryProps) {
  const [internalIsHistoryDialogOpen, setInternalIsHistoryDialogOpen] = useState(false);
  const isControlledDialogOpen = typeof open === "boolean";
  const isHistoryDialogOpen = isControlledDialogOpen ? open : internalIsHistoryDialogOpen;
  const mergedHistoryLogs = useMemo(
    () => getMergedBookingLogs(appointmentLogs, paymentLogs),
    [appointmentLogs, paymentLogs]
  );

  const setIsHistoryDialogOpen = (nextOpen: boolean) => {
    if (isControlledDialogOpen) {
      onOpenChange?.(nextOpen);
      return;
    }

    setInternalIsHistoryDialogOpen(nextOpen);
  };

  if (mergedHistoryLogs.length === 0) return null;

  const openSnapshot = (log: BookingHistoryLog, index: number) => {
    const changedBy = log.changedByName || log.changedBy;
    const lifecycleAction = getAppointmentLifecycleAction(log);
    const paymentLifecycleAction = getPaymentLifecycleAction(log);
    const paymentLifecycleSnapshot = getPaymentLifecycleSnapshot(log);
    const historicalData =
      log.logType === "appointment" && log.newState && Object.keys(log.newState).length > 3
        ? {
            ...appointmentToEdit,
            ...log.newState,
            amount: log.amount,
            paymentDate: log.paymentDate || log.newState?.paymentDate || log.previousState?.paymentDate || log.date,
            paymentStatus: log.paymentStatus || log.newState?.paymentStatus,
            paymentAdjustment: log.paymentAdjustment || log.paymentAdjustmentDetails || log.newState?.paymentAdjustment || log.newState?._paymentAdjustment,
            previousPaymentAmount: log.previousPaymentAmount,
            newPaymentAmount: log.newPaymentAmount,
            previousState: log.previousState,
            newState: log.newState,
            changeType: log.changeType,
            logType: log.logType,
            changedAt: log.changedAt,
            changedByName: changedBy,
            _appointmentHistoryAction: lifecycleAction || undefined,
            _paymentHistoryAction: paymentLifecycleAction || undefined,
            _focusedPaymentSnapshot: paymentLifecycleSnapshot,
          }
        : {
            ...appointmentToEdit,
            ...log.previousState,
            amount: log.amount,
            paymentDate: log.paymentDate || log.newState?.paymentDate || log.previousState?.paymentDate || log.date,
            paymentStatus: log.paymentStatus || log.newState?.paymentStatus || log.previousState?.paymentStatus,
            paymentAdjustment: log.paymentAdjustment || log.paymentAdjustmentDetails || log.newState?.paymentAdjustment || log.newState?._paymentAdjustment,
            previousPaymentAmount: log.previousPaymentAmount,
            newPaymentAmount: log.newPaymentAmount,
            previousState: log.previousState,
            newState: log.newState,
            changeType: log.changeType,
            logType: log.logType,
            changedAt: log.changedAt,
            changedByName: changedBy,
            _appointmentHistoryAction: lifecycleAction || undefined,
            _paymentHistoryAction: paymentLifecycleAction || undefined,
            _focusedPaymentSnapshot: paymentLifecycleSnapshot,
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
      {showTrigger ? trigger : null}

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="!fixed !bottom-0 !left-0 !top-auto !flex max-h-[82dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.25rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[88dvh] sm:w-[min(38rem,calc(100vw-2rem))] sm:max-w-xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.5rem] sm:border"
        >
          <DialogHeader className="shrink-0 border-b bg-gray-50 px-4 pb-3 pt-2.5 sm:p-6">
            <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-100 sm:h-12 sm:w-12 sm:rounded-2xl">
                  <History className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-black text-gray-900">Appointment History</DialogTitle>
                  <DialogDescription className="line-clamp-1 text-xs font-semibold text-gray-500 sm:text-sm">
                    Recent appointment and payment changes
                  </DialogDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryDialogOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close appointment history"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-white p-3 sleek-scrollbar sm:space-y-3 sm:p-6 sm:pr-4">
            {mergedHistoryLogs.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50 p-6 text-center sm:p-8">
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
                  <div key={log.id || `${log.logType}-${log.changedAt}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate text-sm font-black text-gray-900">{getHistoryTitle(log)}</p>
                          {badges.map((badge) => (
                            <span
                              key={`${badge.tone}-${badge.label}`}
                              className={`max-w-[8rem] truncate rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-tight sm:px-2.5 sm:py-1 ${getHistoryBadgeClass(badge.tone)}`}
                            >
                              <CurrencyText value={badge.label} />
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
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent text-gray-400 transition-colors hover:border-blue-100 hover:bg-white hover:text-blue-600 sm:h-9 sm:w-9"
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
