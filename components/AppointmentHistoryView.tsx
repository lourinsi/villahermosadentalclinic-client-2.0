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
import BookingAppointmentHistory, { getMergedBookingLogs } from "./BookingAppointmentHistory";
import { Calendar as CalendarIcon, Clock, Stethoscope, Banknote, Calculator, AlertTriangle, CheckCircle2, History, ArrowLeft, RefreshCw, X, Pencil, Plus, User, Loader2, Check, ChevronRight, FileText, Users, WalletCards, EllipsisVertical, RotateCcw, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PatientAvatar from "./PatientAvatar";
import AppointmentPatientChoiceDialog from "./AppointmentPatientChoiceDialog";
import { SelectPatientModal, type PatientSelectOption } from "./SelectPatientModal";
import { AppointmentActionsMenu, createAppointmentHistoryActions } from "./AppointmentActionsMenu";
import { getAppointmentTypeName, OTHER_APPOINTMENT_TYPE_INDEX } from "@/lib/appointment-types";
import { formatTimeTo12h } from "@/lib/time-slots";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import { toast } from "sonner";
import { useDoctors } from "@/hooks/useDoctors";
import { useAppointmentTypeOptions } from "@/hooks/useAppointmentTypeOptions";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import { useAppointmentStatuses } from "@/hooks/useAppointmentStatuses";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
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
  getBookingTreatmentsValue,
  buildBookingTreatmentsPayload,
  normalizeBookingDuration,
  normalizeBookingToothNumbers,
  normalizeBookingPaymentMethod,
  normalizeBookingHistoryStatus,
  parseLocalDateOnly,
  findNextAvailableRepeatSlot,
} from "./sharedBookingLogic";

import { getDefaultAppointmentStatusColors, getDefaultPaymentStatusColors } from "@/lib/status-colors";
import { isCartAppointmentStatus, normalizeAppointmentStatus } from "@/lib/appointment-status";
import { findDoctorForSnapshot, normalizeDoctorIdentity } from "@/lib/doctor-identity";
import { getAppointmentPatientDisplayName } from "@/lib/patient-identity";
import { SelectDoctorModal } from "./SelectDoctorModal";
import { SelectTreatmentModal, type SelectTreatmentModalSection } from "./SelectTreatmentModal";
import { SelectScheduleModal } from "./SelectScheduleModal";
import { DatePickerModal } from "./DatePickerModal";
import { TimePickerModal } from "./TimePickerModal";
import { AppointmentStatusSelect } from "./AppointmentStatusSelect";
import { CurrencyText } from "./CurrencyAmount";
import { CurrentChangeIndicator, createCurrentFieldChange } from "./HistorySnapshotUI";

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
type SnapshotAuditChange = {
  field: string;
  previousValue: string;
  snapshotValue: string;
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

const getPaymentAdjustmentDetails = (log: any) =>
  log?.paymentAdjustment ||
  log?.paymentAdjustmentDetails ||
  log?.newState?.paymentAdjustment ||
  log?.newState?._paymentAdjustment ||
  null;

const getPaymentAdjustmentId = (log: any) =>
  String(
    getPaymentAdjustmentDetails(log)?.paymentId ||
    log?.paymentId ||
    log?.paymentRecordId ||
    ""
  ).trim();

const getHistoryTimestamp = (value: unknown) => {
  const timestamp = new Date(String(value || "")).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export default function AppointmentHistoryView({ open, onOpenChange, appointmentSnapshot, logDate, onViewCurrent, onOpenAppointment, isAppointmentOpen, isHistorical, actionsDisabled = false, restoreNotificationId, onRestoreNotification, openedFromBookingModal = false, showPreviousInputChanges = true, selectedPaymentSnapshot, useCurrentAppointmentDetails = false }: AppointmentHistoryViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [displayedSnapshot, setDisplayedSnapshot] = useState<any | null>(appointmentSnapshot);
  const [snapshotState, setSnapshotState] = useState<SnapshotState>(Boolean(isHistorical) ? "historical" : "current");
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [isAssignDoctorOpen, setIsAssignDoctorOpen] = useState(false);
  const [isPatientChoiceOpen, setIsPatientChoiceOpen] = useState(false);
  const [isSelectPatientOpen, setIsSelectPatientOpen] = useState(false);
  const [isAssigningDoctor, setIsAssigningDoctor] = useState(false);
  const [isOpeningPaymentEdit, setIsOpeningPaymentEdit] = useState(false);
  const [patientRecord, setPatientRecord] = useState<any | null>(null);
  const [latestPaymentLogAmount, setLatestPaymentLogAmount] = useState<number | null>(null);
  const [latestPaymentLogDate, setLatestPaymentLogDate] = useState<string>("");
  const [latestPaymentLogMethod, setLatestPaymentLogMethod] = useState<string>("");
  const [paymentLogEntries, setPaymentLogEntries] = useState<any[]>([]);
  const [paymentLogsRefreshKey, setPaymentLogsRefreshKey] = useState(0);
  const [historyLogsRefreshKey, setHistoryLogsRefreshKey] = useState(0);
  const [showAdditionalPayments, setShowAdditionalPayments] = useState(false);
  const [isAuditHistoryExpanded, setIsAuditHistoryExpanded] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [paymentHistoryLogs, setPaymentHistoryLogs] = useState<any[]>([]);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isLoadingHistoryLogs, setIsLoadingHistoryLogs] = useState(false);
  const [latestComparisonSnapshot, setLatestComparisonSnapshot] = useState<any | null>(null);
  const [selectedFocusedPaymentSnapshot, setSelectedFocusedPaymentSnapshot] = useState<any | null>(null);
  const [snapshotHistory, setSnapshotHistory] = useState<Array<{ snapshot: any; snapshotState: SnapshotState }>>([]);
  const [isChangeScheduleOpen, setIsChangeScheduleOpen] = useState(false);
  const [isSavingScheduleChange, setIsSavingScheduleChange] = useState(false);
  const [isScheduleDatePickerOpen, setIsScheduleDatePickerOpen] = useState(false);
  const [isScheduleTimePickerOpen, setIsScheduleTimePickerOpen] = useState(false);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<Date | null>(null);
  const [selectedScheduleTime, setSelectedScheduleTime] = useState("");
  const [selectedScheduleDuration, setSelectedScheduleDuration] = useState("30");
  const [selectedScheduleStatus, setSelectedScheduleStatus] = useState("scheduled");
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
  const [selectedTreatmentSections, setSelectedTreatmentSections] = useState<SelectTreatmentModalSection[] | null>(null);
  const { doctors, isLoadingDoctors, reloadDoctors } = useDoctors(open ? 1 : undefined, { enabled: open });
  const { statuses: APPOINTMENT_STATUSES } = useAppointmentStatuses();
  const { effectiveRole } = useAdminViewMode();
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
    if (!open) return;
    setDisplayedSnapshot(appointmentSnapshot);
    setSelectedFocusedPaymentSnapshot(null);
    // Prefer explicit snapshot metadata when available. If the snapshot includes
    // `_isHistorical` (set by `fetchSnapshotFromLogs`), honor that value. Otherwise
    // fall back to the `isHistorical` prop provided by the caller.
    const derivedHistorical = shouldUseCurrentAppointmentDetails
      ? false
      : appointmentSnapshot && Object.prototype.hasOwnProperty.call(appointmentSnapshot, "_isHistorical")
      ? Boolean(appointmentSnapshot._isHistorical)
      : Boolean(isHistorical);
    setSnapshotState(derivedHistorical ? "historical" : "current");
  }, [open, appointmentSnapshot, isHistorical, shouldUseCurrentAppointmentDetails]);

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
      setIsPatientChoiceOpen(false);
      setIsSelectPatientOpen(false);
      setSelectedTreatmentId(null);
      setCustomTreatmentName("");
      setSelectedTreatmentPrice("");
      setSelectedTreatmentDuration("30");
      setTreatmentToothNumberEntries([""]);
    }
  }, [open]);

  useEffect(() => {
    setIsAuditHistoryExpanded(false);
  }, [displayedSnapshot]);

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
        setHistoryLogsRefreshKey((key) => key + 1);
      }
    };

    window.addEventListener("payments:updated", handlePaymentsUpdated as EventListener);
    return () => window.removeEventListener("payments:updated", handlePaymentsUpdated as EventListener);
  }, [open, displayedAppointmentId]);

  useEffect(() => {
    const appointmentId = String(displayedAppointmentId || "").trim();
    if (!open || !appointmentId || typeof window === "undefined") return;

    const handleAppointmentUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{
        appointmentId?: string | number | null;
        appointment?: { id?: string | number | null } | null;
      }>).detail;
      const changedAppointmentId = String(
        detail?.appointmentId ?? detail?.appointment?.id ?? ""
      ).trim();

      if (!changedAppointmentId || changedAppointmentId === appointmentId) {
        setHistoryLogsRefreshKey((key) => key + 1);
      }
    };

    window.addEventListener("appointments:updated", handleAppointmentUpdated as EventListener);
    return () => window.removeEventListener("appointments:updated", handleAppointmentUpdated as EventListener);
  }, [open, displayedAppointmentId]);

  useEffect(() => {
    const appointmentId = String(displayedAppointmentId || "").trim();
    if (!open || !appointmentId || isHistorical) return;

    const controller = new AbortController();
    const refreshCurrentSnapshotOnOpen = async () => {
      try {
        const response = await fetch(
          apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}?t=${Date.now()}`),
          {
            credentials: "include",
            headers: getAuthHeaders(),
            signal: controller.signal,
          }
        );
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.data) return;

        setDisplayedSnapshot({
          ...result.data,
          id: result.data.id || appointmentId,
          appointmentId,
          _isHistorical: false,
        });
        setSelectedFocusedPaymentSnapshot(null);
        setSnapshotState("current");
        setLatestComparisonSnapshot(result.data);
        setShowAdditionalPayments(false);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.warn("[AppointmentHistoryView] Failed to refresh current appointment on open:", error);
        }
      }
    };

    void refreshCurrentSnapshotOnOpen();
    return () => controller.abort();
  }, [open, displayedAppointmentId, isHistorical]);

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
          `/api/payments/appointment/${encodeURIComponent(appointmentId)}${snapshotState === "historical" ? "?includeDeleted=true" : ""}`,
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

  useEffect(() => {
    const appointmentId = String(displayedAppointmentId || "").trim();
    if (!open || !appointmentId || typeof window === "undefined") {
      setHistoryLogs([]);
      setPaymentHistoryLogs([]);
      return;
    }

    let cancelled = false;
    const loadHistoryLogs = async () => {
      setIsLoadingHistoryLogs(true);
      try {
        const [appointmentResponse, paymentResponse] = await Promise.all([
          fetch(apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}/logs`), {
            credentials: "include",
            headers: getAuthHeaders(),
          }),
          fetch(apiUrl(`/api/payments/appointment/${encodeURIComponent(appointmentId)}?includeDeleted=true`), {
            credentials: "include",
            headers: getAuthHeaders(),
          }),
        ]);

        const appointmentPayload = await appointmentResponse.json().catch(() => null);
        const paymentPayload = await paymentResponse.json().catch(() => null);
        const fetchedAppointmentLogs = appointmentResponse.ok && appointmentPayload?.success && Array.isArray(appointmentPayload.data)
          ? appointmentPayload.data
          : [];
        const fetchedPaymentLogs = paymentResponse.ok && paymentPayload?.success && Array.isArray(paymentPayload.data)
          ? paymentPayload.data
          : [];

        if (!cancelled) {
          setHistoryLogs(fetchedAppointmentLogs);
          setPaymentHistoryLogs(fetchedPaymentLogs);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("[AppointmentHistoryView] Failed to load history logs:", error);
          setHistoryLogs([]);
          setPaymentHistoryLogs([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistoryLogs(false);
        }
      }
    };

    loadHistoryLogs();
    return () => {
      cancelled = true;
    };
  }, [open, displayedAppointmentId, paymentLogsRefreshKey, historyLogsRefreshKey]);

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
  const latestStateForComparison = latestComparisonSnapshot ? getComparableSnapshotState(latestComparisonSnapshot) : null;
  const displayedBookingTreatments = getBookingTreatmentsValue(displayedSnapshot);
  const latestBookingTreatments = getBookingTreatmentsValue(latestStateForComparison);
  const primaryDisplayedTreatment = displayedBookingTreatments[0];
  const latestPrimaryBookingTreatment = latestBookingTreatments[0];
  const typeName = resolveAppointmentTypeName(
    primaryDisplayedTreatment?.type ?? displayedSnapshot.type ?? displayedSnapshot.serviceType,
    primaryDisplayedTreatment?.customType ?? displayedSnapshot.customType
  );
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
  const latestMergedHistoryLog = getMergedBookingLogs(historyLogs, paymentHistoryLogs)[0];
  const latestMergedHistoryActor =
    latestMergedHistoryLog?.changedByName ||
    latestMergedHistoryLog?.changedBy ||
    "";
  const changedByName =
    displayedSnapshot.changedByName ||
    displayedSnapshot.changedBy ||
    appointmentSnapshot?.changedByName ||
    appointmentSnapshot?.changedBy ||
    latestMergedHistoryActor ||
    "";
  const snapshotActorName = changedByName || "Unknown";
  const isPastSnapshot = snapshotState === "historical";
  // Consider the snapshot to be a "log view" only when it's actually historical.
  // Many snapshots reconstructed from logs include `previousState`/`newState` metadata
  // but may represent the most-recent (current) state — those should not be shown as
  // historical. Use `snapshotState` (which prefers `_isHistorical` when available)
  // as the authoritative source.
  const openedFromLog = isPastSnapshot;

  const isDeletedAppointmentState = (state: any) => {
    const status = normalizeBookingHistoryStatus(state?.status);
    if (state?.deleted === true || status === "deleted") return true;
    if (state?.deleted === false || status) return false;
    return Boolean(state?.deletedAt);
  };
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

  const focusedPaymentSnapshot = selectedPaymentSnapshot || selectedFocusedPaymentSnapshot || displayedSnapshot?._selectedPaymentSnapshot || displayedSnapshot?._focusedPaymentSnapshot || null;
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
  const formatCurrencyLabel = (value: number) => `\u20b1${Number(value).toLocaleString()}`;
  const snapshotPaymentAmount = hasPaidInSnapshot
    ? paidInSnapshotAmount
    : shouldShowLatestPayment
      ? latestPaymentAmount
      : 0;
  const snapshotPaymentAmountLabel = isPaymentAdjustmentSnapshot && paymentAdjustment.newAmount !== null
    ? formatCurrencyLabel(paymentAdjustment.newAmount)
    : `\u20b1${snapshotPaymentAmount.toLocaleString()}`;
  const snapshotPaymentAmountTitle = isPaymentAdjustmentSnapshot
    ? formatBookingPaymentAdjustmentAmountLabel(displayedSnapshot)
    : snapshotPaymentAmountLabel;
  const snapshotPreviousPaymentAmountLabel =
    isPaymentAdjustmentSnapshot && paymentAdjustment.previousAmount !== null
      ? `from ${formatCurrencyLabel(paymentAdjustment.previousAmount)}`
      : "";

  // Compute total paid (price - remaining balance) when possible, fallback to snapshot payment
  const fallbackTotalPaidAmount = (displayedBalanceNumeric !== null && Number.isFinite(Number(displayedEffectivePrice)))
    ? Math.max(0, Number(displayedEffectivePrice) - Number(displayedBalanceNumeric))
    : (snapshotPaymentAmount ?? 0);

  const displayedBalanceLabel = displayedBalanceNumeric !== null
    ? `\u20b1${Number(displayedBalanceNumeric).toLocaleString()}`
    : (displayedSnapshot.balance !== undefined && displayedSnapshot.balance !== null ? String(displayedSnapshot.balance) : "\u20b10");

  const normalizeNumberComparison = (value: unknown) => {
    const numeric = parseCurrencyNumber(value);
    return numeric === null ? normalizeComparableText(value) : String(numeric);
  };
  const formatLongDate = (value: unknown) =>
    formatWordyDate(String(value || ""), {
      fallback: formatChangeValue(value || "No date"),
    });
  const paymentAdjustmentDateRaw = isPaymentAdjustmentSnapshot
    ? (
      displayedSnapshot?.paymentAdjustment?.newPaymentDate ||
      displayedSnapshot?.paymentAdjustment?.updatedPaymentDate ||
      displayedSnapshot?.paymentAdjustment?.paymentDate ||
      displayedSnapshot?.paymentAdjustmentDetails?.newPaymentDate ||
      displayedSnapshot?.paymentAdjustmentDetails?.updatedPaymentDate ||
      displayedSnapshot?.paymentAdjustmentDetails?.paymentDate ||
      displayedSnapshot?.newState?.paymentDate ||
      displayedSnapshot?.newState?.paymentDetails?.date ||
      displayedSnapshot?.newState?.transaction?.date ||
      displayedSnapshot?.paymentDate ||
      displayedSnapshot?.paymentDetails?.date ||
      displayedSnapshot?.transaction?.date ||
      logDate ||
      displayedSnapshot?.changedAt ||
      appointmentSnapshot?.paymentDate ||
      appointmentSnapshot?.newState?.paymentDate
    )
    : "";
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
  const snapshotPaymentDateRaw = isPaymentAdjustmentSnapshot
    ? paymentAdjustmentDateRaw
    : hasPaidInSnapshot
      ? paidInSnapshotPaymentDateRaw
      : shouldShowLatestPayment
        ? latestPaymentDateRaw
        : "";
  const snapshotPaymentDateLabel = snapshotPaymentDateRaw ? formatLongDate(snapshotPaymentDateRaw) : "";
  const snapshotTimestamp = getHistoryTimestamp(displayedSnapshot?.changedAt || logDate);
  const mergedHistoryForSnapshot = getMergedBookingLogs(historyLogs, paymentHistoryLogs);
  const selectedMergedHistoryIndex = Number.isInteger(displayedSnapshot?._mergedHistoryIndex)
    ? Number(displayedSnapshot._mergedHistoryIndex)
    : -1;
  const futureHistoryLogs = selectedMergedHistoryIndex >= 0
    ? mergedHistoryForSnapshot.slice(0, selectedMergedHistoryIndex)
    : mergedHistoryForSnapshot.filter((log) => getHistoryTimestamp(log?.changedAt) > snapshotTimestamp);
  const futurePaymentLifecycleById = new Map<string, "deleted" | "restored">();
  futureHistoryLogs.forEach((log) => {
    const notes = String(log?.notes || "").trim().toLowerCase();
    const action = notes.includes("payment restored")
      ? "restored"
      : notes.includes("payment deleted")
        ? "deleted"
        : null;
    if (!action) return;

    const state = log?.newState || log?.previousState || {};
    const paymentId = String(
      state?.paymentId ||
      state?.paymentRecordId ||
      log?.paymentId ||
      log?.paymentRecordId ||
      ""
    ).trim();
    // Logs are newest first, so retain the first (most current) lifecycle action.
    if (paymentId && !futurePaymentLifecycleById.has(paymentId)) {
      futurePaymentLifecycleById.set(paymentId, action);
    }
  });
  const futureDeletedPaymentSnapshots = futureHistoryLogs
    .filter((log) => String(log?.notes || "").toLowerCase().includes("payment deleted"))
    .map((log) => {
      const state = log?.newState || log?.previousState || {};
      const amount = Math.abs(Number(state?.paymentAmount || log?.amount || 0));
      const paymentId = String(state?.paymentId || state?.paymentRecordId || log?.paymentId || log?.paymentRecordId || "").trim();
      if (!paymentId || amount <= 0) return null;

      return {
        ...state,
        id: paymentId,
        paymentId,
        paymentRecordId: paymentId,
        amount,
        paymentAmount: amount,
        paymentDate: state?.paymentDate || log?.paymentDate || log?.date,
        paymentMethod: state?.paymentMethod || log?.paymentMethod,
        deleted: true,
        deletedAt: state?.paymentDeletedAt || log?.changedAt,
        paymentDeleted: true,
        paymentDeletedAt: state?.paymentDeletedAt || log?.changedAt,
      };
    })
    .filter(Boolean);
  const futureDeletedPaymentIds = new Set(
    futureDeletedPaymentSnapshots.map((payment: any) => getPaymentEntryIdentity(payment))
  );
  const historicalPaymentEntries = [...paymentLogEntries];
  if (isPastSnapshot) {
    futureDeletedPaymentSnapshots.forEach((deletedPayment: any) => {
      if (!historicalPaymentEntries.some((payment) => getPaymentEntryIdentity(payment) === getPaymentEntryIdentity(deletedPayment))) {
        historicalPaymentEntries.push(deletedPayment);
      }
    });
  }
  const paymentLogRows = historicalPaymentEntries
    .map((payment) => {
      const paymentId = getPaymentEntryIdentity(payment);
      const createdTimestamp = getHistoryTimestamp(payment?.createdAt);
      if (isPastSnapshot && snapshotTimestamp && createdTimestamp && createdTimestamp > snapshotTimestamp) return null;

      const currentAmount = getPaymentLogAmountValue(payment);
      const futureAdjustments = isPastSnapshot && snapshotTimestamp && paymentId
        ? historyLogs
            .filter((log) => {
              const adjustment = getPaymentAdjustmentDetails(log);
              return Boolean(
                adjustment?.isAdjustment &&
                getPaymentAdjustmentId(log) === paymentId &&
                getHistoryTimestamp(log?.changedAt) > snapshotTimestamp
              );
            })
            .sort((a, b) => getHistoryTimestamp(b?.changedAt) - getHistoryTimestamp(a?.changedAt))
        : [];
      const amount = futureAdjustments.reduce((historicalAmount, log) => {
        const previousAmount = Number(getPaymentAdjustmentDetails(log)?.previousAmount);
        return Number.isFinite(previousAmount) ? previousAmount : historicalAmount;
      }, currentAmount);
      const deletedAtTimestamp = getHistoryTimestamp(payment?.deletedAt || payment?.paymentDeletedAt);
      const deletedAfterSnapshot = futureDeletedPaymentIds.has(paymentId) || Boolean(
        isPastSnapshot && snapshotTimestamp && deletedAtTimestamp && deletedAtTimestamp > snapshotTimestamp
      );
      const wasAlreadyDeleted = Boolean(
        payment?.deleted && !deletedAfterSnapshot && (!snapshotTimestamp || !deletedAtTimestamp || deletedAtTimestamp <= snapshotTimestamp)
      );
      if (wasAlreadyDeleted) return null;

      const dateValue = getPaymentLogDateValue(payment);
      const amountChanged = Math.abs(amount - currentAmount) > 0.01;
      const amountDifference = Math.abs(currentAmount - amount);
      const latestLifecycleAction = futurePaymentLifecycleById.get(paymentId);
      const currentChange = latestLifecycleAction === "restored"
        ? { title: "Payment restored." }
        : latestLifecycleAction === "deleted" || deletedAfterSnapshot
          ? { title: "Payment deleted." }
        : amountChanged
          ? {
              title: `Payment ${currentAmount > amount ? "increased" : "decreased"} by ${formatCurrencyLabel(amountDifference)} (${formatCurrencyLabel(amount)} → ${formatCurrencyLabel(currentAmount)}).`,
            }
          : null;

      return {
        id: String(payment?.id || `${dateValue}-${amount}`),
        raw: payment,
        actionRaw: payment,
        amount,
        amountLabel: `\u20b1${amount.toLocaleString()}`,
        dateLabel: dateValue ? formatLongDate(dateValue) : "No date",
        methodLabel: normalizeBookingPaymentMethod(getPaymentLogMethodValue(payment)),
        currentChange,
        isCurrentlyDeleted: latestLifecycleAction === "restored"
          ? false
          : latestLifecycleAction === "deleted"
            ? true
            : Boolean(payment?.deleted || payment?.paymentDeleted),
      };
    })
    .filter((payment): payment is NonNullable<typeof payment> => Boolean(payment && payment.amount > 0));
  // The visible payment rows are the source of truth for the paid summary. This
  // preserves reconstructed historical payments (including payments deleted later)
  // while excluding records that were already deleted at the selected snapshot.
  const totalPaidAmount = paymentLogRows.length > 0
    ? paymentLogRows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    : fallbackTotalPaidAmount;
  const matchedCurrentPaymentRow = hasFocusedPaymentSnapshot
    ? paymentLogRows.find((payment) => isSamePaymentEntry(payment.raw, focusedPaymentSnapshot)) || null
    : null;
  const selectedPaymentRow = hasFocusedPaymentSnapshot
    ? {
        id: getPaymentEntryIdentity(focusedPaymentSnapshot) || `selected-${getPaymentLogDateValue(focusedPaymentSnapshot)}-${focusedPaymentAmount}`,
        raw: focusedPaymentSnapshot,
        actionRaw: matchedCurrentPaymentRow?.raw || focusedPaymentSnapshot,
        amount: focusedPaymentAmount,
        amountLabel: `\u20b1${focusedPaymentAmount.toLocaleString()}`,
        dateLabel: paidInSnapshotPaymentDateRaw ? formatLongDate(paidInSnapshotPaymentDateRaw) : "No date",
        methodLabel: normalizeBookingPaymentMethod(getPaymentLogMethodValue(focusedPaymentSnapshot)),
        currentChange:
          matchedCurrentPaymentRow?.currentChange ||
          (focusedPaymentAction === "restored"
            ? { title: "Payment restored." }
            : focusedPaymentAction === "deleted"
              ? { title: "Payment deleted." }
              : null),
        isCurrentlyDeleted: matchedCurrentPaymentRow?.isCurrentlyDeleted ?? focusedPaymentAction === "deleted",
      }
    : null;
  const mainPaymentRow = hasPaidInSnapshot
    ? selectedPaymentRow || {
        id: getPaymentEntryIdentity(displayedSnapshot) || `snapshot-${paidInSnapshotPaymentDateRaw}-${paidInSnapshotAmount}`,
        raw: displayedSnapshot,
        actionRaw: displayedSnapshot,
        amount: paidInSnapshotAmount,
        amountLabel: `\u20b1${paidInSnapshotAmount.toLocaleString()}`,
        dateLabel: paidInSnapshotPaymentDateRaw ? formatLongDate(paidInSnapshotPaymentDateRaw) : "No date",
        methodLabel: normalizeBookingPaymentMethod(getPaymentLogMethodValue(displayedSnapshot)),
        currentChange: null,
        isCurrentlyDeleted: Boolean(displayedSnapshot?.deleted || displayedSnapshot?.paymentDeleted),
      }
    : shouldShowLatestPayment
      ? paymentLogRows[0] || null
      : null;
  const displayedMainPaymentAmountLabel = !isPaymentAdjustmentSnapshot && mainPaymentRow
    ? mainPaymentRow.amountLabel
    : snapshotPaymentAmountLabel;
  const mainPaymentHistoryNote = focusedPaymentAction === "restored" ? "Was deleted" : "";
  const paymentAdjustmentDateKey = paymentAdjustmentDateRaw ? formatBookingDateKey(paymentAdjustmentDateRaw as any) : "";
  let removedAdjustmentDuplicatePayment = false;
  const additionalPaymentRows = paymentLogRows.filter((payment) => {
    if (mainPaymentRow && isSamePaymentEntry(payment.raw, mainPaymentRow.raw)) return false;

    if (isPaymentAdjustmentSnapshot && !removedAdjustmentDuplicatePayment && paymentAdjustment.newAmount !== null) {
      const amountMatches = Number(payment.amount) === Number(paymentAdjustment.newAmount);
      const paymentDateKey = formatBookingDateKey(getPaymentLogDateValue(payment.raw) as any);
      const dateMatches = !paymentAdjustmentDateKey || !paymentDateKey || paymentDateKey === paymentAdjustmentDateKey;

      if (amountMatches && dateMatches) {
        removedAdjustmentDuplicatePayment = true;
        return false;
      }
    }

    return true;
  });
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
  const latestHasTreatment = Boolean(
    latestStateForComparison &&
    (
      latestPrimaryBookingTreatment?.type !== undefined ||
      latestStateForComparison.type !== undefined ||
      latestStateForComparison.customType
    )
  );
  const latestTreatmentName = latestHasTreatment
    ? resolveAppointmentTypeName(
        latestPrimaryBookingTreatment?.type ?? latestStateForComparison.type ?? latestStateForComparison.serviceType,
        latestPrimaryBookingTreatment?.customType ?? latestStateForComparison.customType
      )
    : "";
  const latestTotalPaidAmount = latestBalanceNumeric !== null && latestEffectivePrice !== null
    ? Math.max(0, Number(latestEffectivePrice) - Number(latestBalanceNumeric))
    : null;
  const displayedNotesComparisonText = displayedSnapshot.notes || (displayedSnapshot.status === 'cancelled' ? displayedSnapshot.cancellationReason || "" : "");
  const latestNotesComparisonText = latestStateForComparison
    ? latestStateForComparison.notes || (latestStateForComparison.status === 'cancelled' ? latestStateForComparison.cancellationReason || "" : "")
    : undefined;
  const displayedNotesText = displayedNotesComparisonText || "No additional notes provided for this snapshot.";
  const displayedAppointmentTreatmentNotes = getBookingTreatmentNotesValue(displayedSnapshot);
  const latestAppointmentTreatmentNotes = latestStateForComparison ? getBookingTreatmentNotesValue(latestStateForComparison) : undefined;
  const displayedTreatmentNotesComparisonText =
    displayedAppointmentTreatmentNotes || primaryDisplayedTreatment?.treatmentNotes?.trim() || "";
  const latestTreatmentNotesComparisonText =
    latestAppointmentTreatmentNotes ||
    (latestPrimaryBookingTreatment?.treatmentNotes?.trim() ? latestPrimaryBookingTreatment.treatmentNotes : undefined);
  const displayedTreatmentNotesText = displayedTreatmentNotesComparisonText || "No treatment notes provided for this snapshot.";
  const displayedAppointmentToothNumbers = getBookingToothNumbersValue(displayedSnapshot);
  const latestAppointmentToothNumbers = latestStateForComparison ? getBookingToothNumbersValue(latestStateForComparison) : undefined;
  const displayedToothNumbersText =
    displayedAppointmentToothNumbers ||
    (primaryDisplayedTreatment?.toothNumbers ? normalizeBookingToothNumbers(primaryDisplayedTreatment.toothNumbers) : "");
  const latestToothNumbersText =
    latestAppointmentToothNumbers ||
    (latestPrimaryBookingTreatment?.toothNumbers ? normalizeBookingToothNumbers(latestPrimaryBookingTreatment.toothNumbers) : undefined);
  const activeTreatmentOptions = treatmentOptions.filter((option) => option.isActive !== false);
  const selectedTreatmentOption = activeTreatmentOptions.find((option) => option.id === selectedTreatmentId) || null;
  const isCustomSelectedTreatment = selectedTreatmentOption?.id === OTHER_APPOINTMENT_TYPE_INDEX;
  const additionalDisplayedTreatments = displayedBookingTreatments.slice(1);

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

  const snapshotAuditChanges: SnapshotAuditChange[] = (() => {
    const previous = isPlainObject(displayedSnapshot?.previousState) ? displayedSnapshot.previousState : null;
    const selected = isPlainObject(displayedSnapshot?.newState) ? displayedSnapshot.newState : null;
    if (!previous || !selected || !Object.keys(previous).length || previous.status === "none") return [];

    const changes: SnapshotAuditChange[] = [];
    const seenFields = new Set<string>();
    const readable = (value: unknown) => {
      if (value === null || value === undefined || String(value).trim() === "") return "Not set";
      if (typeof value === "boolean") return value ? "Yes" : "No";
      return String(value);
    };
    const addChange = (
      field: string,
      previousValue: unknown,
      snapshotValue: unknown,
      format: (value: unknown) => string = readable,
      normalize: (value: unknown) => string = normalizeComparableText,
      previousComparisonValue: unknown = previousValue,
      snapshotComparisonValue: unknown = snapshotValue
    ) => {
      if (seenFields.has(field) || normalize(previousComparisonValue) === normalize(snapshotComparisonValue)) return;
      seenFields.add(field);
      changes.push({ field, previousValue: format(previousValue), snapshotValue: format(snapshotValue) });
    };
    const firstDefined = (state: any, keys: string[]) => {
      for (const key of keys) {
        if (state?.[key] !== undefined) return state[key];
      }
      return undefined;
    };
    const money = (value: unknown) => {
      if (value === null || value === undefined || value === "") return "Not set";
      const numeric = parseCurrencyNumber(value);
      return numeric === null ? readable(value) : formatCurrencyLabel(numeric);
    };
    const status = (value: unknown) => value === null || value === undefined || value === ""
      ? "Not set"
      : formatBookingHistoryStatusLabel(value);
    const date = (value: unknown) => value === null || value === undefined || value === ""
      ? "Not set"
      : formatWordyDate(value as any, { fallback: readable(value) });
    const method = (value: unknown) => value === null || value === undefined || value === ""
      ? "Not set"
      : normalizeBookingPaymentMethod(value);
    const personName = (state: any, kind: "patient" | "doctor") => {
      if (kind === "doctor") return resolveDoctorDisplayNameFromSnapshot(state) || "Not set";
      const resolved = resolvePatientName(state);
      const rawId = String(state?.patientId || state?.patient_id || "").trim();
      if (rawId && resolved === rawId) {
        const recordId = String(patientRecord?.id || patientRecord?.patientId || "").trim();
        if (recordId === rawId) return resolvePatientName({ patient: patientRecord });
        return "Assigned patient";
      }
      return resolved || "Not set";
    };
    const patientIdentity = (state: any) => String(
      state?.patient?.id || state?.patientId || state?.patient_id ||
      state?.patient?.name || state?.patientName || state?.patient_name ||
      [state?.patientFirstName || state?.patient?.firstName, state?.patientLastName || state?.patient?.lastName].filter(Boolean).join(" ") ||
      ""
    ).trim();
    const doctorIdentity = (state: any) => String(
      state?.doctorId || state?.doctor?.id || state?.doctor?.name || state?.doctorName || state?.doctor || ""
    ).trim();
    const treatment = (state: any) => {
      if (state?.type === undefined && !state?.customType && !state?.serviceType) return "Not set";
      return resolveAppointmentTypeName(state?.type ?? state?.serviceType, state?.customType);
    };
    const treatmentSummary = (state: any) => {
      const treatments = getBookingTreatmentsValue(state);
      if (treatments.length > 0) {
        return treatments
          .map((treatment) => resolveAppointmentTypeName(treatment.type, treatment.customType))
          .filter(Boolean)
          .join(" • ") || "Not set";
      }
      return treatment(state);
    };
    const totalPaid = (state: any) => {
      const explicit = firstDefined(state, ["totalPaid", "paid", "amountPaid"]);
      if (explicit !== undefined) return explicit;
      const price = parseCurrencyNumber(firstDefined(state, ["price", "totalPrice"]));
      const discount = parseCurrencyNumber(firstDefined(state, ["discount", "discountAmount"])) ?? 0;
      const balance = parseCurrencyNumber(firstDefined(state, ["balance", "remaining", "balanceAmount"]));
      return price !== null && balance !== null ? Math.max(0, price - discount - balance) : undefined;
    };
    addChange("Appointment status", previous.status, selected.status, status, normalizeBookingHistoryStatus);
    addChange("Payment status", previous.paymentStatus, selected.paymentStatus, status, normalizeBookingHistoryStatus);
    addChange("Remaining balance", firstDefined(previous, ["balance", "remaining", "balanceAmount"]), firstDefined(selected, ["balance", "remaining", "balanceAmount"]), money, normalizeNumberComparison);
    addChange("Total paid", totalPaid(previous), totalPaid(selected), money, normalizeNumberComparison);
    addChange("Price", firstDefined(previous, ["price", "totalPrice"]), firstDefined(selected, ["price", "totalPrice"]), money, normalizeNumberComparison);
    addChange("Discount", firstDefined(previous, ["discount", "discountAmount"]), firstDefined(selected, ["discount", "discountAmount"]), money, normalizeNumberComparison);
    const previousPatientIdentity = patientIdentity(previous);
    const selectedPatientIdentity = patientIdentity(selected);
    const previousPatientName = personName(previous, "patient");
    const selectedPatientName = personName(selected, "patient");
    addChange(
      "Patient",
      previousPatientName === "Assigned patient" ? "Previous patient" : previousPatientName,
      selectedPatientName === "Assigned patient" ? "Selected patient" : selectedPatientName,
      readable,
      normalizeComparableText,
      previousPatientIdentity,
      selectedPatientIdentity
    );
    addChange(
      "Doctor",
      personName(previous, "doctor"),
      personName(selected, "doctor"),
      readable,
      normalizeDoctorName,
      doctorIdentity(previous),
      doctorIdentity(selected)
    );
    addChange("Appointment date", previous.date, selected.date, date, normalizeComparableDate);
    addChange(
      "Time slot",
      `${previous.time || ""}|${previous.duration || ""}`,
      `${selected.time || ""}|${selected.duration || ""}`,
      (value) => {
        const [time, duration] = String(value || "").split("|");
        return time ? formatAppointmentTimeRange(time, duration) : "Not set";
      }
    );
    const treatmentIdentityKey = (treatment: any) => {
      const appointmentType = resolveAppointmentTypeName(treatment?.type ?? treatment?.serviceType, treatment?.customType);
      const toothNumbers = normalizeBookingToothNumbers(treatment?.toothNumbers ?? treatment?.tooth_numbers);
      const notes = String(treatment?.treatmentNotes ?? treatment?.treatment_notes ?? "").trim();
      return `${normalizeComparableText(appointmentType)}|${normalizeComparableText(toothNumbers)}|${normalizeComparableText(notes)}`;
    };
    const treatmentLabel = (treatment: any) => {
      const appointmentType = resolveAppointmentTypeName(treatment?.type ?? treatment?.serviceType, treatment?.customType);
      const toothNumbers = normalizeBookingToothNumbers(treatment?.toothNumbers ?? treatment?.tooth_numbers);
      return toothNumbers ? `${appointmentType} - Tooth # ${toothNumbers}` : appointmentType;
    };
    const treatmentListSummary = (state: any) => {
      const treatments = getBookingTreatmentsValue(state);
      if (treatments.length > 0) {
        return treatments.map((treatment) => treatmentLabel(treatment)).join(" • ");
      }
      return treatment(state);
    };
    const treatmentsWithKeys = (state: any) =>
      getBookingTreatmentsValue(state).map((treatment) => ({
        key: treatmentIdentityKey(treatment),
        label: treatmentLabel(treatment),
      }));
    const previousTreatments = treatmentsWithKeys(previous);
    const selectedTreatments = treatmentsWithKeys(selected);
    const countTreatmentKeys = (items: { key: string; label: string }[]) => {
      return items.reduce((acc, item) => {
        if (!item.key) return acc;
        acc.set(item.key, (acc.get(item.key) || 0) + 1);
        return acc;
      }, new Map<string, number>());
    };
    const normalizeTreatmentDiff = (
      fromItems: { key: string; label: string }[],
      toItems: { key: string; label: string }[]
    ) => {
      const fromCounts = countTreatmentKeys(fromItems);
      const toCounts = countTreatmentKeys(toItems);
      const uniqueKeys = Array.from(new Set([...fromItems.map((item) => item.key), ...toItems.map((item) => item.key)]));
      const diffs: string[] = [];

      for (const key of uniqueKeys) {
        const fromCount = fromCounts.get(key) || 0;
        const toCount = toCounts.get(key) || 0;
        const item = toItems.find((t) => t.key === key) || fromItems.find((t) => t.key === key);
        const label = item?.label || "";
        const countDiff = toCount - fromCount;

        if (countDiff > 0) {
          for (let i = 0; i < countDiff; i += 1) {
            diffs.push(label);
          }
        }
      }

      return diffs;
    };
    const addedTreatments = normalizeTreatmentDiff(previousTreatments, selectedTreatments);
    const removedTreatments = normalizeTreatmentDiff(selectedTreatments, previousTreatments);

    addChange(
      "Service / treatment",
      treatmentListSummary(previous),
      treatmentListSummary(selected),
      readable,
      normalizeComparableText,
      treatmentListSummary(previous),
      treatmentListSummary(selected)
    );
    if (addedTreatments.length > 0) {
      addChange("Added treatment services", "None", addedTreatments.join(", "), readable, normalizeComparableText, "", addedTreatments.join(", "));
    }
    if (removedTreatments.length > 0) {
      addChange("Removed treatment services", removedTreatments.join(", "), "None", readable, normalizeComparableText, removedTreatments.join(", "), "");
    }
    addChange("Tooth numbers", getBookingToothNumbersValue(previous), getBookingToothNumbersValue(selected));
    addChange("Treatment notes", getBookingTreatmentNotesValue(previous), getBookingTreatmentNotesValue(selected));
    addChange("Remarks / notes", previous.notes, selected.notes);
    addChange("Cancellation reason", previous.cancellationReason, selected.cancellationReason);
    if (focusedPaymentAction === "deleted") {
      addChange("Payment state", "Active", "Deleted");
    } else if (focusedPaymentAction === "restored") {
      addChange("Payment state", "Deleted", "Active");
    } else if (appointmentLifecycleAction === "deleted") {
      addChange("Appointment state", "Active", "Deleted");
    } else if (appointmentLifecycleAction === "restored") {
      addChange("Appointment state", "Deleted", "Active");
    } else {
      addChange("Appointment deleted", Boolean(previous.deleted || previous.deletedAt), Boolean(selected.deleted || selected.deletedAt));
    }

    const adjustmentSource = displayedSnapshot?.paymentAdjustment || displayedSnapshot?.paymentAdjustmentDetails || selected?.paymentAdjustment || selected?._paymentAdjustment || {};
    const adjustment = getBookingPaymentAdjustment(displayedSnapshot);
    if (adjustment.isAdjustment && adjustment.previousAmount !== null && adjustment.newAmount !== null) {
      addChange("Selected payment", adjustment.previousAmount, adjustment.newAmount, money, normalizeNumberComparison);
    } else {
      addChange(
        "Selected payment",
        firstDefined(previous, ["paymentAmount", "amountPaidThisTransaction"]),
        firstDefined(selected, ["paymentAmount", "amountPaidThisTransaction"]),
        money,
        normalizeNumberComparison
      );
    }
    addChange(
      "Payment date",
      adjustmentSource.previousDate ?? adjustmentSource.previousPaymentDate ?? adjustmentSource.oldPaymentDate ?? adjustmentSource.fromPaymentDate ?? previous.paymentDate,
      adjustmentSource.newDate ?? adjustmentSource.newPaymentDate ?? adjustmentSource.updatedPaymentDate ?? adjustmentSource.toPaymentDate ?? selected.paymentDate,
      date,
      normalizeComparableDate
    );
    addChange(
      "Payment method",
      adjustmentSource.previousMethod ?? adjustmentSource.previousPaymentMethod ?? adjustmentSource.oldPaymentMethod ?? adjustmentSource.fromPaymentMethod ?? previous.paymentMethod,
      adjustmentSource.newMethod ?? adjustmentSource.newPaymentMethod ?? adjustmentSource.updatedPaymentMethod ?? adjustmentSource.toPaymentMethod ?? selected.paymentMethod,
      method
    );

    return changes;
  })();
  const hasLaterChanges = Boolean(
    latestStateForComparison &&
    snapshotState !== "historical" &&
    currentFieldChanges.some(Boolean)
  );
  const showsLogSnapshotState = isPastSnapshot;
  const showLatestSnapshotAction = isPastSnapshot || hasLaterChanges;
  const stateLabel = showsLogSnapshotState ? "Log" : "Current";
  const stateBadgeClass = showsLogSnapshotState
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const StateIcon = showsLogSnapshotState ? History : CheckCircle2;
  const timestampPrefix = showsLogSnapshotState ? "Logged on" : "Current as of";
  const stateTooltipText = isPastSnapshot
    ? 'Older log. Use "Latest" for current details.'
    : hasLaterChanges
    ? 'This snapshot has later changes. Use "Latest" for current details.'
    : 'This snapshot is current.';

  const patientChanged = isPatientChange(displayedSnapshot);
  const changeTag = patientChanged ? "Patient Changed" : "";

  const appointmentId = displayedAppointmentId;
  const canOpenAppointment = Boolean(!actionsDisabled && appointmentId && !showsLogSnapshotState && !isAppointmentOpen);
  const canUseSnapshotActions = Boolean(!actionsDisabled && appointmentId);
  const managementBasePath = getManagementBasePath(pathname);
  const patientRouteName = isIgnorablePatientName(patientName) ? "" : patientName;
  const doctorRouteName = displayedDoctorName || "";
  const canGoToPatient = Boolean(patientRouteName);
  const canGoToDoctor = Boolean(doctorRouteName);
  const canSelectAppointmentPatient = Boolean(
    canUseSnapshotActions &&
    !showsLogSnapshotState &&
    ["admin", "doctor", "receptionist"].includes(String(effectiveRole || ""))
  );
  const canOpenPatientChoice = Boolean(canSelectAppointmentPatient || canGoToPatient);
  const canAssignDoctor = Boolean(canUseSnapshotActions && !showsLogSnapshotState);
  const canChangeSchedule = Boolean(canUseSnapshotActions && !showsLogSnapshotState);
  const canChangeTreatment = Boolean(canUseSnapshotActions && !showsLogSnapshotState);
  const canChangeStatus = Boolean(canUseSnapshotActions && !showsLogSnapshotState);
  const selectedScheduleDisplayDate = selectedScheduleDate || resolveScheduleDateValue(displayedSnapshot?.date);
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
  const isTreatmentSectionValid = (section: SelectTreatmentModalSection) => {
    const selectedId = section.selectedTreatmentId;
    if (selectedId === undefined || selectedId === null) return false;
    const option = activeTreatmentOptions.find((t) => t.id === selectedId);
    if (!option) return false;
    if (option.id === OTHER_APPOINTMENT_TYPE_INDEX && !String(section.customTreatmentName || "").trim()) return false;
    const priceValue = Number(section.selectedPrice ?? option.price ?? 0);
    if (!Number.isFinite(priceValue) || priceValue < 0) return false;
    if (!String(section.selectedDuration ?? "").trim()) return false;
    return true;
  };

  const canSaveTreatmentChange = Boolean(
    canChangeTreatment &&
    !isSavingTreatmentChange &&
    !isLoadingTreatmentOptions &&
    (
      selectedTreatmentSections
        ? selectedTreatmentSections.length > 0 && selectedTreatmentSections.every(isTreatmentSectionValid)
        : selectedTreatmentOption &&
          (!isCustomSelectedTreatment || customTreatmentName.trim()) &&
          Number.isFinite(Number(selectedTreatmentPrice)) &&
          Number(selectedTreatmentPrice) >= 0 &&
          Boolean(selectedTreatmentDuration)
    )
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

  const handleStatusChange = async (nextStatus: string) => {
    if (!appointmentId) {
      toast.error("No appointment id available");
      return;
    }

    const normalizedStatus = normalizeAppointmentStatus(nextStatus);
    if (!normalizedStatus || isCartAppointmentStatus(normalizedStatus)) return;
    if (normalizedStatus === normalizeAppointmentStatus(String(displayedSnapshot?.status || ""))) return;

    try {
      const statusPatch: Partial<Appointment> = { status: normalizedStatus as Appointment["status"] };
      if (isDeletedAppointmentState(displayedSnapshot) || normalizedStatus === "deleted") {
        (statusPatch as any).deleted = false;
        if (normalizedStatus === "deleted") (statusPatch as any).deletedAt = displayedSnapshot?.deletedAt || new Date().toISOString();
      }
      const updated = await updateAppointment(String(appointmentId), statusPatch);
      setDisplayedSnapshot((current: any) => ({ ...current, ...updated, ...statusPatch }));
      setLatestComparisonSnapshot(null);
      window.dispatchEvent(new CustomEvent("appointments:updated", { detail: { appointment: updated, appointmentId: String(appointmentId) } }));
      window.dispatchEvent(new Event("refreshNotifications"));
      toast.success("Status updated");
    } catch (error) {
      console.error("[AppointmentHistoryView] Failed to update status:", error);
      toast.error("Failed to update status");
    }
  };

  const isStoredPaymentLogRow = (payment: any) => {
    const source = String(payment?.source || "").trim().toLowerCase();
    if (source === "payment-log" || source === "appointment-log") return true;

    return [payment?.id, payment?.transactionId, payment?.paymentId, payment?.paymentRecordId].some((value) => {
      const id = String(value || "").trim();
      return (
        id.startsWith("pay_log_") ||
        id.startsWith("payment-log-") ||
        id.startsWith("appointment-log-") ||
        id.startsWith("apt_log_")
      );
    });
  };

  const isLegacyPaymentRow = (payment: any) => String(payment?.id || "").startsWith("legacy-");
  const isReadOnlyPaymentRow = (payment: any) => isLegacyPaymentRow(payment) || isStoredPaymentLogRow(payment);
  const isDeletedPaymentEntry = (payment: any) => Boolean(
    payment?.deleted || payment?.paymentDeleted || payment?.deletedAt || payment?.paymentDeletedAt
  );

  const getRestorablePaymentEntryId = (payment: any) => {
    if (!isDeletedPaymentEntry(payment)) return "";
    return String(payment?.paymentId || payment?.paymentRecordId || payment?.id || "").trim();
  };

  const getEditablePaymentEntryId = (payment: any) => {
    if (isReadOnlyPaymentRow(payment)) return "";
    if (payment?.deleted || payment?.paymentDeleted || payment?.deletedAt || payment?.paymentDeletedAt) return "";

    const explicitPaymentId = payment?.paymentId || payment?.paymentRecordId || payment?.id;
    return explicitPaymentId ? String(explicitPaymentId).trim() : "";
  };

  const getPaymentEntryEditUnavailableMessage = (payment: any) => {
    if (payment?.deleted || payment?.paymentDeleted) {
      return "This payment has already been deleted.";
    }

    if (isLegacyPaymentRow(payment)) {
      return "This is a legacy recorded total and cannot be edited as a payment record.";
    }

    if (isStoredPaymentLogRow(payment)) {
      return "This payment log is not linked to an editable payment record.";
    }

    return "Could not find an editable payment record.";
  };

  const handleRecordPayment = () => {
    const appointment = getAppointmentForPayment();
    openPaymentFor(appointment, displayedPatientId || undefined, patientName || undefined);
  };

  const handleEditPaymentEntry = async (payment: any) => {
    const paymentId = getEditablePaymentEntryId(payment);
    if (!paymentId) {
      toast.error(getPaymentEntryEditUnavailableMessage(payment));
      return;
    }

    setIsOpeningPaymentEdit(true);
    try {
      openEditPaymentModal(
        paymentId,
        payment,
        String(displayedPatientId || payment?.patientId || ""),
        [getAppointmentForPayment()]
      );
    } catch (error) {
      console.error("[AppointmentHistoryView] Failed to open payment edit:", error);
      toast.error("Failed to open payment editor");
    } finally {
      setIsOpeningPaymentEdit(false);
    }
  };

  const handleDeletePaymentEntry = async (payment: any) => {
    const paymentId = getEditablePaymentEntryId(payment);
    if (!paymentId) {
      toast.error(getPaymentEntryEditUnavailableMessage(payment));
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/payments/${encodeURIComponent(paymentId)}`), {
        method: "DELETE",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        toast.error(result?.message || "Failed to delete payment");
        return;
      }

      const markDeletedPayment = (entry: any) => {
        const entryPaymentId = String(entry?.paymentId || entry?.paymentRecordId || entry?.id || entry?.transactionId || "").trim();
        if (!entryPaymentId) {
          return entry;
        }

        return entryPaymentId === paymentId || String(entry?.id || "") === String(payment?.id || "")
          ? {
              ...entry,
              deleted: true,
              deletedAt: new Date().toISOString(),
              paymentDeleted: true,
              paymentDeletedAt: new Date().toISOString(),
            }
          : entry;
      };

      setPaymentLogEntries((current: any[]) => current.map(markDeletedPayment));
      setPaymentHistoryLogs((current: any[]) => current.map(markDeletedPayment));
      setSelectedFocusedPaymentSnapshot((current: any) => (current ? markDeletedPayment(current) : current));
      setPaymentLogsRefreshKey((key) => key + 1);
      window.dispatchEvent(new CustomEvent("payments:updated", {
        detail: {
          appointmentId: String(appointmentId),
          payment: { id: paymentId, appointmentId: String(appointmentId) },
        },
      }));
      toast.success("Payment deleted successfully");
    } catch (error) {
      console.error("[AppointmentHistoryView] Failed to delete payment:", error);
      toast.error("Failed to delete payment");
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
    setSelectedScheduleDuration(String(normalizeBookingDuration(displayedSnapshot?.duration || 30)));
    setSelectedScheduleStatus(String(normalizeAppointmentStatus(displayedSnapshot?.status || "scheduled")));
    setIsChangeScheduleOpen(true);
  };

  const handleScheduleDateSelect = (date: Date) => {
    setSelectedScheduleDate(date);
  };

  const handleScheduleTimeSelect = (time: string) => {
    setSelectedScheduleTime(time);
  };

  const handleScheduleDurationChange = (duration: string) => {
    setSelectedScheduleDuration(duration);
  };

  const handleScheduleStatusChange = (status: string) => {
    setSelectedScheduleStatus(status);
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
        duration: Number(selectedScheduleDuration) || 30,
        status: normalizeAppointmentStatus(selectedScheduleStatus) as Appointment["status"],
      } as Partial<Appointment>);

      setDisplayedSnapshot((current: any) => ({
        ...current,
        ...updated,
        date: updated?.date ?? nextDate,
        time: updated?.time ?? nextTime,
        duration: updated?.duration ?? (Number(selectedScheduleDuration) || 30),
        status: updated?.status ?? selectedScheduleStatus,
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
    setSelectedTreatmentSections(null);
  };

  const openChangeTreatmentModal = () => {
    if (!canChangeTreatment) {
      toast.error("This snapshot cannot be edited");
      return;
    }

    const normalizeTreatmentLabel = (value: unknown) =>
      String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

    const appointmentToothNumberEntries = getBookingToothNumberEntries(getBookingToothNumbersValue(displayedSnapshot));
    const nextSections = displayedBookingTreatments.length > 0
      ? displayedBookingTreatments.map((bookingTreatment, index) => {
          const treatmentType: string | number | undefined = bookingTreatment.type ?? displayedSnapshot?.type;
          const treatmentCustomType = bookingTreatment.customType ?? displayedSnapshot?.customType;
          const sectionTypeName = resolveAppointmentTypeName(
            treatmentType,
            treatmentCustomType
          );
          const numericType =
            typeof treatmentType === "number"
              ? treatmentType
              : typeof treatmentType === "string" && String(treatmentType).trim()
                ? Number(treatmentType)
                : NaN;
          const normalizedSectionName = normalizeTreatmentLabel(sectionTypeName);
          const matchedTreatment = activeTreatmentOptions.find((option) =>
            option.id === numericType ||
            normalizeTreatmentLabel(option.label) === normalizedSectionName ||
            normalizeTreatmentLabel(option.value) === normalizedSectionName
          );
          const nextSelectedTreatmentId = matchedTreatment?.id ?? OTHER_APPOINTMENT_TYPE_INDEX;
          const currentPrice = pickNumericValue(
            bookingTreatment.price,
            displayedSnapshot.price,
            displayedBasePrice,
            matchedTreatment?.price
          ) ?? 0;
          const currentDuration = normalizeBookingDuration(
            bookingTreatment.duration ?? displayedSnapshot.duration ?? matchedTreatment?.duration ?? 30
          );

          return {
            selectedTreatmentId: nextSelectedTreatmentId,
            currentTreatmentLabel: index === 0 ? typeName : sectionTypeName,
            customTreatmentName:
              nextSelectedTreatmentId === OTHER_APPOINTMENT_TYPE_INDEX
                ? String(bookingTreatment.customType || sectionTypeName || "").trim()
                : "",
            selectedPrice: String(Math.max(0, Number(currentPrice) || 0)),
            selectedDuration: String(currentDuration),
            toothNumberEntries: appointmentToothNumberEntries,
          };
        })
      : [
          {
            selectedTreatmentId: selectedTreatmentId ?? OTHER_APPOINTMENT_TYPE_INDEX,
            currentTreatmentLabel: typeName,
            customTreatmentName: customTreatmentName.trim(),
            selectedPrice: selectedTreatmentPrice,
            selectedDuration: selectedTreatmentDuration,
            toothNumberEntries: treatmentToothNumberEntries,
          },
        ];

    const firstSection = nextSections[0];
    setSelectedTreatmentId(firstSection.selectedTreatmentId ?? null);
    setCustomTreatmentName(firstSection.customTreatmentName || "");
    setSelectedTreatmentPrice(String(firstSection.selectedPrice ?? ""));
    setSelectedTreatmentDuration(String(firstSection.selectedDuration ?? "30"));
    setTreatmentToothNumberEntries(firstSection.toothNumberEntries || [""]);
    setSelectedTreatmentSections(nextSections);
    setIsChangeTreatmentOpen(true);
  };

  const handleSaveTreatmentChange = async () => {
    if (!appointmentId) {
      toast.error("No appointment id available");
      return;
    }

    const sections = selectedTreatmentSections && selectedTreatmentSections.length > 0
      ? selectedTreatmentSections
      : [{
          selectedTreatmentId,
          customTreatmentName,
          selectedPrice: selectedTreatmentPrice,
          selectedDuration: selectedTreatmentDuration,
          toothNumberEntries: treatmentToothNumberEntries,
        }];

    if (sections.length === 0) {
      toast.error("Please select a treatment");
      return;
    }

    const invalidSection = sections.find((section) => {
      const selectedId = section.selectedTreatmentId;
      if (selectedId === undefined || selectedId === null) return true;
      const option = activeTreatmentOptions.find((t) => t.id === selectedId);
      if (!option) return true;
      if (option.id === OTHER_APPOINTMENT_TYPE_INDEX && !String(section.customTreatmentName || "").trim()) return true;
      const priceValue = Number(section.selectedPrice ?? option.price ?? 0);
      if (!Number.isFinite(priceValue) || priceValue < 0) return true;
      if (!String(section.selectedDuration ?? "").trim()) return true;
      return false;
    });

    if (invalidSection) {
      toast.error("Please complete all treatment sections before saving");
      return;
    }

    const updatedTreatments = sections.map((section) => {
      const selectedOption = activeTreatmentOptions.find((option) => option.id === section.selectedTreatmentId) || { id: OTHER_APPOINTMENT_TYPE_INDEX, price: 0, duration: 30 };
      const isCustomTreatment = selectedOption.id === OTHER_APPOINTMENT_TYPE_INDEX;
      const customType = isCustomTreatment ? String(section.customTreatmentName || "").trim() : undefined;
      const priceValue = Number(section.selectedPrice ?? selectedOption.price ?? 0);
      return {
        type: selectedOption.id,
        customType: isCustomTreatment ? customType : undefined,
        duration: normalizeBookingDuration(section.selectedDuration ?? selectedOption.duration ?? 30),
        price: Math.max(0, priceValue),
      };
    });

    const appointmentToothNumbers = normalizeBookingToothNumbers(sections[0]?.toothNumberEntries);
    const firstUpdatedTreatment = updatedTreatments[0];
    const payload: Partial<Appointment> = {
      type: firstUpdatedTreatment.type,
      customType: firstUpdatedTreatment.customType,
      duration: firstUpdatedTreatment.duration,
      price: firstUpdatedTreatment.price,
      ...buildBookingTreatmentsPayload(updatedTreatments),
      toothNumbers: appointmentToothNumbers,
    };

    setIsSavingTreatmentChange(true);
    try {
      const updated = await updateAppointment(String(appointmentId), payload as Partial<Appointment>);

      setDisplayedSnapshot((current: any) => ({
        ...current,
        ...updated,
        type: updated?.type ?? firstUpdatedTreatment.type,
        customType: firstUpdatedTreatment.customType ?? updated?.customType,
        duration: updated?.duration ?? firstUpdatedTreatment.duration,
        price: updated?.price ?? firstUpdatedTreatment.price,
        toothNumbers: updated?.toothNumbers ?? appointmentToothNumbers ?? current.toothNumbers,
        treatments: updated?.treatments ?? current.treatments ?? updatedTreatments,
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

  const handleRestorePaymentEntry = async (payment: any) => {
    const paymentId = getRestorablePaymentEntryId(payment);
    if (!paymentId) {
      toast.error("Could not find the deleted payment record.");
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/payments/${encodeURIComponent(paymentId)}/restore`), {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        toast.error(result?.message || "Failed to restore payment");
        return;
      }

      setPaymentLogsRefreshKey((key) => key + 1);
      window.dispatchEvent(new CustomEvent("payments:updated", {
        detail: {
          appointmentId: String(appointmentId),
          payment: { id: paymentId, appointmentId: String(appointmentId) },
        },
      }));
      toast.success("Payment restored successfully");
    } catch (error) {
      console.error("[AppointmentHistoryView] Failed to restore payment:", error);
      toast.error("Failed to restore payment");
    }
  };

  const openPatientChoiceDialog = () => {
    if (!canOpenPatientChoice) return;
    setIsPatientChoiceOpen(true);
  };

  const openPatientSelector = async () => {
    if (!canSelectAppointmentPatient || !appointmentId) {
      toast.error("This appointment cannot change patients");
      return;
    }

    setIsPatientChoiceOpen(false);
    setIsSelectPatientOpen(true);
  };

  const handleSelectAppointmentPatient = async (patient: PatientSelectOption) => {
    if (!appointmentId) {
      toast.error("No appointment id available");
      return;
    }

    const nextPatientId = String(patient.id || "").trim();
    const nextPatientName = String(patient.name || "").trim();
    if (!nextPatientId || !nextPatientName) {
      toast.error("Please select a valid patient");
      return;
    }

    try {
      const updated = await updateAppointment(String(appointmentId), {
        patientId: nextPatientId,
        patientName: nextPatientName,
      } as Partial<Appointment>);

      setDisplayedSnapshot((current: any) => ({
        ...current,
        ...updated,
        patientId: updated?.patientId ?? nextPatientId,
        patientName: updated?.patientName ?? nextPatientName,
        patient: updated?.patient ?? patient,
        patientProfile: patient.profilePicture || patient.profilePictureUrl || current?.patientProfile,
        patientProfilePicture: patient.profilePicture || patient.profilePictureUrl || current?.patientProfilePicture,
      }));
      setPatientRecord(patient);
      setLatestComparisonSnapshot(null);
      try {
        window.dispatchEvent(
          new CustomEvent("appointments:updated", {
            detail: { appointment: updated, appointmentId: String(appointmentId) },
          })
        );
        window.dispatchEvent(new Event("refreshNotifications"));
      } catch {}

      toast.success("Patient updated");
    } catch (error) {
      console.error("[AppointmentHistoryView] Failed to update patient:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update patient");
      throw error;
    }
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
    void fetchLatestLogSnapshot();
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
      const currentResponse = await fetch(
        apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}?t=${Date.now()}`),
        {
          credentials: "include",
          headers: getAuthHeaders(),
        }
      );
      const currentPayload = await currentResponse.json().catch(() => ({}));
      const currentAppointment = currentResponse.ok && currentPayload?.data
        ? currentPayload.data
        : null;

      if (currentAppointment) {
        setDisplayedSnapshot({
          ...currentAppointment,
          id: currentAppointment.id || appointmentId,
          appointmentId,
          _isHistorical: false,
        });
        setSelectedFocusedPaymentSnapshot(null);
        setSnapshotState("current");
        setLatestComparisonSnapshot(currentAppointment);
        setShowAdditionalPayments(false);
        onViewCurrent?.(appointmentId);
        return;
      }

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
      const latestState = latest.newState && Object.keys(latest.newState).length > 0 ? latest.newState : latest.previousState;
      const snap = latestState ? { ...latestState } : null;
      if (!snap) {
        toast.error("No snapshot data available in latest log");
        return;
      }

      // Attach metadata
      snap.id = snap.id || appointmentId;
      snap.changedAt = latest.changedAt;
      snap.changedByName = latest.changedByName;

      setDisplayedSnapshot(snap);
      setSelectedFocusedPaymentSnapshot(null);
      setSnapshotState("current");
      setLatestComparisonSnapshot(null);
      setShowAdditionalPayments(false);
    } catch (err) {
      console.error("Failed to load logs:", err);
      toast.error("Failed to load appointment logs");
    } finally {
      setIsFetchingLogs(false);
    }
  };

  return (
    <>
      <BookingAppointmentHistory
        appointmentLogs={historyLogs}
        paymentLogs={paymentHistoryLogs}
        appointmentToEdit={displayedSnapshot}
        onViewSnapshot={(snapshot) => {
          setSelectedFocusedPaymentSnapshot(snapshot?._focusedPaymentSnapshot || snapshot?._selectedPaymentSnapshot || null);
          setDisplayedSnapshot(snapshot);
          setSnapshotState("historical");
          setLatestComparisonSnapshot(null);
          setIsHistoryDialogOpen(false);
        }}
        triggerVariant="section"
        userRole={undefined}
        showTrigger={false}
        open={isHistoryDialogOpen}
        onOpenChange={setIsHistoryDialogOpen}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="!fixed !bottom-0 !left-0 !top-auto !flex h-[92dvh] max-h-[92dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.35rem] border border-slate-200 bg-white p-0 shadow-[0_28px_90px_rgba(15,23,42,0.16)] data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:h-auto sm:max-h-[94vh] sm:w-[min(68rem,calc(100vw-2rem))] sm:max-w-[68rem] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.75rem]"
        >
          <DialogHeader className="shrink-0 bg-white px-4 pb-4 pt-2 sm:px-10 sm:pb-6 sm:pt-8">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
              <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                {snapshotHistory.length > 0 ? (
                  <Button size="icon" variant="ghost" className="mt-1 h-10 w-10 shrink-0 rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 sm:h-11 sm:w-11" title="Go back to previous snapshot" onClick={goBackSnapshot}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                ) : null}
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-violet-600 bg-white text-violet-700 shadow-[0_10px_24px_rgba(124,58,237,0.12)] sm:h-16 sm:w-16">
                  <Clock className="h-7 w-7 sm:h-8 sm:w-8" />
                </div>
                <div className="min-w-0 pt-0.5 sm:pt-1">
                  <DialogTitle className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-slate-950 sm:gap-x-5">
                    <span className="truncate text-3xl font-black tracking-tight sm:text-[2rem]">Snapshot</span>
                    {showsLogSnapshotState ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`inline-flex cursor-help items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider sm:gap-2 sm:px-4 sm:py-2 sm:text-xs ${stateBadgeClass}`}>
                            <StateIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            {stateLabel.toUpperCase()}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px] border-amber-200 bg-amber-50 text-center text-amber-800">
                          {stateTooltipText}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider sm:gap-2 sm:px-4 sm:py-2 sm:text-xs ${stateBadgeClass}`}>
                        <StateIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {stateLabel.toUpperCase()}
                      </span>
                    )}
                  </DialogTitle>
                  <DialogDescription className="mt-1.5 text-left text-sm font-semibold leading-5 text-slate-500 sm:mt-3 sm:text-base sm:leading-6">
                    <span className="block truncate">{timestampPrefix} {snapshotDate}</span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-black uppercase tracking-wide text-slate-400 sm:text-[13px]">
                        <span className="truncate">by {snapshotActorName}</span>
                        {changeTag ? <span aria-hidden="true">-</span> : null}
                        {changeTag ? <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">{changeTag}</span> : null}
                      </span>
                  </DialogDescription>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:justify-end sm:gap-3">
                {canOpenAppointment ? (
                  <Button className="h-12 rounded-2xl bg-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 active:scale-95 sm:px-7 sm:text-base" title="Open this appointment" onClick={handleOpenAppointment}>
                    <CalendarIcon className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Open
                  </Button>
                ) : null}
                {showsLogSnapshotState ? (
                  <Button className="h-12 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700 shadow-none transition-all hover:bg-amber-100 active:scale-95" title={appointmentId ? "Open the current appointment snapshot" : "No appointment id available"} disabled={!appointmentId || isFetchingLogs} onClick={viewLatestSnapshot}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingLogs ? "animate-spin" : ""}`} />
                    Latest
                  </Button>
                ) : null}
                {canUseSnapshotActions ? (
                  <AppointmentActionsMenu
                    actions={createAppointmentHistoryActions(
                      {
                        onOpen: handleOpenAppointment,
                        onViewHistory: () => setIsHistoryDialogOpen(true),
                        onChangeTreatment: openChangeTreatmentModal,
                        onChangeSchedule: openChangeScheduleModal,
                        onRepeatSchedule: openRepeatScheduleModal,
                        onEditPayment: handleEditPayment,
                        onAddPayment: handleAddPayment,
                        onGoToPatient: goToPatient,
                        onGoToDoctor: goToDoctor,
                      },
                      {
                        canChangeTreatment,
                        isLoadingTreatmentOptions,
                        canChangeSchedule,
                        canRepeatSchedule,
                        isOpeningPaymentEdit,
                        canGoToPatient,
                        canGoToDoctor,
                      }
                    )}
                    triggerVariant="outline"
                    triggerSize="icon"
                    triggerClassName="h-12 w-12 rounded-2xl border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                    triggerIcon={<EllipsisVertical className="h-5 w-5" />}
                    ariaLabel="More appointment actions"
                  />
                ) : null}
                <Button type="button" variant="outline" size="icon" onClick={() => onOpenChange(false)} className="h-12 w-12 rounded-2xl border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50" aria-label="Close snapshot">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 pb-4 sleek-scrollbar sm:px-10 sm:pb-8">
            <div className="grid gap-3 sm:gap-4">
              <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                  <div className="min-w-0 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 shadow-sm sm:min-w-[11.5rem] sm:rounded-full sm:px-4 sm:py-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100 sm:h-10 sm:w-10">
                        <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {canChangeStatus ? (
                            <AppointmentStatusSelect
                              value={nextStatus || displayedSnapshot.status}
                              statuses={APPOINTMENT_STATUSES}
                              includeDeleted={effectiveRole === "admin"}
                              onChange={handleStatusChange}
                              badgeClassName="max-w-[5.8rem] truncate text-sm font-black capitalize sm:max-w-none sm:text-base"
                            />
                          ) : (
                            <p className={`truncate text-sm font-black sm:text-base ${displayedStatusColors.textColor}`}>
                              {formatBookingHistoryStatusLabel(nextStatus || displayedSnapshot.status)}
                            </p>
                          )}
                          <CurrentChangeIndicator change={statusCurrentChange} />
                        </div>
                        {prevStatus && nextStatus && prevStatusNorm && nextStatusNorm && !isInsignificantStatus(prevStatusNorm) && prevStatusNorm !== nextStatusNorm ? (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] font-bold text-slate-400 sm:text-[11px]"><History className="h-3 w-3" />Was {formatBookingHistoryStatusLabel(prevStatus)}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:min-w-[10.5rem] sm:rounded-full sm:px-4 sm:py-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-600 shadow-sm ring-1 ring-slate-200 sm:h-10 sm:w-10">
                        <WalletCards className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className={`truncate text-sm font-black sm:text-base ${displayedPaymentStatusColors.textColor}`}>
                            {formatBookingHistoryStatusLabel(nextPaymentStatus || displayedSnapshot.paymentStatus)}
                          </p>
                          <CurrentChangeIndicator change={paymentStatusCurrentChange} />
                        </div>
                        {prevPaymentStatus && nextPaymentStatus && prevPaymentStatusNorm && nextPaymentStatusNorm && !isInsignificantStatus(prevPaymentStatusNorm) && prevPaymentStatusNorm !== nextPaymentStatusNorm ? (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] font-bold text-slate-400 sm:text-[11px]"><History className="h-3 w-3" />Was {formatBookingHistoryStatusLabel(prevPaymentStatus)}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-100 bg-white p-3 shadow-[0_10px_30px_rgba(79,70,229,0.08)] sm:rounded-[1.35rem] sm:p-5">
                  <div className="flex items-center justify-between gap-3 sm:gap-4">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-violet-200 sm:h-14 sm:w-14">
                        <Banknote className="h-5 w-5 sm:h-6 sm:w-6" />
                      </span>
                      <div className="min-w-0">
                        <Label className="block text-[10px] font-black uppercase tracking-widest text-violet-700 sm:text-xs">Balance</Label>
                        <p className="mt-0.5 truncate text-xs font-bold text-slate-500 sm:mt-1 sm:text-sm">To be settled</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-right">
                      <p className="text-2xl font-black tracking-tight text-violet-700 sm:text-4xl">
                        <CurrencyText value={displayedBalanceNumeric !== null ? formatCurrencyLabel(displayedBalanceNumeric) : displayedBalanceLabel} />
                      </p>
                      <CurrentChangeIndicator change={balanceCurrentChange} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.08fr_1fr] lg:items-start">
                <div className="order-2 grid gap-4 lg:order-1">
                  <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:p-5">
                    <div className="flex items-center gap-2 text-violet-700">
                      <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                      <Label className="text-sm font-black uppercase tracking-wide">People</Label>
                    </div>
                    <div className="mt-4 grid overflow-hidden rounded-2xl border border-slate-100 bg-white sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={canOpenPatientChoice ? openPatientChoiceDialog : undefined}
                        tabIndex={canOpenPatientChoice ? 0 : -1}
                        aria-disabled={!canOpenPatientChoice}
                        className={`group flex min-h-[4.5rem] w-full items-center gap-3 px-3 py-3 text-left transition-colors sm:min-h-[5.25rem] sm:gap-4 sm:px-5 sm:py-4 ${canOpenPatientChoice ? "hover:bg-slate-50" : "cursor-default"}`}
                      >
                        <PatientAvatar src={resolvedPatientImage} name={patientName} dob={snapshotPatientDob} className="h-12 w-12 shrink-0 rounded-full border border-violet-100 shadow-sm sm:h-14 sm:w-14" sizeClass="h-12 w-12 rounded-full sm:h-14 sm:w-14" />
                        <div className="min-w-0 flex-1">
                          <Label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 sm:text-xs">Patient</Label>
                          <div className="mt-0.5 flex min-w-0 items-center gap-2 sm:mt-1">
                            <p className="truncate text-base font-black leading-tight text-slate-950 sm:text-lg">{patientName}</p>
                            <CurrentChangeIndicator change={patientCurrentChange} />
                          </div>
                        </div>
                        <ChevronRight className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${canOpenPatientChoice ? "text-slate-500 transition-transform group-hover:translate-x-0.5" : "text-slate-300"}`} />
                      </button>

                      <button
                        type="button"
                        onClick={canAssignDoctor ? () => setIsAssignDoctorOpen(true) : undefined}
                        tabIndex={canAssignDoctor ? 0 : -1}
                        aria-disabled={!canAssignDoctor}
                        className={`group flex min-h-[4.5rem] w-full items-center gap-3 border-t border-slate-100 px-3 py-3 text-left transition-colors sm:min-h-[5.25rem] sm:gap-4 sm:border-l sm:border-t-0 sm:px-5 sm:py-4 ${canAssignDoctor ? "hover:bg-slate-50" : "cursor-default"}`}
                      >
                        <Avatar className="h-12 w-12 shrink-0 rounded-full border border-violet-100 shadow-sm sm:h-14 sm:w-14">
                          <AvatarImage src={resolvedDoctorImage} alt={displayedDoctorName || "Doctor"} className="object-cover" />
                          <AvatarFallback className="rounded-full bg-violet-50 text-violet-700"><Stethoscope className="h-5 w-5 sm:h-6 sm:w-6" /></AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <Label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 sm:text-xs">Doctor</Label>
                          <div className="mt-0.5 flex min-w-0 items-center gap-2 sm:mt-1">
                            <p className={`truncate text-base font-black leading-tight sm:text-lg ${canAssignDoctor && !displayedDoctorName ? "text-violet-700" : "text-slate-950"}`}>{canAssignDoctor && !displayedDoctorName ? "Assign doctor" : displayedDoctorName || "Unassigned"}</p>
                            <CurrentChangeIndicator change={doctorCurrentChange} />
                          </div>
                        </div>
                        <ChevronRight className={`h-6 w-6 shrink-0 ${canAssignDoctor ? "text-slate-500 transition-transform group-hover:translate-x-0.5" : "text-slate-300"}`} />
                      </button>
                    </div>
                  </section>

                  <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-violet-700">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                        <Label className="text-sm font-black uppercase tracking-wide">Schedule</Label>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openChangeScheduleModal}
                        disabled={!canChangeSchedule}
                        className="h-10 rounded-full border-violet-100 bg-violet-50 px-4 text-xs font-black text-violet-700 shadow-none hover:bg-violet-100 hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5 sm:text-sm"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Change
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="flex min-w-0 items-center gap-3 sm:border-r sm:border-slate-100 sm:pr-6">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                          <CalendarIcon className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                          <Label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 sm:text-xs">Date</Label>
                          <div className="mt-0.5 flex min-w-0 items-center gap-2">
                            <p className="truncate text-base font-black leading-tight text-slate-950 sm:text-lg">{formattedDate}</p>
                            <CurrentChangeIndicator change={dateCurrentChange} />
                          </div>
                        </div>
                      </div>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                          <Clock className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                          <Label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 sm:text-xs">Time Slot</Label>
                          <div className="mt-0.5 flex min-w-0 items-center gap-2">
                            <p className="truncate text-base font-black leading-tight text-slate-950 sm:text-lg">{displayedTimeLabel}</p>
                            <CurrentChangeIndicator change={timeCurrentChange} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                          <Stethoscope className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 sm:text-xs">Service</Label>
                            {displayedToothNumbersText ? (
                              <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700 ring-1 ring-violet-100">
                                Tooth # {displayedToothNumbersText}
                              </span>
                            ) : null}
                            <CurrentChangeIndicator change={serviceCurrentChange} />
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex max-w-full items-center rounded-full bg-violet-50 px-3 py-2 text-sm font-black text-violet-700 ring-1 ring-violet-100">
                              {typeName}
                            </span>
                            {additionalDisplayedTreatments.map((treatment, index) => (
                              <span
                                key={`${treatment.type || 'extra'}-${index}`}
                                className="inline-flex max-w-full items-center rounded-full bg-violet-50 px-3 py-2 text-sm font-black text-violet-700 ring-1 ring-violet-100"
                              >
                                {resolveAppointmentTypeName(treatment.type, treatment.customType)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={openChangeTreatmentModal}
                          disabled={!canChangeTreatment || isLoadingTreatmentOptions}
                          className="h-10 rounded-full border-violet-200 bg-white px-4 text-xs font-black text-violet-700 shadow-none hover:bg-violet-50 hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:px-6 sm:text-sm"
                        >
                          {isLoadingTreatmentOptions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                          Change
                        </Button>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="order-1 rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:p-5 lg:order-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-violet-700">
                    <div className="flex items-center gap-2">
                      <WalletCards className="h-5 w-5 sm:h-6 sm:w-6" />
                      <Label className="text-sm font-black uppercase tracking-wide">Payment</Label>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRecordPayment}
                      className="h-10 rounded-full border-violet-200 bg-white px-4 text-xs font-black text-violet-700 shadow-none hover:bg-violet-50 hover:text-violet-800 sm:px-5 sm:text-sm"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Record Payment
                    </Button>
                  </div>
                  <div className="mt-5">
                    <div className="flex items-center gap-2">
                      <Label className="block text-xs font-bold uppercase tracking-wide text-slate-500 sm:text-sm">Price</Label>
                      <CurrentChangeIndicator change={priceCurrentChange} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
                      {displayedDiscountAmount > 0 ? (
                        <>
                          <div className="text-sm font-bold text-slate-300 line-through sm:text-lg">
                            <CurrencyText value={formatCurrencyLabel(Number(displayedBasePrice) || 0)} />
                          </div>
                          <div className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                            <CurrencyText value={formatCurrencyLabel(Number(displayedEffectivePrice) || 0)} />
                          </div>
                        </>
                      ) : (
                        <span className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                          <CurrencyText value={formatCurrencyLabel(Number(displayedEffectivePrice) || 0)} />
                        </span>
                      )}
                      <div className="mb-1 flex min-w-0 items-center gap-1.5 text-violet-700 sm:mb-1.5">
                        <Calculator className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
                        <span className="text-xs font-black tracking-tight sm:text-sm">
                          PAID: {formatCurrencyLabel(Number(totalPaidAmount) || 0)}
                        </span>
                        <span className="text-[10px] font-medium text-slate-700 sm:text-xs">
                          ({paymentLogRows.length} {paymentLogRows.length === 1 ? "payment" : "payments"})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <History className="h-4 w-4 sm:h-5 sm:w-5" />
                      <Label className="text-xs font-black uppercase tracking-wide sm:text-sm">{paymentSectionTitle}</Label>
                    </div>
                    {hasAppointmentLifecycleAction ? (
                      <div className={`mt-3 rounded-2xl border p-3 sm:p-4 ${appointmentLifecycleClass}`}>
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm sm:h-10 sm:w-10">
                            <AppointmentLifecycleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
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
                      <div className={`mt-3 overflow-hidden rounded-2xl border p-3 sm:p-4 ${mainPaymentCardClass}`}>
                        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black shadow-sm ring-1 ring-emerald-100 sm:h-14 sm:w-20">
                            <span className={`max-w-full truncate px-1 ${mainPaymentTextClass}`}>{snapshotPaymentMethodLabel}</span>
                          </div>
                          <div className="grid min-w-0 grid-cols-[minmax(4.5rem,max-content)_minmax(7.5rem,1fr)] gap-x-6 gap-y-2 max-[420px]:grid-cols-1 sm:gap-x-8">
                            <div className="min-w-0">
                              <p className={`text-[10px] font-black uppercase tracking-widest ${mainPaymentMutedTextClass}`}>Amount</p>
                              <div className="mt-1 flex items-center gap-2">
                                <p className={`truncate text-lg font-black sm:text-xl ${mainPaymentTextClass}`} title={snapshotPaymentAmountTitle}>
                                  <CurrencyText value={displayedMainPaymentAmountLabel} />
                                </p>
                                <CurrentChangeIndicator change={mainPaymentRow?.currentChange} />
                              </div>
                              {snapshotPreviousPaymentAmountLabel ? (
                                <p className={`mt-0.5 truncate text-[10px] font-black leading-tight sm:text-xs ${mainPaymentMutedTextClass}`} title={snapshotPreviousPaymentAmountLabel}>
                                  <CurrencyText value={snapshotPreviousPaymentAmountLabel} />
                                </p>
                              ) : null}
                              {mainPaymentHistoryNote ? (
                                <p className={`mt-0.5 text-[10px] font-bold leading-tight sm:text-xs ${mainPaymentMutedTextClass}`}>
                                  {mainPaymentHistoryNote}
                                </p>
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[10px] font-black uppercase tracking-widest ${mainPaymentMutedTextClass}`}>Date</p>
                              <p className={`mt-1 truncate text-sm font-black sm:text-base ${mainPaymentTextClass}`} title={snapshotPaymentDateLabel || "No date"}>
                                {snapshotPaymentDateLabel || "No date"}
                              </p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-violet-700"
                                title="Payment actions"
                              >
                                <EllipsisVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              {mainPaymentRow?.isCurrentlyDeleted ? (
                                <DropdownMenuItem
                                  onClick={() => handleRestorePaymentEntry(mainPaymentRow?.actionRaw || mainPaymentRow?.raw)}
                                  disabled={!getRestorablePaymentEntryId(mainPaymentRow?.actionRaw || mainPaymentRow?.raw)}
                                  className="text-emerald-700 focus:text-emerald-700"
                                >
                                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                  Restore
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleEditPaymentEntry(mainPaymentRow?.actionRaw || mainPaymentRow?.raw)}
                                    disabled={!getEditablePaymentEntryId(mainPaymentRow?.actionRaw || mainPaymentRow?.raw)}
                                  >
                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeletePaymentEntry(mainPaymentRow?.actionRaw || mainPaymentRow?.raw)}
                                    disabled={!getEditablePaymentEntryId(mainPaymentRow?.actionRaw || mainPaymentRow?.raw)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {additionalPaymentRows.length > 0 ? (
                          <div className={`mt-3 border-t pt-3 ${mainPaymentDividerClass}`}>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setShowAdditionalPayments((current) => !current)}
                              className={`h-8 rounded-full px-0 text-sm font-black hover:bg-transparent ${mainPaymentTextClass}`}
                            >
                              {showAdditionalPayments ? "Show less" : `See more (${additionalPaymentRows.length})`}
                            </Button>
                            {showAdditionalPayments ? (
                              <div className="mt-2 space-y-2">
                                {additionalPaymentRows.map((payment) => {
                                  const paymentId = getEditablePaymentEntryId(payment.raw);
                                  const restorePaymentId = getRestorablePaymentEntryId(payment.raw);
                                  const isDeletedPayment = payment.isCurrentlyDeleted;
                                  const paymentUnavailableMessage = getPaymentEntryEditUnavailableMessage(payment.raw);

                                  return (
                                    <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
                                      <div className="flex min-w-0 max-w-[70%] shrink-0 items-center gap-2">
                                        <p className="truncate text-sm font-black text-emerald-700" title={payment.amountLabel}>
                                          <CurrencyText value={payment.amountLabel} />
                                        </p>
                                        <CurrentChangeIndicator change={payment.currentChange} />
                                      </div>
                                      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-black text-emerald-700/80">{payment.methodLabel}</p>
                                          <p className="mt-0.5 truncate text-xs font-bold text-emerald-700/60" title={payment.dateLabel}>{payment.dateLabel}</p>
                                        </div>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-violet-700"
                                              title="Payment actions"
                                            >
                                              <EllipsisVertical className="h-3 w-3" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-36">
                                            {isDeletedPayment ? (
                                              <DropdownMenuItem
                                                onClick={() => handleRestorePaymentEntry(payment.raw)}
                                                disabled={!restorePaymentId}
                                                title={restorePaymentId ? "Restore payment" : "Could not find the deleted payment record."}
                                                className="text-emerald-700 focus:text-emerald-700"
                                              >
                                                <RotateCcw className="mr-2 h-3 w-3" />
                                                Restore
                                              </DropdownMenuItem>
                                            ) : (
                                              <>
                                                <DropdownMenuItem
                                                  onClick={() => handleEditPaymentEntry(payment.raw)}
                                                  disabled={!paymentId}
                                                  title={paymentId ? "Edit payment" : paymentUnavailableMessage}
                                                >
                                                  <Pencil className="mr-2 h-3 w-3" />
                                                  Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onClick={() => handleDeletePaymentEntry(payment.raw)}
                                                  disabled={!paymentId}
                                                  title={paymentId ? "Delete payment" : paymentUnavailableMessage}
                                                  className="text-red-600 focus:text-red-600"
                                                >
                                                  <Trash2 className="mr-2 h-3 w-3" />
                                                  Delete
                                                </DropdownMenuItem>
                                              </>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-4 max-w-[18rem] text-sm font-semibold italic leading-6 text-slate-500 sm:mt-5 sm:text-base sm:leading-7">
                        No payment recorded for this snapshot.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              {showsLogSnapshotState ? (
                <section className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                        <History className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-black uppercase tracking-wide text-violet-700">Detailed Audit History</h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500 sm:text-sm">
                          {snapshotAuditChanges.length === 1
                            ? "1 change in this snapshot"
                            : `${snapshotAuditChanges.length} changes in this snapshot`}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-expanded={isAuditHistoryExpanded}
                      aria-controls="detailed-audit-history-content"
                      onClick={() => setIsAuditHistoryExpanded((expanded) => !expanded)}
                      className="h-9 self-start rounded-full px-3 text-xs font-black text-violet-700 hover:bg-violet-50 hover:text-violet-800 sm:self-auto sm:text-sm"
                    >
                      {isAuditHistoryExpanded ? "Show less" : "Show more"}
                      <ChevronRight className={`ml-1.5 h-4 w-4 transition-transform ${isAuditHistoryExpanded ? "rotate-90" : ""}`} />
                    </Button>
                  </div>

                  {isAuditHistoryExpanded ? (
                    <div id="detailed-audit-history-content" className="border-t border-slate-100 bg-violet-50/35 p-3 sm:p-4">
                      {snapshotAuditChanges.length > 0 ? (
                        <div className="space-y-2">
                          {snapshotAuditChanges.map((change) => (
                            <div
                              key={change.field}
                              className="grid min-w-0 gap-2 rounded-xl border border-violet-100/80 bg-white/85 px-3 py-3 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3 sm:px-4"
                            >
                              <p className="break-words text-sm font-black text-slate-600">
                                {change.field}
                              </p>
                              <p className="min-w-0 whitespace-pre-wrap break-words text-sm font-semibold leading-5 text-slate-500">
                                {change.previousValue}
                              </p>
                              <ChevronRight className="h-4 w-4 shrink-0 rotate-90 text-violet-400 sm:rotate-0" aria-hidden="true" />
                              <p className="min-w-0 whitespace-pre-wrap break-words text-sm font-black leading-5 text-violet-800">
                                {change.snapshotValue}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-xl border border-violet-100/80 bg-white/85 px-4 py-3 text-sm font-semibold italic text-slate-500">
                          No detailed changes were recorded for this snapshot.
                        </p>
                      )}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:p-5">
                <div className="flex items-center gap-2 text-violet-700 sm:gap-3">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                  <Label className="text-sm font-black uppercase tracking-wide">Treatment Notes</Label>
                  <CurrentChangeIndicator change={treatmentNotesCurrentChange} />
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className={`max-h-32 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-sm font-semibold leading-6 sleek-scrollbar sm:text-base sm:leading-7 ${displayedTreatmentNotesComparisonText ? "text-slate-600" : "italic text-slate-500"}`}>{displayedTreatmentNotesText}</p>
                </div>
              </section>

              {displayedSnapshot.status === "cancelled" && displayedSnapshot.cancellationReason ? (
                <section className="rounded-[1.35rem] border border-red-100 bg-red-50/60 p-4 shadow-[0_12px_35px_rgba(248,113,113,0.08)] sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
                        <Label className="text-sm font-black uppercase tracking-wide">Cancellation Reason</Label>
                        <CurrentChangeIndicator change={cancellationReasonCurrentChange} />
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-red-700/80 sm:text-base">{displayedSnapshot.cancellationReason}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-red-300" />
                  </div>
                </section>
              ) : null}

              <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:p-5">
                <div className="flex items-center gap-2 text-violet-700 sm:gap-3">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                  <Label className="text-sm font-black uppercase tracking-wide">Remarks</Label>
                  <CurrentChangeIndicator change={notesCurrentChange} />
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className={`max-h-32 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-sm font-semibold leading-6 sleek-scrollbar sm:text-base sm:leading-7 ${displayedNotesComparisonText ? "text-slate-600" : "italic text-slate-500"}`}>{displayedNotesText}</p>
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="shrink-0 !flex-col !items-stretch !justify-center gap-2 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm sm:gap-3 sm:px-8 sm:pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pt-4">
            {canShowSnapshotActions ? (
              <div className="-mx-4 -mt-3 mb-1 border-b border-amber-100 bg-amber-50/70 px-4 py-2.5 sm:-mx-8 sm:-mt-4 sm:px-8 sm:py-3">
                <p className="flex items-start justify-center gap-2 text-center text-xs font-semibold leading-5 text-amber-700 sm:text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{actionNoteText}</p>
              </div>
            ) : null}
            {canShowSnapshotActions ? (
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <Button className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700 active:scale-95 sm:h-12 sm:text-base" onClick={() => openApproveConfirm(displayedSnapshot)}><CheckCircle2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />Accept</Button>
                <Button className="h-11 w-full rounded-xl border-red-200 bg-white text-sm font-black text-red-500 shadow-sm transition-all hover:bg-red-50 active:scale-95 sm:h-12 sm:text-base" onClick={() => openRejectConfirm(displayedSnapshot)} variant="outline"><AlertTriangle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />Decline</Button>
              </div>
            ) : null}
            {canRestoreNotification ? (
              <Button className="h-11 w-full rounded-xl bg-violet-600 text-sm font-black text-white shadow-sm transition-all hover:bg-violet-700 active:scale-95 sm:h-12" onClick={async () => { await onRestoreNotification?.(restoreNotificationId!); onOpenChange(false); }}><RefreshCw className="mr-2 h-4 w-4" />Restore</Button>
            ) : null}
            <div className="flex justify-center">
              <Button onClick={() => onOpenChange(false)} variant="outline" className="h-12 min-w-[13rem] rounded-[1.35rem] border-violet-100 bg-violet-50/40 px-8 text-base font-black text-violet-700 shadow-[0_10px_24px_rgba(124,58,237,0.10)] transition-all hover:bg-violet-50 hover:text-violet-800 sm:h-14 sm:min-w-[15rem]">Close</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppointmentPatientChoiceDialog
        open={isPatientChoiceOpen}
        onOpenChange={setIsPatientChoiceOpen}
        patientName={patientName}
        patientImage={resolvedPatientImage}
        patientDob={snapshotPatientDob}
        canSelectPatient={canSelectAppointmentPatient}
        canOpenProfile={canGoToPatient}
        onSelectPatient={openPatientSelector}
        onOpenProfile={goToPatient}
      />

      <SelectPatientModal
        open={isSelectPatientOpen}
        onOpenChange={setIsSelectPatientOpen}
        selectedPatientId={String(displayedPatientId || "")}
        selectedPatientName={patientName}
        canCreatePatients={canSelectAppointmentPatient}
        onConfirm={handleSelectAppointmentPatient}
      />

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
        selectedDuration={selectedScheduleDuration}
        onDurationChange={handleScheduleDurationChange}
        status={selectedScheduleStatus}
        statusOptions={APPOINTMENT_STATUSES}
        onStatusChange={handleScheduleStatusChange}
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
        treatmentSections={selectedTreatmentSections ?? undefined}
        onTreatmentSectionsChange={setSelectedTreatmentSections}
        allowAddTreatment={true}
        allowRemoveTreatment={true}
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
