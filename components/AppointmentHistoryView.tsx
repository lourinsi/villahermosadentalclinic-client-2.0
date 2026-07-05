import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ApproveRejectDialog from "./ApproveRejectDialog";
import { Calendar as CalendarIcon, Clock, Stethoscope, Banknote, AlertTriangle, CheckCircle2, History, ArrowLeft, RefreshCw, X, MoreHorizontal, Eye, Pencil, Plus, User, Loader2, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PatientAvatar from "./PatientAvatar";
import { getAppointmentTypeName } from "@/lib/appointmentTypes";
import { formatTimeTo12h } from "@/lib/time-slots";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import { toast } from "sonner";
import { useDoctors } from "@/hooks/useDoctors";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import type { Appointment } from "@/hooks/useAppointments";
import { formatWordyDate } from "@/lib/utils";
import {
  formatBookingHistoryStatusLabel,
  formatBookingDateKey,
  formatBookingPaymentAdjustmentAmountLabel,
  getBookingPaymentAdjustment,
  getBookingTreatmentNotesValue,
  getBookingToothNumbersValue,
  normalizeBookingPaymentMethod,
  normalizeBookingHistoryStatus,
} from "./sharedBookingLogic";

import { getDefaultAppointmentStatusColors, getDefaultPaymentStatusColors } from "@/lib/status-colors";
import { findDoctorForSnapshot, normalizeDoctorIdentity } from "@/lib/doctor-identity";
import { getAppointmentPatientDisplayName } from "@/lib/patient-identity";
import { SelectDoctorModal } from "./SelectDoctorModal";

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
  return /^(none|null|undefined|unassigned|no doctor assigned|n\/a|n\.a\.?|na|-)$/.test(normalized) ? "" : normalized;
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
    const dateLabel = formatWordyDate(date, { fallback: String(date || "") });
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


const parseBookingDateTime = (date?: unknown, time?: unknown) => {
  const dateKey = formatBookingDateKey(date as any);
  if (!dateKey) return NaN;
  const [year, month, day] = dateKey.split("-").map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) return NaN;
  const [hours, minutes] = String(time || "").split(":").map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return new Date(year, month - 1, day).getTime();
  }
  return new Date(year, month - 1, day, hours, minutes).getTime();
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

const getInitials = (name?: string) =>
  String(name || "Doctor")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "DR";

const getEditablePaymentId = (payment: any) => {
  const explicitPaymentId = payment?.paymentId || payment?.paymentRecordId || payment?.id;
  return explicitPaymentId ? String(explicitPaymentId).trim() : "";
};

const getManagementBasePath = (pathname: string | null) => {
  if (pathname?.startsWith("/receptionist")) return "/receptionist";
  if (pathname?.startsWith("/admin")) return "/admin";
  if (pathname?.startsWith("/doctor")) return "/doctor";
  return "/admin";
};

export default function AppointmentHistoryView({ open, onOpenChange, appointmentSnapshot, logDate, onViewCurrent, onOpenAppointment, isAppointmentOpen, isHistorical, actionsDisabled = false, restoreNotificationId, onRestoreNotification, openedFromBookingModal = false, showPreviousInputChanges = true }: AppointmentHistoryViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [displayedSnapshot, setDisplayedSnapshot] = useState<any | null>(appointmentSnapshot);
  const [snapshotState, setSnapshotState] = useState<SnapshotState>(Boolean(isHistorical) ? "historical" : "current");
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [isAssignDoctorOpen, setIsAssignDoctorOpen] = useState(false);
  const [isAssigningDoctor, setIsAssigningDoctor] = useState(false);
  const [isOpeningPaymentEdit, setIsOpeningPaymentEdit] = useState(false);
  const [patientRecord, setPatientRecord] = useState<any | null>(null);
  const [latestPaymentLogAmount, setLatestPaymentLogAmount] = useState<number | null>(null);
  const [latestPaymentLogDate, setLatestPaymentLogDate] = useState<string>("");
  const [latestComparisonSnapshot, setLatestComparisonSnapshot] = useState<any | null>(null);
  const [snapshotHistory, setSnapshotHistory] = useState<Array<{ snapshot: any; snapshotState: SnapshotState }>>([]);
  const { doctors, isLoadingDoctors } = useDoctors(open ? 1 : undefined, { enabled: open });
  const displayedPatientId = displayedSnapshot?.patientId || displayedSnapshot?.patient?.id || "";
  const displayedAppointmentId = displayedSnapshot?.id || displayedSnapshot?.appointmentId || appointmentSnapshot?.id || appointmentSnapshot?.appointmentId || "";

  // Appointment action helpers (approve/reject) using central appointment modal hook
  const { updateAppointment, openEditModalById } = useAppointmentModal();
  const { openPaymentFor, openEditPaymentModal } = usePaymentModal();
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
    if (!open) {
      setSnapshotHistory([]);
    }
  }, [open]);

  const pushSnapshotHistory = (snapshot: any, state: SnapshotState) => {
    if (!snapshot) return;
    setSnapshotHistory((prev) => [...prev, { snapshot, snapshotState: state }]);
  };

  const goBackSnapshot = () => {
    const lastEntry = snapshotHistory[snapshotHistory.length - 1];
    if (!lastEntry) return;
    setSnapshotHistory((prev) => prev.slice(0, -1));
    setDisplayedSnapshot(lastEntry.snapshot);
    setSnapshotState(lastEntry.snapshotState);
    setLatestComparisonSnapshot(null);
  };

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
    setLatestPaymentLogDate("");

    const appointmentId = String(displayedAppointmentId || "").trim();
    if (
      !open ||
      !appointmentId
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
        const latestPositiveLog = logs.find((log: any) => Number(log?.amount || 0) > 0);
        const latestPositiveAmount = latestPositiveLog ? Number(latestPositiveLog.amount || 0) : undefined;

        setLatestPaymentLogAmount(latestPositiveAmount ?? 0);
        setLatestPaymentLogDate(
          latestPositiveLog?.paymentDate ||
          latestPositiveLog?.date ||
          latestPositiveLog?.createdAt ||
          latestPositiveLog?.changedAt ||
          ""
        );
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.warn("[AppointmentHistoryView] Failed to load payment logs:", error);
          setLatestPaymentLogAmount(0);
          setLatestPaymentLogDate("");
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

  if (!displayedSnapshot) return null;

  const formattedDate = formatWordyDate(displayedSnapshot.date, {
    fallback: String(displayedSnapshot.date || "No date"),
  });

  const resolvedLogDate = logDate || displayedSnapshot.changedAt || displayedSnapshot.updatedAt || displayedSnapshot.createdAt || new Date().toISOString();
  const isDateOnlyLog = typeof resolvedLogDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(resolvedLogDate);
  const snapshotDate = formatWordyDate(resolvedLogDate, {
    fallback: String(resolvedLogDate),
    includeTime: !isDateOnlyLog,
  });
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

  if (!displayedSnapshot) return null;

  const prevState = displayedSnapshot?.previousState || null;
  const nextState = displayedSnapshot?.newState || displayedSnapshot || null;

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

  const prevScheduleLabel = prevState ? `${formatWordyDate(prevState.date, { fallback: String(prevState.date || "No date") })} ${formatAppointmentTimeRange(prevState.time, prevState.duration)}` : null;
  const nextScheduleLabel = nextState ? `${formatWordyDate(nextState.date, { fallback: String(nextState.date || "No date") })} ${formatAppointmentTimeRange(nextState.time, nextState.duration)}` : null;
  const changedByName = displayedSnapshot.changedByName || appointmentSnapshot?.changedByName;
  const isPastSnapshot = snapshotState === "historical";
  // Consider the snapshot to be a "log view" only when it's actually historical.
  // Many snapshots reconstructed from logs include `previousState`/`newState` metadata
  // but may represent the most-recent (current) state — those should not be shown as
  // historical. Use `snapshotState` (which prefers `_isHistorical` when available)
  // as the authoritative source.
  const openedFromLog = isPastSnapshot;

  const explicitSnapshotPaymentAmount = getExplicitSnapshotPaymentAmount(displayedSnapshot);
  const paymentAdjustment = getBookingPaymentAdjustment(displayedSnapshot);
  const isPaymentAdjustmentSnapshot = paymentAdjustment.isAdjustment;

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
    isPaymentAdjustmentSnapshot ||
    isSeedPaymentId
  );
  const paidInSnapshotAmount = explicitSnapshotPaymentAmount !== null && explicitSnapshotPaymentAmount > 0
    ? explicitSnapshotPaymentAmount
    : 0;
  const hasPaidInSnapshot = !isPaymentAdjustmentSnapshot && isPaymentLogSnapshot && paidInSnapshotAmount > 0;
  const latestPaymentAmount = Number(latestPaymentLogAmount || 0);
  const shouldShowLatestPayment = !isPaymentAdjustmentSnapshot && !hasPaidInSnapshot && latestPaymentAmount > 0;
  const shouldShowPaymentLine = isPaymentAdjustmentSnapshot || hasPaidInSnapshot || shouldShowLatestPayment;
  const snapshotPaymentLabel = isPaymentAdjustmentSnapshot
    ? paymentAdjustment.delta < 0
      ? "Payment Reduced"
      : "Payment Adjusted"
    : hasPaidInSnapshot ? "Paid in Snapshot" : "Latest Payment";
  const snapshotPaymentAmount = hasPaidInSnapshot
    ? paidInSnapshotAmount
    : shouldShowLatestPayment
      ? latestPaymentAmount
      : 0;
  const snapshotPaymentAmountLabel = isPaymentAdjustmentSnapshot
    ? formatBookingPaymentAdjustmentAmountLabel(displayedSnapshot)
    : `\u20b1${snapshotPaymentAmount.toLocaleString()}`;

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
  const formatLongDate = (value: unknown) =>
    formatWordyDate(String(value || ""), {
      fallback: formatChangeValue(value || "No date"),
    });
  const paidInSnapshotPaymentDateRaw =
    displayedSnapshot?.paymentDate ||
    displayedSnapshot?.newState?.paymentDate ||
    displayedSnapshot?.previousState?.paymentDate ||
    displayedSnapshot?.paymentDetails?.date ||
    displayedSnapshot?.transaction?.date ||
    appointmentSnapshot?.paymentDate ||
    appointmentSnapshot?.newState?.paymentDate ||
    displayedSnapshot?.changedAt ||
    logDate ||
    displayedSnapshot?.createdAt ||
    displayedSnapshot?.newState?.createdAt ||
    appointmentSnapshot?.createdAt;
  const latestPaymentDateRaw =
    latestComparisonSnapshot?.paymentDate ||
    latestComparisonSnapshot?.newState?.paymentDate ||
    appointmentSnapshot?.paymentDate ||
    appointmentSnapshot?.newState?.paymentDate ||
    latestPaymentLogDate ||
    latestComparisonSnapshot?.createdAt ||
    appointmentSnapshot?.createdAt;
  const snapshotPaymentDateRaw = hasPaidInSnapshot
    ? paidInSnapshotPaymentDateRaw
    : shouldShowLatestPayment
      ? latestPaymentDateRaw
      : "";
  const snapshotPaymentDateLabel = snapshotPaymentDateRaw ? formatLongDate(snapshotPaymentDateRaw) : "";
  const snapshotPaymentMethodLabel = normalizeBookingPaymentMethod(
    displayedSnapshot?.paymentMethod ||
    displayedSnapshot?.newState?.paymentMethod ||
    displayedSnapshot?.paymentDetails?.method ||
    displayedSnapshot?.transaction?.method ||
    appointmentSnapshot?.paymentMethod ||
    appointmentSnapshot?.newState?.paymentMethod
  );
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
  const displayedToothNumbersText = getBookingToothNumbersValue(displayedSnapshot);
  const latestToothNumbersText = latestStateForComparison
    ? getBookingToothNumbersValue(latestStateForComparison)
    : undefined;

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
    `${typeName}|${displayedToothNumbersText}`,
    latestHasTreatment ? `${latestTreatmentName}|${latestToothNumbersText || ""}` : undefined,
    displayedToothNumbersText ? `${typeName} - Tooth # ${displayedToothNumbersText}` : typeName,
    latestToothNumbersText ? `${latestTreatmentName} - Tooth # ${latestToothNumbersText}` : latestTreatmentName
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
  const canOpenAppointment = Boolean(!actionsDisabled && appointmentId && !showsLogSnapshotState && !isAppointmentOpen);
  const canUseSnapshotActions = Boolean(!actionsDisabled && appointmentId);
  const managementBasePath = getManagementBasePath(pathname);
  const patientRouteName = isIgnorablePatientName(patientName) ? "" : patientName;
  const doctorRouteName = displayedDoctorName || "";
  const canGoToPatient = Boolean(patientRouteName);
  const canGoToDoctor = Boolean(doctorRouteName);
  const canAssignDoctor = Boolean(canUseSnapshotActions && !showsLogSnapshotState && !displayedDoctorName);
  const canRestoreNotification = Boolean(actionsDisabled && restoreNotificationId && onRestoreNotification);
  const canShowSnapshotActions = Boolean(
    snapshotState === "current" &&
    !hasLaterChanges &&
    !actionsDisabled &&
    !isAppointmentOpen &&
    (nextStatusNorm === "reserved" || nextStatusNorm === "tbd")
  );
  const actionNoteText = nextStatusNorm === "tbd"
    ? "Accept to mark this appointment as completed or cancel it if needed."
    : "Accept to confirm this schedule or cancel the appointment request.";

  const getAppointmentForPayment = (): Appointment => ({
    ...displayedSnapshot,
    id: String(appointmentId),
    patientId: String(displayedPatientId || displayedSnapshot?.patientId || ""),
    patientName,
    date: String(displayedSnapshot?.date || ""),
    time: String(displayedSnapshot?.time || ""),
    type: Number.isFinite(Number(displayedSnapshot?.type)) ? Number(displayedSnapshot.type) : 0,
    customType: displayedSnapshot?.customType,
    price: Number(displayedBasePrice) || 0,
    discount: Number(displayedDiscountAmount) || 0,
    doctor: displayedDoctorName || resolveDoctorName(displayedSnapshot?.doctor || displayedSnapshot?.doctorName || ""),
    doctorId: displayedSnapshot?.doctorId,
    doctorName: displayedDoctorName || displayedSnapshot?.doctorName,
    duration: Number(displayedSnapshot?.duration) || undefined,
    notes: displayedSnapshot?.notes || "",
    treatmentNotes: displayedTreatmentNotesComparisonText || displayedSnapshot?.treatmentNotes,
    toothNumbers: displayedToothNumbersText || displayedSnapshot?.toothNumbers,
    serviceType: displayedSnapshot?.serviceType,
    status: displayedSnapshot?.status || "scheduled",
    paymentStatus: displayedSnapshot?.paymentStatus,
    paymentMethod: displayedSnapshot?.paymentMethod,
    paymentDate: displayedSnapshot?.paymentDate,
    balance: displayedBalanceNumeric ?? undefined,
    totalPaid: Number(totalPaidAmount) || 0,
    patient: displayedSnapshot?.patient,
  } as Appointment);

  const handleOpenAppointment = async () => {
    if (!appointmentId) {
      toast.error("No appointment id available");
      return;
    }

    if (onOpenAppointment) {
      onOpenAppointment(String(appointmentId), displayedSnapshot);
      return;
    }

    try {
      await openEditModalById(String(appointmentId));
    } catch (error) {
      console.error("[AppointmentHistoryView] Failed to open appointment:", error);
      toast.error("Failed to open appointment");
    }
  };

  const handleAddPayment = () => {
    if (!appointmentId) {
      toast.error("No appointment id available");
      return;
    }

    openPaymentFor(getAppointmentForPayment(), String(displayedPatientId || ""), patientName);
  };

  const handleEditPayment = async () => {
    if (!appointmentId) {
      toast.error("No appointment id available");
      return;
    }

    setIsOpeningPaymentEdit(true);
    try {
      const response = await fetch(apiUrl(`/api/payments/appointment/${encodeURIComponent(String(appointmentId))}`), {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const result = await response.json().catch(() => null);
      const payments = response.ok && result?.success && Array.isArray(result.data) ? result.data : [];
      const latestEditablePayment = payments.find((payment: any) => getEditablePaymentId(payment));

      if (!latestEditablePayment) {
        toast.error("No editable payment found for this appointment");
        return;
      }

      openEditPaymentModal(
        getEditablePaymentId(latestEditablePayment),
        latestEditablePayment,
        String(displayedPatientId || latestEditablePayment.patientId || ""),
        [getAppointmentForPayment()]
      );
    } catch (error) {
      console.error("[AppointmentHistoryView] Failed to open payment edit:", error);
      toast.error("Failed to open payment editor");
    } finally {
      setIsOpeningPaymentEdit(false);
    }
  };

  const goToPatient = () => {
    if (!canGoToPatient) {
      toast.error("No patient profile available");
      return;
    }

    if (managementBasePath === "/doctor") {
      router.push("/doctor/patients");
      return;
    }

    router.push(`${managementBasePath}/patients/${encodeURIComponent(patientRouteName)}`);
  };

  const goToDoctor = () => {
    if (!canGoToDoctor) {
      toast.error("No doctor profile available");
      return;
    }

    const doctorBasePath = managementBasePath === "/doctor" ? "/doctors" : `${managementBasePath}/doctors`;
    router.push(`${doctorBasePath}/${encodeURIComponent(doctorRouteName)}`);
  };

  const handleAssignDoctor = async (doctor: any) => {
    if (!appointmentId) {
      toast.error("No appointment id available");
      return;
    }

    setIsAssigningDoctor(true);
    try {
      const updated = await updateAppointment(String(appointmentId), {
        doctor: doctor.name,
        doctorId: doctor.id,
        doctorName: doctor.name,
      } as Partial<Appointment>);

      setDisplayedSnapshot((current: any) => ({
        ...current,
        ...updated,
        doctor: doctor.name,
        doctorId: doctor.id,
        doctorName: doctor.name,
        doctorProfile: doctor.profilePicture || doctor.profilePictureUrl || current?.doctorProfile,
        doctorProfilePicture: doctor.profilePicture || doctor.profilePictureUrl || current?.doctorProfilePicture,
      }));
      setLatestComparisonSnapshot(null);
      setIsAssignDoctorOpen(false);
      toast.success("Doctor assigned");
    } catch (error) {
      console.error("[AppointmentHistoryView] Failed to assign doctor:", error);
      toast.error("Failed to assign doctor");
    } finally {
      setIsAssigningDoctor(false);
    }
  };

  const viewLatestSnapshot = () => {
    if (!displayedSnapshot) return;
    pushSnapshotHistory(displayedSnapshot, snapshotState);

    if (appointmentId && typeof onViewCurrent === "function") {
      onViewCurrent(appointmentId);
      return;
    }

    fetchLatestLogSnapshot();
  };

  const fetchLatestLogSnapshotForAppointment = async (targetAppointmentId: string) => {
    if (!targetAppointmentId) {
      toast.error("No appointment id available for logs");
      return;
    }

    if (displayedSnapshot) {
      pushSnapshotHistory(displayedSnapshot, snapshotState);
    }

    setIsFetchingLogs(true);
    try {
      const res = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(targetAppointmentId)}/logs`), {
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

      const latest = logs[0];
      const snap = latest.newState && Object.keys(latest.newState).length > 0 ? latest.newState : latest.previousState;
      if (!snap) {
        toast.error("No snapshot data available in latest log");
        return;
      }

      snap.id = snap.id || targetAppointmentId;
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
        <DialogContent
          showCloseButton={false}
          className="!fixed !bottom-0 !left-0 !top-auto !flex h-[92dvh] max-h-[92dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:h-auto sm:max-h-[92vh] sm:w-[min(34rem,calc(100vw-2rem))] sm:max-w-[34rem] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[2rem]"
        >
          <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-3 shadow-sm sm:px-6">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                {snapshotHistory.length > 0 ? (
                  <Button size="icon" variant="ghost" className="mt-0.5 h-8 w-8 shrink-0 rounded-full text-slate-600 hover:bg-slate-100" title="Go back to previous snapshot" onClick={goBackSnapshot}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                ) : null}
                <div className="min-w-0">
                  <DialogTitle className="flex flex-wrap items-center gap-2 text-violet-600">
                    <Clock className="h-5 w-5 shrink-0" />
                    <span className="text-xl font-black tracking-tight">Snapshot</span>
                    {showsLogSnapshotState ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`inline-flex cursor-help items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${stateBadgeClass}`}>
                            <StateIcon className="h-3.5 w-3.5" />
                            {stateLabel}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px] border-amber-200 bg-amber-50 text-center text-amber-800">
                          {stateTooltipText}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${stateBadgeClass}`}>
                        <StateIcon className="h-3.5 w-3.5" />
                        {stateLabel}
                      </span>
                    )}
                  </DialogTitle>
                  <DialogDescription className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {timestampPrefix} {snapshotDate}{changeSuffix ? ` - ${changeSuffix}` : ""}
                  </DialogDescription>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {canOpenAppointment ? (
                  <Button className="h-10 rounded-full bg-blue-600 px-4 text-sm font-black text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95" title="Open this appointment" onClick={handleOpenAppointment}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Open
                  </Button>
                ) : null}
                {showsLogSnapshotState ? (
                  <Button className="h-10 rounded-full bg-slate-100 px-3 text-xs font-black text-slate-600 shadow-none transition-all hover:bg-slate-200 active:scale-95" title={appointmentId ? "Open the current appointment snapshot" : "No appointment id available"} disabled={!appointmentId || isFetchingLogs} onClick={viewLatestSnapshot}>
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingLogs ? "animate-spin" : ""}`} />
                    Latest
                  </Button>
                ) : null}
                {canUseSnapshotActions ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-600 hover:bg-slate-100" aria-label="More appointment actions">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onSelect={handleOpenAppointment}>
                        <Eye className="mr-2 h-4 w-4" />
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleEditPayment} disabled={isOpeningPaymentEdit}>
                        {isOpeningPaymentEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                        Edit payment
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleAddPayment}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add payment
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={goToPatient} disabled={!canGoToPatient}>
                        <User className="mr-2 h-4 w-4" />
                        Go to patient
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={goToDoctor} disabled={!canGoToDoctor}>
                        <Stethoscope className="mr-2 h-4 w-4" />
                        Go to doctor
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
                <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-10 w-10 rounded-full text-slate-600 hover:bg-slate-100" aria-label="Close snapshot">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-4 py-5 custom-scrollbar sm:px-6">
            <div className="mx-auto grid max-w-[31rem] gap-3.5">
              <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
                <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Status</Label>
                    <CurrentChangeIndicator change={statusCurrentChange} />
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-black uppercase tracking-wider ${displayedStatusColors.bgColor} ${displayedStatusColors.textColor}`}>
                    {formatBookingHistoryStatusLabel(nextStatus || displayedSnapshot.status)}
                  </span>
                  {prevStatus && nextStatus && prevStatusNorm && nextStatusNorm && !isInsignificantStatus(prevStatusNorm) && prevStatusNorm !== nextStatusNorm ? (
                    <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-slate-400"><History className="h-3 w-3" />Was {formatBookingHistoryStatusLabel(prevStatus)}</p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Payment</Label>
                    <CurrentChangeIndicator change={paymentStatusCurrentChange} />
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-black uppercase tracking-wider ${displayedPaymentStatusColors.bgColor} ${displayedPaymentStatusColors.textColor}`}>
                    {formatBookingHistoryStatusLabel(nextPaymentStatus || displayedSnapshot.paymentStatus)}
                  </span>
                  {prevPaymentStatus && nextPaymentStatus && prevPaymentStatusNorm && nextPaymentStatusNorm && !isInsignificantStatus(prevPaymentStatusNorm) && prevPaymentStatusNorm !== nextPaymentStatusNorm ? (
                    <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-slate-400"><History className="h-3 w-3" />Was {formatBookingHistoryStatusLabel(prevPaymentStatus)}</p>
                  ) : null}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
                <div className="absolute right-4 top-4 opacity-[0.04]"><Banknote className="h-16 w-16 text-violet-600" /></div>
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600"><Banknote className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <Label className="block text-[11px] font-black uppercase tracking-widest text-violet-400">Balance</Label>
                      <p className="mt-1 text-sm font-bold text-slate-500">To be settled</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-right">
                    <p className="text-2xl font-black tracking-tight text-violet-600">{displayedBalanceNumeric !== null ? formatCurrencyLabel(displayedBalanceNumeric) : displayedBalanceLabel}</p>
                    <CurrentChangeIndicator change={balanceCurrentChange} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm max-[420px]:grid-cols-1">
                <div className="flex min-w-0 items-center gap-3 p-4">
                  <PatientAvatar src={resolvedPatientImage} name={patientName} dob={snapshotPatientDob} className="h-12 w-12 shrink-0 rounded-2xl border border-slate-100 shadow-sm" sizeClass="h-12 w-12 rounded-2xl" />
                  <div className="min-w-0">
                    <Label className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Patient</Label>
                    <div className="mt-1 flex min-w-0 items-center gap-1">
                      <p className="truncate text-base font-black leading-tight text-slate-900">{patientName}</p>
                      <CurrentChangeIndicator change={patientCurrentChange} />
                    </div>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 border-l border-slate-100 p-4 max-[420px]:border-l-0 max-[420px]:border-t">
                  <Avatar className="h-12 w-12 shrink-0 rounded-2xl border border-slate-100 shadow-sm">
                    <AvatarImage src={resolvedDoctorImage} alt={displayedDoctorName || "Doctor"} className="object-cover" />
                    <AvatarFallback className="rounded-2xl bg-blue-50 text-blue-600"><Stethoscope className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <Label className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Doctor</Label>
                    <div className="mt-1 flex min-w-0 items-center gap-1">
                      {canAssignDoctor ? (
                        <button
                          type="button"
                          onClick={() => setIsAssignDoctorOpen(true)}
                          className="truncate text-left text-[11px] font-black uppercase leading-tight tracking-wider text-blue-600 underline-offset-2 transition-colors hover:text-blue-700 hover:underline"
                        >
                          Assign doctor
                        </button>
                      ) : (
                        <p className="truncate text-base font-black leading-tight text-slate-900">{displayedDoctorName || "Unassigned"}</p>
                      )}
                      <CurrentChangeIndicator change={doctorCurrentChange} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
                <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-blue-600" /><Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Date</Label></div>
                  <div className="flex items-start gap-1.5"><p className="text-base font-black leading-tight text-slate-900">{formattedDate}</p><CurrentChangeIndicator change={dateCurrentChange} /></div>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" /><Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Time Slot</Label></div>
                  <div className="flex items-start gap-1.5"><p className="text-base font-black leading-tight text-slate-900">{displayedTimeLabel}</p><CurrentChangeIndicator change={timeCurrentChange} /></div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Stethoscope className="h-5 w-5" /></div>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-lg font-black leading-tight text-slate-900">{typeName}</p>
                      <CurrentChangeIndicator change={serviceCurrentChange} />
                    </div>
                  </div>
                  {displayedToothNumbersText ? (
                    <span className="inline-flex max-w-full shrink-0 items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                      Tooth # {displayedToothNumbersText}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-4 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">Price<CurrentChangeIndicator change={priceCurrentChange} /></span>
                    <div className="text-right">
                      {displayedDiscountAmount > 0 ? (
                        <>
                          <div className="text-xs font-bold text-slate-300 line-through">{"\u20b1"}{Number(displayedBasePrice).toLocaleString()}</div>
                          <div className="text-lg font-black text-slate-900">{"\u20b1"}{Number(displayedEffectivePrice).toLocaleString()}</div>
                        </>
                      ) : (
                        <span className="text-lg font-black text-slate-900">{"\u20b1"}{(Number(displayedEffectivePrice) || 0).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  {shouldShowPaymentLine ? (
                    <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                      <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600/80">{snapshotPaymentLabel}</span>
                      <div className="text-right">
                        <div className="text-base font-black text-emerald-600">{snapshotPaymentAmountLabel}</div>
                        <div className="text-[11px] font-bold text-slate-400">
                          {snapshotPaymentMethodLabel}{snapshotPaymentDateLabel ? ` - ${snapshotPaymentDateLabel}` : ""}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <div className="mb-2 flex items-center gap-2"><History className="h-4 w-4 text-blue-500" /><Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Treatment Notes</Label><CurrentChangeIndicator change={treatmentNotesCurrentChange} /></div>
                    <p className={`max-h-28 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-sm font-medium leading-relaxed custom-scrollbar ${displayedTreatmentNotesComparisonText ? "text-slate-600" : "italic text-slate-400"}`}>{displayedTreatmentNotesText}</p>
                  </div>
                </div>
              </div>

              {(displayedSnapshot.status === "cancelled" && displayedSnapshot.cancellationReason) || displayedNotesComparisonText ? (
                <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  {displayedSnapshot.status === "cancelled" && displayedSnapshot.cancellationReason ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /><Label className="text-[11px] font-black uppercase tracking-widest text-red-500">Cancellation Reason</Label><CurrentChangeIndicator change={cancellationReasonCurrentChange} /></div>
                      <p className="border-l-2 border-red-100 pl-3 text-sm font-bold leading-relaxed text-red-700/80">{displayedSnapshot.cancellationReason}</p>
                    </div>
                  ) : null}
                  {displayedNotesComparisonText ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2"><History className="h-4 w-4 text-slate-300" /><Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Remarks</Label><CurrentChangeIndicator change={notesCurrentChange} /></div>
                      <p className="whitespace-pre-wrap border-l-2 border-slate-100 py-0.5 pl-3 text-sm font-medium italic leading-relaxed text-slate-500">{displayedNotesText}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="shrink-0 !flex-col gap-3 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:px-6">
            {canShowSnapshotActions ? (
              <div className="-mx-5 -mt-4 mb-1 border-b border-amber-100 bg-amber-50/70 px-5 py-3 sm:-mx-6 sm:px-6">
                <p className="flex items-start justify-center gap-2 text-center text-sm font-semibold leading-5 text-amber-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{actionNoteText}</p>
              </div>
            ) : null}
            {canShowSnapshotActions ? (
              <>
                <Button className="h-14 w-full rounded-full bg-emerald-600 text-base font-black text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700 active:scale-95" onClick={() => openApproveConfirm(displayedSnapshot)}><CheckCircle2 className="mr-2 h-5 w-5" />Accept</Button>
                <Button className="h-14 w-full rounded-full border-red-200 bg-white text-base font-black text-red-500 shadow-sm transition-all hover:bg-red-50 active:scale-95" onClick={() => openRejectConfirm(displayedSnapshot)} variant="outline"><AlertTriangle className="mr-2 h-5 w-5" />Decline</Button>
              </>
            ) : null}
            {canRestoreNotification ? (
              <Button className="h-12 w-full rounded-full bg-violet-600 text-sm font-black text-white shadow-sm transition-all hover:bg-violet-700 active:scale-95" onClick={async () => { await onRestoreNotification?.(restoreNotificationId!); onOpenChange(false); }}><RefreshCw className="mr-2 h-4 w-4" />Restore</Button>
            ) : null}
            <Button onClick={() => onOpenChange(false)} variant="ghost" className="h-11 w-full rounded-full text-sm font-black text-slate-400 transition-all hover:bg-slate-50 hover:text-slate-600">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignDoctorOpen} onOpenChange={(nextOpen) => !isAssigningDoctor && setIsAssignDoctorOpen(nextOpen)}>
        <DialogContent
          showCloseButton={false}
          className="!fixed !bottom-0 !left-0 !top-auto !flex max-h-[88dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.5rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:w-[min(42rem,calc(100vw-2rem))] sm:max-w-2xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.5rem]"
        >
          <DialogHeader className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-3 shadow-sm sm:px-6">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div className="min-w-0 text-left">
                  <DialogTitle className="truncate text-xl font-black tracking-tight text-slate-950">Assign Doctor</DialogTitle>
                  <DialogDescription className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-500">
                    {patientName ? `${typeName} for ${patientName}` : typeName}
                  </DialogDescription>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setIsAssignDoctorOpen(false)} disabled={isAssigningDoctor} className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close assign doctor">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-4 py-5 custom-scrollbar sm:px-6">
            <SelectDoctorModal className="mx-auto max-w-[38rem]">
              {isLoadingDoctors ? (
                <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-100 bg-white text-sm font-bold text-slate-500 shadow-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
                  Loading doctors
                </div>
              ) : doctors.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
                  <p className="text-sm font-black text-slate-900">No doctors available</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Add a doctor record first, then assign this appointment.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {doctors.map((doctor: any) => {
                    const doctorAvatar = resolveImageSource(pickImageSource(doctor.profilePicture, doctor.profilePictureUrl));

                    return (
                      <button
                        key={doctor.id || doctor.name}
                        type="button"
                        onClick={() => handleAssignDoctor(doctor)}
                        disabled={isAssigningDoctor}
                        className="group flex min-h-[6.5rem] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Avatar className="h-14 w-14 shrink-0 rounded-2xl border border-blue-50 shadow-sm">
                          {doctorAvatar ? <AvatarImage src={doctorAvatar} alt={doctor.name} className="object-cover" /> : null}
                          <AvatarFallback className="rounded-2xl bg-blue-50 text-sm font-black text-blue-700">
                            {getInitials(doctor.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black leading-tight text-slate-950">{resolveDoctorName(doctor.name)}</p>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-slate-500">{doctor.specialization || doctor.role || "Dental specialist"}</p>
                        </div>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                          {isAssigningDoctor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </SelectDoctorModal>
          </div>
        </DialogContent>
      </Dialog>

      <ApproveRejectDialog open={isApproveConfirmOpen} onOpenChange={setIsApproveConfirmOpen} mode="approve" appointment={displayedSnapshot} onConfirm={performApprove} isProcessing={isProcessingAction} />
      <ApproveRejectDialog open={isRejectConfirmOpen} onOpenChange={setIsRejectConfirmOpen} mode="reject" appointment={displayedSnapshot} onConfirm={performReject} isProcessing={isProcessingAction} />
    </>
  );

}
