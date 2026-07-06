import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ApproveRejectDialog from "./ApproveRejectDialog";
import { Calendar as CalendarIcon, Clock, Stethoscope, Banknote, AlertTriangle, CheckCircle2, History, ArrowLeft, RefreshCw, X, Eye, Pencil, Plus, User, Loader2, Check, ChevronRight, FileText, Users, WalletCards, EllipsisVertical, RotateCcw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PatientAvatar from "./PatientAvatar";
import { getAppointmentTypeName, OTHER_APPOINTMENT_TYPE_INDEX } from "@/lib/appointment-types";
import { formatTimeTo12h } from "@/lib/time-slots";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import { toast } from "sonner";
import { useDoctors } from "@/hooks/useDoctors";
import { useAppointmentTypeOptions } from "@/hooks/useAppointmentTypeOptions";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import type { Appointment } from "@/hooks/useAppointments";
import { formatDateToYYYYMMDD, formatWordyDate } from "@/lib/utils";
import {
  formatBookingHistoryStatusLabel,
  formatBookingDateKey,
  formatBookingPaymentAdjustmentAmountLabel,
  getBookingPaymentAdjustment,
  getBookingTreatmentNotesValue,
  getBookingToothNumberEntries,
  getBookingToothNumbersValue,
  normalizeBookingDuration,
  normalizeBookingToothNumbers,
  normalizeBookingPaymentMethod,
  normalizeBookingHistoryStatus,
  parseLocalDateOnly,
  findNextAvailableRepeatSlot,
} from "./sharedBookingLogic";

import { getDefaultAppointmentStatusColors, getDefaultPaymentStatusColors } from "@/lib/status-colors";
import { findDoctorForSnapshot, normalizeDoctorIdentity } from "@/lib/doctor-identity";
import { getAppointmentPatientDisplayName } from "@/lib/patient-identity";
import { SelectDoctorModal } from "./SelectDoctorModal";
import { SelectTreatmentModal } from "./SelectTreatmentModal";
import { SelectScheduleModal } from "./SelectScheduleModal";
import { DatePickerModal } from "./DatePickerModal";
import { TimePickerModal } from "./TimePickerModal";

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
  selectedPaymentSnapshot?: any;
  useCurrentAppointmentDetails?: boolean;
}

type SnapshotState = "historical" | "latest" | "current";
type CurrentFieldChange = {
  title: string;
};

const REPEAT_NONE_OPTION = "do-not-repeat";
const REPEAT_OPTIONS = [
  { value: "next-week", label: "Next week" },
  { value: "next-month", label: "Next month" },
  { value: "3-months", label: "3 months from now" },
  { value: "custom", label: "Custom date" },
];

const getRepeatTargetDate = (baseDateValue: unknown, repeatOption: string, customRepeatDate = "") => {
  if (repeatOption === REPEAT_NONE_OPTION) return null;

  const baseDate = resolveScheduleDateValue(baseDateValue);
  if (!baseDate) return null;

  const target = new Date(baseDate);
  switch (repeatOption) {
    case "next-week":
      target.setDate(baseDate.getDate() + 7);
      return target;
    case "next-month":
      target.setMonth(baseDate.getMonth() + 1);
      return target;
    case "3-months":
      target.setMonth(baseDate.getMonth() + 3);
      return target;
    case "custom":
      return customRepeatDate ? parseLocalDateOnly(customRepeatDate) : null;
    default:
      return null;
  }
};

const buildRepeatScheduleNotes = (baseNotes: unknown, sourceDate: Date) => {
  const sourceDateLabel = formatWordyDate(sourceDate);
  const followUpNote = `Created as a repeating schedule from ${sourceDateLabel}`;
  const trimmed = String(baseNotes || "").trim();
  return trimmed ? `${trimmed}\n${followUpNote}` : followUpNote;
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

const resolveScheduleDateValue = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsedLocalDate = parseLocalDateOnly(String(value));
  if (parsedLocalDate) return parsedLocalDate;

  const parsedDate = new Date(String(value));
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getPaymentLogAmountValue = (payment: any) => Number(payment?.amount || payment?.paymentAmount || 0);

const getPaymentLogDateValue = (payment: any) =>
  payment?.paymentDate ||
  payment?.date ||
  payment?.paymentDetails?.paymentDate ||
  payment?.paymentDetails?.date ||
  payment?.transaction?.paymentDate ||
  payment?.transaction?.date ||
  "";

const getPaymentLogFallbackDateValue = (payment: any) =>
  payment?.changedAt || payment?.createdAt || payment?.updatedAt || "";

const getPaymentLogMethodValue = (payment: any) =>
  payment?.paymentMethod || payment?.method || payment?.paymentDetails?.method || "";

const getPaymentLogSortTime = (payment: any) => {
  const primaryDate = getPaymentLogDateValue(payment);
  const parsedPrimary = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(primaryDate)) ? `${primaryDate}T00:00:00` : String(primaryDate));
  if (!Number.isNaN(parsedPrimary.getTime())) return parsedPrimary.getTime();

  const fallbackDate = getPaymentLogFallbackDateValue(payment);
  const parsedFallback = new Date(fallbackDate);
  return Number.isNaN(parsedFallback.getTime()) ? 0 : parsedFallback.getTime();
};

const getPaymentEntryIdentity = (payment: any) =>
  String(
    payment?.paymentId ||
    payment?.paymentRecordId ||
    payment?.transactionId ||
    payment?._paymentTransactionId ||
    payment?._transactionId ||
    payment?.id ||
    ""
  ).trim();

const normalizePaymentEntryMethod = (payment: any) =>
  String(getPaymentLogMethodValue(payment) || "").trim().toLowerCase();

const isSamePaymentEntry = (first: any, second: any) => {
  if (!first || !second) return false;

  const firstIdentity = getPaymentEntryIdentity(first);
  const secondIdentity = getPaymentEntryIdentity(second);
  if (firstIdentity && secondIdentity && firstIdentity === secondIdentity) return true;

  const firstAmount = getPaymentLogAmountValue(first);
  const secondAmount = getPaymentLogAmountValue(second);
  const firstDate = String(getPaymentLogDateValue(first) || "").trim();
  const secondDate = String(getPaymentLogDateValue(second) || "").trim();

  return (
    Math.abs(firstAmount - secondAmount) <= 0.01 &&
    Boolean(firstDate && secondDate && firstDate === secondDate) &&
    normalizePaymentEntryMethod(first) === normalizePaymentEntryMethod(second)
  );
};

export default function AppointmentHistoryView({ open, onOpenChange, appointmentSnapshot, logDate, onViewCurrent, onOpenAppointment, isAppointmentOpen, isHistorical, actionsDisabled = false, restoreNotificationId, onRestoreNotification, openedFromBookingModal = false, showPreviousInputChanges = true, selectedPaymentSnapshot, useCurrentAppointmentDetails = false }: AppointmentHistoryViewProps) {
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
  const [latestPaymentLogMethod, setLatestPaymentLogMethod] = useState<string>("");
  const [paymentLogEntries, setPaymentLogEntries] = useState<any[]>([]);
  const [paymentLogsRefreshKey, setPaymentLogsRefreshKey] = useState(0);
  const [showAdditionalPayments, setShowAdditionalPayments] = useState(false);
  const [latestComparisonSnapshot, setLatestComparisonSnapshot] = useState<any | null>(null);
  const [snapshotHistory, setSnapshotHistory] = useState<Array<{ snapshot: any; snapshotState: SnapshotState }>>([]);
  const [isChangeScheduleOpen, setIsChangeScheduleOpen] = useState(false);
  const [isSavingScheduleChange, setIsSavingScheduleChange] = useState(false);
  const [isScheduleDatePickerOpen, setIsScheduleDatePickerOpen] = useState(false);
  const [isScheduleTimePickerOpen, setIsScheduleTimePickerOpen] = useState(false);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<Date | null>(null);
  const [selectedScheduleTime, setSelectedScheduleTime] = useState("");
  const [isRepeatScheduleOpen, setIsRepeatScheduleOpen] = useState(false);
  const [isSavingRepeatSchedule, setIsSavingRepeatSchedule] = useState(false);
  const [repeatOption, setRepeatOption] = useState("next-week");
  const [customRepeatDate, setCustomRepeatDate] = useState("");
  const [isCustomRepeatDatePickerOpen, setIsCustomRepeatDatePickerOpen] = useState(false);
  const [isChangeTreatmentOpen, setIsChangeTreatmentOpen] = useState(false);
  const [isSavingTreatmentChange, setIsSavingTreatmentChange] = useState(false);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<number | null>(null);
  const [customTreatmentName, setCustomTreatmentName] = useState("");
  const [selectedTreatmentPrice, setSelectedTreatmentPrice] = useState("");
  const [selectedTreatmentDuration, setSelectedTreatmentDuration] = useState("30");
  const [treatmentToothNumberEntries, setTreatmentToothNumberEntries] = useState<string[]>([""]);
  const { doctors, isLoadingDoctors, reloadDoctors } = useDoctors(open ? 1 : undefined, { enabled: open });
  const { options: treatmentOptions, isLoading: isLoadingTreatmentOptions } = useAppointmentTypeOptions(open);
  const displayedPatientId = displayedSnapshot?.patientId || displayedSnapshot?.patient?.id || "";
  const displayedAppointmentId = displayedSnapshot?.id || displayedSnapshot?.appointmentId || appointmentSnapshot?.id || appointmentSnapshot?.appointmentId || "";

  // Appointment action helpers (approve/reject) using central appointment modal hook
  const { addAppointment, updateAppointment, openEditModalById } = useAppointmentModal();
  const { openPaymentFor, openEditPaymentModal } = usePaymentModal();
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [pendingActionSnapshot, setPendingActionSnapshot] = useState<any | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const shouldShowPreviousInputChanges = openedFromBookingModal || showPreviousInputChanges;
  const shouldUseCurrentAppointmentDetails = Boolean(useCurrentAppointmentDetails && !openedFromBookingModal);

  useEffect(() => {
    setDisplayedSnapshot(appointmentSnapshot);
    // Prefer explicit snapshot metadata when available. If the snapshot includes
    // `_isHistorical` (set by `fetchSnapshotFromLogs`), honor that value. Otherwise
    // fall back to the `isHistorical` prop provided by the caller.
    const derivedHistorical = shouldUseCurrentAppointmentDetails
      ? false
      : appointmentSnapshot && Object.prototype.hasOwnProperty.call(appointmentSnapshot, "_isHistorical")
      ? Boolean(appointmentSnapshot._isHistorical)
      : Boolean(isHistorical);
    setSnapshotState(derivedHistorical ? "historical" : "current");
  }, [appointmentSnapshot, isHistorical, shouldUseCurrentAppointmentDetails]);

  useEffect(() => {
    if (!open) {
      setSnapshotHistory([]);
      setShowAdditionalPayments(false);
      setIsChangeScheduleOpen(false);
      setIsSavingScheduleChange(false);
      setIsScheduleDatePickerOpen(false);
      setIsScheduleTimePickerOpen(false);
      setSelectedScheduleDate(null);
      setSelectedScheduleTime("");
      setIsRepeatScheduleOpen(false);
      setIsSavingRepeatSchedule(false);
      setRepeatOption("next-week");
      setCustomRepeatDate("");
      setIsCustomRepeatDatePickerOpen(false);
      setIsChangeTreatmentOpen(false);
      setSelectedTreatmentId(null);
      setCustomTreatmentName("");
      setSelectedTreatmentPrice("");
      setSelectedTreatmentDuration("30");
      setTreatmentToothNumberEntries([""]);
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
    const appointmentId = String(displayedAppointmentId || "").trim();
    if (!open || !appointmentId || typeof window === "undefined") return;

    const handlePaymentsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{
        appointmentId?: string | number | null;
        appointment?: { id?: string | number | null } | null;
        payment?: { appointmentId?: string | number | null } | null;
      }>).detail;
      const changedAppointmentId = String(
        detail?.appointmentId ??
        detail?.payment?.appointmentId ??
        detail?.appointment?.id ??
        ""
      ).trim();

      if (!changedAppointmentId || changedAppointmentId === appointmentId) {
        setPaymentLogsRefreshKey((key) => key + 1);
      }
    };

    window.addEventListener("payments:updated", handlePaymentsUpdated as EventListener);
    return () => window.removeEventListener("payments:updated", handlePaymentsUpdated as EventListener);
  }, [open, displayedAppointmentId]);

  useEffect(() => {
    const appointmentId = String(displayedAppointmentId || "").trim();
    if (!open || !shouldUseCurrentAppointmentDetails || !appointmentId) return;

    const controller = new AbortController();
    const loadCurrentAppointmentDetails = async () => {
      try {
        const response = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}?t=${Date.now()}`), {
          credentials: "include",
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        const currentAppointment = response.ok && result?.data ? result.data : null;
        if (!currentAppointment) return;

        setDisplayedSnapshot((current: any) => ({
          ...(current || {}),
          ...currentAppointment,
          id: currentAppointment.id || appointmentId,
          appointmentId,
          changedAt: currentAppointment.changedAt || currentAppointment.updatedAt || currentAppointment.createdAt || current?.changedAt,
          _isHistorical: false,
        }));
        setSnapshotState("current");
        setLatestComparisonSnapshot(currentAppointment);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.warn("[AppointmentHistoryView] Failed to load current appointment details:", error);
        }
      }
    };

    loadCurrentAppointmentDetails();

    return () => controller.abort();
  }, [
    open,
    displayedAppointmentId,
    shouldUseCurrentAppointmentDetails,
    paymentLogsRefreshKey,
  ]);

  useEffect(() => {
    setLatestPaymentLogAmount(null);
    setLatestPaymentLogDate("");
    setLatestPaymentLogMethod("");
    setPaymentLogEntries([]);
    setShowAdditionalPayments(false);

    const appointmentId = String(displayedAppointmentId || "").trim();
    if (
      !open ||
      !appointmentId
    ) return;

    const controller = new AbortController();
    const loadLatestPaymentLogAmount = async () => {
      try {
        const fetchPaymentRows = async (path: string, normalizeRow: (row: any) => any) => {
          const response = await fetch(apiUrl(path), {
            credentials: "include",
            headers: getAuthHeaders(),
            signal: controller.signal,
          });
          const result = await response.json().catch(() => null);
          return response.ok && result?.success && Array.isArray(result.data)
            ? result.data.map(normalizeRow)
            : [];
        };

        const paymentRecords = await fetchPaymentRows(
          `/api/payments/appointment/${encodeURIComponent(appointmentId)}`,
          (payment: any) => ({
            ...payment,
            paymentId: payment.paymentId || payment.id,
            paymentRecordId: payment.paymentRecordId || payment.id,
            paymentAmount: payment.paymentAmount ?? payment.amount,
            paymentDate: getPaymentLogDateValue(payment) || payment.date,
            paymentMethod: getPaymentLogMethodValue(payment) || payment.method,
          })
        );
        const logs = paymentRecords.length > 0
          ? paymentRecords
          : await fetchPaymentRows(
              `/api/appointments/${encodeURIComponent(appointmentId)}/payments`,
              (log: any) => ({
                ...log,
                paymentAmount: log.paymentAmount ?? log.amount,
                paymentDate: getPaymentLogDateValue(log) || getPaymentLogFallbackDateValue(log),
                paymentMethod: getPaymentLogMethodValue(log),
              })
            );
        const positiveLogs = logs
          .filter((log: any) => getPaymentLogAmountValue(log) > 0)
          .sort((a: any, b: any) => getPaymentLogSortTime(b) - getPaymentLogSortTime(a));
        const latestPositiveLog = positiveLogs[0];
        const latestPositiveAmount = latestPositiveLog ? getPaymentLogAmountValue(latestPositiveLog) : undefined;

        setPaymentLogEntries(positiveLogs);
        setLatestPaymentLogAmount(latestPositiveAmount ?? 0);
        setLatestPaymentLogDate(
          latestPositiveLog ? getPaymentLogDateValue(latestPositiveLog) : ""
        );
        setLatestPaymentLogMethod(latestPositiveLog ? getPaymentLogMethodValue(latestPositiveLog) : "");
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.warn("[AppointmentHistoryView] Failed to load payment logs:", error);
          setLatestPaymentLogAmount(0);
          setLatestPaymentLogDate("");
          setLatestPaymentLogMethod("");
          setPaymentLogEntries([]);
        }
      }
    };

    loadLatestPaymentLogAmount();

    return () => controller.abort();
  }, [
    open,
    displayedAppointmentId,
    paymentLogsRefreshKey,
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

  const resolvedLogDate = shouldUseCurrentAppointmentDetails
    ? displayedSnapshot.updatedAt || displayedSnapshot.changedAt || displayedSnapshot.createdAt || logDate || new Date().toISOString()
    : logDate || displayedSnapshot.changedAt || displayedSnapshot.updatedAt || displayedSnapshot.createdAt || new Date().toISOString();
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

  const isDeletedAppointmentState = (state: any) =>
    Boolean(state?.deleted || state?.deletedAt) ||
    normalizeBookingHistoryStatus(state?.status) === "deleted";
  const derivedLifecycleAction = (() => {
    const wasDeleted = isDeletedAppointmentState(prevState);
    const isDeleted = isDeletedAppointmentState(nextState);

    if (!wasDeleted && isDeleted) return "deleted";
    if (wasDeleted && !isDeleted) return "restored";
    return "";
  })();
  const appointmentLifecycleAction =
    displayedSnapshot?._appointmentHistoryAction ||
    (openedFromBookingModal ? derivedLifecycleAction : "");
  const hasAppointmentLifecycleAction =
    appointmentLifecycleAction === "deleted" || appointmentLifecycleAction === "restored";
  const appointmentLifecycleLabel =
    appointmentLifecycleAction === "deleted" ? "Appointment Deleted" : "Appointment Restored";
  const appointmentLifecycleDetail =
    appointmentLifecycleAction === "deleted"
      ? "This snapshot was logged when the appointment was deleted."
      : "This snapshot was logged when the appointment was restored.";
  const appointmentLifecycleClass =
    appointmentLifecycleAction === "deleted"
      ? "border-red-100 bg-red-50/70 text-red-700"
      : "border-emerald-100 bg-emerald-50/70 text-emerald-700";
  const AppointmentLifecycleIcon = appointmentLifecycleAction === "deleted" ? AlertTriangle : RefreshCw;

  const focusedPaymentSnapshot = selectedPaymentSnapshot || displayedSnapshot?._selectedPaymentSnapshot || displayedSnapshot?._focusedPaymentSnapshot || null;
  const focusedPaymentAmount = focusedPaymentSnapshot ? getPaymentLogAmountValue(focusedPaymentSnapshot) : 0;
  const hasFocusedPaymentSnapshot = focusedPaymentAmount > 0;
  const focusedPaymentAction =
    focusedPaymentSnapshot?._paymentHistoryAction ||
    displayedSnapshot?._paymentHistoryAction ||
    "";
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
  const paidInSnapshotAmount = hasFocusedPaymentSnapshot
    ? focusedPaymentAmount
    : explicitSnapshotPaymentAmount !== null && explicitSnapshotPaymentAmount > 0
      ? explicitSnapshotPaymentAmount
      : 0;
  const hasPaidInSnapshot = !isPaymentAdjustmentSnapshot && (
    hasFocusedPaymentSnapshot ||
    (openedFromBookingModal && isPaymentLogSnapshot && paidInSnapshotAmount > 0)
  );
  const latestPaymentAmount = Number(latestPaymentLogAmount || 0);
  const shouldShowLatestPayment = !isPaymentAdjustmentSnapshot && !hasPaidInSnapshot && latestPaymentAmount > 0;
  const shouldShowPaymentLine = isPaymentAdjustmentSnapshot || hasPaidInSnapshot || shouldShowLatestPayment;
  const snapshotPaymentLabel = isPaymentAdjustmentSnapshot
    ? paymentAdjustment.delta < 0
      ? "Payment Reduced"
      : "Payment Adjusted"
    : focusedPaymentAction === "deleted"
      ? "Deleted Payment"
      : focusedPaymentAction === "restored"
        ? "Restored Payment"
        : hasPaidInSnapshot ? "Paid in Snapshot" : "Latest Payment";
  const paymentSectionTitle = hasAppointmentLifecycleAction
    ? "Appointment Activity"
    : hasPaidInSnapshot ? "Selected Payment" : "Latest Payment";
  const mainPaymentTone = focusedPaymentAction === "deleted" ? "deleted" : "default";
  const mainPaymentCardClass = mainPaymentTone === "deleted"
    ? "border-red-100 bg-red-50/70"
    : "border-emerald-100 bg-emerald-50/60";
  const mainPaymentTextClass = mainPaymentTone === "deleted"
    ? "text-red-700"
    : "text-emerald-700";
  const mainPaymentMutedTextClass = mainPaymentTone === "deleted"
    ? "text-red-700/70"
    : "text-emerald-700/70";
  const mainPaymentMethodTextClass = mainPaymentTone === "deleted"
    ? "text-red-700/80"
    : "text-emerald-700/80";
  const mainPaymentDividerClass = mainPaymentTone === "deleted"
    ? "border-red-100"
    : "border-emerald-100";
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
    (focusedPaymentSnapshot ? getPaymentLogDateValue(focusedPaymentSnapshot) || getPaymentLogFallbackDateValue(focusedPaymentSnapshot) : "") ||
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
    latestPaymentLogDate ||
    latestComparisonSnapshot?.paymentDate ||
    latestComparisonSnapshot?.newState?.paymentDate ||
    appointmentSnapshot?.paymentDate ||
    appointmentSnapshot?.newState?.paymentDate ||
    latestComparisonSnapshot?.createdAt ||
    appointmentSnapshot?.createdAt;
  const snapshotPaymentDateRaw = hasPaidInSnapshot
    ? paidInSnapshotPaymentDateRaw
    : shouldShowLatestPayment
      ? latestPaymentDateRaw
      : "";
  const snapshotPaymentDateLabel = snapshotPaymentDateRaw ? formatLongDate(snapshotPaymentDateRaw) : "";
  const paymentLogRows = paymentLogEntries
    .map((payment) => {
      const amount = getPaymentLogAmountValue(payment);
      const dateValue = getPaymentLogDateValue(payment);

      return {
        id: String(payment?.id || `${dateValue}-${amount}`),
        raw: payment,
        amount,
        amountLabel: `\u20b1${amount.toLocaleString()}`,
        dateLabel: dateValue ? formatLongDate(dateValue) : "No date",
        methodLabel: normalizeBookingPaymentMethod(getPaymentLogMethodValue(payment)),
      };
    })
    .filter((payment) => payment.amount > 0);
  const selectedPaymentRow = hasFocusedPaymentSnapshot
    ? {
        id: getPaymentEntryIdentity(focusedPaymentSnapshot) || `selected-${getPaymentLogDateValue(focusedPaymentSnapshot)}-${focusedPaymentAmount}`,
        raw: focusedPaymentSnapshot,
        amount: focusedPaymentAmount,
        amountLabel: `\u20b1${focusedPaymentAmount.toLocaleString()}`,
        dateLabel: paidInSnapshotPaymentDateRaw ? formatLongDate(paidInSnapshotPaymentDateRaw) : "No date",
        methodLabel: normalizeBookingPaymentMethod(getPaymentLogMethodValue(focusedPaymentSnapshot)),
      }
    : null;
  const mainPaymentRow = hasPaidInSnapshot
    ? selectedPaymentRow || {
        id: getPaymentEntryIdentity(displayedSnapshot) || `snapshot-${paidInSnapshotPaymentDateRaw}-${paidInSnapshotAmount}`,
        raw: displayedSnapshot,
        amount: paidInSnapshotAmount,
        amountLabel: `\u20b1${paidInSnapshotAmount.toLocaleString()}`,
        dateLabel: paidInSnapshotPaymentDateRaw ? formatLongDate(paidInSnapshotPaymentDateRaw) : "No date",
        methodLabel: normalizeBookingPaymentMethod(getPaymentLogMethodValue(displayedSnapshot)),
      }
    : shouldShowLatestPayment
      ? paymentLogRows[0] || null
      : null;
  const additionalPaymentRows = paymentLogRows.filter((payment) =>
    mainPaymentRow ? !isSamePaymentEntry(payment.raw, mainPaymentRow.raw) : true
  );
  const snapshotPaymentMethodLabel = normalizeBookingPaymentMethod(
    hasFocusedPaymentSnapshot
      ? getPaymentLogMethodValue(focusedPaymentSnapshot)
      : shouldShowLatestPayment
        ? latestPaymentLogMethod ||
        displayedSnapshot?.paymentMethod ||
        displayedSnapshot?.newState?.paymentMethod ||
        displayedSnapshot?.paymentDetails?.method ||
        displayedSnapshot?.transaction?.method ||
        appointmentSnapshot?.paymentMethod ||
        appointmentSnapshot?.newState?.paymentMethod
        : displayedSnapshot?.paymentMethod ||
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
  const activeTreatmentOptions = treatmentOptions.filter((option) => option.isActive !== false);
  const selectedTreatmentOption = activeTreatmentOptions.find((option) => option.id === selectedTreatmentId) || null;
  const isCustomSelectedTreatment = selectedTreatmentOption?.id === OTHER_APPOINTMENT_TYPE_INDEX;

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
  const canChangeSchedule = Boolean(canUseSnapshotActions && !showsLogSnapshotState);
  const selectedScheduleDisplayDate = selectedScheduleDate || resolveScheduleDateValue(displayedSnapshot?.date);
  const selectedScheduleDuration = String(normalizeBookingDuration(displayedSnapshot?.duration || 30));
  const repeatSourceDate = resolveScheduleDateValue(displayedSnapshot?.date);
  const repeatTargetDate = getRepeatTargetDate(displayedSnapshot?.date, repeatOption, customRepeatDate);
  const repeatTargetLabel = repeatTargetDate ? formatWordyDate(repeatTargetDate) : "";
  const canRepeatSchedule = Boolean(
    canChangeSchedule &&
    repeatSourceDate &&
    displayedPatientId &&
    displayedDoctorName &&
    String(displayedSnapshot?.time || "").trim()
  );
  const canSaveRepeatSchedule = Boolean(
    canRepeatSchedule &&
    repeatTargetDate &&
    !isSavingRepeatSchedule
  );
  const canSaveScheduleChange = Boolean(
    canChangeSchedule &&
    selectedScheduleDisplayDate &&
    String(selectedScheduleTime || "").trim() &&
    !isSavingScheduleChange
  );
  const canChangeTreatment = Boolean(canUseSnapshotActions && !showsLogSnapshotState);
  const canSaveTreatmentChange = Boolean(
    canChangeTreatment &&
    selectedTreatmentOption &&
    (!isCustomSelectedTreatment || customTreatmentName.trim()) &&
    Number.isFinite(Number(selectedTreatmentPrice)) &&
    Number(selectedTreatmentPrice) >= 0 &&
    Boolean(selectedTreatmentDuration) &&
    !isSavingTreatmentChange &&
    !isLoadingTreatmentOptions
  );
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

  const closeChangeScheduleModal = (force = false) => {
    if (isSavingScheduleChange && !force) return;

    setIsChangeScheduleOpen(false);
    setIsScheduleDatePickerOpen(false);
    setIsScheduleTimePickerOpen(false);
    setSelectedScheduleDate(null);
    setSelectedScheduleTime("");
  };

  const openChangeScheduleModal = () => {
    if (!canChangeSchedule) {
      toast.error("This snapshot cannot be edited");
      return;
    }

    setSelectedScheduleDate(resolveScheduleDateValue(displayedSnapshot?.date));
    setSelectedScheduleTime(String(displayedSnapshot?.time || ""));
    setIsChangeScheduleOpen(true);
  };

  const handleScheduleDateSelect = (date: Date) => {
    setSelectedScheduleDate(date);
  };

  const handleScheduleTimeSelect = (time: string) => {
    setSelectedScheduleTime(time);
  };

  const handleSaveScheduleChange = async () => {
    if (!appointmentId) {
      toast.error("No appointment id available");
      return;
    }

    const nextDate = formatDateToYYYYMMDD(selectedScheduleDisplayDate);
    const nextTime = String(selectedScheduleTime || "").trim();

    if (!nextDate) {
      toast.error("Please select a date");
      return;
    }

    if (!nextTime) {
      toast.error("Please select a time");
      return;
    }

    setIsSavingScheduleChange(true);
    try {
      const updated = await updateAppointment(String(appointmentId), {
        date: nextDate,
        time: nextTime,
      } as Partial<Appointment>);

      setDisplayedSnapshot((current: any) => ({
        ...current,
        ...updated,
        date: updated?.date ?? nextDate,
        time: updated?.time ?? nextTime,
      }));
      setLatestComparisonSnapshot(null);
      try {
        window.dispatchEvent(
          new CustomEvent("appointments:updated", {
            detail: { appointment: updated, appointmentId: String(appointmentId) },
          })
        );
        window.dispatchEvent(new Event("refreshNotifications"));
      } catch {}

      toast.success("Schedule updated");
      closeChangeScheduleModal(true);
    } catch (error) {
      console.error("[AppointmentHistoryView] Failed to update schedule:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update schedule");
    } finally {
      setIsSavingScheduleChange(false);
    }
  };

  const closeRepeatScheduleModal = (force = false) => {
    if (isSavingRepeatSchedule && !force) return;

    setIsRepeatScheduleOpen(false);
    setIsCustomRepeatDatePickerOpen(false);
  };

  const openRepeatScheduleModal = () => {
    if (!canChangeSchedule) {
      toast.error("This snapshot cannot be repeated");
      return;
    }

    if (!displayedPatientId) {
      toast.error("No patient is assigned to this appointment");
      return;
    }

    if (!displayedDoctorName) {
      toast.error("Assign a doctor before repeating this schedule");
      return;
    }

    if (!repeatSourceDate || !displayedSnapshot?.time) {
      toast.error("This appointment does not have a complete schedule");
      return;
    }

    setRepeatOption("next-week");
    setCustomRepeatDate("");
    setIsCustomRepeatDatePickerOpen(false);
    setIsRepeatScheduleOpen(true);
  };

  const handleRepeatOptionChange = (value: string) => {
    setRepeatOption(value);
    setIsCustomRepeatDatePickerOpen(value === "custom");
  };

  const handleSaveRepeatSchedule = async () => {
    if (!canSaveRepeatSchedule || !repeatSourceDate || !repeatTargetDate) {
      toast.error("Please choose a repeat schedule");
      return;
    }

    const sourceTime = String(displayedSnapshot?.time || "").trim();
    const patientId = String(displayedPatientId || "").trim();
    const doctorName = displayedDoctorName || resolveDoctorName(displayedSnapshot?.doctor || displayedSnapshot?.doctorName || "");
    const basePrice = Number(displayedBasePrice) || 0;
    const discountAmount = Number(displayedDiscountAmount) || 0;
    const sourceTypeNumber =
      typeof displayedSnapshot?.type === "number"
        ? displayedSnapshot.type
        : typeof displayedSnapshot?.type === "string" && displayedSnapshot.type.trim()
          ? Number(displayedSnapshot.type)
          : NaN;
    const appointmentType = Number.isFinite(sourceTypeNumber) ? sourceTypeNumber : OTHER_APPOINTMENT_TYPE_INDEX;
    const customType = appointmentType === OTHER_APPOINTMENT_TYPE_INDEX
      ? String(displayedSnapshot?.customType || typeName || "Appointment").trim()
      : displayedSnapshot?.customType;

    setIsSavingRepeatSchedule(true);
    try {
      const resolvedRepeatSlot = await findNextAvailableRepeatSlot({
        startDate: repeatTargetDate,
        doctorToCheck: doctorName,
        durationToCheck: selectedScheduleDuration,
        patientToCheck: patientId,
        timeToCheck: sourceTime,
        availabilityMode: "authenticated",
      });

      if (!resolvedRepeatSlot) {
        toast.error("No available repeat schedule found in the next 30 days");
        return;
      }

      const followUpDate = resolvedRepeatSlot.date;
      const followUpDateStr = formatDateToYYYYMMDD(followUpDate);
      const movedFromRequestedDate = followUpDateStr !== formatDateToYYYYMMDD(repeatTargetDate);

      const newAppointment = await addAppointment({
        patientId,
        patientName,
        doctor: doctorName,
        doctorId: displayedSnapshot?.doctorId,
        doctorName,
        date: followUpDateStr,
        time: resolvedRepeatSlot.time || sourceTime,
        type: appointmentType,
        customType,
        duration: normalizeBookingDuration(displayedSnapshot?.duration || 30),
        price: basePrice,
        discount: discountAmount,
        notes: buildRepeatScheduleNotes(displayedSnapshot?.notes, repeatSourceDate),
        treatmentNotes: displayedTreatmentNotesComparisonText || displayedSnapshot?.treatmentNotes || "",
        toothNumbers: displayedToothNumbersText || displayedSnapshot?.toothNumbers || "",
        serviceType: displayedSnapshot?.serviceType,
        status: "scheduled",
        paymentStatus: "unpaid",
        paymentMethod: "",
        totalPaid: 0,
        balance: Math.max(0, basePrice - discountAmount),
      } as any);

      try {
        window.dispatchEvent(
          new CustomEvent("appointments:updated", {
            detail: { appointment: newAppointment, appointmentId: newAppointment?.id },
          })
        );
        window.dispatchEvent(new Event("refreshNotifications"));
      } catch {}

      if (movedFromRequestedDate) {
        toast.success(`Repeat schedule moved to ${formatWordyDate(followUpDate)} because the requested date was unavailable.`);
      } else {
        toast.success("Repeat schedule created");
      }

      closeRepeatScheduleModal(true);
    } catch (error) {
      console.error("[AppointmentHistoryView] Failed to repeat schedule:", error);
      toast.error(error instanceof Error ? error.message : "Failed to repeat schedule");
    } finally {
      setIsSavingRepeatSchedule(false);
    }
  };

  const closeChangeTreatmentModal = (force = false) => {
    if (isSavingTreatmentChange && !force) return;

    setIsChangeTreatmentOpen(false);
    setSelectedTreatmentId(null);
    setCustomTreatmentName("");
    setSelectedTreatmentPrice("");
    setSelectedTreatmentDuration("30");
    setTreatmentToothNumberEntries([""]);
  };

  const openChangeTreatmentModal = () => {
    if (!canChangeTreatment) {
      toast.error("This snapshot cannot be edited");
      return;
    }

    const normalizeTreatmentLabel = (value: unknown) =>
      String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    const numericType =
      typeof displayedSnapshot?.type === "number"
        ? displayedSnapshot.type
        : typeof displayedSnapshot?.type === "string" && displayedSnapshot.type.trim()
          ? Number(displayedSnapshot.type)
          : NaN;
    const normalizedCurrentName = normalizeTreatmentLabel(typeName);
    const matchedTreatment = activeTreatmentOptions.find((option) =>
      option.id === numericType ||
      normalizeTreatmentLabel(option.label) === normalizedCurrentName ||
      normalizeTreatmentLabel(option.value) === normalizedCurrentName
    );
    const nextSelectedTreatmentId = matchedTreatment?.id ?? OTHER_APPOINTMENT_TYPE_INDEX;
    const currentPrice = pickNumericValue(displayedSnapshot.price, displayedBasePrice, matchedTreatment?.price) ?? 0;
    const currentDuration = normalizeBookingDuration(displayedSnapshot.duration || matchedTreatment?.duration || 30);

    setSelectedTreatmentId(nextSelectedTreatmentId);
    setCustomTreatmentName(
      nextSelectedTreatmentId === OTHER_APPOINTMENT_TYPE_INDEX
        ? String(displayedSnapshot.customType || typeName || "").trim()
        : ""
    );
    setSelectedTreatmentPrice(String(Math.max(0, Number(currentPrice) || 0)));
    setSelectedTreatmentDuration(String(currentDuration));
    setTreatmentToothNumberEntries(getBookingToothNumberEntries(displayedToothNumbersText));
    setIsChangeTreatmentOpen(true);
  };

  const handleSaveTreatmentChange = async () => {
    if (!appointmentId) {
      toast.error("No appointment id available");
      return;
    }

    if (!selectedTreatmentOption) {
      toast.error("Please select a treatment");
      return;
    }

    const isCustomTreatment = selectedTreatmentOption.id === OTHER_APPOINTMENT_TYPE_INDEX;
    const customType = isCustomTreatment ? customTreatmentName.trim() : "";
    if (isCustomTreatment && !customType) {
      toast.error("Custom treatment name is required");
      return;
    }

    const nextPrice = Number(selectedTreatmentPrice);
    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      toast.error("Enter a valid treatment price");
      return;
    }

    const nextDuration = normalizeBookingDuration(selectedTreatmentDuration || selectedTreatmentOption.duration || displayedSnapshot.duration || 30);
    const nextToothNumbers = normalizeBookingToothNumbers(treatmentToothNumberEntries);

    setIsSavingTreatmentChange(true);
    try {
      const updated = await updateAppointment(String(appointmentId), {
        type: selectedTreatmentOption.id,
        customType: isCustomTreatment ? customType : undefined,
        duration: nextDuration,
        price: Math.max(0, nextPrice),
        toothNumbers: nextToothNumbers,
      } as Partial<Appointment>);

      setDisplayedSnapshot((current: any) => ({
        ...current,
        ...updated,
        type: updated?.type ?? selectedTreatmentOption.id,
        customType: isCustomTreatment ? customType : updated?.customType,
        duration: updated?.duration ?? nextDuration,
        price: updated?.price ?? Math.max(0, nextPrice),
        toothNumbers: updated?.toothNumbers ?? nextToothNumbers,
      }));
      setLatestComparisonSnapshot(null);
      try {
        window.dispatchEvent(
          new CustomEvent("appointments:updated", {
            detail: { appointment: updated, appointmentId: String(appointmentId) },
          })
        );
        window.dispatchEvent(new Event("refreshNotifications"));
      } catch {}

      toast.success("Treatment updated");
      closeChangeTreatmentModal(true);
    } catch (error) {
      console.error("[AppointmentHistoryView] Failed to update treatment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update treatment");
    } finally {
      setIsSavingTreatmentChange(false);
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
          className="!fixed !bottom-0 !left-0 !top-auto !flex h-[94dvh] max-h-[94dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-[0_28px_90px_rgba(15,23,42,0.22)] data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:h-auto sm:max-h-[94vh] sm:w-[min(68rem,calc(100vw-2rem))] sm:max-w-[68rem] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.75rem]"
        >
          <DialogHeader className="shrink-0 bg-white px-5 pb-4 pt-3 sm:px-8 sm:pb-5 sm:pt-8">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                {snapshotHistory.length > 0 ? (
                  <Button size="icon" variant="ghost" className="mt-1 h-11 w-11 shrink-0 rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50" title="Go back to previous snapshot" onClick={goBackSnapshot}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                ) : null}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-violet-600 bg-white text-violet-700">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="min-w-0 pt-1">
                  <DialogTitle className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-950">
                    <span className="text-2xl font-black tracking-tight sm:text-[2rem]">Snapshot</span>
                    {showsLogSnapshotState ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`inline-flex cursor-help items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wider ${stateBadgeClass}`}>
                            <StateIcon className="h-4 w-4" />
                            {stateLabel}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px] border-amber-200 bg-amber-50 text-center text-amber-800">
                          {stateTooltipText}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wider ${stateBadgeClass}`}>
                        <StateIcon className="h-4 w-4" />
                        {stateLabel}
                      </span>
                    )}
                  </DialogTitle>
                  <DialogDescription className="mt-3 line-clamp-2 text-left text-sm font-semibold leading-6 text-slate-500 sm:text-base">
                    {timestampPrefix} {snapshotDate}{changeSuffix ? ` - ${changeSuffix}` : ""}
                  </DialogDescription>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 lg:justify-end">
                {canOpenAppointment ? (
                  <Button className="h-12 rounded-xl bg-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 active:scale-95 sm:h-14 sm:px-7 sm:text-base" title="Open this appointment" onClick={handleOpenAppointment}>
                    <CalendarIcon className="mr-2 h-5 w-5" />
                    Open
                  </Button>
                ) : null}
                {showsLogSnapshotState ? (
                  <Button className="h-12 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700 shadow-none transition-all hover:bg-amber-100 active:scale-95 sm:h-14" title={appointmentId ? "Open the current appointment snapshot" : "No appointment id available"} disabled={!appointmentId || isFetchingLogs} onClick={viewLatestSnapshot}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingLogs ? "animate-spin" : ""}`} />
                    Latest
                  </Button>
                ) : null}
                {canUseSnapshotActions ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-xl border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 sm:h-14 sm:w-14" aria-label="More appointment actions">
                        <EllipsisVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onSelect={handleOpenAppointment}>
                        <Eye className="mr-2 h-4 w-4" />
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={openChangeTreatmentModal} disabled={!canChangeTreatment || isLoadingTreatmentOptions}>
                        {isLoadingTreatmentOptions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stethoscope className="mr-2 h-4 w-4" />}
                        Change treatment
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={openChangeScheduleModal} disabled={!canChangeSchedule}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        Change schedule
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={openRepeatScheduleModal} disabled={!canRepeatSchedule}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Repeat Schedule
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
                <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-12 w-12 rounded-xl text-slate-600 hover:bg-slate-100 sm:h-14 sm:w-14" aria-label="Close snapshot">
                  <X className="h-7 w-7" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 pb-5 custom-scrollbar sm:px-8 sm:pb-7">
            <div className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
                <div className="flex flex-wrap gap-3">
                  <div className="min-w-[11.5rem] rounded-full border border-emerald-100 bg-emerald-50/70 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100">
                        <CalendarIcon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`truncate text-base font-black ${displayedStatusColors.textColor}`}>
                            {formatBookingHistoryStatusLabel(nextStatus || displayedSnapshot.status)}
                          </p>
                          <CurrentChangeIndicator change={statusCurrentChange} />
                        </div>
                        {prevStatus && nextStatus && prevStatusNorm && nextStatusNorm && !isInsignificantStatus(prevStatusNorm) && prevStatusNorm !== nextStatusNorm ? (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-slate-400"><History className="h-3 w-3" />Was {formatBookingHistoryStatusLabel(prevStatus)}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-[10.5rem] rounded-full border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-600 shadow-sm ring-1 ring-slate-200">
                        <WalletCards className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`truncate text-base font-black ${displayedPaymentStatusColors.textColor}`}>
                            {formatBookingHistoryStatusLabel(nextPaymentStatus || displayedSnapshot.paymentStatus)}
                          </p>
                          <CurrentChangeIndicator change={paymentStatusCurrentChange} />
                        </div>
                        {prevPaymentStatus && nextPaymentStatus && prevPaymentStatusNorm && nextPaymentStatusNorm && !isInsignificantStatus(prevPaymentStatusNorm) && prevPaymentStatusNorm !== nextPaymentStatusNorm ? (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-slate-400"><History className="h-3 w-3" />Was {formatBookingHistoryStatusLabel(prevPaymentStatus)}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-violet-100 bg-white p-4 shadow-[0_10px_30px_rgba(79,70,229,0.08)] sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-violet-200">
                        <Banknote className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <Label className="block text-xs font-black uppercase tracking-widest text-violet-700">Balance</Label>
                        <p className="mt-1 text-sm font-bold text-slate-500">To be settled</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-right">
                      <p className="text-3xl font-black tracking-tight text-violet-700 sm:text-4xl">{displayedBalanceNumeric !== null ? formatCurrencyLabel(displayedBalanceNumeric) : displayedBalanceLabel}</p>
                      <CurrentChangeIndicator change={balanceCurrentChange} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.08fr_1fr]">
                <div className="grid gap-4">
                  <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center gap-3 text-violet-700">
                      <Users className="h-6 w-6" />
                      <Label className="text-sm font-black uppercase tracking-wide">People</Label>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <button
                        type="button"
                        onClick={canGoToPatient ? goToPatient : undefined}
                        tabIndex={canGoToPatient ? 0 : -1}
                        aria-disabled={!canGoToPatient}
                        className={`group flex min-h-[5.25rem] w-full items-center gap-4 px-4 py-3 text-left transition-colors ${canGoToPatient ? "hover:bg-slate-50" : "cursor-default"}`}
                      >
                        <PatientAvatar src={resolvedPatientImage} name={patientName} dob={snapshotPatientDob} className="h-14 w-14 shrink-0 rounded-full border border-violet-100 shadow-sm" sizeClass="h-14 w-14 rounded-full" />
                        <div className="min-w-0 flex-1">
                          <Label className="block text-xs font-black uppercase tracking-widest text-slate-400">Patient</Label>
                          <div className="mt-1 flex min-w-0 items-center gap-2">
                            <p className="truncate text-lg font-black leading-tight text-slate-950">{patientName}</p>
                            <CurrentChangeIndicator change={patientCurrentChange} />
                          </div>
                        </div>
                        <ChevronRight className={`h-6 w-6 shrink-0 ${canGoToPatient ? "text-slate-500 transition-transform group-hover:translate-x-0.5" : "text-slate-300"}`} />
                      </button>

                      <button
                        type="button"
                        onClick={canAssignDoctor ? () => setIsAssignDoctorOpen(true) : canGoToDoctor ? goToDoctor : undefined}
                        tabIndex={canAssignDoctor || canGoToDoctor ? 0 : -1}
                        aria-disabled={!canAssignDoctor && !canGoToDoctor}
                        className={`group flex min-h-[5.25rem] w-full items-center gap-4 border-t border-slate-200 px-4 py-3 text-left transition-colors ${canAssignDoctor || canGoToDoctor ? "hover:bg-slate-50" : "cursor-default"}`}
                      >
                        <Avatar className="h-14 w-14 shrink-0 rounded-full border border-violet-100 shadow-sm">
                          <AvatarImage src={resolvedDoctorImage} alt={displayedDoctorName || "Doctor"} className="object-cover" />
                          <AvatarFallback className="rounded-full bg-violet-50 text-violet-700"><Stethoscope className="h-6 w-6" /></AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <Label className="block text-xs font-black uppercase tracking-widest text-slate-400">Doctor</Label>
                          <div className="mt-1 flex min-w-0 items-center gap-2">
                            <p className={`truncate text-lg font-black leading-tight ${canAssignDoctor ? "text-violet-700" : "text-slate-950"}`}>{canAssignDoctor ? "Assign doctor" : displayedDoctorName || "Unassigned"}</p>
                            <CurrentChangeIndicator change={doctorCurrentChange} />
                          </div>
                        </div>
                        <ChevronRight className={`h-6 w-6 shrink-0 ${canAssignDoctor || canGoToDoctor ? "text-slate-500 transition-transform group-hover:translate-x-0.5" : "text-slate-300"}`} />
                      </button>
                    </div>
                  </section>

                  <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-violet-700">
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="h-6 w-6" />
                        <Label className="text-sm font-black uppercase tracking-wide">Schedule</Label>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openChangeScheduleModal}
                        disabled={!canChangeSchedule}
                        className="h-10 rounded-full border-violet-100 bg-violet-50 px-5 text-sm font-black text-violet-700 shadow-none hover:bg-violet-100 hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Change
                      </Button>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="min-w-0 sm:border-r sm:border-slate-200 sm:pr-6">
                        <Label className="block text-xs font-black uppercase tracking-widest text-slate-500">Date</Label>
                        <div className="mt-2 flex items-start gap-2">
                          <p className="break-words text-lg font-black leading-tight text-slate-950">{formattedDate}</p>
                          <CurrentChangeIndicator change={dateCurrentChange} />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <Label className="block text-xs font-black uppercase tracking-widest text-slate-500">Time Slot</Label>
                        <div className="mt-2 flex items-start gap-2">
                          <p className="break-words text-lg font-black leading-tight text-slate-950">{displayedTimeLabel}</p>
                          <CurrentChangeIndicator change={timeCurrentChange} />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-violet-700">
                      <div className="flex items-center gap-3">
                        <Stethoscope className="h-6 w-6" />
                        <Label className="text-sm font-black uppercase tracking-wide">Service</Label>
                      </div>
                      {displayedToothNumbersText ? (
                        <span className="inline-flex max-w-full shrink-0 items-center rounded-full bg-violet-100 px-4 py-1.5 text-sm font-black text-violet-700">
                          Tooth # {displayedToothNumbersText}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                          <Stethoscope className="h-7 w-7" />
                        </span>
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-lg font-black leading-tight text-slate-950">{typeName}</p>
                          <CurrentChangeIndicator change={serviceCurrentChange} />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openChangeTreatmentModal}
                        disabled={!canChangeTreatment || isLoadingTreatmentOptions}
                        className="h-11 rounded-full border-violet-100 bg-violet-50 px-6 text-sm font-black text-violet-700 shadow-none hover:bg-violet-100 hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoadingTreatmentOptions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                        Change
                      </Button>
                    </div>
                  </section>
                </div>

                <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm lg:min-h-[28.25rem]">
                  <div className="flex items-center gap-3 text-violet-700">
                    <WalletCards className="h-6 w-6" />
                    <Label className="text-sm font-black uppercase tracking-wide">Payment</Label>
                  </div>
                  <div className="mt-12">
                    <div className="flex items-center gap-2">
                      <Label className="block text-sm font-bold uppercase tracking-wide text-slate-500">Price</Label>
                      <CurrentChangeIndicator change={priceCurrentChange} />
                    </div>
                    <div className="mt-4">
                      {displayedDiscountAmount > 0 ? (
                        <>
                          <div className="text-lg font-bold text-slate-300 line-through">{"\u20b1"}{Number(displayedBasePrice).toLocaleString()}</div>
                          <div className="text-4xl font-black tracking-tight text-slate-950">{"\u20b1"}{Number(displayedEffectivePrice).toLocaleString()}</div>
                        </>
                      ) : (
                        <span className="text-4xl font-black tracking-tight text-slate-950">{"\u20b1"}{(Number(displayedEffectivePrice) || 0).toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-10 border-t border-slate-200 pt-8">
                    <div className="flex items-center gap-3 text-slate-500">
                      <History className="h-5 w-5" />
                      <Label className="text-sm font-black uppercase tracking-wide">{paymentSectionTitle}</Label>
                    </div>
                    {hasAppointmentLifecycleAction ? (
                      <div className={`mt-5 rounded-2xl border p-4 ${appointmentLifecycleClass}`}>
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm">
                            <AppointmentLifecycleIcon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-widest">{appointmentLifecycleLabel}</p>
                            <p className="mt-2 text-sm font-bold leading-6">{appointmentLifecycleDetail}</p>
                            <p className="mt-2 text-xs font-bold opacity-75">
                              Logged on {snapshotDate}{changedByName ? ` by ${changedByName}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : shouldShowPaymentLine ? (
                      <div className={`mt-5 rounded-2xl border p-4 ${mainPaymentCardClass}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className={`text-xs font-black uppercase tracking-widest ${mainPaymentTextClass}`}>{snapshotPaymentLabel}</p>
                          <p className={`max-w-[45%] text-right text-sm font-black ${mainPaymentMethodTextClass}`}>{snapshotPaymentMethodLabel}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                          <p className={`text-2xl font-black ${mainPaymentTextClass}`}>{snapshotPaymentAmountLabel}</p>
                          <p className={`text-sm font-bold ${mainPaymentMutedTextClass}`}>
                            {snapshotPaymentDateLabel || "No date"}
                          </p>
                        </div>
                        {additionalPaymentRows.length > 0 ? (
                          <div className="mt-4">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setShowAdditionalPayments((current) => !current)}
                              className={`h-9 rounded-full px-0 text-sm font-black hover:bg-transparent ${mainPaymentTextClass}`}
                            >
                              {showAdditionalPayments ? "Show less" : `See more (${additionalPaymentRows.length})`}
                            </Button>
                            {showAdditionalPayments ? (
                              <div className={`mt-2 space-y-2 border-t pt-3 ${mainPaymentDividerClass}`}>
                                {additionalPaymentRows.map((payment) => (
                                  <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
                                    <p className="text-sm font-black text-emerald-700">{payment.amountLabel}</p>
                                    <div className="min-w-0 text-right">
                                      <p className="truncate text-xs font-black text-emerald-700/80">{payment.methodLabel}</p>
                                      <p className="mt-0.5 text-xs font-bold text-emerald-700/60">{payment.dateLabel}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-5 max-w-[18rem] text-base font-semibold italic leading-7 text-slate-500">
                        No payment recorded for this snapshot.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3 text-violet-700">
                  <FileText className="h-6 w-6" />
                  <Label className="text-sm font-black uppercase tracking-wide">Treatment Notes</Label>
                  <CurrentChangeIndicator change={treatmentNotesCurrentChange} />
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className={`max-h-32 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-base font-semibold leading-7 custom-scrollbar ${displayedTreatmentNotesComparisonText ? "text-slate-600" : "italic text-slate-500"}`}>{displayedTreatmentNotesText}</p>
                </div>
              </section>

              {displayedSnapshot.status === "cancelled" && displayedSnapshot.cancellationReason ? (
                <section className="rounded-[1.25rem] border border-red-100 bg-red-50/60 p-4 shadow-sm sm:p-5">
                  <div className="flex items-center gap-3 text-red-600">
                    <AlertTriangle className="h-6 w-6" />
                    <Label className="text-sm font-black uppercase tracking-wide">Cancellation Reason</Label>
                    <CurrentChangeIndicator change={cancellationReasonCurrentChange} />
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-red-100 bg-white px-4 py-3 text-base font-bold leading-7 text-red-700/80">{displayedSnapshot.cancellationReason}</p>
                </section>
              ) : null}

              <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3 text-violet-700">
                  <FileText className="h-6 w-6" />
                  <Label className="text-sm font-black uppercase tracking-wide">Remarks</Label>
                  <CurrentChangeIndicator change={notesCurrentChange} />
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className={`max-h-32 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-base font-semibold leading-7 custom-scrollbar ${displayedNotesComparisonText ? "text-slate-600" : "italic text-slate-500"}`}>{displayedNotesText}</p>
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="shrink-0 !flex-col !items-stretch !justify-center gap-3 border-t border-slate-200 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm sm:px-8">
            {canShowSnapshotActions ? (
              <div className="-mx-5 -mt-4 mb-1 border-b border-amber-100 bg-amber-50/70 px-5 py-3 sm:-mx-8 sm:px-8">
                <p className="flex items-start justify-center gap-2 text-center text-sm font-semibold leading-5 text-amber-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{actionNoteText}</p>
              </div>
            ) : null}
            {canShowSnapshotActions ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button className="h-12 w-full rounded-xl bg-emerald-600 text-base font-black text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700 active:scale-95" onClick={() => openApproveConfirm(displayedSnapshot)}><CheckCircle2 className="mr-2 h-5 w-5" />Accept</Button>
                <Button className="h-12 w-full rounded-xl border-red-200 bg-white text-base font-black text-red-500 shadow-sm transition-all hover:bg-red-50 active:scale-95" onClick={() => openRejectConfirm(displayedSnapshot)} variant="outline"><AlertTriangle className="mr-2 h-5 w-5" />Decline</Button>
              </div>
            ) : null}
            {canRestoreNotification ? (
              <Button className="h-12 w-full rounded-xl bg-violet-600 text-sm font-black text-white shadow-sm transition-all hover:bg-violet-700 active:scale-95" onClick={async () => { await onRestoreNotification?.(restoreNotificationId!); onOpenChange(false); }}><RefreshCw className="mr-2 h-4 w-4" />Restore</Button>
            ) : null}
            <div className="flex justify-center">
              <Button onClick={() => onOpenChange(false)} variant="outline" className="h-14 min-w-[11rem] rounded-xl border-slate-200 bg-white px-8 text-base font-black text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900">Close</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRepeatScheduleOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeRepeatScheduleModal();
          else setIsRepeatScheduleOpen(true);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100vw-1.25rem)] max-w-[520px] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl"
        >
          <DialogHeader className="border-b border-slate-100 px-6 pb-5 pt-6 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <RotateCcw className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-2xl font-black tracking-tight text-slate-950">Repeat Schedule</DialogTitle>
                  <DialogDescription className="mt-1 text-sm font-semibold text-slate-500">
                    {patientName ? `${typeName} for ${patientName}` : typeName}
                  </DialogDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => closeRepeatScheduleModal()}
                disabled={isSavingRepeatSchedule}
                className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100"
                aria-label="Close repeat schedule"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-5 px-6 py-6">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm font-bold text-slate-600">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">From</span>
                <span className="text-right text-slate-900">
                  {repeatSourceDate ? formatWordyDate(repeatSourceDate) : "No date"} at {formatAppointmentTimeRange(displayedSnapshot?.time, displayedSnapshot?.duration)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Doctor</span>
                <span className="truncate text-right text-slate-900">{displayedDoctorName || "No doctor assigned"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Repeat this appointment</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select value={repeatOption} onValueChange={handleRepeatOptionChange} disabled={isSavingRepeatSchedule}>
                  <SelectTrigger className="h-11 rounded-full border-0 bg-slate-100 px-4 text-sm font-black text-slate-900 shadow-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value={REPEAT_NONE_OPTION} className="mx-2 my-1 rounded-xl">
                      Do not repeat
                    </SelectItem>
                    {REPEAT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="mx-2 my-1 rounded-xl">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {repeatOption === "custom" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full border-0 bg-blue-50 px-4 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-100"
                    onClick={() => setIsCustomRepeatDatePickerOpen(true)}
                    disabled={isSavingRepeatSchedule}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customRepeatDate
                      ? formatWordyDate(parseLocalDateOnly(customRepeatDate), { fallback: "Pick date" })
                      : "Pick date"}
                  </Button>
                ) : null}
              </div>
            </div>

            {repeatOption !== REPEAT_NONE_OPTION ? (
              <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold leading-6 text-blue-700">
                {repeatTargetDate
                  ? `This appointment will be cloned to ${repeatTargetLabel}.`
                  : "Choose a custom clone date to schedule the follow-up."}
              </p>
            ) : (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-6 text-slate-500">
                Select a repeat option to create another appointment from this schedule.
              </p>
            )}
          </div>

          <DialogFooter className="flex gap-3 border-t border-slate-200 bg-slate-50/80 p-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => closeRepeatScheduleModal()}
              disabled={isSavingRepeatSchedule}
              className="h-12 flex-1 rounded-xl border-slate-200 bg-white text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveRepeatSchedule}
              disabled={!canSaveRepeatSchedule}
              className="h-12 flex-1 rounded-xl bg-blue-600 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-blue-100 hover:bg-blue-700"
            >
              {isSavingRepeatSchedule ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Create Repeat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DatePickerModal
        open={isCustomRepeatDatePickerOpen}
        onOpenChange={setIsCustomRepeatDatePickerOpen}
        selectedDate={customRepeatDate || repeatTargetDate || repeatSourceDate}
        onDateSelect={(date) => setCustomRepeatDate(formatDateToYYYYMMDD(date))}
        doctorName={displayedDoctorName}
        patientId={String(displayedPatientId || "")}
        selectedTime={String(displayedSnapshot?.time || "")}
        duration={selectedScheduleDuration}
        minDate={repeatSourceDate}
        title="Choose follow-up date"
        subtitle="Pick a date for the cloned appointment."
        disableDatesWithTimeConflict={true}
        timeConflictMessage="This doctor already has an appointment at the selected time on this day."
        disableDatesOnOrBeforeMinDate={true}
      />

      <SelectScheduleModal
        open={isChangeScheduleOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeChangeScheduleModal();
        }}
        title="Change Schedule"
        description={patientName ? `${typeName} for ${patientName}` : typeName}
        appointmentLabel={typeName}
        doctorLabel={displayedDoctorName || "No doctor assigned"}
        selectedDate={selectedScheduleDisplayDate}
        selectedTime={selectedScheduleTime}
        onDateClick={() => setIsScheduleDatePickerOpen(true)}
        onTimeClick={() => setIsScheduleTimePickerOpen(true)}
        onSave={handleSaveScheduleChange}
        onCancel={() => closeChangeScheduleModal()}
        isSaving={isSavingScheduleChange}
        canSave={canSaveScheduleChange}
        saveLabel="Save Schedule"
      />

      <DatePickerModal
        open={isScheduleDatePickerOpen}
        onOpenChange={setIsScheduleDatePickerOpen}
        selectedDate={selectedScheduleDisplayDate}
        onDateSelect={handleScheduleDateSelect}
        doctorName={displayedDoctorName}
        patientId={String(displayedPatientId || "")}
        selectedTime={selectedScheduleTime}
        duration={selectedScheduleDuration}
        dateSelectionMode="edit"
        excludeAppointmentId={String(appointmentId || "")}
      />

      {selectedScheduleDisplayDate ? (
        <TimePickerModal
          open={isScheduleTimePickerOpen}
          onOpenChange={setIsScheduleTimePickerOpen}
          selectedDate={selectedScheduleDisplayDate}
          selectedTime={selectedScheduleTime}
          doctorName={displayedDoctorName}
          duration={selectedScheduleDuration}
          onTimeSelect={handleScheduleTimeSelect}
          onDateChange={handleScheduleDateSelect}
          excludeAppointmentId={String(appointmentId || "")}
          patientId={String(displayedPatientId || "")}
          dateSelectionMode="edit"
        />
      ) : null}

      <SelectTreatmentModal
        open={isChangeTreatmentOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeChangeTreatmentModal();
        }}
        title="Change Treatment"
        description={patientName ? `${typeName} for ${patientName}` : typeName}
        treatments={activeTreatmentOptions}
        selectedTreatmentId={selectedTreatmentId}
        currentTreatmentLabel={typeName}
        customTreatmentName={customTreatmentName}
        selectedPrice={selectedTreatmentPrice}
        selectedDuration={selectedTreatmentDuration}
        toothNumberEntries={treatmentToothNumberEntries}
        onCustomTreatmentNameChange={setCustomTreatmentName}
        onSelectedPriceChange={setSelectedTreatmentPrice}
        onSelectedDurationChange={setSelectedTreatmentDuration}
        onToothNumberEntriesChange={setTreatmentToothNumberEntries}
        onTreatmentSelect={(treatment) => {
          setSelectedTreatmentId(treatment.id);
          setSelectedTreatmentPrice(String(Math.max(0, Number(treatment.price || 0))));
          setSelectedTreatmentDuration(String(normalizeBookingDuration(treatment.duration || 30)));
          if (treatment.id !== OTHER_APPOINTMENT_TYPE_INDEX) {
            setCustomTreatmentName("");
          } else if (!customTreatmentName.trim()) {
            setCustomTreatmentName(typeName);
          }
        }}
        onSave={handleSaveTreatmentChange}
        onCancel={() => closeChangeTreatmentModal()}
        isSaving={isSavingTreatmentChange}
        canSave={canSaveTreatmentChange}
        saveLabel="Save Treatment"
      />

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
            <SelectDoctorModal className="mx-auto max-w-[38rem]" onDoctorAdded={() => void reloadDoctors()}>
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
