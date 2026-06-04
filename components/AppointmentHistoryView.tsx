import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ApproveRejectDialog from "./ApproveRejectDialog";
import { Calendar as CalendarIcon, Clock, Stethoscope, Banknote, CreditCard, UserRound, AlertTriangle, CheckCircle2, RefreshCw, History } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PatientAvatar from "./PatientAvatar";
import { getAppointmentTypeName } from "@/lib/appointmentTypes";
import { formatTimeTo12h } from "@/lib/time-slots";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import { toast } from "sonner";
import { useDoctors } from "@/hooks/useDoctors";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import {
  formatBookingHistoryStatusLabel,
  formatBookingDateKey,
  formatBookingRecurringDate,
  getBookingRecurrenceState,
  getBookingRecurringNextDate,
  getBookingTreatmentNotesValue,
  normalizeBookingHistoryStatus,
  isSignificantBookingPaymentStatus,
} from "./sharedBookingLogic";
import { getDefaultAppointmentStatusColors, getDefaultPaymentStatusColors } from "@/lib/status-colors";
import { findDoctorForSnapshot, normalizeDoctorIdentity } from "@/lib/doctor-identity";
import { getAppointmentPatientDisplayName } from "@/lib/patient-identity";

interface AppointmentHistoryViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentSnapshot: any;
  logDate: string;
  onViewCurrent?: (appointmentId: string) => void;
  onOpenAppointment?: (appointmentId: string, appointmentSnapshot?: any) => void;
  isAppointmentOpen?: boolean;
  isHistorical?: boolean;
  actionsDisabled?: boolean;
  restoreNotificationId?: string;
  onRestoreNotification?: (notificationId: string) => void | Promise<void>;
  openedFromBookingModal?: boolean;
  showPreviousInputChanges?: boolean;
}

type SnapshotState = "historical" | "latest" | "current";
type CurrentFieldChange = {
  title: string;
};

const resolveAppointmentTypeName = (type: unknown, customType?: string) => {
  const numericType = typeof type === "number" ? type : typeof type === "string" && type.trim() ? Number(type) : NaN;

  if (Number.isFinite(numericType)) {
    return getAppointmentTypeName(numericType, customType);
  }

  if (typeof type === "string" && type.trim()) {
    return type;
  }

  return customType || "Appointment";
};

const resolvePatientName = (appointmentSnapshot: any) => {
  const patient = appointmentSnapshot?.patient;
  const nestedPatientName = typeof patient === "string"
    ? patient
    : patient?.name || patient?.fullName || [patient?.firstName, patient?.lastName].filter(Boolean).join(" ");
  const directPatientName =
    appointmentSnapshot?.patientName ||
    appointmentSnapshot?.patient_name ||
    [appointmentSnapshot?.patientFirstName, appointmentSnapshot?.patientLastName].filter(Boolean).join(" ");

  return directPatientName || nestedPatientName || appointmentSnapshot?.patientId || "No patient assigned";
};

const pickImageSource = (...sources: unknown[]) => {
  for (const source of sources) {
    if (typeof source !== "string") continue;
    const trimmed = source.trim();
    if (trimmed) return trimmed;
  }

  return undefined;
};

const resolveImageSource = (source?: string) => {
  if (!source) return undefined;
  if (
    source.startsWith("http") ||
    source.startsWith("data:") ||
    source.startsWith("blob:")
  ) {
    return source;
  }

  return apiUrl(source);
};

const getPatientProfilePicture = (snapshot: any, patientRecord?: any) =>
  pickImageSource(
    snapshot?.patientProfile,
    snapshot?.patientProfilePicture,
    snapshot?.patientPhoto,
    snapshot?.patientImage,
    snapshot?.patientAvatar,
    snapshot?.profilePicture,
    snapshot?.patient?.profilePicture,
    snapshot?.patient?.profilePictureUrl,
    snapshot?.patient?.photo,
    snapshot?.patient?.avatar,
    patientRecord?.profilePicture,
    patientRecord?.profilePictureUrl,
    patientRecord?.photo,
    patientRecord?.avatar
  );

const resolveDoctorName = (doctor: any) => {
  if (!doctor) return "";
  if (typeof doctor === "string") return doctor;
  return doctor.name || doctor.fullName || doctor.username || doctor.id || "";
};

const normalizeDoctorName = (doctor: any) => {
  const normalized = normalizeDoctorIdentity(resolveDoctorName(doctor));
  return /^(none|null|undefined|unassigned|no doctor assigned)$/.test(normalized) ? "" : normalized;
};

const shortDoctorLabel = (fullName?: string, prefix = "From") => {
  if (!fullName) return "";
  const stripped = String(fullName).replace(/^Dr\.?\s+/i, "").trim();
  const first = stripped.split(/\s+/)[0] || stripped;
  return `${prefix} Dr. ${first}`;
};

const shortPatientLabel = (fullName?: string, prefix = "From") => {
  if (!fullName) return "";
  const stripped = String(fullName).trim();
  return `${prefix} ${stripped}`;
};

const shortScheduleLabel = (snapshot: any) => {
  if (!snapshot) return "";
  const date = snapshot?.date;
  const time = snapshot?.time;
  const duration = snapshot?.duration;
  try {
    const dateLabel = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeLabel = formatAppointmentTimeRange(time, duration);
    return `${dateLabel} ${timeLabel}`;
  } catch (e) {
    return formatAppointmentTimeRange(time, duration) || String(date || "");
  }
};

const formatCompactTime = (time24?: string) => formatTimeTo12h(time24 || "").replace(/\s+/g, "");

const formatAppointmentTimeRange = (time?: string, duration?: unknown) => {
  const startLabel = formatCompactTime(time);
  const [hourPart, minutePart] = String(time || "").split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  const durationMinutes = Number(duration) || 0;

  if (!startLabel || !Number.isFinite(hours) || !Number.isFinite(minutes) || durationMinutes <= 0) {
    return startLabel || "No time";
  }

  const endTime = new Date(2000, 0, 1, hours, minutes + durationMinutes);
  const endTime24 = `${String(endTime.getHours()).padStart(2, "0")}:${String(endTime.getMinutes()).padStart(2, "0")}`;

  return `${startLabel} - ${formatCompactTime(endTime24)}`;
};

const isIgnorablePatientName = (name?: string) => {
  if (!name) return true;
  const n = String(name).trim().toLowerCase();
  return n === "" || /^(no patient assigned|no patient|occupied|unassigned|none|null|n\/a|-)$/.test(n);
};

const isValidDateValue = (value: any) => {
  if (value === undefined || value === null || String(value).trim() === "") return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
};

const isMeaningfulTime = (time?: string, duration?: unknown) => {
  const label = formatAppointmentTimeRange(time, duration);
  if (!label) return false;
  const n = String(label).trim().toLowerCase();
  return n !== "no time" && n !== "";
};

const isMeaningfulTreatmentName = (name?: string) => {
  if (!name) return false;
  const n = String(name).trim().toLowerCase();
  return n !== "appointment" && n !== "";
};

const isInsignificantStatus = (status?: string) => {
  const n = String(status ?? "").toLowerCase().trim();
  return n === "" || /^(updated|invalid|unknown|none|n\/a|-)$/.test(n);
};

const pickNumericValue = (...values: unknown[]) => {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;
  }

  return null;
};

const isPlainObject = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const getComparableSnapshotState = (snapshot: any) => {
  if (!snapshot) return null;
  return isPlainObject(snapshot.newState) && Object.keys(snapshot.newState).length > 0
    ? { ...snapshot, ...snapshot.newState }
    : snapshot;
};

const normalizeComparableText = (value: unknown) =>
  String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const normalizeComparableDate = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === "") return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return normalizeComparableText(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatChangeValue = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || "Not set";
};

const createCurrentFieldChange = (
  fieldName: string,
  snapshotValue: unknown,
  currentValue: unknown,
  snapshotLabel = formatChangeValue(snapshotValue),
  currentLabel = formatChangeValue(currentValue),
  normalize: (value: unknown) => string = normalizeComparableText
): CurrentFieldChange | null => {
  const normalizedCurrent = normalize(currentValue);
  const normalizedSnapshot = normalize(snapshotValue);

  if (currentValue === undefined || currentValue === null || normalizedCurrent === normalizedSnapshot) return null;

  return {
    title: `Current ${fieldName}: ${currentLabel}.`,
  };
};

const CurrentChangeIndicator = ({ change }: { change?: CurrentFieldChange | null }) => {
  if (!change) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200"
          aria-label={change.title}
          title={change.title}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        {change.title}
      </TooltipContent>
    </Tooltip>
  );
};

const getExplicitSnapshotPaymentAmount = (snapshot: any) =>
  pickNumericValue(
    snapshot?.amount,
    snapshot?.paymentAmount,
    snapshot?.newPayment,
    snapshot?.amountPaid,
    snapshot?.paymentDetails?.amount
  );

const isLogSnapshot = (snapshot: any) =>
  Boolean(snapshot?.logType || snapshot?.changeType || snapshot?.previousState || snapshot?.newState || snapshot?._isHistorical);

const getRecurringCreatedFromDate = (recurrence?: any, currentDate?: unknown) => {
  if (!recurrence || typeof recurrence !== "object") return "";

  const currentDateKey = formatBookingDateKey(currentDate as any);
  const candidates = [
    recurrence.createdFromAppointmentDate,
    recurrence.originalGeneratedFromDate,
    recurrence.generatedFromDate,
    recurrence.sourceAppointmentDate,
  ];

  for (const candidate of candidates) {
    const dateKey = formatBookingDateKey(candidate as any);
    if (dateKey && dateKey !== currentDateKey) return dateKey;
  }

  return "";
};

const getRecurringCreatedFromDateFromText = (value?: unknown) => {
  const text = String(value || "");
  const match =
    /Created from (?:recurring|repeating) schedule from\s+([^.\n]+)/i.exec(text) ||
    /Created from\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/i.exec(text);

  return match ? formatBookingDateKey(match[1]) : "";
};

const getRecurringCreatedFromDateFromLogs = (logs: any[], currentDate?: unknown) => {
  const sortedLogs = logs
    .slice()
    .sort((left, right) =>
      new Date(left?.changedAt || left?.createdAt || 0).getTime() -
      new Date(right?.changedAt || right?.createdAt || 0).getTime()
    );

  for (const log of sortedLogs) {
    const stateCandidates = [log?.newState, log?.previousState, log];

    for (const state of stateCandidates) {
      const recurrenceDate = getRecurringCreatedFromDate(state?.recurrence, currentDate);
      if (recurrenceDate) return recurrenceDate;
    }

    const noteDate = getRecurringCreatedFromDateFromText(log?.notes);
    if (noteDate && noteDate !== formatBookingDateKey(currentDate as any)) return noteDate;
  }

  return "";
};

const isPatientChange = (snapshot: any) => {
  const prev = snapshot?.previousState;
  const next = snapshot?.newState;
  if (!prev || !next) return false;

  const resolvePatient = (s: any) => {
    if (!s) return "";
    if (typeof s.patient === "string") return s.patient;
    if (s.patient?.id) return String(s.patient.id);
    if (s.patient?.name) return String(s.patient.name);
    if (s.patientId) return String(s.patientId);
    if (s.patientName) return String(s.patientName || s.patient_name);
    const first = s.patientFirstName || s.patient?.firstName;
    const last = s.patientLastName || s.patient?.lastName;
    if (first || last) return [first, last].filter(Boolean).join(" ");
    return "";
  };

  const pPrev = String(resolvePatient(prev) || "").trim();
  const pNext = String(resolvePatient(next) || "").trim();
  return Boolean(pPrev && pNext && pPrev !== pNext);
};

export default function AppointmentHistoryView({ open, onOpenChange, appointmentSnapshot, logDate, onViewCurrent, onOpenAppointment, isAppointmentOpen, isHistorical, actionsDisabled = false, restoreNotificationId, onRestoreNotification, openedFromBookingModal = false, showPreviousInputChanges = true }: AppointmentHistoryViewProps) {
  const [displayedSnapshot, setDisplayedSnapshot] = useState<any | null>(appointmentSnapshot);
  const [snapshotState, setSnapshotState] = useState<SnapshotState>(Boolean(isHistorical) ? "historical" : "current");
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [patientRecord, setPatientRecord] = useState<any | null>(null);
  const [latestPaymentLogAmount, setLatestPaymentLogAmount] = useState<number | null>(null);
  const [latestComparisonSnapshot, setLatestComparisonSnapshot] = useState<any | null>(null);
  const [recurringSourceDateFromLogs, setRecurringSourceDateFromLogs] = useState("");
  const { doctors } = useDoctors(open ? 1 : undefined, { enabled: open });
  const displayedPatientId = displayedSnapshot?.patientId || displayedSnapshot?.patient?.id || "";
  const displayedAppointmentId = displayedSnapshot?.id || displayedSnapshot?.appointmentId || appointmentSnapshot?.id || appointmentSnapshot?.appointmentId || "";

  // Appointment action helpers (approve/reject) using central appointment modal hook
  const { updateAppointment } = useAppointmentModal();
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [pendingActionSnapshot, setPendingActionSnapshot] = useState<any | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const shouldShowPreviousInputChanges = openedFromBookingModal || showPreviousInputChanges;

  useEffect(() => {
    setDisplayedSnapshot(appointmentSnapshot);
    // Prefer explicit snapshot metadata when available. If the snapshot includes
    // `_isHistorical` (set by `fetchSnapshotFromLogs`), honor that value. Otherwise
    // fall back to the `isHistorical` prop provided by the caller.
    const derivedHistorical = appointmentSnapshot && Object.prototype.hasOwnProperty.call(appointmentSnapshot, "_isHistorical")
      ? Boolean(appointmentSnapshot._isHistorical)
      : Boolean(isHistorical);
    setSnapshotState(derivedHistorical ? "historical" : "current");
  }, [appointmentSnapshot, isHistorical]);

  useEffect(() => {
    const patientId = String(displayedPatientId || "").trim();
    setPatientRecord(null);

    if (!open || !patientId || patientId === "Occupied" || patientId === "No patient assigned") return;

    const controller = new AbortController();
    const loadPatientRecord = async () => {
      try {
        const response = await fetch(apiUrl(`/api/patients/${encodeURIComponent(patientId)}`), {
          credentials: "include",
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        if (response.ok && result?.success && result.data) {
          setPatientRecord(result.data);
        }
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.warn("[AppointmentHistoryView] Failed to load patient photo:", error);
        }
      }
    };

    loadPatientRecord();

    return () => controller.abort();
  }, [open, displayedPatientId]);

  useEffect(() => {
    setLatestPaymentLogAmount(null);

    const appointmentId = String(displayedAppointmentId || "").trim();
    const explicitAmount = getExplicitSnapshotPaymentAmount(displayedSnapshot);
    if (
      !open ||
      !appointmentId ||
      snapshotState === "historical" ||
      (explicitAmount !== null && explicitAmount > 0)
    ) return;

    const controller = new AbortController();
    const loadLatestPaymentLogAmount = async () => {
      try {
        const response = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}/payments`), {
          credentials: "include",
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        const logs = response.ok && result?.success && Array.isArray(result.data) ? result.data : [];
        const latestPositiveAmount = logs
          .map((log: any) => Number(log?.amount || 0))
          .find((amount: number) => amount > 0);

        setLatestPaymentLogAmount(latestPositiveAmount ?? 0);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.warn("[AppointmentHistoryView] Failed to load payment logs:", error);
          setLatestPaymentLogAmount(0);
        }
      }
    };

    loadLatestPaymentLogAmount();

    return () => controller.abort();
  }, [
    open,
    displayedAppointmentId,
    displayedSnapshot,
    snapshotState,
  ]);

  useEffect(() => {
    setLatestComparisonSnapshot(null);

    const appointmentId = String(displayedAppointmentId || "").trim();
    if (!open || !appointmentId) return;

    const controller = new AbortController();
    const loadLatestComparisonSnapshot = async () => {
      try {
        const currentResponse = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}?t=${Date.now()}`), {
          credentials: "include",
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const currentResult = await currentResponse.json().catch(() => null);

        if (currentResponse.ok && currentResult?.data) {
          setLatestComparisonSnapshot(currentResult.data);
          return;
        }

        const logsResponse = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}/logs`), {
          credentials: "include",
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const logsResult = await logsResponse.json().catch(() => null);
        const logs = logsResponse.ok && logsResult?.success && Array.isArray(logsResult.data) ? logsResult.data : [];
        const latestLog = logs[0];
        const latestState = getComparableSnapshotState(latestLog);

        if (latestState) {
          setLatestComparisonSnapshot({
            ...latestState,
            id: latestState.id || appointmentId,
            changedAt: latestLog?.changedAt || latestState.changedAt,
            changedByName: latestLog?.changedByName || latestState.changedByName,
          });
        }
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.warn("[AppointmentHistoryView] Failed to load current comparison snapshot:", error);
        }
      }
    };

    loadLatestComparisonSnapshot();

    return () => controller.abort();
  }, [
    open,
    displayedAppointmentId,
    displayedSnapshot,
    snapshotState,
    appointmentSnapshot,
  ]);

  useEffect(() => {
    setRecurringSourceDateFromLogs("");

    const appointmentId = String(displayedAppointmentId || "").trim();
    if (!open || !appointmentId) return;

    const controller = new AbortController();
    const loadRecurringCreatedFromDate = async () => {
      try {
        const response = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}/logs`), {
          credentials: "include",
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        const logs = response.ok && result?.success && Array.isArray(result.data) ? result.data : [];
        const createdFromDate = getRecurringCreatedFromDateFromLogs(logs, displayedSnapshot?.date);
        setRecurringSourceDateFromLogs(createdFromDate);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.warn("[AppointmentHistoryView] Failed to load recurring source log:", error);
        }
      }
    };

    loadRecurringCreatedFromDate();

    return () => controller.abort();
  }, [
    open,
    displayedAppointmentId,
    displayedSnapshot?.date,
  ]);

  if (!displayedSnapshot) return null;

  const appointmentDate = new Date(displayedSnapshot.date);
  const formattedDate = Number.isNaN(appointmentDate.getTime()) ? String(displayedSnapshot.date || "No date") : appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const resolvedLogDate = logDate || displayedSnapshot.changedAt || displayedSnapshot.updatedAt || displayedSnapshot.createdAt || new Date().toISOString();
  const isDateOnlyLog = typeof resolvedLogDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(resolvedLogDate);
  const parsedLogDate = new Date(isDateOnlyLog ? `${resolvedLogDate}T00:00:00` : resolvedLogDate);
  const snapshotDate = Number.isNaN(parsedLogDate.getTime())
    ? String(resolvedLogDate)
    : isDateOnlyLog
      ? parsedLogDate.toLocaleDateString()
      : parsedLogDate.toLocaleString();
  const typeName = resolveAppointmentTypeName(displayedSnapshot.type, displayedSnapshot.customType);
  const patientName = getAppointmentPatientDisplayName(displayedSnapshot, patientRecord);
  const resolvedPatientImage = resolveImageSource(getPatientProfilePicture(displayedSnapshot, patientRecord));
  const snapshotPatientDob =
    displayedSnapshot?.patientDateOfBirth ||
    displayedSnapshot?.patient?.dateOfBirth ||
    displayedSnapshot?.patient?.birthDate ||
    displayedSnapshot?.patient?.dob ||
    displayedSnapshot?.patient?.birthday ||
    displayedSnapshot?.patientBirthDate ||
    displayedSnapshot?.patientBirthday;
  const rawDisplayedDoctorName = resolveDoctorName(displayedSnapshot.doctor || displayedSnapshot.doctorName || displayedSnapshot.doctorId);
  const doctorRecord = findDoctorForSnapshot(doctors, displayedSnapshot) || doctors.find((doctor: any) =>
    String(doctor.id) === String(displayedSnapshot.doctorId || rawDisplayedDoctorName) ||
    String(doctor.name) === String(rawDisplayedDoctorName) ||
    normalizeDoctorName(doctor.name) === normalizeDoctorName(rawDisplayedDoctorName)
  );
  const displayedDoctorName = normalizeDoctorName(rawDisplayedDoctorName)
    ? resolveDoctorName(doctorRecord?.name || rawDisplayedDoctorName)
    : "";
  const doctorImage =
    displayedSnapshot.doctorProfile ||
    displayedSnapshot.doctorProfilePicture ||
    displayedSnapshot.doctorPhoto ||
    displayedSnapshot.doctor?.profilePicture ||
    displayedSnapshot.doctor?.profilePictureUrl ||
    doctorRecord?.profilePicture ||
    (doctorRecord as any)?.profilePictureUrl;

  const resolvedDoctorImage = resolveImageSource(pickImageSource(doctorImage));

  // Prepare previous / next state values for explicit change lines
  const prevState = displayedSnapshot?.previousState || null;
  const nextState = displayedSnapshot?.newState || displayedSnapshot || null;
  const recurrenceState = getBookingRecurrenceState(displayedSnapshot, displayedSnapshot ? [displayedSnapshot] : []);
  const recurrenceNextDate = recurrenceState.generatedAppointmentDate ||
    getBookingRecurringNextDate({
      appointmentDate: nextState?.date || displayedSnapshot.date,
      recurrenceOption: recurrenceState.recurrenceOption,
      customRecurrenceDate: recurrenceState.customRecurrenceDate,
    });
  const recurrenceNextDateLabel = formatBookingRecurringDate(recurrenceNextDate);
  const recurrenceSourceDate = getRecurringCreatedFromDate(
    recurrenceState.recurrence,
    nextState?.date || displayedSnapshot.date
  ) || recurringSourceDateFromLogs;
  const recurrenceSourceDateLabel = formatBookingRecurringDate(recurrenceSourceDate);
  const shouldShowRecurrenceSummary = Boolean(
    recurrenceState.isRecurring ||
    recurrenceState.recurrence ||
    recurrenceState.generatedAppointmentId ||
    recurrenceState.generatedAppointmentDate ||
    recurrenceSourceDate
  );

  const prevPatientName = prevState ? resolvePatientName(prevState) : null;
  const nextPatientName = nextState ? resolvePatientName(nextState) : patientName;

  const prevTreatmentName = prevState ? resolveAppointmentTypeName(prevState.type, prevState.customType) : null;
  const nextTreatmentName = nextState ? resolveAppointmentTypeName(nextState.type, nextState.customType) : typeName;

  // Price calculations: account for `discount` on snapshots (appointments may store `discount`)
  const getBasePrice = (s: any) => (s ? pickNumericValue(s.price, s.amount, s.totalPrice) : null);
  const getDiscountValue = (s: any) => {
    const d = s ? pickNumericValue(s.discount) : null;
    return Number(d ?? 0);
  };

  const prevBase = getBasePrice(prevState);
  const prevDiscount = prevState ? getDiscountValue(prevState) : 0;
  const prevPrice = prevBase !== null ? Math.max(0, Number(prevBase) - Number(prevDiscount)) : null;

  const nextBase = getBasePrice(nextState) ?? getBasePrice(displayedSnapshot);
  const nextDiscount = nextState ? (getDiscountValue(nextState) || getDiscountValue(displayedSnapshot)) : getDiscountValue(displayedSnapshot);
  const nextPrice = nextBase !== null ? Math.max(0, Number(nextBase) - Number(nextDiscount)) : null;

  // Values for rendering: prefer next (current) values, fallback to previous or raw snapshot
  const displayedBasePrice = nextBase ?? prevBase ?? pickNumericValue(displayedSnapshot.price) ?? 0;
  const displayedDiscountAmount = Number(nextDiscount ?? prevDiscount ?? pickNumericValue(displayedSnapshot.discount) ?? 0);
  const displayedEffectivePrice = nextPrice ?? prevPrice ?? Math.max(0, Number(displayedBasePrice) - Number(displayedDiscountAmount));

  // Parse numeric remaining balance (accepts numbers or currency strings)
  const parseCurrencyNumber = (v: any) => {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const cleaned = String(v).replace(/[^0-9.-]/g, '');
    const n2 = Number(cleaned);
    return Number.isFinite(n2) ? n2 : null;
  };

  const displayedBalanceNumeric = parseCurrencyNumber(displayedSnapshot.balance ?? displayedSnapshot.remaining ?? displayedSnapshot.balanceAmount);

  const prevStatus = prevState?.status || null;
  const nextStatus = nextState?.status || displayedSnapshot?.status || null;

  const prevPaymentStatus = prevState?.paymentStatus || null;
  const nextPaymentStatus = nextState?.paymentStatus || displayedSnapshot?.paymentStatus || null;

  const prevStatusNorm = normalizeBookingHistoryStatus(prevStatus);
  const nextStatusNorm = normalizeBookingHistoryStatus(nextStatus || displayedSnapshot?.status);
  const prevPaymentStatusNorm = normalizeBookingHistoryStatus(prevPaymentStatus);
  const nextPaymentStatusNorm = normalizeBookingHistoryStatus(nextPaymentStatus || displayedSnapshot?.paymentStatus);
  const displayedStatusColors = getDefaultAppointmentStatusColors(nextStatus || displayedSnapshot?.status);
  const displayedPaymentStatusColors = getDefaultPaymentStatusColors(nextPaymentStatus || displayedSnapshot?.paymentStatus);

  const prevScheduleLabel = prevState ? `${new Date(prevState.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} ${formatAppointmentTimeRange(prevState.time, prevState.duration)}` : null;
  const nextScheduleLabel = nextState ? `${new Date(nextState.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} ${formatAppointmentTimeRange(nextState.time, nextState.duration)}` : null;
  const changedByName = displayedSnapshot.changedByName || appointmentSnapshot?.changedByName;
  const isPastSnapshot = snapshotState === "historical";
  // Consider the snapshot to be a "log view" only when it's actually historical.
  // Many snapshots reconstructed from logs include `previousState`/`newState` metadata
  // but may represent the most-recent (current) state — those should not be shown as
  // historical. Use `snapshotState` (which prefers `_isHistorical` when available)
  // as the authoritative source.
  const openedFromLog = isPastSnapshot;

  const isLogView = isPastSnapshot; // authoritative
  const explicitSnapshotPaymentAmount = getExplicitSnapshotPaymentAmount(displayedSnapshot);
  const snapshotPaymentAmount = isLogView
    ? // historical log: show any explicit payment amount recorded on the log (or 0)
      explicitSnapshotPaymentAmount ?? 0
    : // current view: prefer explicit snapshot payment if present, else fall back to latest payment log amount
      (explicitSnapshotPaymentAmount && explicitSnapshotPaymentAmount > 0 ? explicitSnapshotPaymentAmount : latestPaymentLogAmount ?? 0);

  // Detect payment logs: explicit payment markers, log/change type that mentions "payment",
  // or transaction identifiers produced by the seeder like `SEED-PAY-0003`.
  const _txnId = String(
    displayedSnapshot?._paymentTransactionId ||
    displayedSnapshot?._transactionId ||
    displayedSnapshot?.transactionId ||
    displayedSnapshot?.transaction?.transactionId ||
    displayedSnapshot?.id ||
    ""
  ).trim();
  const isSeedPaymentId = _txnId ? /^seed-?pay-/i.test(_txnId) : false;

  const isPaymentLogSnapshot = Boolean(
    (displayedSnapshot?.logType && String(displayedSnapshot.logType).toLowerCase().includes("payment")) ||
    (displayedSnapshot?.changeType && String(displayedSnapshot.changeType).toLowerCase().includes("payment")) ||
    (explicitSnapshotPaymentAmount !== null && explicitSnapshotPaymentAmount > 0) ||
    isSeedPaymentId
  );

  // Compute total paid (price - remaining balance) when possible, fallback to snapshot payment
  const totalPaidAmount = (displayedBalanceNumeric !== null && Number.isFinite(Number(displayedEffectivePrice)))
    ? Math.max(0, Number(displayedEffectivePrice) - Number(displayedBalanceNumeric))
    : (snapshotPaymentAmount ?? 0);

  const displayedBalanceLabel = displayedBalanceNumeric !== null
    ? `₱${Number(displayedBalanceNumeric).toLocaleString()}`
    : (displayedSnapshot.balance !== undefined && displayedSnapshot.balance !== null ? String(displayedSnapshot.balance) : '₱0');

  const latestStateForComparison = latestComparisonSnapshot ? getComparableSnapshotState(latestComparisonSnapshot) : null;
  const formatCurrencyLabel = (value: number) => `\u20b1${Number(value).toLocaleString()}`;
  const normalizeNumberComparison = (value: unknown) => {
    const numeric = parseCurrencyNumber(value);
    return numeric === null ? normalizeComparableText(value) : String(numeric);
  };
  const formatLongDate = (value: unknown) => {
    const date = new Date(String(value || ""));
    return Number.isNaN(date.getTime()) ? formatChangeValue(value || "No date") : date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  const getPatientIdentity = (snapshot: any) => {
    const patient = snapshot?.patient;
    if (patient && typeof patient !== "string" && patient.id) return String(patient.id);
    return String(snapshot?.patientId || snapshot?.patient_id || "").trim();
  };
  const resolveDoctorDisplayNameFromSnapshot = (snapshot: any) => {
    const rawName = resolveDoctorName(snapshot?.doctor || snapshot?.doctorName || snapshot?.doctorId);
    const normalizedRawName = normalizeDoctorName(rawName);
    if (!normalizedRawName) return "";

    const matchedDoctor = findDoctorForSnapshot(doctors, snapshot) || doctors.find((doctor: any) =>
      String(doctor.id) === String(snapshot?.doctorId || rawName) ||
      String(doctor.name) === String(rawName) ||
      normalizeDoctorName(doctor.name) === normalizedRawName
    );

    return resolveDoctorName(matchedDoctor?.name || rawName);
  };

  const latestStatus = latestStateForComparison?.status;
  const latestPaymentStatus = latestStateForComparison?.paymentStatus;
  const latestBalanceNumeric = latestStateForComparison
    ? parseCurrencyNumber(latestStateForComparison.balance ?? latestStateForComparison.remaining ?? latestStateForComparison.balanceAmount)
    : null;
  const latestBasePrice = getBasePrice(latestStateForComparison);
  const latestDiscountAmount = latestStateForComparison ? getDiscountValue(latestStateForComparison) : 0;
  const latestEffectivePrice = latestBasePrice !== null ? Math.max(0, Number(latestBasePrice) - Number(latestDiscountAmount)) : null;
  const latestPatientName = latestStateForComparison ? resolvePatientName(latestStateForComparison) : "";
  const latestDoctorDisplayName = latestStateForComparison ? resolveDoctorDisplayNameFromSnapshot(latestStateForComparison) : "";
  const latestTimeLabel = latestStateForComparison ? formatAppointmentTimeRange(latestStateForComparison.time, latestStateForComparison.duration) : "";
  const displayedTimeLabel = formatAppointmentTimeRange(displayedSnapshot.time, displayedSnapshot.duration);
  const latestHasTreatment = Boolean(latestStateForComparison && (latestStateForComparison.type !== undefined || latestStateForComparison.customType));
  const latestTreatmentName = latestHasTreatment ? resolveAppointmentTypeName(latestStateForComparison.type, latestStateForComparison.customType) : "";
  const latestTotalPaidAmount = latestBalanceNumeric !== null && latestEffectivePrice !== null
    ? Math.max(0, Number(latestEffectivePrice) - Number(latestBalanceNumeric))
    : null;
  const displayedNotesComparisonText = displayedSnapshot.notes || (displayedSnapshot.status === 'cancelled' ? displayedSnapshot.cancellationReason || "" : "");
  const latestNotesComparisonText = latestStateForComparison
    ? latestStateForComparison.notes || (latestStateForComparison.status === 'cancelled' ? latestStateForComparison.cancellationReason || "" : "")
    : undefined;
  const displayedNotesText = displayedNotesComparisonText || "No additional notes provided for this snapshot.";
  const displayedTreatmentNotesComparisonText = getBookingTreatmentNotesValue(displayedSnapshot);
  const latestTreatmentNotesComparisonText = latestStateForComparison
    ? getBookingTreatmentNotesValue(latestStateForComparison)
    : undefined;
  const displayedTreatmentNotesText = displayedTreatmentNotesComparisonText || "No treatment notes provided for this snapshot.";

  const statusCurrentChange = createCurrentFieldChange(
    "status",
    nextStatus || displayedSnapshot.status,
    latestStatus,
    formatBookingHistoryStatusLabel(nextStatus || displayedSnapshot.status),
    formatBookingHistoryStatusLabel(latestStatus),
    normalizeBookingHistoryStatus
  );
  const paymentStatusCurrentChange = createCurrentFieldChange(
    "payment status",
    nextPaymentStatus || displayedSnapshot.paymentStatus,
    latestPaymentStatus,
    formatBookingHistoryStatusLabel(nextPaymentStatus || displayedSnapshot.paymentStatus),
    formatBookingHistoryStatusLabel(latestPaymentStatus),
    normalizeBookingHistoryStatus
  );
  const balanceCurrentChange = createCurrentFieldChange(
    "remaining balance",
    displayedBalanceNumeric,
    latestBalanceNumeric,
    displayedBalanceLabel,
    latestBalanceNumeric !== null ? formatCurrencyLabel(latestBalanceNumeric) : undefined,
    normalizeNumberComparison
  );
  const patientCurrentChange = createCurrentFieldChange(
    "patient",
    getPatientIdentity(displayedSnapshot) || patientName,
    latestStateForComparison ? getPatientIdentity(latestStateForComparison) || latestPatientName : undefined,
    patientName,
    latestPatientName
  );
  const doctorCurrentChange = createCurrentFieldChange(
    "assigned doctor",
    displayedDoctorName || "No doctor assigned",
    latestStateForComparison ? latestDoctorDisplayName || "No doctor assigned" : undefined,
    displayedDoctorName || "No doctor assigned",
    latestDoctorDisplayName || "No doctor assigned",
    normalizeDoctorName
  );
  const dateCurrentChange = createCurrentFieldChange(
    "date",
    displayedSnapshot.date,
    latestStateForComparison?.date,
    formattedDate,
    latestStateForComparison ? formatLongDate(latestStateForComparison.date) : undefined,
    normalizeComparableDate
  );
  const timeCurrentChange = createCurrentFieldChange(
    "time slot",
    `${displayedSnapshot.time || ""}|${displayedSnapshot.duration || ""}`,
    latestStateForComparison ? `${latestStateForComparison.time || ""}|${latestStateForComparison.duration || ""}` : undefined,
    displayedTimeLabel,
    latestTimeLabel
  );
  const serviceCurrentChange = createCurrentFieldChange(
    "service",
    typeName,
    latestHasTreatment ? latestTreatmentName : undefined,
    typeName,
    latestTreatmentName
  );
  const priceCurrentChange = createCurrentFieldChange(
    "service price",
    displayedEffectivePrice,
    latestEffectivePrice,
    formatCurrencyLabel(Number(displayedEffectivePrice) || 0),
    latestEffectivePrice !== null ? formatCurrencyLabel(latestEffectivePrice) : undefined,
    normalizeNumberComparison
  );
  const totalPaidCurrentChange = createCurrentFieldChange(
    "total amount paid",
    totalPaidAmount,
    latestTotalPaidAmount,
    formatCurrencyLabel(Number(totalPaidAmount) || 0),
    latestTotalPaidAmount !== null ? formatCurrencyLabel(latestTotalPaidAmount) : undefined,
    normalizeNumberComparison
  );
  const cancellationReasonCurrentChange = createCurrentFieldChange(
    "cancellation reason",
    displayedSnapshot.cancellationReason,
    latestStateForComparison ? latestStateForComparison.cancellationReason || "" : undefined,
    displayedSnapshot.cancellationReason || "Not set",
    latestStateForComparison?.cancellationReason || "Not set"
  );
  const notesCurrentChange = createCurrentFieldChange(
    "notes",
    displayedNotesComparisonText,
    latestNotesComparisonText,
    displayedNotesComparisonText || "No notes",
    latestNotesComparisonText || "No notes"
  );
  const treatmentNotesCurrentChange = createCurrentFieldChange(
    "treatment notes",
    displayedTreatmentNotesComparisonText,
    latestTreatmentNotesComparisonText,
    displayedTreatmentNotesComparisonText || "No treatment notes",
    latestTreatmentNotesComparisonText || "No treatment notes"
  );

  const currentFieldChanges = [
    statusCurrentChange,
    paymentStatusCurrentChange,
    balanceCurrentChange,
    patientCurrentChange,
    doctorCurrentChange,
    dateCurrentChange,
    timeCurrentChange,
    serviceCurrentChange,
    priceCurrentChange,
    totalPaidCurrentChange,
    cancellationReasonCurrentChange,
    notesCurrentChange,
    treatmentNotesCurrentChange,
  ];
  const hasLaterChanges = Boolean(
    latestStateForComparison &&
    snapshotState !== "historical" &&
    currentFieldChanges.some(Boolean)
  );
  const showsLogSnapshotState = isPastSnapshot || hasLaterChanges;
  const stateLabel = showsLogSnapshotState ? "Log" : "Current";
  const stateBadgeClass = showsLogSnapshotState
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const StateIcon = showsLogSnapshotState ? History : CheckCircle2;
  const timestampPrefix = showsLogSnapshotState ? "Logged on" : "Current as of";
  const stateTooltipText = isPastSnapshot
    ? 'Older log. Use "Latest" for current details.'
    : 'This log has later changes. Use "Latest" for current details.';

  const patientChanged = isPatientChange(displayedSnapshot);
  const changeSuffix = patientChanged ? "Patient Changed" : (changedByName ? `by ${changedByName}` : "");

  const appointmentId = displayedAppointmentId;
  const canOpenAppointment = Boolean(!actionsDisabled && appointmentId && !showsLogSnapshotState && onOpenAppointment && !isAppointmentOpen);
  const canRestoreNotification = Boolean(actionsDisabled && restoreNotificationId && onRestoreNotification);

  const viewLatestSnapshot = () => {
    if (appointmentId && typeof onViewCurrent === "function") {
      onViewCurrent(appointmentId);
      return;
    }

    fetchLatestLogSnapshot();
  };

  // Action handlers mirroring RequestsView behavior
  const openApproveConfirm = (snap: any) => {
    setPendingActionSnapshot(snap);
    setIsApproveConfirmOpen(true);
  };

  const openRejectConfirm = (snap: any) => {
    setPendingActionSnapshot(snap);
    setIsRejectConfirmOpen(true);
  };

  const performApprove = async () => {
    if (!pendingActionSnapshot) return;
    setIsProcessingAction(true);
    try {
      const currentStatus = normalizeBookingHistoryStatus(pendingActionSnapshot?.status || displayedSnapshot?.status || "");
      let newStatus = "scheduled";
      if (currentStatus === "tbd") newStatus = "completed";
      const idToUpdate = String(pendingActionSnapshot.id || displayedAppointmentId || "");
      await updateAppointment(idToUpdate, { status: newStatus });
      toast.success("Appointment updated");
      // trigger a global refresh event used in other views
      setTimeout(() => window.dispatchEvent(new Event('refreshNotifications')), 500);
      setIsApproveConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update appointment");
    } finally {
      setIsProcessingAction(false);
      setPendingActionSnapshot(null);
    }
  };

  const performReject = async () => {
    if (!pendingActionSnapshot) return;
    setIsProcessingAction(true);
    try {
      const idToUpdate = String(pendingActionSnapshot.id || displayedAppointmentId || "");
      await updateAppointment(idToUpdate, { status: "cancelled" });
      toast.success("Appointment cancelled");
      setTimeout(() => window.dispatchEvent(new Event('refreshNotifications')), 500);
      setIsRejectConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel appointment");
    } finally {
      setIsProcessingAction(false);
      setPendingActionSnapshot(null);
    }
  };

  const fetchLatestLogSnapshot = async () => {
    if (!appointmentId) {
      toast.error("No appointment id available for logs");
      return;
    }

    setIsFetchingLogs(true);
    try {
      const res = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}/logs`), {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.message || "Failed to fetch appointment logs");
        return;
      }

      const logs = Array.isArray(payload.data) ? payload.data : [];
      if (!logs.length) {
        toast.error("No logs found for this appointment");
        return;
      }

      // Server returns logs ordered desc; take the first as the most recent
      const latest = logs[0];
      const snap = latest.newState && Object.keys(latest.newState).length > 0 ? latest.newState : latest.previousState;
      if (!snap) {
        toast.error("No snapshot data available in latest log");
        return;
      }

      // Attach metadata
      snap.id = snap.id || appointmentId;
      snap.changedAt = latest.changedAt;
      snap.changedByName = latest.changedByName;

      setDisplayedSnapshot(snap);
      setSnapshotState("current");
      setLatestComparisonSnapshot(null);
    } catch (err) {
      console.error("Failed to load logs:", err);
      toast.error("Failed to load appointment logs");
    } finally {
      setIsFetchingLogs(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[480px] overflow-hidden p-0 sm:p-0 rounded-[2.5rem]">
        <DialogHeader className="bg-white border-b border-slate-50">
          <div className="flex w-full flex-col gap-2 p-5 pb-3 pr-10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-primary">
                <Clock className="w-4 h-4 shrink-0" />
                <span className="text-base tracking-tight font-black">Snapshot</span>
                {showsLogSnapshotState ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 cursor-help ${stateBadgeClass}`}>
                        <StateIcon className="h-3 w-3" />
                        {stateLabel}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] text-center bg-amber-50 text-amber-800 border-amber-200">
                      {stateTooltipText}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${stateBadgeClass}`}>
                    <StateIcon className="h-3 w-3" />
                    {stateLabel}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="truncate text-[10px] font-medium text-slate-400 mt-0.5 uppercase tracking-widest">
                {timestampPrefix} {snapshotDate}{changeSuffix ? ` • ${changeSuffix}` : ""}
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2 shrink-0 sm:ml-2">
              {canOpenAppointment ? (
                <Button
                  className="h-8 rounded-xl bg-blue-600 px-3 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 transition-all active:scale-95"
                  title="Open this appointment"
                  onClick={() => onOpenAppointment?.(String(appointmentId), displayedSnapshot)}
                >
                  <CalendarIcon className="w-3 h-3 mr-1.5" />
                  Open
                </Button>
              ) : null}
              {showsLogSnapshotState ? (
                <Button
                  className="h-8 rounded-xl bg-slate-100 px-3 text-[11px] font-bold text-slate-600 shadow-none hover:bg-slate-200 transition-all active:scale-95"
                  title={appointmentId ? "Open the current appointment snapshot" : "No appointment id available"}
                  disabled={!appointmentId || isFetchingLogs}
                  onClick={viewLatestSnapshot}
                >
                  <RefreshCw className={`w-3 h-3 mr-1.5 ${isFetchingLogs ? "animate-spin" : ""}`} />
                  Latest
                </Button>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-2.5 px-5 py-4 max-h-[70vh] overflow-y-auto pr-3 custom-scrollbar bg-slate-50/30">
          {/* Top Summary Cards - Dynamic alignment */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white p-3 rounded-[1.25rem] border border-slate-200/50 shadow-sm flex flex-col justify-start">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[8px] uppercase text-slate-400 font-bold tracking-[0.1em]">Status</Label>
                <CurrentChangeIndicator change={statusCurrentChange} />
              </div>
              <div className="flex flex-col">
                <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase ${displayedStatusColors.bgColor} ${displayedStatusColors.textColor}`}>
                  {formatBookingHistoryStatusLabel(nextStatus || displayedSnapshot.status)}
                </span>
                {prevStatus && nextStatus && prevStatusNorm && nextStatusNorm && !isInsignificantStatus(prevStatusNorm) && prevStatusNorm !== nextStatusNorm ? (
                  <p className="text-[9px] text-slate-400 font-bold italic truncate flex items-center gap-1 mt-1">
                    <History className="w-2.5 h-2.5" />
                    Was {formatBookingHistoryStatusLabel(prevStatus)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="bg-white p-3 rounded-[1.25rem] border border-slate-200/50 shadow-sm flex flex-col justify-start">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[8px] uppercase text-slate-400 font-bold tracking-[0.1em]">Payment</Label>
                <CurrentChangeIndicator change={paymentStatusCurrentChange} />
              </div>
              <div className="flex flex-col">
                <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase ${displayedPaymentStatusColors.bgColor} ${displayedPaymentStatusColors.textColor}`}>
                  {formatBookingHistoryStatusLabel(nextPaymentStatus || displayedSnapshot.paymentStatus)}
                </span>
                {prevPaymentStatus && nextPaymentStatus && prevPaymentStatusNorm && nextPaymentStatusNorm && !isInsignificantStatus(prevPaymentStatusNorm) && prevPaymentStatusNorm !== nextPaymentStatusNorm ? (
                  <p className="text-[9px] text-slate-400 font-bold italic truncate flex items-center gap-1 mt-1">
                    <History className="w-2.5 h-2.5" />
                    Was {formatBookingHistoryStatusLabel(prevPaymentStatus)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Balance Highlight Card - Sleeker */}
          <div className="bg-white p-3 rounded-[1.25rem] border border-primary/10 shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-[0.03]">
              <Banknote className="w-10 h-10 text-primary" />
            </div>
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-primary/5 p-1.5 rounded-lg border border-primary/10">
                <Banknote className="w-4 h-4 text-primary" />
              </div>
              <div>
                <Label className="text-[8px] uppercase text-primary/50 font-black tracking-widest mb-0.5 block">Balance</Label>
                <p className="text-[10px] font-bold text-slate-400">To be settled</p>
              </div>
            </div>
            <div className="text-right relative z-10">
              <div className="flex items-center justify-end gap-1.5">
                <p className="text-lg font-black text-primary tracking-tighter">{displayedBalanceLabel}</p>
                <CurrentChangeIndicator change={balanceCurrentChange} />
              </div>
            </div>
          </div>

          {/* Participants - More compact */}
          <div className="bg-white p-3 rounded-[1.25rem] border border-slate-200/50 shadow-sm grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5">
              <PatientAvatar src={resolvedPatientImage} name={patientName} dob={snapshotPatientDob} className="h-9 w-9 rounded-xl border border-slate-50 shadow-sm shrink-0" sizeClass="h-9 w-9 rounded-xl" />
              <div className="min-w-0">
                <Label className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-0.5 block">Patient</Label>
                <div className="flex min-w-0 items-center gap-1">
                  <p className="font-black text-slate-800 truncate text-[12px] leading-tight tracking-tight">{patientName}</p>
                  <CurrentChangeIndicator change={patientCurrentChange} />
                </div>
                {(() => {
                  if (!shouldShowPreviousInputChanges) return null;
                  if (isPastSnapshot && latestStateForComparison) {
                    const logPatient = getPatientIdentity(displayedSnapshot) || patientName;
                    const currentPatient = getPatientIdentity(latestStateForComparison) || latestPatientName;
                    if (logPatient && currentPatient && logPatient !== currentPatient && !isIgnorablePatientName(logPatient)) {
                      return (
                        <p className="text-[9px] font-bold text-blue-400/80 mt-0.5 truncate flex items-center gap-1">
                          <History className="w-2 h-2" /> {shortPatientLabel(logPatient)}
                        </p>
                      );
                    }
                  }
                  if (prevState && nextState && prevPatientName && nextPatientName && prevPatientName !== nextPatientName && !isIgnorablePatientName(prevPatientName)) {
                    return (
                      <p className="text-[9px] font-bold text-blue-400/80 mt-0.5 truncate flex items-center gap-1">
                        <History className="w-2 h-2" /> {shortPatientLabel(prevPatientName)}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            <div className="flex items-center gap-2.5 border-l border-slate-50 pl-3">
              <Avatar className="h-9 w-9 rounded-xl border border-slate-50 shadow-sm shrink-0">
                <AvatarImage src={resolvedDoctorImage} alt={displayedDoctorName || "Doctor"} className="object-cover" />
                <AvatarFallback className="rounded-xl bg-slate-50">
                  <Stethoscope className="w-4 h-4 text-emerald-400" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <Label className="text-[8px] uppercase text-slate-400 font-black tracking-widest mb-0.5 block">Doctor</Label>
                <div className="flex min-w-0 items-center gap-1">
                  <p className="font-black text-slate-800 truncate text-[12px] leading-tight tracking-tight">{displayedDoctorName || "Unassigned"}</p>
                  <CurrentChangeIndicator change={doctorCurrentChange} />
                </div>
                {(() => {
                  if (!shouldShowPreviousInputChanges) return null;
                  const prevDoc = prevState ? resolveDoctorDisplayNameFromSnapshot(prevState) : "";
                  const nextDoc = nextState ? resolveDoctorDisplayNameFromSnapshot(nextState) : "";
                  const prevDocNorm = prevDoc ? normalizeDoctorName(prevDoc) : "";
                  const nextDocNorm = nextDoc ? normalizeDoctorName(nextDoc) : "";
                  if (!prevState || !nextState || !prevDocNorm || !nextDocNorm || prevDocNorm === nextDocNorm) return null;
                  return (
                    <p className="text-[9px] font-bold text-blue-400/80 mt-0.5 truncate flex items-center gap-1">
                      <History className="w-2 h-2" /> {shortDoctorLabel(prevDoc)}
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Schedule Row - Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white p-3 rounded-[1.25rem] border border-slate-200/50 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <CalendarIcon className="w-2.5 h-2.5 text-blue-500" />
                <Label className="text-[8px] uppercase text-slate-400 font-black tracking-widest leading-none">Date</Label>
              </div>
              <div className="flex items-start gap-1">
                <p className="font-black text-slate-800 text-[12px] tracking-tight">{formattedDate}</p>
                <CurrentChangeIndicator change={dateCurrentChange} />
              </div>
              {prevState && nextState && prevState.date !== nextState.date && isValidDateValue(prevState.date) ? (
                <p className="text-[9px] font-bold text-blue-400/80 mt-0.5 flex items-center gap-1">
                  <History className="w-2 h-2" /> {new Date(prevState.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              ) : null}
            </div>

            <div className="bg-white p-3 rounded-[1.25rem] border border-slate-200/50 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-2.5 h-2.5 text-amber-500" />
                <Label className="text-[8px] uppercase text-slate-400 font-black tracking-widest leading-none">Time Slot</Label>
              </div>
              <div className="flex items-start gap-1">
                <p className="font-black text-slate-800 text-[12px] tracking-tight">{displayedTimeLabel}</p>
                <CurrentChangeIndicator change={timeCurrentChange} />
              </div>
              {prevState && nextState && (prevState.time !== nextState.time || (prevState.duration || 0) !== (nextState.duration || 0)) && isMeaningfulTime(prevState.time, prevState.duration) ? (
                <p className="text-[9px] font-bold text-blue-400/80 mt-0.5 flex items-center gap-1">
                  <History className="w-2 h-2" /> {formatAppointmentTimeRange(prevState.time, prevState.duration)}
                </p>
              ) : null}
            </div>
          </div>

          {shouldShowRecurrenceSummary && (
            <div className="bg-white p-3 rounded-[1.25rem] border border-slate-200/50 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <RefreshCw className="w-2.5 h-2.5 text-cyan-500 shrink-0" />
                  <Label className="text-[8px] uppercase text-slate-400 font-black tracking-widest leading-none">Recurring</Label>
                </div>
                <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${recurrenceState.isRecurring ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"}`}>
                  {recurrenceState.isRecurring ? "Yes" : "No"}
                </span>
              </div>
              {recurrenceState.isRecurring && recurrenceNextDateLabel ? (
                <p className="mt-2 text-[11px] font-black text-slate-800">
                  Next schedule: {recurrenceNextDateLabel}
                </p>
              ) : recurrenceSourceDateLabel ? (
                <p className="mt-2 text-[10px] font-bold text-slate-400">
                  Created from {recurrenceSourceDateLabel}
                </p>
              ) : null}
            </div>
          )}

          {/* Service & Financials - Sleeker */}
          <div className="bg-white rounded-[1.25rem] border border-slate-200/50 shadow-sm overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2.5">
              <Stethoscope className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="font-black text-slate-800 text-[13px] leading-tight tracking-tight truncate">{typeName}</p>
                  <CurrentChangeIndicator change={serviceCurrentChange} />
                </div>
              </div>
            </div>

            <div className="p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="inline-flex items-center gap-1.5 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                  Price
                  <CurrentChangeIndicator change={priceCurrentChange} />
                </span>
                <div className="text-right">
                  {prevPrice !== null && nextPrice !== null && Number(prevPrice) !== Number(nextPrice) && Number(prevPrice) > 0 ? (
                    <>
                      <div className="font-black text-slate-800 text-[12px]">₱{Number(nextPrice).toLocaleString()}</div>
                      <div className="text-[8px] font-black text-blue-400 uppercase flex items-center justify-end gap-1">
                        <History className="w-2 h-2" /> {Number(prevPrice).toLocaleString()}
                      </div>
                    </>
                  ) : (
                    (displayedDiscountAmount > 0) ? (
                      <>
                        <div className="text-[8px] text-slate-300 line-through font-bold">₱{Number(displayedBasePrice).toLocaleString()}</div>
                        <div className="font-black text-slate-800 text-[12px]">₱{Number(displayedEffectivePrice).toLocaleString()}</div>
                      </>
                    ) : (
                      <span className="font-black text-slate-800 text-[12px]">₱{(Number(displayedEffectivePrice) || 0).toLocaleString()}</span>
                    )
                  )}
                </div>
              </div>

              {(((isLogSnapshot(displayedSnapshot) || isPastSnapshot) && openedFromBookingModal) || isPaymentLogSnapshot) && (
                <div className="flex justify-between items-center py-0.5 border-t border-slate-50 pt-1.5">
                  <span className="text-emerald-500/80 font-black text-[9px] uppercase tracking-wider">Paid in Snapshot</span>
                  <span className="font-black text-emerald-600 text-[12px]">₱{snapshotPaymentAmount.toLocaleString()}</span>
                </div>
              )}

              {/* {totalPaidAmount !== null ? (
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-50">
                  <span className="inline-flex items-center gap-1.5 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                    Total Paid
                    <CurrentChangeIndicator change={totalPaidCurrentChange} />
                  </span>
                  <span className="font-black text-slate-800 text-[12px]">₱{Number(totalPaidAmount).toLocaleString()}</span>
                </div>
              ) : null} */}

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <History className="w-2.5 h-2.5 text-blue-400" />
                  <Label className="text-[8px] uppercase text-slate-400 font-black tracking-widest">Treatment Notes</Label>
                  <CurrentChangeIndicator change={treatmentNotesCurrentChange} />
                </div>
                <p className={`max-h-24 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-[10px] font-medium leading-relaxed custom-scrollbar ${
                  displayedTreatmentNotesComparisonText ? "text-slate-600" : "text-slate-400 italic"
                }`}>
                  {displayedTreatmentNotesText}
                </p>
              </div>
            </div>
          </div>

          {/* Cancellation Reason / Notes - Tighter */}
          {(displayedSnapshot.status === 'cancelled' && displayedSnapshot.cancellationReason) || displayedNotesComparisonText ? (
            <div className="bg-white p-3 rounded-[1.25rem] border border-slate-200/50 shadow-sm space-y-2.5">
              {displayedSnapshot.status === 'cancelled' && displayedSnapshot.cancellationReason && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-2.5 h-2.5 text-red-500" />
                    <Label className="text-[8px] uppercase text-red-600/60 font-black tracking-widest">Cancellation Reason</Label>
                    <CurrentChangeIndicator change={cancellationReasonCurrentChange} />
                  </div>
                  <p className="text-[10px] text-red-700/80 font-bold leading-relaxed pl-3 border-l-2 border-red-50 ml-1">{displayedSnapshot.cancellationReason}</p>
                </div>
              )}

              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <History className="w-2.5 h-2.5 text-slate-300" />
                  <Label className="text-[8px] uppercase text-slate-400 font-black tracking-widest">Remarks</Label>
                  <CurrentChangeIndicator change={notesCurrentChange} />
                </div>
                <p className="text-[10px] text-slate-500 font-medium whitespace-pre-wrap leading-relaxed italic border-l-2 border-slate-50 pl-3 py-0.5 ml-1">
                  {displayedNotesText}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Action Note */}
        {snapshotState === "current" &&
          !hasLaterChanges &&
          !actionsDisabled &&
          !isAppointmentOpen &&
          (nextStatusNorm === "reserved" || nextStatusNorm === "tbd") && (
            <div className="px-6 py-2 bg-amber-50/50 border-t border-b border-amber-100/50">
              <p className="text-[11px] text-amber-700 font-medium flex items-center justify-center gap-1.5 text-center">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {nextStatusNorm === "tbd" 
                  ? "Accept to mark this appointment as completed or cancel it if needed."
                  : "Accept to confirm this schedule or cancel the appointment request."
                }
              </p>
            </div>
          )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2 p-5 pt-3 bg-white border-t border-slate-50">
          {/* Accept/Cancel buttons for reserved appointments (current, not historical, and modal not open) */}
          {snapshotState === "current" &&
            !hasLaterChanges &&
            !actionsDisabled &&
            !isAppointmentOpen &&
            (nextStatusNorm === "reserved" || nextStatusNorm === "tbd") && (
              <div className="flex flex-1 gap-2">
                <Button
                  className="flex-1 rounded-2xl bg-emerald-600 h-10 text-xs font-black text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
                  onClick={() => openApproveConfirm(displayedSnapshot)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                  Accept
                </Button>
                <Button
                  className="flex-1 rounded-2xl bg-white h-10 border-red-100 text-xs font-black text-red-500 shadow-sm transition-all hover:bg-red-50 active:scale-95"
                  onClick={() => openRejectConfirm(displayedSnapshot)}
                  variant="outline"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-2" />
                  Decline
                </Button>
              </div>
            )}
          {canRestoreNotification ? (
            <Button
              className="flex-1 rounded-2xl bg-violet-600 h-10 text-xs font-black text-white shadow-sm transition-all hover:bg-violet-700 active:scale-95"
              onClick={async () => {
                await onRestoreNotification?.(restoreNotificationId!);
                onOpenChange(false);
              }}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Restore
            </Button>
          ) : null}
          <Button
            onClick={() => onOpenChange(false)}
            variant="ghost"
            className="flex-1 rounded-2xl h-10 text-xs font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ApproveRejectDialog
      open={isApproveConfirmOpen}
      onOpenChange={setIsApproveConfirmOpen}
      mode="approve"
      appointment={displayedSnapshot}
      onConfirm={performApprove}
      isProcessing={isProcessingAction}
    />

    <ApproveRejectDialog
      open={isRejectConfirmOpen}
      onOpenChange={setIsRejectConfirmOpen}
      mode="reject"
      appointment={displayedSnapshot}
      onConfirm={performReject}
      isProcessing={isProcessingAction}
    />
    </>
  );
}
