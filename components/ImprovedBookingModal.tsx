import { apiUrl } from "@/lib/api";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CompactNotesField } from "@/components/CompactNotesField";
import { useAuth } from "@/hooks/useAuth";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import { useAppointmentTypeOptions } from "@/hooks/useAppointmentTypeOptions";
import { useAppointmentStatuses, AppointmentStatusOption } from "@/hooks/useAppointmentStatuses";
import { usePaymentStatuses, PaymentStatusOption } from "@/hooks/usePaymentStatuses";
import { Calendar as CalendarIcon, Clock, Award, Loader2, CreditCard, Banknote, Stethoscope, ChevronLeft, AlertCircle, Plus, History, Eye, Check, X, Lock } from "lucide-react";
import { formatDateToYYYYMMDD } from "@/lib/utils";
import { formatTimeTo12h, TIME_SLOTS } from "@/lib/time-slots";
import { APPOINTMENT_PRICES, getAppointmentTypeName } from "@/lib/appointmentTypes";
import { getAuthHeaders } from "@/lib/auth-headers";
import { toast } from 'sonner';
import useSharedBookingLogic, {
  ALLOWED_BOOKING_DURATIONS,
  DEFAULT_APPOINTMENT_TYPE_DURATIONS as appointmentTypeDurations,
  PAST_APPOINTMENT_STATUS_VALUES,
  getPastAppointmentStatusOptions,
  findNextAvailableBookingSlot,
  findNextAvailableRepeatSlot,
  formatBookingDateKey,
  formatBookingDoctorName as formatDoctorName,
  formatBookingHistoryStatusLabel,
  getBookingAppointmentTypeIndex as getAppointmentTypeIndex,
  getBookingAppointmentStatusConfig,
  useBookingPaymentPrefill,
  getBookingAutoPreselectConfig,
  getBookingActor,
  getBookingCancellationConfig,
  getBookingConflictWarnings,
  getBookingHistoryPaymentStatusChange,
  getBookingHistoryNotes,
  getBookingCreateDate,
  getBookingCreateTime,
  getBookingDefaultDate,
  getBookingDefaultScheduleAction,
  getBookingDefaultTime,
  getBookingEditDate,
  parseLocalDateOnly,
  getBookingEditTime,
  getDefaultBookingPaymentDate,
  normalizeBookingPaymentDate,
  isFutureBookingPaymentDate,
  formatBookingPaymentDateLabel,
  getBookingTreatmentNotesValue,
  getBookingPaymentStatusConfig,
  getBookingStatusLabel,
  CART_APPOINTMENT_STATUS,
  getBookingDoctorInitials as getDoctorInitials,
  buildBookingTreatmentNotesPayload,
  getProjectedPaymentStatus,
  isCartAppointmentStatus,
  isSignificantBookingPaymentStatus,
  isPastAppointmentSchedule,
  normalizeBookingDoctorName as normalizeDoctorName,
  normalizeBookingDuration,
  normalizePastAppointmentStatus,
  shouldShowBookingHistoryLog,
  toBookingPatientOption as toPatientOption,
} from './sharedBookingLogic';
import AppointmentHistoryView from "./AppointmentHistoryView";
import { DatePickerModal } from "./DatePickerModal";
import { TimePickerModal } from "./TimePickerModal";
import { ConfirmAppointmentModal } from "./ConfirmAppointmentModal";
import ApproveRejectDialog from "./ApproveRejectDialog";
import { useDoctors, type DoctorOption } from "@/hooks/useDoctors";
import { cachePublicBookingAppointment, cachePublicBookingPatient, createPublicBookingAppointment, getCachedPublicBlockingAppointments, getCachedPublicBookingPatients } from "@/lib/publicBookingCache";
import type { BookingCreationMode, BookingMode } from "./sharedBookingLogic";
import type { ServiceCatalogItem } from "@/lib/appointment-service-catalog";

type ImprovedBookingStep = "patient" | "schedule" | "doctor" | "treatment" | "payment";

type BookingHistoryLog = any & {
  logType: "appointment" | "payment";
  changedAt: string;
};

const getMergedBookingLogs = (appointmentLogs: any[], paymentLogs: any[]): BookingHistoryLog[] => {
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
    hour: "2-digit",
    minute: "2-digit",
  });

const getHistoryDoctorChange = (log: BookingHistoryLog) => {
  const previousDoctor = normalizeDoctorName(log.previousState?.doctor) ? formatDoctorName(log.previousState?.doctor) : "";
  const nextDoctor = normalizeDoctorName(log.newState?.doctor) ? formatDoctorName(log.newState?.doctor) : "";

  return {
    previousDoctor,
    nextDoctor,
    changed: Boolean(nextDoctor && normalizeDoctorName(log.newState?.doctor) !== normalizeDoctorName(log.previousState?.doctor)),
  };
};

const getHistoryPaymentAmount = (log: BookingHistoryLog) => Number(log.amount || 0);

const getHistoryActor = (log: BookingHistoryLog) => log.changedByName || log.changedBy || "";

type HistoryBadge = {
  label: string;
  tone: "appointment" | "payment" | "amount";
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
  if (tone === "payment") return "bg-emerald-100 text-emerald-700";
  if (tone === "amount") return "bg-green-100 text-green-700";
  return "bg-blue-100 text-blue-700";
};

const getHistoryTitle = (log: BookingHistoryLog) => {
  const paymentStatusChange = getBookingHistoryPaymentStatusChange(log);
  const amount = getHistoryPaymentAmount(log);

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

const getHistoryDetail = (log: BookingHistoryLog) => {
  const paymentStatusChange = getBookingHistoryPaymentStatusChange(log);
  const amount = getHistoryPaymentAmount(log);
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

  if (log.logType === "payment") {
    if (amount > 0) return "Payment recorded";
    if (paymentStatusChange.changed) return "Payment status updated";
    return "Payment updated";
  }

  if (isInitialHistoryLog(log)) {
    const actor = getHistoryActor(log);
    if (amount > 0) return "Payment recorded";
    return actor ? `Created by ${actor}` : "Appointment record created";
  }

  const details: string[] = [];
  if (scheduleChanged) details.push("Schedule changed");
  if (doctorChanged) details.push("Doctor changed");
  if (treatmentChanged) details.push("Treatment changed");

  // patient change detection
  const prev = (log as any)?.previousState;
  const next = (log as any)?.newState;
  const isPatientChanged = (() => {
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
  })();
  if (isPatientChanged) details.push("Patient Changed");

  // price change detection
  const prevPrice = prev ? Number(prev.price ?? prev.amount ?? 0) : null;
  const nextPrice = next ? Number(next.price ?? next.amount ?? 0) : null;
  const priceChanged = prevPrice !== null && nextPrice !== null && Number(prevPrice) !== Number(nextPrice);
  if (priceChanged) details.push("Price changed");

  if (statusChanged) details.push("Appointment status updated");
  if (paymentStatusChange.changed) details.push("Payment status updated");
  if (amount > 0) details.push("Payment recorded");

  if (details.length > 0) return details.slice(0, 5).join(" - ");

  const actor = getHistoryActor(log);

  const isPatientChangeLog = (() => {
    const prev = (log as any)?.previousState;
    const next = (log as any)?.newState;
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
  })();

  if (isPatientChangeLog) return "Patient Changed";

  return actor ? `Updated by ${actor}` : "Details were updated";
};

const getHistoryPaymentDateLabel = (log: BookingHistoryLog) => {
  if (getHistoryPaymentAmount(log) <= 0) return "";

  const paymentDate = normalizeBookingPaymentDate(
    (log as any)?.paymentDate ||
    (log as any)?.newState?.paymentDate ||
    (log as any)?.previousState?.paymentDate
  );

  return formatBookingPaymentDateLabel(paymentDate);
};

const pickAvatarSource = (...sources: unknown[]) => {
  for (const source of sources) {
    if (typeof source !== "string") continue;
    const trimmed = source.trim();
    if (trimmed) return trimmed;
  }

  return undefined;
};

const resolveAvatarSource = (source?: string) => {
  if (!source) return undefined;
  if (source.startsWith("http") || source.startsWith("data:") || source.startsWith("blob:")) return source;
  return apiUrl(source);
};

const getPersonInitials = (name?: string) => {
  const initials = String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "?";
};

type BookingSlotCandidate = {
  date: Date;
  time: string;
  doctorName: string;
  doctorIndex: number;
};

const getBookingSlotTimestamp = (slot: { date: Date; time: string }) => {
  const [hours = 0, minutes = 0] = slot.time.split(":").map(Number);
  const date = new Date(slot.date);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
};

const findNextAvailablePatientSchedule = async ({
  startDate,
  doctorsToCheck,
  durationToCheck,
  patientToCheck,
  timeSlots,
  availabilityMode,
  localBlockingAppointments,
}: {
  startDate: Date;
  doctorsToCheck: DoctorOption[];
  durationToCheck: string;
  patientToCheck?: string;
  timeSlots: string[];
  availabilityMode: "authenticated" | "public";
  localBlockingAppointments: any[];
}): Promise<BookingSlotCandidate | null> => {
  const doctorsWithNames = doctorsToCheck.filter((doctor) => String(doctor.name || "").trim());
  if (doctorsWithNames.length === 0) return null;

  const candidates = await Promise.all(
    doctorsWithNames.map(async (doctor, doctorIndex): Promise<BookingSlotCandidate | null> => {
      const slot = await findNextAvailableBookingSlot({
        startDate,
        doctorToCheck: doctor.name,
        durationToCheck,
        patientToCheck,
        timeSlots,
        availabilityMode,
        localBlockingAppointments,
      });

      return slot
        ? {
            ...slot,
            doctorName: doctor.name,
            doctorIndex,
          }
        : null;
    })
  );

  return candidates
    .filter((candidate): candidate is BookingSlotCandidate => Boolean(candidate))
    .sort((a, b) => {
      const timeDiff = getBookingSlotTimestamp(a) - getBookingSlotTimestamp(b);
      return timeDiff || a.doctorIndex - b.doctorIndex;
    })[0] || null;
};

const DEFAULT_BOOKING_TREATMENT = "Routine Cleaning";
const TOUR_STEP_CHANGE_EVENT = "villahermosa-tour:step-change";

type TreatmentOption = {
  name: string;
  short: string;
  icon: string;
  color: string;
};

type ExistingTreatmentSuggestion = {
  treatment: string;
  normalizedInput: string;
  isExact: boolean;
};

const BOOKING_TREATMENT_OPTIONS: TreatmentOption[] = [
  { name: DEFAULT_BOOKING_TREATMENT, short: "Cleaning", icon: "✨", color: "bg-blue-500" },
  { name: "Checkup", short: "Checkup", icon: "🔍", color: "bg-emerald-500" },
  { name: "Filling", short: "Filling", icon: "🦷", color: "bg-amber-500" },
  { name: "Root Canal", short: "Root Canal", icon: "🔬", color: "bg-rose-500" },
  { name: "Extraction", short: "Extraction", icon: "🦷", color: "bg-slate-700" },
  { name: "Whitening", short: "Whitening", icon: "💎", color: "bg-cyan-400" },
  { name: "Dentures", short: "Dentures", icon: "🦷", color: "bg-violet-500" },
  { name: "Crowns", short: "Crowns", icon: "👑", color: "bg-yellow-500" },
  { name: "Braces", short: "Braces", icon: "😁", color: "bg-fuchsia-500" },
  { name: "Other", short: "Other", icon: "➕", color: "bg-gray-400" },
];

const TREATMENT_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-slate-700",
  "bg-cyan-500",
  "bg-violet-500",
  "bg-yellow-500",
  "bg-fuchsia-500",
  "bg-gray-500",
];

const getTreatmentInitials = (name: string) =>
  String(name || "Service")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "S";

const buildBookingTreatmentOptions = (serviceOptions: ServiceCatalogItem[]): TreatmentOption[] => {
  const options = serviceOptions
    .filter((service) => service.isActive !== false)
    .map((service, index) => ({
      name: service.label,
      short: service.label.length > 14 ? `${service.label.slice(0, 13)}...` : service.label,
      icon: getTreatmentInitials(service.label),
      color: TREATMENT_COLORS[index % TREATMENT_COLORS.length],
    }));

  if (!options.length) return BOOKING_TREATMENT_OPTIONS;
  if (!options.some((option) => option.name === "Other")) {
    options.push({ name: "Other", short: "Other", icon: "+", color: "bg-gray-400" });
  }

  return options;
};

const normalizeTreatmentInput = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const getTreatmentAliases = (treatment: string) => {
  const normalized = normalizeTreatmentInput(treatment);
  const aliases = new Set([normalized]);

  if (treatment === DEFAULT_BOOKING_TREATMENT) {
    aliases.add("cleaning");
    aliases.add("teethcleaning");
    aliases.add("dentalcleaning");
  }

  if (treatment === "Root Canal") aliases.add("rootcanaltherapy");
  if (treatment === "Dentures") aliases.add("denture");
  if (treatment === "Crowns") aliases.add("crown");
  if (treatment === "Braces") aliases.add("brace");

  return Array.from(aliases);
};

const getExistingTreatmentAliases = (treatmentOptions: TreatmentOption[]) =>
  treatmentOptions
    .filter((treatment) => treatment.name !== "Other")
    .flatMap((treatment) =>
    getTreatmentAliases(treatment.name).map((alias) => ({
      alias,
      treatment: treatment.name,
    }))
  );

const getEditDistance = (first: string, second: string) => {
  if (first === second) return 0;
  if (!first) return second.length;
  if (!second) return first.length;

  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  const current = Array(second.length + 1).fill(0);

  for (let i = 1; i <= first.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= second.length; j += 1) {
      const substitutionCost = first[i - 1] === second[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[second.length];
};

const findExistingTreatmentSuggestion = (value: string, treatmentOptions: TreatmentOption[]): ExistingTreatmentSuggestion | null => {
  const normalizedInput = normalizeTreatmentInput(value);
  if (normalizedInput.length < 3) return null;

  const treatmentAliases = getExistingTreatmentAliases(treatmentOptions);
  const exactMatch = treatmentAliases.find((option) => option.alias === normalizedInput);
  if (exactMatch) {
    return {
      treatment: exactMatch.treatment,
      normalizedInput,
      isExact: true,
    };
  }

  if (normalizedInput.length < 4) return null;

  const bestMatch = treatmentAliases
    .map((option) => ({
      ...option,
      distance: getEditDistance(normalizedInput, option.alias),
    }))
    .sort((a, b) => a.distance - b.distance || a.alias.length - b.alias.length)[0];

  if (!bestMatch) return null;

  const maxDistance = normalizedInput.length >= 7 ? 2 : 1;
  const distanceRatio = bestMatch.distance / Math.max(normalizedInput.length, bestMatch.alias.length);
  if (bestMatch.distance <= maxDistance && distanceRatio <= 0.35) {
    return {
      treatment: bestMatch.treatment,
      normalizedInput,
      isExact: false,
    };
  }

  return null;
};

const getCurrentTourStepId = () => {
  if (typeof window === "undefined") return "";
  return (window as Window & { __villahermosaTourStepId?: string }).__villahermosaTourStepId || "";
};

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultTime?: string;
  doctorName?: string; // doctor's display name
  defaultPatientId?: string;
  onBooked?: (apt?: any) => void;
  onDeleted?: (apt?: any) => void;
  appointmentToEdit?: any; // optional appointment object to edit
  title?: string; // optional override for dialog title
  bookingMode?: BookingMode;
  appointmentCreationMode?: BookingCreationMode;
}

export default function BookingModal({ open, onOpenChange, defaultDate, defaultTime, doctorName, defaultPatientId, onBooked, onDeleted, appointmentToEdit, title, bookingMode = "standard", appointmentCreationMode = "standard" }: BookingModalProps) {
  const { user } = useAuth();
  const { effectiveRole } = useAdminViewMode();
  const { doctors } = useDoctors(undefined, { publicBooking: bookingMode === "public" });
  const { addAppointment, updateAppointment, deleteAppointment, isPaymentFlow, openAddPatientModal, lastAddedPatient, lastAddedPatientAt } = useAppointmentModal();
  const { statuses: appointmentStatuses } = useAppointmentStatuses();
  const { statuses: paymentStatuses } = usePaymentStatuses();
  const { options: serviceOptions } = useAppointmentTypeOptions(open);

  // Define toDate helper before useState calls that use it
  const toDate = (value: any): Date => {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    try {
      const parsed = typeof value === 'string' ? parseLocalDateOnly(value) ?? new Date(value) : new Date(value);
      return parsed instanceof Date && !isNaN(parsed.getTime()) ? parsed : new Date(String(value));
    } catch (err) {
      return new Date();
    }
  };
  
  const [isPriceEditable, setIsPriceEditable] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>(doctorName || "");
  const [appointmentType, setAppointmentType] = useState<string>("");
  const [customAppointmentTypeName, setCustomAppointmentTypeName] = useState<string>("");
  const [declinedTreatmentSuggestion, setDeclinedTreatmentSuggestion] = useState<{ normalizedInput: string; treatment: string } | null>(null);
  const [pendingConfirmAfterTreatmentSuggestion, setPendingConfirmAfterTreatmentSuggestion] = useState(false);
  const [duration, setDuration] = useState<string>("30");
  const [discount, setDiscount] = useState<string>("0");
  const [customPrice, setCustomPrice] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");
  const [treatmentNotes, setTreatmentNotes] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(() => toDate(defaultDate ?? new Date()));
  const [selectedTime, setSelectedTime] = useState<string>(defaultTime ?? "");
  const [isBooking, setIsBooking] = useState(false);
  const [appointmentLogs, setAppointmentLogs] = useState<any[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<any[]>([]);
  const [durationConflict, setDurationConflict] = useState<string>("");

  // New states for multi-step flow (patient -> schedule -> treatment -> doctor -> payment)
  const [modalStep, setModalStep] = useState<ImprovedBookingStep>("patient");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [amountToPay, setAmountToPay] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(getDefaultBookingPaymentDate());
  const paymentDateInputRef = useRef<HTMLInputElement | null>(null);
  const [overpayPulse, setOverpayPulse] = useState(false);
  const [appointmentStatus, setAppointmentStatus] = useState<string>("scheduled");
  const [paymentStatus, setPaymentStatus] = useState<string>("unpaid");
  const [statusChangedByUser, setStatusChangedByUser] = useState<number>(0);
  const [paymentStatusChangedByUser, setPaymentStatusChangedByUser] = useState<number>(0);
  const [repeatOption, setRepeatOption] = useState<string>("do-not-repeat");
  const [customRepeatDate, setCustomRepeatDate] = useState<string>("");
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isConfirmSummaryOpen, setIsConfirmSummaryOpen] = useState(false);
  const [snapshotToView, setSnapshotToView] = useState<any>(null);
  const [snapshotIsHistorical, setSnapshotIsHistorical] = useState(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [activeTourStepId, setActiveTourStepId] = useState(getCurrentTourStepId);
  const bookingTreatmentOptions = useMemo(
    () => buildBookingTreatmentOptions(serviceOptions),
    [serviceOptions]
  );
  const servicePriceByName = useMemo(() => {
    const prices: Record<string, number> = { ...APPOINTMENT_PRICES };
    serviceOptions.forEach((service) => {
      prices[service.label] = Number(service.price) || 0;
    });
    return prices;
  }, [serviceOptions]);
  const serviceDurationByName = useMemo(() => {
    const durations: Record<string, number> = { ...appointmentTypeDurations };
    serviceOptions.forEach((service) => {
      durations[service.label] = Number(service.duration) || 30;
    });
    return durations;
  }, [serviceOptions]);
  const [dailyAppointments, setDailyAppointments] = useState<any[]>([]);
  const [dailyAppointmentsDateKey, setDailyAppointmentsDateKey] = useState("");
  const [patientConflict, setPatientConflict] = useState("");
  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);
  const lastHandledAddedPatientAtRef = useRef<number | null>(null);
  const appliedDefaultScheduleKeyRef = useRef<string | null>(null);
  const autoPreselectedScheduleRef = useRef<{ patientId: string; scheduleKey: string } | null>(null);
  const autoPreselectedDoctorRef = useRef<string | null>(null);
  const previousSelectedPatientRef = useRef<string>("");
  const autoPreselectRequestIdRef = useRef(0);
  const autoPreselectSearchKeyRef = useRef<string | null>(null);
  const selectedDateRef = useRef(selectedDate);
  const selectedTimeRef = useRef(selectedTime);
  const selectedDoctorRef = useRef(selectedDoctor);
  

  // Log all available statuses when modal opens
  useEffect(() => {
    if (open && appointmentStatuses && appointmentStatuses.length > 0) {
      console.log('[BookingModal] Available appointment statuses:', appointmentStatuses.map(s => s.value));
    }
  }, [open, appointmentStatuses]);

  useEffect(() => {
    if (!open) {
      appliedDefaultScheduleKeyRef.current = null;
      autoPreselectedScheduleRef.current = null;
      autoPreselectedDoctorRef.current = null;
      previousSelectedPatientRef.current = "";
      autoPreselectRequestIdRef.current += 1;
      autoPreselectSearchKeyRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    const handleTourStepChange = (event: Event) => {
      const stepId = (event as CustomEvent<{ stepId?: string }>).detail?.stepId || "";
      setActiveTourStepId(stepId);
    };

    setActiveTourStepId(getCurrentTourStepId());
    window.addEventListener(TOUR_STEP_CHANGE_EVENT, handleTourStepChange);

    return () => {
      window.removeEventListener(TOUR_STEP_CHANGE_EVENT, handleTourStepChange);
    };
  }, []);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    selectedTimeRef.current = selectedTime;
  }, [selectedTime]);

  useEffect(() => {
    selectedDoctorRef.current = selectedDoctor;
  }, [selectedDoctor]);

  const {
    isPublicBookingMode,
    isStaffBookingMode,
    canCreatePatients,
    canManagePricing,
    canManageStatuses,
    canManagePaymentStatuses,
    isPatientLevelBookingMode,
    isDoctorSelectionLocked,
  } = getBookingActor({
    userRole: effectiveRole,
    bookingMode,
    isEditing: Boolean(appointmentToEdit),
  });
  const isTourPatientNextStep = activeTourStepId === "booking-patient-next";
  const isTourScheduleSelectionLocked = activeTourStepId === "booking-schedule";
  const publicBlockingAppointments = useMemo(
    () => (isPublicBookingMode ? getCachedPublicBlockingAppointments() : []),
    [
      isPublicBookingMode,
      open,
      selectedDate,
      selectedTime,
      selectedPatient,
      selectedDoctor,
      appointmentToEdit?.id,
    ]
  );

  // Fetch all appointments for the day to check conflicts across all doctors and patients
  useEffect(() => {
    if (!open || !selectedDate) {
      setDailyAppointmentsDateKey("");
      return;
    }
    let cancelled = false;
    const dateStr = formatDateToYYYYMMDD(selectedDate);
    setDailyAppointmentsDateKey("");
    
    const fetchDailyAppointments = async () => {
      try {
        if (isPublicBookingMode) {
          const filtered = publicBlockingAppointments.filter(
            (apt: any) =>
              apt.date === dateStr && String(apt.id) !== String(appointmentToEdit?.id || "")
          );
          if (cancelled) return;
          setDailyAppointments(filtered);
          setDailyAppointmentsDateKey(dateStr);
          setPatientAppointments(
            selectedPatient
              ? filtered.filter((apt: any) => String(apt.patientId) === String(selectedPatient))
              : []
          );
          return;
        }

        const res = await fetch(
          apiUrl(`/api/appointments?startDate=${dateStr}&endDate=${dateStr}`),
          { credentials: 'include' }
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            // Exclude cancelled appointments and current appointment being edited
            const filtered = (json.data || []).filter((apt: any) => 
              apt.status !== 'cancelled' && apt.id !== appointmentToEdit?.id
            );
            
            // Group appointments by doctor and status for detailed logging
            const byDoctor: Record<string, any[]> = {};
            const byStatus: Record<string, any[]> = {};
            
            filtered.forEach((apt: any) => {
              // Group by doctor
              if (!byDoctor[apt.doctor]) byDoctor[apt.doctor] = [];
              byDoctor[apt.doctor].push(apt);
              
              // Group by status
              if (!byStatus[apt.status]) byStatus[apt.status] = [];
              byStatus[apt.status].push(apt);
            });
            
            // Log comprehensive schedule information
            console.log('[BookingModal] 📅 DAILY SCHEDULE - ALL APPOINTMENTS:', {
              date: dateStr,
              formattedDate: toDate(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
              totalAppointments: filtered.length,
              
              // Summary by status
              summary: {
                scheduled: byStatus['scheduled']?.length || 0,
                reserved: byStatus['reserved']?.length || 0,
                cart: byStatus[CART_APPOINTMENT_STATUS]?.length || byStatus['pending']?.length || 0,
                completed: byStatus['completed']?.length || 0,
              },
              
              // Detailed breakdown by doctor
              byDoctor: Object.keys(byDoctor).sort().map(doctor => ({
                doctor,
                appointments: byDoctor[doctor].map((apt: any) => ({
                  time: apt.time,
                  duration: `${apt.duration} mins`,
                  endTime: (() => {
                    const [h, m] = (apt.time || '00:00').split(':').map(Number);
                    const end = toDate(selectedDate);
                    end.setHours(h, m + apt.duration, 0, 0);
                    return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                  })(),
                  status: apt.status,
                  patient: apt.patientName,
                  patientId: apt.patientId
                }))
              })),
              
              // Alternative view: all appointments in chronological order
              chronological: filtered
                .sort((a: any, b: any) => {
                  const aTime = a.time.split(':').map(Number);
                  const bTime = b.time.split(':').map(Number);
                  return (aTime[0] * 60 + aTime[1]) - (bTime[0] * 60 + bTime[1]);
                })
                .map((apt: any) => ({
                  time: apt.time,
                  duration: `${apt.duration} mins`,
                  status: apt.status,
                  doctor: apt.doctor,
                  patient: apt.patientName
                }))
            });
            
            if (cancelled) return;
            setDailyAppointments(filtered);
            setDailyAppointmentsDateKey(dateStr);
            
            // Also filter for current patient if one is selected
            if (selectedPatient) {
              const pAppts = filtered.filter((apt: any) => String(apt.patientId) === String(selectedPatient));
              setPatientAppointments(pAppts);
            } else {
              setPatientAppointments([]);
            }
          }
        }
      } catch (err) {
        console.warn("[BookingModal] Could not fetch daily appointments:", err);
      }
    };
    
    fetchDailyAppointments();
    return () => {
      cancelled = true;
    };
  }, [open, selectedDate, selectedPatient, appointmentToEdit?.id, isPublicBookingMode, publicBlockingAppointments]);

  // Read-only for patient viewing their own booked/reserved appointment: only notes editable
  const { isCancelled, canCancelAppointment } = getBookingCancellationConfig({
    appointmentToEdit,
    appointmentStatus,
  });
  const isPatientReadonly = Boolean(appointmentToEdit && user?.role === 'patient');
  const isEditMode = Boolean(appointmentToEdit);
  const isPastAppointmentMode = appointmentCreationMode === "past" && !appointmentToEdit;
  const statusRestrictionDate = selectedDate ?? appointmentToEdit?.date;
  const statusRestrictionTime = selectedTime || appointmentToEdit?.time;
  const isPastStatusRestricted = isPastAppointmentMode || isPastAppointmentSchedule(statusRestrictionDate, statusRestrictionTime);
  const isPublicCachedAppointment = isPublicBookingMode && Boolean(appointmentToEdit?.isPublicCache);
  const canDeleteCancelledAppointment = Boolean(
    appointmentToEdit &&
    isCancelled &&
    !isPatientLevelBookingMode &&
    !isPublicCachedAppointment
  );
  const getLocalPublicAppointmentLogs = useCallback(() => {
    if (!isPublicCachedAppointment || !appointmentToEdit?.id) return [];

    return [
      {
        id: `local_public_log_${appointmentToEdit.id}`,
        appointmentId: appointmentToEdit.id,
        previousState: { status: "none", paymentStatus: "none", price: 0, balance: 0, totalPaid: 0 },
        newState: appointmentToEdit,
        changedBy: "public",
        changedByName: appointmentToEdit.patientName || "Public Patient",
        changedAt: appointmentToEdit.createdAt || appointmentToEdit.cachedAt || appointmentToEdit.updatedAt || new Date().toISOString(),
        changeType: "update",
        amount: appointmentToEdit.totalPaid || 0,
        notes: appointmentToEdit.notes,
      },
    ];
  }, [appointmentToEdit, isPublicCachedAppointment]);

  const getLocalPublicPaymentLogs = useCallback(() => {
    const amount = Number(appointmentToEdit?.totalPaid || 0);
    if (!isPublicCachedAppointment || !appointmentToEdit?.id || amount <= 0) return [];

    return [
      {
        id: `local_public_payment_${appointmentToEdit.id}`,
        appointmentId: appointmentToEdit.id,
        amount,
        paymentDate: appointmentToEdit.paymentDate,
        paymentMethod: appointmentToEdit.paymentMethod || "payment",
        paymentStatus: appointmentToEdit.paymentStatus || "unpaid",
        changedBy: "public",
        changedByName: appointmentToEdit.patientName || "Public Patient",
        changedAt: appointmentToEdit.createdAt || appointmentToEdit.cachedAt || appointmentToEdit.updatedAt || new Date().toISOString(),
        previousBalance: appointmentToEdit.price || 0,
        newBalance: appointmentToEdit.balance || 0,
      },
    ];
  }, [appointmentToEdit, isPublicCachedAppointment]);
  const canEditAppointmentStatus = canManageStatuses && !isPatientReadonly;
  const visibleAppointmentStatuses = useMemo(
    () => (appointmentStatuses || []).filter((status) =>
      effectiveRole === "admin" || String(status.value || "").toLowerCase().trim() !== "deleted"
    ),
    [appointmentStatuses, effectiveRole]
  );
  const { appointmentStatusOptions } = getBookingAppointmentStatusConfig<AppointmentStatusOption>({
    appointmentStatus,
    existingStatus: appointmentToEdit?.status,
    isPastStatusRestricted,
    canManageStatuses,
    statusOptions: visibleAppointmentStatuses,
  });
  const getAppointmentStatusOption = (statusValue: string) =>
    appointmentStatusOptions.find((status) => status.value === statusValue);
  const { paymentStatusOptions } = getBookingPaymentStatusConfig<PaymentStatusOption>({
    paymentStatus,
    existingStatus: appointmentToEdit?.paymentStatus,
    statusOptions: paymentStatuses,
  });
  const getPaymentStatusOption = (statusValue: string) =>
    paymentStatusOptions.find((status) => status.value === statusValue);

  useEffect(() => {
    if (!open || appointmentToEdit || !canCreatePatients || !lastAddedPatient || !lastAddedPatientAt) return;
    if (lastHandledAddedPatientAtRef.current === lastAddedPatientAt) return;

    const patientOption = toPatientOption(lastAddedPatient);
    if (isPublicBookingMode) {
      cachePublicBookingPatient(patientOption);
    }
    setPatients(prev => {
      const filtered = prev.filter((patient: any) => String(patient.id) !== String(patientOption.id));
      return [patientOption, ...filtered];
    });
    setSelectedPatient(patientOption.id);
    lastHandledAddedPatientAtRef.current = lastAddedPatientAt;
  }, [open, appointmentToEdit, canCreatePatients, isPublicBookingMode, lastAddedPatient, lastAddedPatientAt]);

  // Fetch logs when appointment is being edited
  useEffect(() => {
    // Fetch logs for any appointment being edited, including public-cached ones.
    // Public cached appointments may still have server logs, so avoid skipping fetch.
    if (open && appointmentToEdit?.id) {
      console.log(`[BookingModal] 🔍 FETCHING LOGS for appointment: ${appointmentToEdit.id}`);
      const fetchLogs = async () => {
        // Add a small delay to ensure backend has finished saving before fetching
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          let url = apiUrl(`/api/appointments/${appointmentToEdit.id}/logs`);
          const publicToken = (appointmentToEdit as any).publicToken || (appointmentToEdit as any).publicAccessToken;
          if (publicToken) url = `${url}?publicToken=${encodeURIComponent(String(publicToken))}`;
          const res = await fetch(url, { credentials: 'include' });
          if (res.ok) {
            const json = await res.json();
            console.log(`[BookingModal] ✅ LOGS FETCHED:`, { 
              count: json.data?.length, 
              logs: json.data 
            });
            if (json.success) {
              const logs = json.data || [];
              setAppointmentLogs(logs.length > 0 ? logs : getLocalPublicAppointmentLogs());
            }
          } else if (res.status === 404) {
            // 404 is expected if logs endpoint doesn't exist or no logs available yet
            console.log(`[BookingModal] ℹ️ No logs available for this appointment`);
            setAppointmentLogs(getLocalPublicAppointmentLogs());
          } else {
            console.warn(`[BookingModal] ⚠️ Failed to fetch logs with status:`, res.status);
            setAppointmentLogs(getLocalPublicAppointmentLogs());
          }
        } catch (err) {
          console.warn("[BookingModal] ⚠️ Could not fetch appointment logs:", err);
          setAppointmentLogs(getLocalPublicAppointmentLogs());
        }
      };
      fetchLogs();
    } else if (!open) {
      setAppointmentLogs([]);
    }
  }, [open, appointmentToEdit, isPublicCachedAppointment, getLocalPublicAppointmentLogs]);

  // Fetch payment logs when appointment is being edited
  useEffect(() => {
    // Fetch payment logs for any appointment being edited, including public-cached ones.
    if (open && appointmentToEdit?.id) {
      const fetchPaymentLogs = async () => {
        // Add a small delay to ensure backend has finished saving before fetching
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          let url = apiUrl(`/api/appointments/${appointmentToEdit.id}/payments`);
          const publicToken = (appointmentToEdit as any).publicToken || (appointmentToEdit as any).publicAccessToken;
          if (publicToken) url = `${url}?publicToken=${encodeURIComponent(String(publicToken))}`;
          const res = await fetch(url, { credentials: 'include' });
          if (res.ok) {
            const json = await res.json();
            if (json.success) {
              const logs = json.data || [];
              setPaymentLogs(logs.length > 0 ? logs : getLocalPublicPaymentLogs());
            }
          } else {
            setPaymentLogs(getLocalPublicPaymentLogs());
          }
        } catch (err) {
          console.warn("[BookingModal] ⚠️ Could not fetch payment logs:", err);
          setPaymentLogs(getLocalPublicPaymentLogs());
        }
      };
      fetchPaymentLogs();
    } else if (!open) {
      setPaymentLogs([]);
    }
  }, [open, appointmentToEdit, isPublicCachedAppointment, getLocalPublicPaymentLogs]);

  // Check if a time + duration combination overlaps with existing appointments for selected doctor
  const checkDurationConflict = useCallback((time: string, durationMins: number): boolean => {
    if (!time || !selectedDate || !selectedDoctor) return false;

    const [hours, minutes] = time.split(':').map(Number);
    const slotStartDate = toDate(selectedDate);
    slotStartDate.setHours(hours, minutes, 0, 0);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMins * 60000);

    // Normalize doctor name for more robust matching (remove "Dr. " prefix and case-insensitive)
    const normalizeName = (name: string) => (name || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();
    const targetDoctor = normalizeName(selectedDoctor);

    // Filter daily appointments for the selected doctor - exclude cart items as they can be overridden
    const doctorAppts = dailyAppointments.filter(apt => 
      normalizeName(apt.doctor) === targetDoctor && 
      !isCartAppointmentStatus(apt.status)
    );
    
    // DEBUG: Log the filtering process
    console.log('[BookingModal] 🔍 DOCTOR NAME MATCHING DEBUG:', {
      selectedDoctor,
      targetDoctor,
      totalDailyAppointments: dailyAppointments.length,
      allDoctorNames: Array.from(new Set(dailyAppointments.map(apt => apt.doctor))),
      normalizedDoctorNames: Array.from(new Set(dailyAppointments.map(apt => normalizeName(apt.doctor)))),
      matchedCount: doctorAppts.length
    });

    for (const apt of doctorAppts) {
      // Parse the appointment date - it might be YYYY-MM-DD format
      let aptStart: Date;
      if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
        const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
        aptStart = new Date(apt.date);
        aptStart.setHours(aptHours, aptMinutes, 0, 0);
      } else {
        aptStart = new Date(apt.date);
      }
      
      const aptDurationMins = normalizeBookingDuration(apt.duration);
      const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);

      // Check if times overlap
      if (slotStartDate < aptEnd && slotEndDate > aptStart) {
        return true;
      }
    }

    return false;
  }, [selectedDate, selectedDoctor, dailyAppointments]);

  // Get conflict info for a specific duration
  const getDurationConflictInfo = useCallback((durationMins: number): { hasConflict: boolean; conflictTime?: string } => {
    if (!selectedTime || !selectedDate || !selectedDoctor) return { hasConflict: false };
    
    const hasConflict = checkDurationConflict(selectedTime, durationMins);
    if (!hasConflict) return { hasConflict: false };

    // Find the conflicting appointment time
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const slotStartDate = toDate(selectedDate);
    slotStartDate.setHours(hours, minutes, 0, 0);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMins * 60000);

    const normalizeName = (name: string) => (name || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();
    const targetDoctor = normalizeName(selectedDoctor);
    const doctorAppts = dailyAppointments.filter(apt => 
      normalizeName(apt.doctor) === targetDoctor && 
      !isCartAppointmentStatus(apt.status)
    );

    for (const apt of doctorAppts) {
      let aptStart: Date;
      if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
        const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
        aptStart = new Date(apt.date);
        aptStart.setHours(aptHours, aptMinutes, 0, 0);
      } else {
        aptStart = new Date(apt.date);
      }
      
      const aptDurationMins = normalizeBookingDuration(apt.duration);
      const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);
      
      if (slotStartDate < aptEnd && slotEndDate > aptStart) {
        return { 
          hasConflict: true, 
          conflictTime: `${String(aptStart.getHours()).padStart(2, '0')}:${String(aptStart.getMinutes()).padStart(2, '0')}` 
        };
      }
    }

    return { hasConflict: true };
  }, [selectedTime, selectedDate, selectedDoctor, dailyAppointments, checkDurationConflict]);

  // Check if a specific duration option is available (no conflict)
  const isDurationAvailable = useCallback((durationMins: number): boolean => {
    if (!selectedTime) return true;
    return !checkDurationConflict(selectedTime, durationMins);
  }, [selectedTime, checkDurationConflict]);

  // Update conflict status when duration changes
  useEffect(() => {
    if (!selectedTime || !selectedDoctor) {
      setDurationConflict("");
      return;
    }

    const durationMins = normalizeBookingDuration(duration);
    const conflict = getDurationConflictInfo(durationMins);
    
    if (conflict.hasConflict) {
      setDurationConflict(`Conflicts with appointment at ${conflict.conflictTime || 'this time'}`);
    } else {
      setDurationConflict("");
    }

    // Log available durations when time is set
    const availableDurations = ALLOWED_BOOKING_DURATIONS.filter(dur => isDurationAvailable(dur));
    const unavailableDurations = ALLOWED_BOOKING_DURATIONS.filter(dur => !isDurationAvailable(dur));
    
    console.log('[BookingModal] ⏱️ DURATION AVAILABILITY AT TIME:', {
      doctor: selectedDoctor,
      date: toDate(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      selectedTime: selectedTime,
      currentDuration: `${durationMins} mins`,
      availableDurations: availableDurations.length > 0 ? availableDurations.map(d => `${d} mins`) : '❌ NONE',
      unavailableDurations: unavailableDurations.length > 0 ? unavailableDurations.map(d => `${d} mins`) : 'None',
      
      // DEBUG: Show all doctor appointments being checked
      debugDoctorAppts: dailyAppointments
        .filter(apt => (apt.doctor || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim() === (selectedDoctor || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim())
        .map(apt => ({ time: apt.time, duration: apt.duration, status: apt.status, patient: apt.patientName })),
      
      // Show which appointments are blocking each unavailable duration
      blockedBy: unavailableDurations.length > 0 ? unavailableDurations.map(dur => {
        const [hours, minutes] = selectedTime.split(':').map(Number);
        const slotStart = toDate(selectedDate);
        slotStart.setHours(hours, minutes, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + dur * 60000);
        
        const normalizeName = (name: string) => (name || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();
        const targetDoctor = normalizeName(selectedDoctor);
        const doctorAppts = dailyAppointments.filter(apt => 
          normalizeName(apt.doctor) === targetDoctor && 
          !isCartAppointmentStatus(apt.status)
        );
        
        const blockingAppts = doctorAppts.filter((apt: any) => {
          let aptStart: Date;
          if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
            const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
            aptStart = new Date(apt.date);
            aptStart.setHours(aptHours, aptMinutes, 0, 0);
          } else {
            aptStart = new Date(apt.date);
          }
          const aptDurationMins = normalizeBookingDuration(apt.duration);
          const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);
          return slotStart < aptEnd && slotEnd > aptStart;
        });
        
        return {
          duration: `${dur} mins`,
          blocked: blockingAppts.length > 0,
          blockingAppointments: blockingAppts.map((apt: any) => ({
            time: apt.time,
            duration: `${apt.duration} mins`,
            status: apt.status,
            patient: apt.patientName
          }))
        };
      }) : []
    });
  }, [duration, selectedTime, getDurationConflictInfo, isDurationAvailable, selectedDoctor, selectedDate, dailyAppointments]);

  // Check if patient has a conflicting appointment at the selected time
  const checkPatientConflict = useCallback((time: string, durationMins: number): boolean => {
    if (!time || !selectedDate) return false;

    const [hours, minutes] = time.split(':').map(Number);
    const slotStartDate = toDate(selectedDate);
    slotStartDate.setHours(hours, minutes, 0, 0);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMins * 60000);

    for (const apt of patientAppointments) {
      let aptStart: Date;
      if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
        const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
        aptStart = new Date(apt.date);
        aptStart.setHours(aptHours, aptMinutes, 0, 0);
      } else {
        aptStart = new Date(apt.date);
      }
      
      const aptDurationMins = normalizeBookingDuration(apt.duration);
      const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);

      // Check if times overlap
      if (slotStartDate < aptEnd && slotEndDate > aptStart) {
        return true;
      }
    }

    return false;
  }, [selectedDate, patientAppointments]);

  // Get conflict info for patient
  const getPatientConflictInfo = useCallback(() => {
    if (!selectedTime || !selectedDate || !selectedPatient) return { hasConflict: false };

    if (patientAppointments.length > 0) {
      return {
        hasConflict: true,
        conflictMessage: 'Selected patient already has an appointment on this date. Only one appointment is allowed per patient per day.',
      };
    }

    const durationMins = normalizeBookingDuration(duration);
    const hasConflict = checkPatientConflict(selectedTime, durationMins);
    if (!hasConflict) return { hasConflict: false };

    // Find the conflicting appointment
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const slotStartDate = toDate(selectedDate);
    slotStartDate.setHours(hours, minutes, 0, 0);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMins * 60000);

    for (const apt of patientAppointments) {
      let aptStart: Date;
      if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
        const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
        aptStart = new Date(apt.date);
        aptStart.setHours(aptHours, aptMinutes, 0, 0);
      } else {
        aptStart = new Date(apt.date);
      }
      
      const aptDurationMins = normalizeBookingDuration(apt.duration);
      const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);
      
      if (slotStartDate < aptEnd && slotEndDate > aptStart) {
        return { 
          hasConflict: true, 
          conflictTime: `${String(aptStart.getHours()).padStart(2, '0')}:${String(aptStart.getMinutes()).padStart(2, '0')}`,
          conflictDoctor: apt.doctor || 'Another Doctor'
        };
      }
    }

    return { hasConflict: true };
  }, [selectedTime, selectedDate, duration, checkPatientConflict, patientAppointments, selectedPatient]);

  // Update conflict status when patient, time, or duration changes
  useEffect(() => {
    if (!selectedTime || !selectedPatient) {
      setPatientConflict("");
      return;
    }

    // Get the selected patient's name
    const selectedPatientObj = patients.find(p => String(p.id) === String(selectedPatient));
    const selectedPatientName = selectedPatientObj?.name || 'Patient';

    const conflict = getPatientConflictInfo();
    
    if (conflict.hasConflict) {
      if (conflict.conflictMessage) {
        setPatientConflict(conflict.conflictMessage);
      } else {
        setPatientConflict(`${selectedPatientName} has appointment with ${conflict.conflictDoctor} at ${conflict.conflictTime}`);
      }
    } else {
      setPatientConflict("");
    }
  }, [selectedPatient, selectedTime, duration, patients, getPatientConflictInfo]);

  // Compute which patients have conflicts for the selected time/duration/date
  const computePatientConflicts = useCallback((): Set<string> => {
    if (!selectedTime || !selectedDate) return new Set();
    
    const durationMins = normalizeBookingDuration(duration);
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const slotStartDate = toDate(selectedDate);
    slotStartDate.setHours(hours, minutes, 0, 0);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMins * 60000);

    const conflictingPatientIds = new Set<string>();

    // For each appointment in dailyAppointments, check if it overlaps with our selected time slot
    for (const apt of dailyAppointments) {
      if (isCartAppointmentStatus(apt.status)) continue;
      let aptStart: Date;
      if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
        const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
        aptStart = new Date(apt.date);
        aptStart.setHours(aptHours, aptMinutes, 0, 0);
      } else {
        aptStart = new Date(apt.date);
      }
      
      const aptDurationMins = normalizeBookingDuration(apt.duration);
      const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);
      
      if (slotStartDate < aptEnd && slotEndDate > aptStart) {
        if (apt.patientId) {
          conflictingPatientIds.add(String(apt.patientId));
        }
      }
    }

    return conflictingPatientIds;
  }, [selectedTime, selectedDate, duration, dailyAppointments]);

  const patientConflictSet = useMemo(() => computePatientConflicts(), [computePatientConflicts]);

  // Update duration when appointment type changes - always reset to default when type changes
  useEffect(() => {
    if (!appointmentType) {
      setDuration("");
      return;
    }
    // Always set default duration when appointment type changes
    const defaultDur = normalizeBookingDuration(serviceDurationByName[appointmentType]);
    setDuration(String(defaultDur));
  }, [appointmentType, serviceDurationByName]);

  useEffect(() => {
    autoPreselectedScheduleRef.current = null;
    setSelectedDate(getBookingDefaultDate(defaultDate));
  }, [defaultDate]);

  useEffect(() => {
    autoPreselectedScheduleRef.current = null;
    setSelectedTime(getBookingDefaultTime(defaultTime));
  }, [defaultTime]);

  // Debug: log incoming default patient id
  useEffect(() => {
    if (defaultPatientId) {
      console.log('[ImprovedBookingModal] 🔔 defaultPatientId prop:', defaultPatientId);
    } else {
      console.log('[ImprovedBookingModal] 🔔 no defaultPatientId provided');
    }
  }, [defaultPatientId]);

  // Sync doctorName prop to selectedDoctor state when it changes
  useEffect(() => {
    if (doctorName) {
      autoPreselectedDoctorRef.current = null;
      setSelectedDoctor(doctorName);
    }
  }, [doctorName]);

  useEffect(() => {
    if (!open || appointmentToEdit || doctorName) return;
    if (user?.role === 'doctor' && user.username) {
      autoPreselectedDoctorRef.current = null;
      setSelectedDoctor(user.username);
    }
  }, [open, appointmentToEdit, doctorName, user?.role, user?.username]);

  const getExplicitPreselectDoctor = useCallback(() => {
    if (selectedDoctor) return selectedDoctor;
    if (doctorName) return doctorName;
    if (user?.role === 'doctor') return user.username || (user as any)?.name || "";
    return "";
  }, [selectedDoctor, doctorName, user]);

  // Centralized auto-preselect/validation runner for the schedule step.
  const runAutoPreselect = useCallback(async (patientId?: string) => {
    const doctorToPreselect = getExplicitPreselectDoctor();
    const autoPreselect = getBookingAutoPreselectConfig({
      isEditing: Boolean(appointmentToEdit),
      defaultDate,
      defaultTime,
      selectedTime,
      appointmentType,
      selectedDoctor: doctorToPreselect,
      selectedPatient,
      defaultPatientId,
      patientId,
      appointmentTypeDurations: serviceDurationByName,
    });

    if (autoPreselect.type === "skip") return;

    if (!appointmentType) setAppointmentType(autoPreselect.defaultAppointmentType);

    if (autoPreselect.type === "preserve_schedule") return;

    if (autoPreselect.type === "wait_for_doctor") {
      const selectedAppointmentType = appointmentType || autoPreselect.defaultAppointmentType;
      const durationToSearch = String(normalizeBookingDuration(serviceDurationByName[selectedAppointmentType]));
      const patientToSearch = patientId || selectedPatient || defaultPatientId || undefined;
      const doctorPoolKey = doctors.map((doctor) => doctor.id || doctor.name).join(",");
      const searchKey = [
        "any-doctor",
        doctorPoolKey,
        durationToSearch,
        patientToSearch || "",
        isPublicBookingMode ? "public" : "standard",
      ].join("|");

      if (autoPreselectSearchKeyRef.current === searchKey) {
        return;
      }

      autoPreselectSearchKeyRef.current = searchKey;
      const requestId = autoPreselectRequestIdRef.current + 1;
      autoPreselectRequestIdRef.current = requestId;
      const selectedDateAtSearchStart = formatDateToYYYYMMDD(selectedDateRef.current);

      const nextSlot = await findNextAvailablePatientSchedule({
        startDate: new Date(),
        doctorsToCheck: doctors,
        durationToCheck: durationToSearch,
        patientToCheck: patientToSearch,
        timeSlots: TIME_SLOTS,
        availabilityMode: isPublicBookingMode ? "public" : "authenticated",
        localBlockingAppointments: isPublicBookingMode ? publicBlockingAppointments : [],
      });

      if (requestId !== autoPreselectRequestIdRef.current) return;
      if (selectedTimeRef.current || selectedDoctorRef.current) return;
      if (formatDateToYYYYMMDD(selectedDateRef.current) !== selectedDateAtSearchStart) return;

      if (nextSlot) {
        console.log('[BookingModal] Found next available patient schedule:', {
          date: formatDateToYYYYMMDD(nextSlot.date),
          time: nextSlot.time,
          availabilityFoundWithDoctor: nextSlot.doctorName,
        });
        autoPreselectedScheduleRef.current = {
          patientId: String(patientToSearch || ""),
          scheduleKey: `${formatDateToYYYYMMDD(nextSlot.date)}|${nextSlot.time}`,
        };
        setSelectedDate(nextSlot.date);
        setSelectedTime(nextSlot.time);
      }
      return;
    }

    if (doctorToPreselect && !selectedDoctor) {
      console.log('[BookingModal] Using explicitly provided doctor before schedule search:', doctorToPreselect);
      autoPreselectedDoctorRef.current = null;
      setSelectedDoctor(doctorToPreselect);
    }

    const searchKey = [
      autoPreselect.doctorToSearch,
      autoPreselect.durationToSearch,
      autoPreselect.patientToSearch || "",
      isPublicBookingMode ? "public" : "standard",
    ].join("|");

    if (autoPreselectSearchKeyRef.current === searchKey) {
      return;
    }

    autoPreselectSearchKeyRef.current = searchKey;
    const requestId = autoPreselectRequestIdRef.current + 1;
    autoPreselectRequestIdRef.current = requestId;
    const selectedDateAtSearchStart = formatDateToYYYYMMDD(selectedDateRef.current);

    const nextSlot = await findNextAvailableBookingSlot({
      startDate: new Date(),
      doctorToCheck: autoPreselect.doctorToSearch,
      durationToCheck: autoPreselect.durationToSearch,
      patientToCheck: autoPreselect.patientToSearch,
      timeSlots: TIME_SLOTS,
      availabilityMode: isPublicBookingMode ? "public" : "authenticated",
      localBlockingAppointments: isPublicBookingMode ? publicBlockingAppointments : [],
    });

    if (requestId !== autoPreselectRequestIdRef.current) return;
    if (selectedTimeRef.current) return;
    if (formatDateToYYYYMMDD(selectedDateRef.current) !== selectedDateAtSearchStart) return;

    const currentDoctor = selectedDoctorRef.current || doctorToPreselect;
    if (normalizeDoctorName(currentDoctor) !== normalizeDoctorName(autoPreselect.doctorToSearch)) return;

    if (nextSlot) {
      console.log('[BookingModal] Found next available slot after patient selection:', { date: formatDateToYYYYMMDD(nextSlot.date), time: nextSlot.time });
      autoPreselectedScheduleRef.current = {
        patientId: String(autoPreselect.patientToSearch || ""),
        scheduleKey: `${formatDateToYYYYMMDD(nextSlot.date)}|${nextSlot.time}`,
      };
      setSelectedDate(nextSlot.date);
      setSelectedTime(nextSlot.time);
    }
  }, [
    appointmentToEdit,
    defaultDate,
    defaultTime,
    appointmentType,
    selectedDoctor,
    selectedPatient,
    defaultPatientId,
    selectedTime,
    isPublicBookingMode,
    publicBlockingAppointments,
    doctors,
    getExplicitPreselectDoctor,
    serviceDurationByName,
  ]);

  useEffect(() => {
    if (!open || appointmentToEdit) {
      previousSelectedPatientRef.current = selectedPatient;
      return;
    }

    const previousPatient = previousSelectedPatientRef.current;
    if (!previousPatient) {
      previousSelectedPatientRef.current = selectedPatient;
      return;
    }

    if (selectedPatient && String(previousPatient) !== String(selectedPatient)) {
      if (autoPreselectedScheduleRef.current) {
        autoPreselectedScheduleRef.current = null;
        autoPreselectSearchKeyRef.current = null;
        setSelectedTime("");
      }

      const autoDoctor = autoPreselectedDoctorRef.current;
      if (autoDoctor) {
        autoPreselectedDoctorRef.current = null;
        setSelectedDoctor((current) =>
          normalizeDoctorName(current) === normalizeDoctorName(autoDoctor) ? "" : current
        );
      }
    }

    previousSelectedPatientRef.current = selectedPatient;
  }, [open, appointmentToEdit, selectedPatient]);

  // Auto-preselect date, time, and appointment type for all portals
  useEffect(() => {
    const defaultScheduleAction = getBookingDefaultScheduleAction({
      open,
      isEditing: Boolean(appointmentToEdit),
      defaultDate,
      defaultTime,
      doctorName,
      appliedScheduleKey: appliedDefaultScheduleKeyRef.current,
    });

    if (defaultScheduleAction.type === "apply") {
      if (defaultScheduleAction.source === "doctor_availability") {
        console.log('[BookingModal] 📍 DoctorAvailabilityView context detected');
        console.log('[BookingModal] ℹ️ Pre-filled with: date=' + formatDateToYYYYMMDD(defaultScheduleAction.date) + ', time=' + defaultScheduleAction.time + ', doctor=' + defaultScheduleAction.doctorName);
      } else {
        console.log('[BookingModal] 📍 Using explicitly passed date/time:', {
          date: formatDateToYYYYMMDD(defaultScheduleAction.date),
          time: defaultScheduleAction.time,
          source: 'clicked_slot'
        });
      }

      if (!appointmentType) setAppointmentType(DEFAULT_BOOKING_TREATMENT);

      if (defaultScheduleAction.shouldApplySchedule) {
        autoPreselectedScheduleRef.current = null;
        setSelectedDate(defaultScheduleAction.date);
        setSelectedTime(defaultScheduleAction.time);
        appliedDefaultScheduleKeyRef.current = defaultScheduleAction.scheduleKey;
      }
      return;
    }

    if (!open || appointmentToEdit) return; // Only for new appointments, not editing

    // CASE 3: New appointment modal (no defaults at all)
    // Only preselect if not already set
    if (selectedTime) return;
    
    // Preselect first appointment type
    if (!appointmentType) {
      console.log('[BookingModal] 📋 Preselecting appointment type: Routine Cleaning');
      setAppointmentType(DEFAULT_BOOKING_TREATMENT);
    }
    
  }, [open, appointmentToEdit, defaultDate, defaultTime, doctorName, selectedTime, appointmentType]);

  useEffect(() => {
    if (!open || appointmentToEdit || modalStep !== 'schedule') return;
    if (!selectedPatient || selectedTime) return;

    runAutoPreselect(selectedPatient).catch((err) => {
      console.warn('[BookingModal] Failed to auto-preselect schedule after patient selection:', err);
    });
  }, [open, appointmentToEdit, modalStep, selectedPatient, selectedTime, runAutoPreselect]);

  // Price calculations - handle custom types
  // finalPrice is the base price (before discount) - used in payment calculations
  const basePrice = appointmentType === "Other" ? Number(customPrice) : (servicePriceByName[appointmentType] || 0);
  const finalPrice = Number(customPrice) > 0 ? Number(customPrice) : basePrice;

  // Log appointment type changes with price
  useEffect(() => {
    if (appointmentType) {
      const basePriceLog = servicePriceByName[appointmentType] || 0;
      console.log(`[BookingModal] Appointment Type Changed:`, {
        event: 'appointmentTypeChanged',
        type: appointmentType,
        basePrice: basePriceLog,
        duration: duration,
        userRole: user?.role,
        timestamp: new Date().toISOString()
      });
      // Reset custom price when appointment type changes (unless in edit mode)
      if (!isEditMode) {
        setCustomPrice("0");
      }
    }
  }, [appointmentType, user?.role, duration, isEditMode, servicePriceByName]);

  const isTreatmentSuggestionDeclined = useCallback(
    (suggestion: ExistingTreatmentSuggestion | null) =>
      Boolean(
        suggestion &&
        declinedTreatmentSuggestion &&
        declinedTreatmentSuggestion.normalizedInput === suggestion.normalizedInput &&
        declinedTreatmentSuggestion.treatment === suggestion.treatment
      ),
    [declinedTreatmentSuggestion]
  );

  const detectedExistingTreatment = useMemo(() => {
    if (appointmentType !== "Other") return null;
    return findExistingTreatmentSuggestion(customAppointmentTypeName, bookingTreatmentOptions);
  }, [appointmentType, customAppointmentTypeName, bookingTreatmentOptions]);

  const otherTreatmentSuggestion = detectedExistingTreatment &&
    !detectedExistingTreatment.isExact &&
    !isTreatmentSuggestionDeclined(detectedExistingTreatment)
      ? detectedExistingTreatment
      : null;

  const handleTreatmentSelect = useCallback((treatmentName: string) => {
    setAppointmentType(treatmentName);
    setDeclinedTreatmentSuggestion(null);
    if (treatmentName !== "Other") {
      setCustomAppointmentTypeName("");
    }
  }, []);

  const handleCustomTreatmentNameChange = useCallback((value: string) => {
    const normalizedInput = normalizeTreatmentInput(value);
    setCustomAppointmentTypeName(value);
    setDeclinedTreatmentSuggestion((current) =>
      current && current.normalizedInput !== normalizedInput ? null : current
    );
  }, []);

  const applyExistingTreatmentSuggestion = useCallback((suggestion: ExistingTreatmentSuggestion) => {
    setAppointmentType(suggestion.treatment);
    setCustomAppointmentTypeName("");
    setDeclinedTreatmentSuggestion(null);
    setCustomPrice("0");
  }, []);

  const declineExistingTreatmentSuggestion = useCallback((suggestion: ExistingTreatmentSuggestion) => {
    setDeclinedTreatmentSuggestion({
      normalizedInput: suggestion.normalizedInput,
      treatment: suggestion.treatment,
    });
  }, []);

  const resolveOtherTreatmentBeforeContinue = useCallback((nextAction: "treatment-next" | "payment-confirm") => {
    if (appointmentType !== "Other" || !detectedExistingTreatment) return false;
    if (!detectedExistingTreatment.isExact && isTreatmentSuggestionDeclined(detectedExistingTreatment)) return false;

    applyExistingTreatmentSuggestion(detectedExistingTreatment);

    if (nextAction === "treatment-next") {
      setModalStep("payment");
    } else {
      setPendingConfirmAfterTreatmentSuggestion(true);
    }

    return true;
  }, [
    appointmentType,
    detectedExistingTreatment,
    isTreatmentSuggestionDeclined,
    applyExistingTreatmentSuggestion,
  ]);

  useEffect(() => {
    if (!open) return;
    // fetch patients based on role - rely on server-side filtering for patient role
    const fetchPatients = async () => {
      setIsLoadingPatients(true);
      try {
        if (isPublicBookingMode) {
          const cachedPatients = getCachedPublicBookingPatients().map(toPatientOption);
          setPatients(cachedPatients);

          if (cachedPatients.length > 0) {
            const foundDefault = defaultPatientId
              ? cachedPatients.find((p: any) => String(p.id) === String(defaultPatientId))
              : null;
            setSelectedPatient((current) => current || foundDefault?.id || cachedPatients[0].id);
          }

          setIsLoadingPatients(false);
          return;
        }

        const fetchOpts: RequestInit = { credentials: 'include' };
        
        // Always fetch from /api/patients - server will filter based on requester role
        const res = await fetch(apiUrl(`/api/patients?limit=1000`), fetchOpts);
        
        if (!res.ok) {
          console.error('BookingModal: fetch failed', { status: res.status, statusText: res.statusText });
          setIsLoadingPatients(false);
          return;
        }
        
        const json = await res.json();
        console.log('BookingModal: fetch response', { success: json?.success, dataCount: json?.data?.length, user: { username: user?.username, role: user?.role } });
        
        if (json?.success && Array.isArray(json.data)) {
          let list = json.data.map(toPatientOption);
          const editPatientId = appointmentToEdit?.patientId ? String(appointmentToEdit.patientId) : "";

          if (editPatientId && !list.some((p: any) => String(p.id) === editPatientId)) {
            try {
              const patientRes = await fetch(apiUrl(`/api/patients/${encodeURIComponent(editPatientId)}`), fetchOpts);
              const patientJson = await patientRes.json();
              if (patientJson?.success && patientJson.data) {
                list = [toPatientOption(patientJson.data), ...list];
              }
            } catch (patientErr) {
              console.warn('[ImprovedBookingModal] Failed to fetch appointment patient; using appointment snapshot:', patientErr);
            }

            if (!list.some((p: any) => String(p.id) === editPatientId)) {
              list = [
                toPatientOption({
                  id: editPatientId,
                  name: appointmentToEdit.patientName || 'Patient',
                }),
                ...list,
              ];
            }
          }
          console.log('BookingModal: patients loaded', { 
            count: list.length, 
            source: user?.role === 'patient' ? 'server-filtered' : 'admin-fetch',
            allIds: list.slice(0, 3).map((p: any) => ({ id: p.id, type: typeof p.id, name: p.name }))
          });
          try { window.dispatchEvent(new CustomEvent('bookingmodal:patients', { detail: { source: user?.role === 'patient' ? 'server-filtered' : 'admin-fetch', count: list.length, patients: list } })); } catch {}
          setPatients(list);
          // Edit/view mode must always use the appointment patient, never the default/first patient.
          let chosenPatientId: string | undefined = undefined;
          if (editPatientId) {
            chosenPatientId = editPatientId;
          } else if (defaultPatientId) {
            const found = list.find((p: any) => String(p.id) === String(defaultPatientId));
            if (found) chosenPatientId = String(defaultPatientId);
            else if (list.length > 0) chosenPatientId = list[0].id;
          } else if (list.length > 0) {
            chosenPatientId = list[0].id;
          }

          if (chosenPatientId) {
            setSelectedPatient(chosenPatientId);
          }
        } else {
          console.warn('BookingModal: empty or failed response', json);
          setPatients([]);
        }
      } catch (err) {
        console.error('Failed to fetch patients for booking modal', err);
        setPatients([]);
      } finally {
        setIsLoadingPatients(false);
      }
    };

    fetchPatients();
  }, [open, user, defaultPatientId, appointmentToEdit, isPublicBookingMode]);

  // When an appointment is provided for editing, prefill the form
  useEffect(() => {
    if (appointmentToEdit) {
      autoPreselectedScheduleRef.current = null;
      autoPreselectedDoctorRef.current = null;
      console.log('[BookingModal] 📂 OPENING APPOINTMENT FOR EDITING:', {
        appointmentId: appointmentToEdit.id,
        patientName: appointmentToEdit.patientName,
        currentStatus: appointmentToEdit.status,
        currentPaymentStatus: appointmentToEdit.paymentStatus,
        totalPaid: appointmentToEdit.totalPaid,
        balance: appointmentToEdit.balance,
        logsCount: appointmentLogs.length,
        paymentLogsCount: paymentLogs.length,
        timestamp: new Date().toISOString()
      });

      setSelectedPatient(String(appointmentToEdit.patientId || appointmentToEdit.patientId));
      // Use getAppointmentTypeName to convert type index to string name
      // This handles both standard types (0-5) and custom type (6 with customType)
      const typeName = getAppointmentTypeName(appointmentToEdit.type, appointmentToEdit.customType);
      console.log('[BookingModal Edit] Converted appointment type:', {
        type: appointmentToEdit.type,
        customType: appointmentToEdit.customType,
        convertedTypeName: typeName
      });

      // If it's a custom type (type 6), set appointmentType to "Other"
      // This ensures the Select matches "Other" and custom fields are shown
      if (appointmentToEdit.type === 6) {
        setAppointmentType("Other");
        setCustomAppointmentTypeName(appointmentToEdit.customType || "");
      } else {
        setAppointmentType(typeName);
      }
      
      // Always set the stored price (whether custom or standard type)
      setCustomPrice(String(appointmentToEdit.price || 0));
      setDuration(String(normalizeBookingDuration(appointmentToEdit.duration)));
      // Prefill discount if it exists in the appointment (from discount field)
      setDiscount(String(appointmentToEdit.discount || 0));
      // For both editing and creating via the BookingModal we intentionally
      // clear the notes field so the modal opens with an empty notes input.
      // Notes from history remain visible in the AppointmentHistoryView below,
      // but they are not auto-copied into the editable notes field.
      setNotes('');
      setTreatmentNotes(getBookingTreatmentNotesValue(appointmentToEdit));
      setSelectedDate(toDate(getBookingEditDate({ appointmentDate: appointmentToEdit.date, defaultDate })));
      setSelectedTime(getBookingEditTime({ appointmentTime: appointmentToEdit.time, defaultTime }));
      // Set doctor from the appointment
      if (appointmentToEdit.doctor) {
        setSelectedDoctor(appointmentToEdit.doctor);
      }
      // For editing, initialize payment amount to empty so user enters NEW payment amount
      setAmountToPay('0');
      setPaymentDate(getDefaultBookingPaymentDate());
      setAppointmentStatus(appointmentToEdit.status || 'scheduled');
      setPaymentStatus(appointmentToEdit.paymentStatus || 'unpaid');
      const existingPaymentMethod = String(appointmentToEdit.paymentMethod || "").trim();
      setPaymentMethod(existingPaymentMethod.toLowerCase() === 'pay at clinic' ? '' : existingPaymentMethod);
      setDeclinedTreatmentSuggestion(null);
      setPendingConfirmAfterTreatmentSuggestion(false);
      // Reset the flag when opening for edit
      setStatusChangedByUser(0);
      setPaymentStatusChangedByUser(0);
      // Set the modal step based on isPaymentFlow flag or if we are editing
      // Only skip to payment step if explicitly marked as payment flow (e.g., "Pay Now" click)
      // or if we are viewing/editing an existing appointment
      setModalStep(isPaymentFlow || appointmentToEdit ? 'payment' : 'patient');
      setIsRescheduling(false);
    } else {
      autoPreselectedScheduleRef.current = null;
      autoPreselectedDoctorRef.current = null;
      previousSelectedPatientRef.current = defaultPatientId ? String(defaultPatientId) : '';
      // Reset form when creating new appointment
      // If a defaultPatientId was provided (e.g., user clicked Schedule on a patient), prefer it
      setSelectedPatient(defaultPatientId ? String(defaultPatientId) : '');
      setAppointmentType(DEFAULT_BOOKING_TREATMENT);
      setCustomAppointmentTypeName('');
      setDuration('30');
      setDiscount('0');
      setCustomPrice('0');
      setNotes('');
      setTreatmentNotes('');
      setSelectedDate(toDate(getBookingCreateDate({ defaultDate, isPastAppointmentMode })));
      setSelectedTime(getBookingCreateTime(defaultTime));
      setSelectedDoctor(doctorName || (user?.role === 'doctor' ? user.username : ''));
      setAmountToPay('0');
      setPaymentDate(getDefaultBookingPaymentDate());
      setAppointmentStatus(isPastAppointmentMode ? 'completed' : 'scheduled');
      setPaymentStatus('unpaid');
      setPaymentMethod('');
      setDeclinedTreatmentSuggestion(null);
      setPendingConfirmAfterTreatmentSuggestion(false);
      // Reset the flag when opening for new appointment
      setStatusChangedByUser(0);
      setPaymentStatusChangedByUser(0);
      setModalStep('patient');
    }
  }, [open, appointmentToEdit, defaultDate, defaultTime, defaultPatientId, doctorName, user?.role, user?.username, isPastAppointmentMode]);

    // Use shared booking logic for next/prev step handling
    const { handleNextStep, handlePrevStep } = useSharedBookingLogic({
      modalStep,
      flow: 'multi-step',
      selectedPatient,
      selectedDate,
      selectedTime,
      appointmentType,
      customAppointmentTypeName,
      selectedDoctor,
      setModalStep: (step) => setModalStep(step as ImprovedBookingStep),
      setIsConfirmSummaryOpen,
      toast,
      durationConflict,
      patientConflict,
      patientDateConflict: patientAppointments.length > 0 && selectedPatient ? 'Selected patient already has an appointment on this date. Only one appointment is allowed per patient per day.' : undefined,
      skipDoctorStep: isDoctorSelectionLocked,
      scheduleMode: isPastAppointmentMode ? 'past' : 'standard',
    });

  // Derived display values for schedule block
  const scheduleDoctorName = selectedDoctor || appointmentToEdit?.doctor || doctorName;
  const displayDoctor = formatDoctorName(scheduleDoctorName);
  const showDoctorStep = !isDoctorSelectionLocked;
  const visibleBookingSteps: Array<{ id: ImprovedBookingStep; label: string; icon: string }> = [
    { id: 'patient', label: 'Patient', icon: '1' },
    { id: 'schedule', label: 'Schedule', icon: '2' },
    ...(showDoctorStep ? [{ id: 'doctor' as ImprovedBookingStep, label: 'Doctor', icon: '3' }] : []),
    { id: 'treatment', label: 'Treatment', icon: showDoctorStep ? '4' : '3' },
    { id: 'payment', label: 'Payment', icon: showDoctorStep ? '5' : '4' },
  ];
  const activeStepIndex = Math.max(0, visibleBookingSteps.findIndex((step) => step.id === modalStep));
  const progressWidth = visibleBookingSteps.length > 1
    ? `${(activeStepIndex / (visibleBookingSteps.length - 1)) * 100}%`
    : '0%';
  const selectedDoctorRecord = doctors.find((doctor) => normalizeDoctorName(doctor.name) === normalizeDoctorName(selectedDoctor));
  // For doctor users, prefer showing only their own doctor record when present.
  const visibleDoctors = (() => {
    if (user?.role === 'doctor') {
      const docKey = (user as any)?.username || (user as any)?.name || '';
      const filtered = (doctors || []).filter((d: any) => normalizeDoctorName(d.name) === normalizeDoctorName(docKey));
      return filtered.length > 0 ? filtered : (doctors || []);
    }
    return doctors || [];
  })();
  const summaryPatientRecord = patients.find((patient) => String(patient.id) === String(selectedPatient));
  const summaryPatientName = summaryPatientRecord?.name || appointmentToEdit?.patientName || selectedPatient || "Patient";
  const summaryPatientAvatar = resolveAvatarSource(pickAvatarSource(
    summaryPatientRecord?.profilePicture,
    summaryPatientRecord?.profilePictureUrl,
    summaryPatientRecord?.photo,
    summaryPatientRecord?.avatar,
    appointmentToEdit?.patientProfile,
    appointmentToEdit?.patientProfilePicture,
    appointmentToEdit?.patientPhoto,
    appointmentToEdit?.patientImage,
    appointmentToEdit?.patientAvatar,
    appointmentToEdit?.patient?.profilePicture,
    appointmentToEdit?.patient?.profilePictureUrl,
    appointmentToEdit?.patient?.photo,
    appointmentToEdit?.patient?.avatar,
  ));
  const summaryDoctorAvatar = resolveAvatarSource(pickAvatarSource(
    selectedDoctorRecord?.profilePicture,
    (selectedDoctorRecord as any)?.profilePictureUrl,
    appointmentToEdit?.doctorProfile,
    appointmentToEdit?.doctorProfilePicture,
    appointmentToEdit?.doctorPhoto,
    appointmentToEdit?.doctorImage,
    appointmentToEdit?.doctor?.profilePicture,
    appointmentToEdit?.doctor?.profilePictureUrl,
  ));

  const selectedDateKey = formatDateToYYYYMMDD(selectedDate);
  const isSelectedDateAppointmentsLoaded = !selectedDateKey || dailyAppointmentsDateKey === selectedDateKey;

  const hasDoctorScheduleConflict = useCallback((doctorNameToCheck: string) => {
    if (!selectedDate || !selectedTime || !doctorNameToCheck) return false;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const slotStart = toDate(selectedDate);
    slotStart.setHours(hours, minutes, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + normalizeBookingDuration(duration) * 60000);
    const targetDoctor = normalizeDoctorName(doctorNameToCheck);

    return dailyAppointments.some((apt: any) => {
      if (normalizeDoctorName(apt.doctor) !== targetDoctor) return false;
      if (isCartAppointmentStatus(apt.status)) return false;

      const aptDate = typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')
        ? new Date(apt.date)
        : new Date(apt.date);
      const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
      aptDate.setHours(aptHours, aptMinutes, 0, 0);
      const aptEnd = new Date(aptDate.getTime() + normalizeBookingDuration(apt.duration) * 60000);

      return slotStart < aptEnd && slotEnd > aptDate;
    });
  }, [selectedDate, selectedTime, duration, dailyAppointments]);

  useEffect(() => {
    if (!open || appointmentToEdit || modalStep !== 'doctor') return;
    if (selectedDoctor || !selectedDate || !selectedTime) return;
    if (!isSelectedDateAppointmentsLoaded) return;

    const firstAvailableDoctor = visibleDoctors.find((doctor) => !hasDoctorScheduleConflict(doctor.name));
    if (!firstAvailableDoctor) return;

    autoPreselectedDoctorRef.current = firstAvailableDoctor.name;
    setSelectedDoctor(firstAvailableDoctor.name);
  }, [
    open,
    appointmentToEdit,
    modalStep,
    selectedDoctor,
    selectedDate,
    selectedTime,
    isSelectedDateAppointmentsLoaded,
    visibleDoctors,
    hasDoctorScheduleConflict,
  ]);

  const canOpenStep = (stepId: ImprovedBookingStep) => {
    if (isBooking) return false;
    if (stepId === 'patient') return true;
    if (stepId === 'schedule') return !!selectedPatient;
    if (stepId === 'doctor') return showDoctorStep && !!selectedPatient && !!selectedDate && !!selectedTime;
    if (stepId === 'treatment') {
      return !!selectedPatient && !!selectedDate && !!selectedTime && (!showDoctorStep || !!selectedDoctor);
    }
    if (stepId === 'payment') {
      return !!selectedPatient && !!selectedDate && !!selectedTime && !!appointmentType && !!selectedDoctor;
    }
    return false;
  };

  const getNextButtonLabel = () => {
    if (modalStep === 'patient') return 'Next: Schedule';
    if (modalStep === 'schedule') return showDoctorStep ? 'Next: Doctor' : 'Next: Treatment';
    if (modalStep === 'doctor') return 'Next: Treatment';
    if (modalStep === 'treatment') return 'Next: Payment';
    // final step (payment) - show 'Add to Cart' when the projected status is a cart item
    if (modalStep === 'payment') {
      if (isCartAppointmentStatus(getFinalAppointmentStatus())) return 'Add to Cart';
      return paymentAmountNow > 0 ? 'Confirm & Process Payment' : 'Confirm & Save';
    }
    return 'Confirm & Save';
  };
  
  // Calculate remaining balance for display in payment step
  const previouslyPaidAmount = appointmentToEdit?.totalPaid !== undefined 
    ? appointmentToEdit.totalPaid 
    : (appointmentToEdit?.price !== undefined && appointmentToEdit?.balance !== undefined)
      ? Math.max(0, appointmentToEdit.price - appointmentToEdit.balance)
      : 0;
  const discountAmount = Math.max(0, Number(discount) || 0);
  const hasDiscount = discountAmount > 0;
  const discountedPrice = Math.max(0, finalPrice - discountAmount);
  const remainingBalance = Math.max(0, discountedPrice - previouslyPaidAmount);
  const paymentAmountNow = parseFloat(amountToPay) || 0;
  const isOverpay = paymentAmountNow > remainingBalance;
  const projectedRemainingBalance = Math.max(0, remainingBalance - paymentAmountNow);
  const selectedTreatmentName = appointmentType === "Other"
    ? customAppointmentTypeName || "Custom Treatment"
    : appointmentType || "Selected Treatment";
  const bookingConflictWarnings = getBookingConflictWarnings({
    durationConflict,
    patientConflict,
    duration,
  });
  const bookingConflictTitle = bookingConflictWarnings.map(w => w.message).join('\n');
  const mergedHistoryLogs = getMergedBookingLogs(appointmentLogs, paymentLogs);
  const hasScheduledStatusOption = appointmentStatusOptions.some(
    (status) => String(status.value || '').trim().toLowerCase() === 'scheduled'
  );
  const defaultAppointmentStatus = isPastStatusRestricted || !hasScheduledStatusOption ? 'completed' : 'scheduled';

  useBookingPaymentPrefill({
    open,
    modalStep,
    amountToPay,
    remainingBalance,
    setAmountToPay,
  });

  useEffect(() => {
    if (!open || statusChangedByUser === 1) return;
    if (appointmentToEdit) return;
    if (appointmentStatus === defaultAppointmentStatus) return;
    setAppointmentStatus(defaultAppointmentStatus);
  }, [open, statusChangedByUser, appointmentStatus, defaultAppointmentStatus, appointmentToEdit]);

  // Handler for status changes that sets the flag
  const handleStatusChange = (newStatus: string) => {
    if (isPastStatusRestricted && !PAST_APPOINTMENT_STATUS_VALUES.includes(newStatus as typeof PAST_APPOINTMENT_STATUS_VALUES[number])) {
      toast.error("Past appointments can only be Cancelled, Completed, or TBD.");
      return;
    }

    if (canManageStatuses && isCartAppointmentStatus(newStatus)) {
      toast.error("Add to Cart is reserved for patient carts.");
      return;
    }
    setAppointmentStatus(newStatus);
    setStatusChangedByUser(1);
  };

  const handlePaymentStatusChange = (newStatus: string) => {
    setPaymentStatus(newStatus as any);
    setPaymentStatusChangedByUser(1);
  };

  // First step: validate details and move to payment
  const handleConfirmBooking = async () => {
    if (modalStep === "treatment" && resolveOtherTreatmentBeforeContinue("treatment-next")) {
      return;
    }

    // Progress to the next step in the multi-step flow
    setIsBooking(true);
    try {
      await handleNextStep();
    } catch (err) {
      console.error('Booking: details error', err);
    } finally {
      setIsBooking(false);
    }
  };

  const validatePaymentDateForAmount = (amount: number) => {
    if (amount <= 0) return true;

    const normalizedDate = normalizeBookingPaymentDate(paymentDate);
    if (!normalizedDate) {
      toast.error("Please choose the date the payment was made.");
      return false;
    }

    if (isFutureBookingPaymentDate(normalizedDate)) {
      toast.error("Payment date cannot be in the future.");
      return false;
    }

    if (normalizedDate !== paymentDate) setPaymentDate(normalizedDate);
    return true;
  };

  // Second step: show summary confirmation before saving
  const handleConfirmPayment = async () => {
    if (resolveOtherTreatmentBeforeContinue("payment-confirm")) {
      return;
    }

    // Prevent overpayment: do not proceed if entered amount exceeds remaining balance
    const amountPaidRaw = amountToPay.trim() === '' ? '0' : amountToPay;
    const amountPaid = parseFloat(amountPaidRaw) || 0;
    if (amountPaid > remainingBalance) {
      toast.error(`Amount exceeds remaining balance. Maximum allowed: ₱${remainingBalance.toLocaleString()}`);
      return;
    }

    if (!validatePaymentDateForAmount(amountPaid)) return;

    // Use the shared next-step helper: if already at payment, this will open the summary
    await handleNextStep();
  };

  useEffect(() => {
    if (!pendingConfirmAfterTreatmentSuggestion || appointmentType === "Other") return;
    setPendingConfirmAfterTreatmentSuggestion(false);
    handleConfirmPayment();
  }, [pendingConfirmAfterTreatmentSuggestion, appointmentType, handleConfirmPayment]);

  useEffect(() => {
    const handleGuidedNext = async () => {
      if (!open || isBooking) return;

      if (isTimePickerOpen) {
        setIsTimePickerOpen(false);
      }
      if (isDatePickerOpen) {
        setIsDatePickerOpen(false);
      }

      if (modalStep === "payment") {
        await handleConfirmPayment();
        return;
      }

      if (modalStep === "doctor" && !selectedDoctor) {
        if (!isSelectedDateAppointmentsLoaded) return;
        const firstAvailableDoctor = visibleDoctors.find((doctor) => !hasDoctorScheduleConflict(doctor.name));
        if (firstAvailableDoctor) {
          autoPreselectedDoctorRef.current = firstAvailableDoctor.name;
          setSelectedDoctor(firstAvailableDoctor.name);
          setModalStep("treatment");
        }
        return;
      }

      await handleConfirmBooking();
    };

    const handleGuidedPrev = () => {
      if (!open || isBooking) return;
      handlePrevStep();
    };

    window.addEventListener("villahermosa-tour:booking-next", handleGuidedNext);
    window.addEventListener("villahermosa-tour:booking-prev", handleGuidedPrev);

    return () => {
      window.removeEventListener("villahermosa-tour:booking-next", handleGuidedNext);
      window.removeEventListener("villahermosa-tour:booking-prev", handleGuidedPrev);
    };
  }, [
    handleConfirmBooking,
    handlePrevStep,
    isBooking,
    modalStep,
    open,
    isSelectedDateAppointmentsLoaded,
    selectedDoctor,
    visibleDoctors,
    hasDoctorScheduleConflict,
  ]);

  useEffect(() => {
    if (!open) return;

    window.dispatchEvent(
      new CustomEvent("villahermosa-tour:booking-step-change", {
        detail: { step: modalStep },
      })
    );
  }, [modalStep, open]);

  // Calculate what the final status will be for display in summary
  const getProjectedStatus = () => {
    if (statusChangedByUser === 1) {
      return isPastStatusRestricted
        ? normalizePastAppointmentStatus(appointmentStatus || appointmentToEdit?.status || defaultAppointmentStatus)
        : appointmentStatus || appointmentToEdit?.status || defaultAppointmentStatus;
    }

    return defaultAppointmentStatus;
  };

  // Calculate what the final payment status will be for display in summary
  const getFinalPaymentStatus = () => {
    const amountPaidRaw = amountToPay.trim() === '' ? '0' : amountToPay;
    const amountPaid = parseFloat(amountPaidRaw) || 0;

    return getProjectedPaymentStatus({
      paymentMethod,
      statusChangedByUser: paymentStatusChangedByUser === 1,
      selectedStatus: paymentStatus,
      existingStatus: appointmentToEdit?.paymentStatus,
      amountPaid,
      previouslyPaidAmount,
      totalPrice: discountedPrice,
    });
  };

  // Calculate the FINAL appointment status
  const getFinalAppointmentStatus = () => {
    return getProjectedStatus();
  };

  const getRepeatTargetDate = (repeatPayload?: { repeatOption: string; customRepeatDate?: string }) => {
    const repeatOptionValue = repeatPayload?.repeatOption || "do-not-repeat";
    if (repeatOptionValue === "do-not-repeat") return null;

    const baseDate = new Date(selectedDate);
    const target = new Date(baseDate);

    switch (repeatOptionValue) {
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
        if (!repeatPayload?.customRepeatDate) return null;
        const parsed = new Date(repeatPayload.customRepeatDate);
        return isNaN(parsed.getTime()) ? null : parsed;
      default:
        return null;
    }
  };

  const getFollowUpLogNotes = (followUpTargetDate: Date) => {
    return `Follow-up appointment created for ${followUpTargetDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}.`;
  };

  const buildRepeatAppointmentNotes = (baseNotes: string, sourceDate: Date, nextDate: Date) => {
    const repeatDateLabel = nextDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    const repeatNote = `Repeats on ${repeatDateLabel}`;
    const trimmed = String(baseNotes || "").trim();
    return trimmed ? `${trimmed}\n${repeatNote}` : repeatNote;
  };

  const buildFollowUpAppointmentNotes = (baseNotes: string, sourceDate: Date, sourceDateForLabel: Date) => {
    const sourceDateLabel = sourceDateForLabel.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    const followUpNote = `Created as a repeating schedule from ${sourceDateLabel}`;
    const trimmed = String(baseNotes || "").trim();
    return trimmed ? `${trimmed}\n${followUpNote}` : followUpNote;
  };

  // Final step: save after confirmation
  const handleConfirmSummary = async (repeatPayload?: { repeatOption: string; customRepeatDate?: string }) => {
    if (!selectedPatient || !appointmentType) return;
    
    const repeatTargetDate = getRepeatTargetDate(repeatPayload);
    
    // Log the current state and history logs before submitting
    console.log('[BookingModal] 🚀 SUBMITTING APPOINTMENT:', {
      mode: appointmentToEdit ? 'EDIT' : 'CREATE',
      appointmentId: appointmentToEdit?.id,
      patientId: selectedPatient,
      type: appointmentType,
      date: formatDateToYYYYMMDD(selectedDate),
      time: selectedTime,
      price: finalPrice,
      treatmentNotes,
      payment: {
        amountToPay,
        method: paymentMethod,
        previouslyPaid: previouslyPaidAmount,
        remaining: remainingBalance
      },
      historyLogs: appointmentLogs,
      timestamp: new Date().toISOString()
    });

    setIsBooking(true);
    setIsConfirmSummaryOpen(false);
    try {
      const dateStr = formatDateToYYYYMMDD(selectedDate);
      const bookingDuration = normalizeBookingDuration(duration);
      const treatmentNotesUpdate = buildBookingTreatmentNotesPayload(treatmentNotes);
      const originalAppointmentNotes = repeatTargetDate
        ? buildRepeatAppointmentNotes(notes, selectedDate, repeatTargetDate)
        : notes;
      
      let amountPaidRaw = amountToPay.trim() === '' ? '0' : amountToPay;
      const amountPaid = parseFloat(amountPaidRaw) || 0;

      // Final validation: prevent overpayment
      if (amountPaid > remainingBalance) {
        toast.error(`Amount exceeds remaining balance. Maximum allowed: ₱${remainingBalance.toLocaleString()}`);
        setIsBooking(false);
        return;
      }

      const paymentDatePayload = amountPaid > 0 ? normalizeBookingPaymentDate(paymentDate) : "";
      if (!validatePaymentDateForAmount(amountPaid) || (amountPaid > 0 && !paymentDatePayload)) {
        setIsBooking(false);
        return;
      }

      console.log('[BookingModal Payment] Payment confirmation:', {
        amountToPay,
        amountPaidRaw,
        amountPaid,
        paymentMethod,
        paymentDate: paymentDatePayload || undefined,
        finalPrice,
        parsing: {
          trimmed: amountToPay.trim(),
          parseFloat: parseFloat(amountPaidRaw),
        }
      });

      if (appointmentToEdit) {
        // update existing appointment
        // If editing, ADD the new payment to existing totalPaid (only if amountPaid > 0)
        const previouslyPaid = appointmentToEdit.totalPaid || 0;
        const newTotalPaid = amountPaid > 0 ? previouslyPaid + amountPaid : previouslyPaid;
        const newBalance = Math.max(0, discountedPrice - newTotalPaid);

        console.log('[BookingModal Payment] Updating appointment:', {
          appointmentId: appointmentToEdit.id,
          previouslyPaid,
          newPayment: amountPaid,
          newTotalPaid,
          newBalance,
        });

        // Determine payment status
        const updatePaymentStatus = getFinalPaymentStatus();
        
        // Determine appointment status using the new function that includes override logic
        const updateAppointmentStatus = getFinalAppointmentStatus();

        const selectedPatientRecord = patients.find(p => String(p.id) === String(selectedPatient));
        const updated = isPublicCachedAppointment
          ? cachePublicBookingAppointment({
              ...appointmentToEdit,
              patientId: selectedPatient,
              patientName: selectedPatientRecord?.name || appointmentToEdit.patientName || selectedPatient,
              publicPatient: selectedPatientRecord || appointmentToEdit.publicPatient,
              doctor: selectedDoctor || appointmentToEdit.doctor || doctorName || '',
              date: dateStr,
              time: selectedTime,
              type: getAppointmentTypeIndex(appointmentType),
              customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
              duration: bookingDuration,
              price: finalPrice,
              discount: Number(discount) || 0,
              notes: originalAppointmentNotes,
              ...treatmentNotesUpdate,
              status: updateAppointmentStatus as any,
              paymentStatus: updatePaymentStatus as any,
              paymentMethod,
              totalPaid: newTotalPaid,
              paymentDate: paymentDatePayload || undefined,
              balance: newBalance,
              updatedAt: new Date().toISOString(),
              isPublicCache: true,
            } as any)
          : await updateAppointment(appointmentToEdit.id, {
              patientId: selectedPatient,
              patientName: selectedPatientRecord?.name || selectedPatient,
              doctor: selectedDoctor || appointmentToEdit.doctor || doctorName || '',
              date: dateStr,
              time: selectedTime,
              type: getAppointmentTypeIndex(appointmentType),
              customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
              duration: bookingDuration,
              price: finalPrice,
              discount: Number(discount) || 0,
              notes: originalAppointmentNotes,
              ...treatmentNotesUpdate,
              status: updateAppointmentStatus as any,
              paymentStatus: updatePaymentStatus as any,
              paymentMethod,
              totalPaid: newTotalPaid,
              paymentDate: paymentDatePayload || undefined,
              balance: newBalance,
            } as any);

        // Log the updated appointment details
        console.log('[BookingModal Payment] ✅ APPOINTMENT UPDATED SUCCESSFULLY:', {
          appointmentId: updated?.id,
          patientName: updated?.patientName,
          service: updated?.customType,
          scheduleDate: updated?.date,
          scheduleTime: updated?.time,
          totalPrice: updated?.price,
          paymentDetails: {
            previouslyPaid,
            newPayment: amountPaid,
            totalPaid: updated?.totalPaid,
            balance: updated?.balance,
            paymentStatus: updated?.paymentStatus,
          },
          appointmentStatus: updated?.status,
          timestamp: new Date().toISOString(),
        });

        if (amountPaid > 0) {
          toast.success(`Payment of ₱${amountPaid.toLocaleString()} recorded successfully!`);
        } else {
          toast.success(`Appointment updated successfully!`);
        }
        try { window.dispatchEvent(new CustomEvent('appointments:updated', { detail: { appointment: updated } })); } catch {}
        if (onBooked) onBooked(updated);

        if (repeatTargetDate) {
          const resolvedRepeatSlot = await findNextAvailableRepeatSlot({
            startDate: repeatTargetDate,
            doctorToCheck: selectedDoctor || appointmentToEdit.doctor || doctorName || "",
            durationToCheck: bookingDuration,
            patientToCheck: selectedPatient,
            timeToCheck: selectedTime,
            availabilityMode: isPublicBookingMode ? "public" : "authenticated",
            localBlockingAppointments: isPublicBookingMode ? publicBlockingAppointments : [],
          });

          if (resolvedRepeatSlot) {
            const followUpDate = resolvedRepeatSlot.date;
            if (followUpDate.getTime() !== repeatTargetDate.getTime()) {
              toast.success(`Follow-up appointment moved to ${followUpDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} because the originally requested follow-up date was unavailable.`);
            }

            const followUpDateStr = formatDateToYYYYMMDD(followUpDate);
            const followUpStatus = isCartAppointmentStatus(updateAppointmentStatus) ? updateAppointmentStatus : "scheduled";
            const followUpPayload: any = {
              patientId: selectedPatient,
              patientName: selectedPatientRecord?.name || selectedPatient,
              doctor: selectedDoctor || appointmentToEdit.doctor || doctorName || "",
              date: followUpDateStr,
              time: selectedTime,
              type: getAppointmentTypeIndex(appointmentType),
              customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
              duration: bookingDuration,
              price: finalPrice,
              discount: Number(discount) || 0,
              notes: buildFollowUpAppointmentNotes(notes, selectedDate, followUpDate),
              ...treatmentNotesUpdate,
              status: followUpStatus as any,
              paymentStatus: "unpaid",
              paymentMethod: "",
              totalPaid: 0,
              balance: discountedPrice,
              logNotes: getFollowUpLogNotes(followUpDate),
            };

            try {
              if (isPublicBookingMode) {
                if (isCartAppointmentStatus(followUpStatus)) {
                  await createPublicBookingAppointment(followUpPayload);
                } else {
                  const resp = await fetch(apiUrl("/api/appointments/public-book"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      firstName: selectedPatientRecord?.firstName || "",
                      lastName: selectedPatientRecord?.lastName || "",
                      email: selectedPatientRecord?.email || "",
                      phone: selectedPatientRecord?.phone || "",
                      patientId: selectedPatientRecord?.id,
                      ...followUpPayload,
                    }),
                  });
                  const json = await resp.json();
                  if (!resp.ok || !json.success) {
                    throw new Error(json?.message || "Failed to create follow-up appointment");
                  }
                }
              } else {
                await addAppointment(followUpPayload);
              }
              toast.success("Follow-up appointment saved successfully.");
            } catch (repeatError) {
              console.error("Failed to save follow-up appointment:", repeatError);
              toast.error("Could not save the follow-up appointment. Please try again.");
            }
          }
        }

        // close modal after updating
        onOpenChange(false);
      } else {
        // create new appointment
        // Determine payment status
        const paymentStatus = getFinalPaymentStatus();
        
        // Determine appointment status using the new function that includes override logic
        const autoStatus = getFinalAppointmentStatus();

        console.log('[BookingModal Payment] Calculated status:', { paymentStatus, autoStatus, amountPaid, finalPrice, discountedPrice });

        const newBalance = Math.max(0, discountedPrice - amountPaid);

        console.log('[BookingModal Payment] Creating new appointment:', {
          selectedPatient,
          appointmentType,
          amountPaid,
          finalPrice,
          newBalance,
          autoStatus,
          paymentStatus,
          paymentMethod,
        });

        const selectedPatientRecord = patients.find(p => String(p.id) === String(selectedPatient));
        let newApt: any = null;
        if (isPublicBookingMode) {
          if (isCartAppointmentStatus(autoStatus)) {
            newApt = await createPublicBookingAppointment({
              patient: selectedPatientRecord || { id: selectedPatient, name: selectedPatient },
              date: dateStr,
              time: selectedTime,
              duration: bookingDuration,
              type: getAppointmentTypeIndex(appointmentType),
              customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
              doctor: selectedDoctor || '',
              notes: originalAppointmentNotes,
              ...treatmentNotesUpdate,
              price: finalPrice,
              discount: Number(discount) || 0,
              status: autoStatus as any,
              paymentStatus: paymentStatus as any,
              paymentMethod,
              totalPaid: amountPaid,
              paymentDate: paymentDatePayload || undefined,
              balance: newBalance,
            } as any);
          } else {
            // Persist public booking to backend and fallback to local cache on failure
            try {
              const patientName = selectedPatientRecord?.name || String(selectedPatient || "");
              const nameParts = String(patientName).trim().split(/\s+/);
              const firstName = selectedPatientRecord?.firstName || nameParts[0] || "Patient";
              const lastName = selectedPatientRecord?.lastName || nameParts.slice(1).join(" ") || "";
              const payload: any = {
                firstName,
                lastName,
                email: selectedPatientRecord?.email || "",
                phone: selectedPatientRecord?.phone || "",
                patientId: selectedPatientRecord?.id,
                date: dateStr,
                time: selectedTime,
                duration: bookingDuration,
                type: getAppointmentTypeIndex(appointmentType),
                customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
                doctor: selectedDoctor || "",
                notes: originalAppointmentNotes,
                ...treatmentNotesUpdate,
                // Include status/payment info so the public endpoint can persist non-cart bookings
                status: autoStatus,
                paymentStatus: paymentStatus,
                totalPaid: amountPaid,
                paymentMethod,
                paymentDate: paymentDatePayload || undefined,
                price: finalPrice,
                discount: Number(discount) || 0,
              };

              const resp = await fetch(apiUrl("/api/appointments/public-book"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = await resp.json();
              if (resp.ok && json.success) {
                const serverAppointment = json.data;
                const publicPatient = selectedPatientRecord
                  ? cachePublicBookingPatient({
                      ...selectedPatientRecord,
                      id: serverAppointment.patientId || selectedPatientRecord.id,
                      name: serverAppointment.patientName || selectedPatientRecord.name,
                    })
                  : undefined;
                newApt =
                  cachePublicBookingAppointment({
                    ...serverAppointment,
                    publicPatient: publicPatient || selectedPatientRecord,
                  } as any) || serverAppointment;
              } else {
                console.warn("Public booking endpoint returned error, falling back to cache:", json);
                toast.error(json?.message || "Could not save booking to server; saved locally instead.");
                newApt = await createPublicBookingAppointment({
                  patient: selectedPatientRecord || { id: selectedPatient, name: selectedPatient },
                  date: dateStr,
                  time: selectedTime,
                  duration: bookingDuration,
                  type: getAppointmentTypeIndex(appointmentType),
                  customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
                  doctor: selectedDoctor || '',
                  notes: originalAppointmentNotes,
                  ...treatmentNotesUpdate,
                  price: finalPrice,
                  discount: Number(discount) || 0,
                  status: autoStatus as any,
                  paymentStatus: paymentStatus as any,
                  paymentMethod,
                  totalPaid: amountPaid,
                  paymentDate: paymentDatePayload || undefined,
                  balance: newBalance,
                });
              }
            } catch (err) {
              console.error("Public booking error, falling back to cache:", err);
              toast.error("Could not save booking to server; saved locally instead.");
              newApt = await createPublicBookingAppointment({
                patient: selectedPatientRecord || { id: selectedPatient, name: selectedPatient },
                date: dateStr,
                time: selectedTime,
                duration: bookingDuration,
                type: getAppointmentTypeIndex(appointmentType),
                customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
                doctor: selectedDoctor || '',
                notes: originalAppointmentNotes,
                ...treatmentNotesUpdate,
                price: finalPrice,
                discount: Number(discount) || 0,
                status: autoStatus as any,
                paymentStatus: paymentStatus as any,
                paymentMethod,
                totalPaid: amountPaid,
                paymentDate: paymentDatePayload || undefined,
                balance: newBalance,
              } as any);
            }
          }
        } else {
          newApt = await addAppointment({
            patientId: selectedPatient,
            patientName: selectedPatientRecord?.name || selectedPatient,
            doctor: selectedDoctor || '',
            date: dateStr,
            time: selectedTime,
            type: getAppointmentTypeIndex(appointmentType),
            customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
            duration: bookingDuration,
            price: finalPrice,
            discount: Number(discount) || 0,
            notes: originalAppointmentNotes,
            ...treatmentNotesUpdate,
            status: autoStatus as any,
            paymentStatus: paymentStatus as any,
            paymentMethod,
            totalPaid: amountPaid,
            paymentDate: paymentDatePayload || undefined,
            balance: newBalance,
          } as any);
        }

        if (repeatTargetDate) {
          const resolvedRepeatSlot = await findNextAvailableRepeatSlot({
            startDate: repeatTargetDate,
            doctorToCheck: selectedDoctor || "",
            durationToCheck: bookingDuration,
            patientToCheck: selectedPatient,
            timeToCheck: selectedTime,
            availabilityMode: isPublicBookingMode ? "public" : "authenticated",
            localBlockingAppointments: isPublicBookingMode ? publicBlockingAppointments : [],
          });

          if (resolvedRepeatSlot) {
            const followUpDate = resolvedRepeatSlot.date;
            if (followUpDate.getTime() !== repeatTargetDate.getTime()) {
              toast.success(`Follow-up appointment moved to ${followUpDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} because the originally requested follow-up date was unavailable.`);
            }

            const followUpDateStr = formatDateToYYYYMMDD(followUpDate);
            const followUpStatus = isCartAppointmentStatus(autoStatus) ? autoStatus as any : "scheduled";
            const followUpPayload: any = {
              patientId: selectedPatient,
              patientName: selectedPatientRecord?.name || selectedPatient,
              doctor: selectedDoctor || '',
              date: followUpDateStr,
              time: selectedTime,
              type: getAppointmentTypeIndex(appointmentType),
              customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
              duration: bookingDuration,
              price: finalPrice,
              discount: Number(discount) || 0,
              notes: buildFollowUpAppointmentNotes(notes, selectedDate, followUpDate),
              ...treatmentNotesUpdate,
              status: followUpStatus,
              paymentStatus: "unpaid",
              paymentMethod: "",
              totalPaid: 0,
              balance: discountedPrice,
              logNotes: getFollowUpLogNotes(followUpDate),
            };

            try {
              if (isPublicBookingMode) {
                if (isCartAppointmentStatus(followUpStatus)) {
                  await createPublicBookingAppointment(followUpPayload);
                } else {
                  const resp = await fetch(apiUrl("/api/appointments/public-book"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      firstName: selectedPatientRecord?.firstName || "",
                      lastName: selectedPatientRecord?.lastName || "",
                      email: selectedPatientRecord?.email || "",
                      phone: selectedPatientRecord?.phone || "",
                      patientId: selectedPatientRecord?.id,
                      ...followUpPayload,
                    }),
                  });
                  const json = await resp.json();
                  if (!resp.ok || !json.success) {
                    throw new Error(json?.message || "Failed to create follow-up appointment");
                  }
                }
              } else {
                await addAppointment(followUpPayload);
              }
              toast.success("Follow-up appointment saved successfully.");
            } catch (repeatError) {
              console.error("Failed to save follow-up appointment:", repeatError);
              toast.error("Could not save the follow-up appointment. Please try again.");
            }
          }
        }

        // Auto-cancel any overlapping cart appointments for the same doctor
        if (newApt && dailyAppointments.length > 0) {
          const timeToMinutes = (time: string): number => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
          };

          const newSlotStart = timeToMinutes(selectedTime);
          const newSlotEnd = newSlotStart + bookingDuration;

          const pendingToCancel = dailyAppointments.filter((apt: any) => {
            // Only cancel cart appointments
            if (!isCartAppointmentStatus(apt.status)) return false;
            // For the same doctor - use selectedDoctor (the actually selected doctor), not the prop
            const currentDocNormalized = (selectedDoctor || '').replace(/^Dr\.\s+/i, "").toLowerCase();
            const aptDocNormalized = apt.doctor.replace(/^Dr\.\s+/i, "").toLowerCase();
            if (aptDocNormalized !== currentDocNormalized) return false;
            // On the same date
            if (apt.date !== dateStr) return false;
            // That overlap with the new appointment
            const aptStart = timeToMinutes(apt.time);
            const aptEnd = aptStart + normalizeBookingDuration(apt.duration);
            return newSlotStart < aptEnd && newSlotEnd > aptStart;
          });

          // Cancel all overlapping cart appointments
          for (const pendingApt of pendingToCancel) {
            await updateAppointment(pendingApt.id, {
              ...pendingApt,
              status: 'cancelled',
            });
            console.log('[BookingModal] Auto-cancelled overlapping cart appointment:', {
              pendingId: pendingApt.id,
              pendingPatient: pendingApt.patientName,
              newAppointmentId: newApt.id,
              reason: 'Overlapping time slot',
            });
          }
        }

        // Log the new appointment details
        console.log('[BookingModal Payment] ✅ APPOINTMENT CREATED SUCCESSFULLY:', {
          appointmentId: newApt?.id,
          patientName: newApt?.patientName,
          service: newApt?.customType,
          scheduleDate: newApt?.date,
          scheduleTime: newApt?.time,
          totalPrice: newApt?.price,
          paymentDetails: {
            amountPaid: newApt?.totalPaid,
            balance: newApt?.balance,
            paymentStatus: newApt?.paymentStatus,
          },
          appointmentStatus: newApt?.status,
          timestamp: new Date().toISOString(),
        });

        if (amountPaid > 0) {
          toast.success(`Appointment booked with payment of ₱${amountPaid.toLocaleString()}!`);
        } else {
          toast.success(`Appointment booked successfully!`);
        }
        try { window.dispatchEvent(new CustomEvent('appointments:updated', { detail: { appointment: newApt } })); } catch {}
        if (onBooked) onBooked(newApt);
        // close modal after creating
        onOpenChange(false);
      }

      setModalStep('patient');
      setAmountToPay('0');
      setPaymentDate(getDefaultBookingPaymentDate());
    } catch (err) {
      console.error('Booking payment error:', err);
    } finally {
      setIsBooking(false);
    }
  };

  // Cancel handler (previously named handleDelete) — preserve behavior but use clearer name
  const handleCancel = async () => {
    // Close the confirmation dialog immediately for better UX (optimistic UI)
    setIsDeleteDialogOpen(false);
    if (!appointmentToEdit) return;
    setIsBooking(true);
    try {
      if (canDeleteCancelledAppointment) {
        await deleteAppointment(appointmentToEdit.id);
        const deletedAppointment = {
          ...appointmentToEdit,
          status: "deleted",
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        try {
          window.dispatchEvent(new CustomEvent('appointments:updated', {
            detail: { appointment: deletedAppointment, appointmentId: appointmentToEdit.id, newStatus: 'deleted' },
          }));
        } catch {}
        if (onDeleted) onDeleted(deletedAppointment);
        toast?.success?.('Appointment marked as deleted');
        onOpenChange(false);
        return;
      }

      // Update status to cancelled instead of deleting
      const updated = isPublicCachedAppointment
        ? cachePublicBookingAppointment({
            ...appointmentToEdit,
            status: 'cancelled',
            updatedAt: new Date().toISOString(),
            isPublicCache: true,
          } as any)
        : await updateAppointment(appointmentToEdit.id, {
            status: 'cancelled',
          } as any);
      try { window.dispatchEvent(new CustomEvent('appointments:updated', { detail: { appointment: updated, appointmentId: appointmentToEdit.id, newStatus: 'cancelled' } })); } catch {}
      if (onBooked) onBooked(updated);
        if (onDeleted) onDeleted(updated);
      toast?.success?.('Appointment marked as cancelled');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to cancel appointment', err);
      toast?.error?.('Failed to cancel appointment');
    } finally {
      setIsBooking(false);
    }
  };

  const handleClose = () => {
    autoPreselectedScheduleRef.current = null;
    autoPreselectedDoctorRef.current = null;
    previousSelectedPatientRef.current = "";
    setModalStep("patient");
    setIsRescheduling(false);
    setAmountToPay("0");
    setPaymentDate(getDefaultBookingPaymentDate());
    setCustomAppointmentTypeName("");
    setCustomPrice("0");
    onOpenChange(false);
  };

  const clearAutomaticScheduleSelection = () => {
    autoPreselectedScheduleRef.current = null;
    autoPreselectSearchKeyRef.current = null;

    const autoDoctor = autoPreselectedDoctorRef.current;
    if (autoDoctor) {
      autoPreselectedDoctorRef.current = null;
      setSelectedDoctor((current) =>
        normalizeDoctorName(current) === normalizeDoctorName(autoDoctor) ? "" : current
      );
    }
  };

  const handleManualDateSelect = (date: Date) => {
    clearAutomaticScheduleSelection();
    setSelectedDate(toDate(date));
  };

  const handleManualTimeSelect = (time: string) => {
    clearAutomaticScheduleSelection();
    setSelectedTime(time);
  };

  const viewCurrentAppointment = async (appointmentId?: string) => {
    if (!appointmentId) return;

    setIsSnapshotModalOpen(true);
    setSnapshotIsHistorical(false);

    if (isPublicCachedAppointment) {
      setSnapshotToView(appointmentToEdit || null);
      return;
    }

    setSnapshotToView(null);
    try {
      const res = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}`), {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.message || "Failed to fetch current appointment");
        setSnapshotToView(appointmentToEdit || null);
        return;
      }

      setSnapshotToView(payload?.data || appointmentToEdit || null);
    } catch (err) {
      console.error("Failed to load current appointment:", err);
      toast.error("Failed to load current appointment");
      setSnapshotToView(appointmentToEdit || null);
    }
  };

  const openPaymentDatePicker = () => {
    const input = paymentDateInputRef.current;
    if (!input) return;

    input.focus();
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // Some browsers only allow showPicker from direct user activation; focus still keeps the input usable.
    }
  };

  const handlePrimaryBookingAction = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    if (isBooking) return;
    const overpayNow = modalStep === 'payment' && isOverpay;
    if (overpayNow) {
      toast.error(`Amount exceeds remaining balance. Maximum allowed: \u20b1${remainingBalance.toLocaleString()}`);
      setOverpayPulse(true);
      setTimeout(() => setOverpayPulse(false), 700);
      return;
    }

    if (modalStep === 'payment') {
      handleConfirmPayment();
    } else {
      handleConfirmBooking();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => {
          if (!v) handleClose(); else onOpenChange(true);
        }}>
        <DialogContent data-tour-id="booking-modal-shell" className="flex max-h-[96dvh] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] flex-col gap-0 overflow-hidden rounded-[1.5rem] border-none p-0 shadow-2xl sm:max-h-[95vh] sm:w-[min(64rem,calc(100vw-3rem))] sm:max-w-5xl sm:rounded-[2rem]">
          <DialogHeader className="shrink-0 border-b bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center justify-between mb-2">
              {modalStep !== 'patient' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevStep}
                  disabled={isBooking}
                  className="rounded-full hover:bg-gray-100 h-9 w-9 transition-all"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </Button>
              ) : (
                <div className="w-9" />
              )}

              <DialogTitle className="flex-1 text-center text-lg font-black tracking-tight text-gray-900 sm:text-xl">
                {title ? title : (
                  (() => {
                    const isPastAppointment = isPastAppointmentSchedule(selectedDate, selectedTime);
                    
                    if (modalStep === 'payment') {
                      return 'Complete Booking';
                    }
                    
                    if (appointmentToEdit) {
                      if (isPatientReadonly) return 'View Appointment';
                      return isPastAppointment ? 'Edit past appointment' : 'Edit Appointment';
                    }
                    
                    return isPastAppointment ? 'Add a past appointment' : 'Book Appointment';
                  })()
                )}
              </DialogTitle>
              {isEditMode && mergedHistoryLogs.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setIsHistoryDialogOpen(true)}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-all hover:bg-blue-50 hover:text-blue-600"
                  title="View appointment history"
                  aria-label="View appointment history"
                >
                  <History className="h-4.5 w-4.5" />
                  <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-black text-white shadow-sm">
                    {mergedHistoryLogs.length}
                  </span>
                </button>
              ) : (
                <div className="w-9" />
              )}
            </div>

            {/* STEP INDICATOR */}
            {!(isCancelled && user?.role === 'patient') && (
              <div className="relative flex items-center justify-between w-full mt-3 mb-4 px-2 sm:mt-4 sm:mb-6 sm:px-12">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0 rounded-full" />
                <div
                  className="absolute top-1/2 left-0 h-1 bg-blue-600 -translate-y-1/2 transition-all duration-500 z-0 rounded-full"
                  style={{ width: progressWidth }}
                />

                {visibleBookingSteps.map((step, index) => {
                  const isActive = modalStep === step.id;
                  const isCompleted = index < activeStepIndex;
                  const isClickable = canOpenStep(step.id);

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => isClickable && setModalStep(step.id)}
                      disabled={!isClickable}
                      className={`relative z-10 flex flex-col items-center group outline-none transition-all ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    >
                      <div className={`
                        flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 transition-all duration-300
                        ${isActive ? 'bg-blue-600 border-blue-600 text-white scale-110 shadow-lg shadow-blue-100' :
                          isCompleted ? 'bg-blue-600 border-blue-600 text-white' :
                            'bg-white border-gray-200 text-gray-400'}
                      `}>
                        {isCompleted ? (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-[10px] sm:text-xs font-bold">{step.icon}</span>
                        )}
                      </div>
                      <span className={`absolute -bottom-5 text-[7px] sm:-bottom-6 sm:text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/20 p-4 pb-6 sm:p-8 lg:p-10 custom-scrollbar">
            <div className="w-full mx-auto">
              
              {/* STEP 1: PATIENT */}
              {modalStep === 'patient' && (
                <div data-tour-id="booking-patient-step" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-5 mb-10">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-blue-600 text-white shadow-xl shadow-blue-100 ring-4 ring-blue-50">
                      <Stethoscope className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight">Select Patient</h3>
                      <p className="text-sm font-bold text-gray-400">Who is this appointment for?</p>
                    </div>
                    {canCreatePatients && !isPatientReadonly && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-tour-id="booking-new-patient"
                        disabled={isTourPatientNextStep}
                        onClick={() => {
                          if (isTourPatientNextStep) return;
                          openAddPatientModal({ publicBooking: isPublicBookingMode });
                        }}
                        className="ml-auto h-12 px-5 gap-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border-2 hover:bg-gray-50 hover:border-gray-200 transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        New patient
                      </Button>
                    )}
                  </div>
                  <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                    <SelectTrigger data-tour-id="booking-patient-select" className="h-20 rounded-[2rem] border-2 border-gray-100 bg-white px-8 text-lg font-bold shadow-sm hover:border-blue-200 transition-all">
                      <SelectValue placeholder="Search or choose a patient" />
                    </SelectTrigger>
                    <SelectContent data-tour-id="booking-patient-options" className="rounded-2xl border-none shadow-2xl">
                      {patients.map(p => (
                        <SelectItem key={p.id} value={p.id} className="rounded-xl my-1 mx-2">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* STEP 2: SCHEDULE */}
              {modalStep === 'schedule' && (
                <div data-tour-id="booking-schedule-step" className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-5 mb-10">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-blue-600 text-white shadow-xl shadow-blue-100 ring-4 ring-blue-50">
                      <CalendarIcon className="h-7 w-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight">Pick Schedule</h3>
                      <p className="text-sm font-bold text-gray-400">Select your preferred date and time</p>
                    </div>
                    {scheduleDoctorName && (
                      <div className="hidden sm:flex max-w-[240px] items-center gap-3 rounded-[1.25rem] bg-blue-50 px-5 py-3 text-blue-700 shadow-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                          <Stethoscope className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Selected Doctor</p>
                          <p className="truncate text-sm font-black tracking-tight">{displayDoctor}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {scheduleDoctorName && (
                    <div className="flex sm:hidden items-center gap-4 rounded-[1.25rem] border-2 border-blue-50 bg-blue-50/50 px-5 py-4 text-blue-700 shadow-sm">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-md">
                        <Stethoscope className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Selected Doctor</p>
                        <p className="truncate text-base font-black tracking-tight">{displayDoctor}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button 
                      data-tour-id="booking-date-card"
                      onClick={() => setIsDatePickerOpen(true)} 
                      className="flex flex-col gap-6 p-8 bg-white rounded-[2.5rem] border-2 border-gray-100 hover:border-blue-500 transition-all text-left shadow-sm hover:shadow-xl hover:shadow-blue-50 group"
                    >
                      <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors w-fit">
                        <CalendarIcon className="h-8 w-8" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">Appointment Date</p>
                        <p className="text-3xl font-black text-gray-900">{toDate(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        <p className="text-sm font-bold text-gray-400 mt-1">{toDate(selectedDate).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                      </div>
                    </button>
                    <button 
                      data-tour-id="booking-time-card"
                      onClick={() => setIsTimePickerOpen(true)} 
                      className="flex flex-col gap-6 p-8 bg-white rounded-[2.5rem] border-2 border-gray-100 hover:border-blue-500 transition-all text-left shadow-sm hover:shadow-xl hover:shadow-blue-50 group"
                    >
                      <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors w-fit">
                        <Clock className="h-8 w-8" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">Time Slot</p>
                        <p className="text-3xl font-black text-gray-900">{selectedTime ? formatTimeTo12h(selectedTime) : '--:--'}</p>
                        <p className="text-sm font-bold text-gray-400 mt-1">{selectedTime ? 'Confirmed Slot' : 'Please select'}</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: DOCTOR */}
              {modalStep === 'doctor' && showDoctorStep && (
                <div data-tour-id="booking-doctor-step" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-5 mb-10">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-blue-600 text-white shadow-xl shadow-blue-100 ring-4 ring-blue-50">
                      <Award className="h-7 w-7" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight">Choose Doctor</h3>
                      <p className="text-sm font-bold text-gray-400">Select your dental specialist</p>
                    </div>
                    <div className="hidden sm:block">
                      <div className="rounded-[1.25rem] bg-blue-50 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-blue-700 shadow-sm">
                        {toDate(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} @ {selectedTime ? formatTimeTo12h(selectedTime) : '--:--'}
                      </div>
                    </div>
                  </div>

                  {doctors.length === 0 ? (
                    <div className="rounded-[2.5rem] border-2 border-dashed border-gray-200 bg-white p-12 text-center">
                      <Stethoscope className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                      <p className="text-lg font-bold text-gray-900">No doctors available</p>
                      <p className="mt-2 text-sm text-gray-500">Please try again in a moment.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {visibleDoctors.map((doctor) => {
                        const selected = normalizeDoctorName(selectedDoctor) === normalizeDoctorName(doctor.name);
                        const unavailable = hasDoctorScheduleConflict(doctor.name);

                        return (
                          <button
                            key={doctor.id}
                            data-tour-id="booking-doctor-option"
                            type="button"
                            onClick={() => {
                              if (unavailable) return;
                              autoPreselectedDoctorRef.current = null;
                              setSelectedDoctor(doctor.name);
                            }}
                            disabled={unavailable}
                            className={`group flex min-h-[120px] flex-col justify-center rounded-[2rem] border-2 bg-white p-5 text-left shadow-sm transition-all ${
                              selected
                                ? 'border-blue-600 bg-blue-50/60 shadow-lg shadow-blue-100'
                                : unavailable
                                ? 'cursor-not-allowed border-gray-100 opacity-55'
                                : 'border-gray-100 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-50'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <Avatar className={`h-16 w-16 border-4 shrink-0 transition-transform group-hover:scale-105 ${selected ? 'border-blue-200' : 'border-gray-50'} shadow-sm`}>
                                {doctor.profilePicture && (
                                  <AvatarImage src={doctor.profilePicture} alt={doctor.name} className="object-cover" />
                                )}
                                <AvatarFallback className="bg-blue-100 text-lg font-black text-blue-700">
                                  {getDoctorInitials(doctor.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <h4 className="text-sm font-black leading-tight text-gray-900">{formatDoctorName(doctor.name)}</h4>
                                    {doctor.specialization && (
                                      <p className="mt-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600/70">{doctor.specialization}</p>
                                    )}
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter ${
                                    unavailable
                                      ? 'bg-gray-100 text-gray-500'
                                      : selected
                                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}>
                                    {unavailable ? 'Busy' : selected ? 'Selected' : 'Open'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: CHOOSE TREATMENT & FINANCIALS */}
              {modalStep === 'treatment' && (
                <div data-tour-id="booking-treatment-step" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 sm:space-y-10">
                  {/* Treatment Selection */}
                  <div className="space-y-6">
                    <div className="mb-6 flex items-center gap-4 sm:mb-10 sm:gap-5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-100 ring-4 ring-blue-50 sm:h-14 sm:w-14 sm:rounded-[1.25rem]">
                        <Plus className="h-6 w-6 sm:h-7 sm:w-7" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">Select Treatment</h3>
                        <p className="text-sm font-bold text-gray-400">What service do you need today?</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                      {bookingTreatmentOptions.map((t) => (
                        <button
                          key={t.name}
                          data-tour-id={t.name === "Routine Cleaning" ? "booking-routine-cleaning" : undefined}
                          type="button"
                          onClick={() => handleTreatmentSelect(t.name)}
                          className={`flex min-h-[6.25rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 shadow-sm transition-all sm:min-h-[8rem] sm:gap-3 sm:rounded-[2rem] sm:p-4 ${appointmentType === t.name ? 'border-blue-600 bg-blue-50/50 shadow-blue-100 scale-[1.02] sm:scale-105' : 'border-white bg-white hover:border-gray-200 hover:-translate-y-1'}`}
                        >
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${t.color} text-lg text-white shadow-lg shadow-gray-100 sm:h-12 sm:w-12 sm:text-xl`}>{t.icon}</div>
                          <span className="text-center text-[9px] font-black uppercase tracking-tighter text-gray-900 sm:text-[10px]">{t.short}</span>
                        </button>
                      ))}
                    </div>
                    {appointmentType === "Other" && (
                      <div className="space-y-3">
                        <Input
                          placeholder="Type custom treatment..."
                          value={customAppointmentTypeName}
                          onChange={(e) => handleCustomTreatmentNameChange(e.target.value)}
                          className="h-14 rounded-2xl border-gray-100 bg-white px-6 font-bold shadow-inner"
                        />
                        {otherTreatmentSuggestion && (
                          <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-gray-900">
                                Do you mean {otherTreatmentSuggestion.treatment}?
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-blue-700/70">
                                Continuing will use this treatment unless you choose No.
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => applyExistingTreatmentSuggestion(otherTreatmentSuggestion)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-blue-700"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => declineExistingTreatmentSuggestion(otherTreatmentSuggestion)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-100 bg-white px-3 text-xs font-black uppercase tracking-wider text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                No
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Financials & Duration */}
                  <div className="grid grid-cols-1 gap-4 pt-1 lg:grid-cols-2">
                    <div className="order-2 grid grid-cols-1 gap-4">
                      <div className="flex min-h-[8.5rem] flex-col justify-between rounded-2xl border-2 border-gray-100 bg-white p-4 shadow-sm sm:min-h-[11rem] sm:rounded-[2rem] sm:p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Clock className="h-5 w-5" />
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Duration</span>
                        </div>
                        <div className="mt-4">
                          {canManagePricing ? (
                            <Select value={duration} onValueChange={(value) => setDuration(String(normalizeBookingDuration(value)))}>
                              <SelectTrigger className="h-12 w-full rounded-2xl border-0 bg-gray-50 px-4 text-base font-black text-gray-900 focus:ring-0 focus:ring-offset-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {ALLOWED_BOOKING_DURATIONS.map(d => <SelectItem key={d} value={String(d)}>{d} mins</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex h-12 items-center rounded-2xl bg-gray-50 px-4 text-base font-black text-blue-600">
                              {duration} mins
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex min-h-[8.5rem] flex-col justify-between rounded-2xl border-2 border-gray-100 bg-white p-4 shadow-sm sm:min-h-[11rem] sm:rounded-[2rem] sm:p-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                              <Award className="h-5 w-5" />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Discount</span>
                          </div>
                          <div className="relative mt-4">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-orange-400">₱</span>
                            <Input
                              type="number"
                              value={discount}
                              onChange={(e) => setDiscount(e.target.value)}
                              disabled={!canManagePricing}
                              className="h-12 rounded-2xl border-0 bg-gray-50 pl-8 pr-4 text-base font-black text-orange-600 shadow-none focus-visible:ring-0"
                            />
                          </div>
                        </div>
                    </div>

                    <div className="order-1 grid grid-cols-1 gap-4">
                      {/* Blue Estimated Cost Card */}
                      <div 
                      onClick={() => {
                        if (canManagePricing && !isPriceEditable) setIsPriceEditable(true);
                      }}
                      className={`group relative flex min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-2xl bg-blue-600 p-4 text-white shadow-2xl shadow-blue-200/50 sm:min-h-[11rem] sm:rounded-[2rem] sm:p-5 ${canManagePricing ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <div className="absolute top-0 right-0 h-28 w-28 rounded-full bg-white/5 -mr-14 -mt-14 transition-transform group-hover:scale-110" />
                      <CreditCard className="absolute top-5 right-5 h-9 w-9 text-white/10" />
                      
                      <div className="relative z-10">
                        <p className="text-blue-200 text-[9px] font-black uppercase tracking-widest mb-1">Estimated Cost</p>
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-black sm:text-xl">Treatment Fee</h4>
                        </div>
                      </div>

                        <div className="relative z-10 mt-4 flex flex-col items-end">
                        {/* Upper small text logic */}
                        {isPriceEditable ? (
                          <p className="text-xs text-blue-100 font-bold opacity-90 mb-2 bg-white/10 px-3 py-1 rounded-full">
                            Reflected Total: ₱{Math.max(0, (Number(customPrice === "0" ? finalPrice : customPrice) - Number(discount))).toLocaleString()}
                          </p>
                        ) : (
                          Number(discount) > 0 && <p className="text-xs text-blue-200 line-through opacity-80 mb-0.5">₱{finalPrice.toLocaleString()}</p>
                        )}
                        
                        <div className="flex items-center justify-end w-full">
                          <span className="mr-2 text-3xl font-black opacity-40 sm:text-4xl">₱</span>
                          {/* AIRTIGHT LOCK: MUST BE EDITABLE *AND* USER MUST BE ADMIN/DOCTOR */}
                          {isPriceEditable && canManagePricing ? (
                            <input 
                              type="number"
                              value={customPrice === "0" ? finalPrice : customPrice}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setCustomPrice(e.target.value)}
                              onBlur={() => setIsPriceEditable(false)}
                              className="w-[120px] appearance-none border-b-4 border-white/50 bg-transparent p-0 text-right text-3xl font-black text-white outline-none ring-0 transition-all placeholder-blue-300 focus:border-white sm:w-[140px] sm:text-4xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              placeholder={String(finalPrice)}
                              autoFocus
                            />
                          ) : (
                            <span className="text-3xl font-black tracking-tighter sm:text-4xl">
                              {Math.max(0, (Number(customPrice === "0" ? finalPrice : customPrice) - Number(discount))).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                      <div className="flex min-h-[9.5rem] flex-col rounded-2xl border-2 border-gray-100 bg-white p-4 shadow-sm sm:min-h-[11rem] sm:rounded-[2rem] sm:p-5">
                        <Label htmlFor="improved-booking-treatment-notes" className="text-[11px] font-black uppercase tracking-widest text-gray-500">
                          Treatment Notes
                        </Label>
                        <Textarea
                          id="improved-booking-treatment-notes"
                          value={treatmentNotes}
                          onChange={(event) => setTreatmentNotes(event.target.value)}
                          placeholder="Add treatment-specific notes..."
                          disabled={isPatientReadonly}
                          className="mt-4 min-h-0 flex-1 resize-none rounded-2xl border-0 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 shadow-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FINAL STEP: PAYMENT & STATUS */}
              {modalStep === 'payment' && (
                <div data-tour-id="booking-payment-step" className="mx-auto max-w-5xl space-y-6 py-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-6 rounded-[1.25rem] border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.25rem] bg-emerald-600 text-white shadow-xl shadow-emerald-100">
                      <CreditCard className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black tracking-tight text-gray-900">Payment & Status</h3>
                      <p className="text-base font-medium text-slate-500">Review the balance and record the payment.</p>
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-gray-100 bg-white p-6 shadow-sm">
                    <h4 className="mb-4 text-lg font-black text-gray-900">Bill Summary</h4>
                    <div className="grid gap-4 md:grid-cols-3 md:divide-x md:divide-gray-100">
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-500">Total Billed:</p>
                      <div className="flex flex-col items-center justify-center">
                        {Number(discount) > 0 && (
                          <span className="text-xs font-bold text-gray-400 line-through decoration-gray-400/50">&#8369;{(customPrice === "0" ? finalPrice : Number(customPrice)).toLocaleString()}</span>
                        )}
                        <p className="mt-2 text-3xl font-black tracking-tight text-gray-900">&#8369;{discountedPrice.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-center md:pl-4">
                      <p className="text-sm font-medium text-slate-500">Total Paid:</p>
                      <p className="mt-2 text-3xl font-black tracking-tight text-gray-900">&#8369;{previouslyPaidAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-center md:pl-4">
                      <p className="text-sm font-medium text-slate-500">Current Balance Due:</p>
                      <p className="mt-2 text-3xl font-black tracking-tight text-emerald-600">&#8369;{remainingBalance.toLocaleString()}</p>
                    </div>
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-gray-100 bg-white p-7 shadow-sm">
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-2xl font-black text-gray-900">Payment Details</h4>
                        <p className="mt-2 text-base font-medium text-slate-500">
                          Payment for: <span className="font-black text-emerald-600">{selectedTreatmentName || "Selected Treatment"}</span>
                        </p>
                      </div>
                      <div className="grid gap-7 lg:grid-cols-2 lg:items-start">
                        <div className="space-y-3">
                          <div className="flex h-7 items-center">
                            <Label htmlFor="improvedBookingAmount" className="text-base font-semibold text-slate-900">
                              Amount to Pay
                            </Label>
                          </div>
                          <div className="group relative">
                            <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center">
                              <span className="text-2xl font-black text-slate-400 opacity-60 transition-colors group-focus-within:text-emerald-600">&#8369;</span>
                            </div>
                            <Input
                              id="improvedBookingAmount"
                              type="number"
                              min="0"
                              placeholder="0"
                              value={amountToPay}
                              onChange={(e: any) => setAmountToPay(e.target.value)}
                              max={remainingBalance}
                              className="h-[4.5rem] rounded-2xl border-2 border-emerald-200/70 bg-emerald-50/35 pl-14 pr-32 text-3xl font-black tracking-tight text-slate-950 shadow-none transition-all appearance-none focus:border-emerald-500 focus:bg-white focus:ring-0"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setAmountToPay(String(remainingBalance))}
                              disabled={remainingBalance <= 0}
                              className="absolute right-4 top-1/2 h-10 -translate-y-1/2 rounded-xl px-3 text-sm font-black uppercase tracking-wide text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                            >
                              Pay Full
                            </Button>
                          </div>
                          <p className="text-sm font-medium text-slate-500">
                            Remaining balance after payment: <span className="font-black text-emerald-600">&#8369;{projectedRemainingBalance.toLocaleString()}</span>
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="flex h-7 items-center gap-3">
                            <CalendarIcon className="h-4 w-4 text-blue-600" />
                            <Label htmlFor="improvedBookingPaymentDate" className="text-base font-semibold text-slate-700">
                              Payment Date
                            </Label>
                          </div>
                          <div className="relative">
                            <Input
                              ref={paymentDateInputRef}
                              id="improvedBookingPaymentDate"
                              type="date"
                              value={paymentDate}
                              max={getDefaultBookingPaymentDate()}
                              onChange={(e: any) => setPaymentDate(e.target.value)}
                              onClick={openPaymentDatePicker}
                              className="h-[4.5rem] rounded-2xl border-2 border-slate-200 bg-white px-7 pr-20 text-3xl font-black tracking-tight text-slate-950 shadow-none focus:border-blue-500 focus:bg-white focus:ring-0 [&::-webkit-calendar-picker-indicator]:opacity-0"
                            />
                            <button
                              type="button"
                              onClick={openPaymentDatePicker}
                              aria-label="Open payment date calendar"
                              className="absolute right-5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-950 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <CalendarIcon className="h-6 w-6" />
                            </button>
                          </div>
                          <p className="text-sm font-medium text-slate-500">
                            {formatBookingPaymentDateLabel(paymentDate) || "Choose actual payment date."}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-6">
                      <p className="text-base font-semibold text-gray-900">Choose Payment Method</p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {[
                          { id: "GCash", label: "GCash", icon: "GC", color: "bg-blue-600", shadow: "shadow-blue-100" },
                          { id: "Card", label: "Credit Card", icon: <CreditCard className="h-5 w-5"/>, color: "bg-violet-600", shadow: "shadow-violet-100" },
                          ...(isStaffBookingMode ? [{ id: "Cash", label: "Cash", icon: <Banknote className="h-4 w-4"/>, color: "bg-slate-700", shadow: "shadow-slate-100" }] : [])
                        ].map((pm) => (
                          <button
                            key={pm.id}
                            type="button"
                            aria-pressed={paymentMethod === pm.id}
                            onClick={() => setPaymentMethod(pm.id)}
                            className={`relative flex h-24 items-center gap-5 rounded-2xl border-2 px-6 text-left transition-all group ${
                              paymentMethod === pm.id
                                ? `border-blue-600 bg-blue-50 text-blue-700 shadow-lg ${pm.shadow}`
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${pm.color} text-sm font-black text-white shadow-lg transition-transform group-hover:scale-105`}>
                              {pm.icon}
                            </div>
                            <span className="text-sm font-black uppercase tracking-wide">{pm.label}</span>
                            {paymentMethod === pm.id && (
                              <div className="absolute right-5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
                                <Check className="h-4 w-4" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 flex-col gap-3 border-t bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
            {isCancelled && user?.role === 'patient' ? (
              <Button
                onClick={handleClose}
                className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-8 font-black uppercase tracking-widest text-gray-600 shadow-sm hover:bg-gray-50 sm:w-auto sm:ml-auto"
              >
                Close
              </Button>
            ) : (
              <>
                {(canCancelAppointment || canDeleteCancelledAppointment) && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={isBooking}
                    className="h-12 w-full rounded-2xl bg-red-500 px-6 font-black uppercase tracking-widest text-white shadow-lg shadow-red-100 hover:bg-red-600 hover:shadow-red-200 sm:w-auto sm:mr-auto transition-all"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {isBooking ? "Processing..." : canDeleteCancelledAppointment ? "Delete Appointment" : "Cancel Appointment"}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handlePrimaryBookingAction}
                  aria-disabled={modalStep === 'payment' && isOverpay}
                  disabled={isBooking}
                  data-tour-id="booking-next-button"
                  className={`h-12 w-full rounded-2xl px-8 font-black uppercase tracking-widest text-white shadow-lg transition-all sm:ml-auto sm:w-auto ${modalStep === 'payment' ? 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700 hover:shadow-emerald-300 sm:min-w-[260px]' : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300 sm:min-w-[200px]'} ${modalStep === 'payment' && isOverpay ? 'cursor-pointer opacity-80' : ''} ${overpayPulse ? 'ring-2 ring-red-400 animate-pulse' : ''}`}
                >
                  {isBooking ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <div className="flex items-center justify-center gap-2">
                      {modalStep === 'payment' ? <Lock className="h-4 w-4" /> : null}
                      <span>
                        {getNextButtonLabel()}
                      </span>
                      {modalStep === 'payment' ? null : <ChevronLeft className="w-4 h-4 rotate-180" />}
                    </div>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApproveRejectDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        mode="cancel"
        appointment={appointmentToEdit}
        isProcessing={isBooking}
        title={canDeleteCancelledAppointment ? "Delete Appointment?" : undefined}
        description={
          canDeleteCancelledAppointment
            ? "You will be deleting this appointment permanently from receptionist views. Only an admin can return it back. Are you sure?"
            : undefined
        }
        confirmLabel={canDeleteCancelledAppointment ? "Yes, Delete" : undefined}
        onConfirm={handleCancel}
      />

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
                              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-tight ${getHistoryBadgeClass(badge.tone)}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-gray-500">{getHistoryDetail(log)}</p>
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
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {formatHistoryTimestamp(log.changedAt)}
                          {changedBy ? ` • ${changedBy}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const historicalData =
                            log.logType === "appointment" && log.newState && Object.keys(log.newState).length > 3
                              ? { ...appointmentToEdit, ...log.newState, amount: log.amount, paymentStatus: log.paymentStatus || log.newState?.paymentStatus, previousState: log.previousState, newState: log.newState, changeType: log.changeType, logType: log.logType, changedAt: log.changedAt, changedByName: changedBy }
                              : { ...appointmentToEdit, ...log.previousState, amount: log.amount, paymentStatus: log.paymentStatus || log.newState?.paymentStatus || log.previousState?.paymentStatus, previousState: log.previousState, newState: log.newState, changeType: log.changeType, logType: log.logType, changedAt: log.changedAt, changedByName: changedBy };

                          setIsHistoryDialogOpen(false);
                          setSnapshotToView(historicalData);
                          setSnapshotIsHistorical(index !== 0);
                          setIsSnapshotModalOpen(true);
                        }}
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

      {/* Summary confirmation dialog */}
      <ConfirmAppointmentModal
        open={isConfirmSummaryOpen}
        onOpenChange={setIsConfirmSummaryOpen}
        onConfirm={handleConfirmSummary}
        isBooking={isBooking}
        patientName={summaryPatientName}
        patientAvatar={summaryPatientAvatar}
        doctorName={displayDoctor}
        doctorAvatar={summaryDoctorAvatar}
        appointmentType={appointmentType}
        customAppointmentTypeName={customAppointmentTypeName}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        duration={duration}
        treatmentNotes={treatmentNotes}
        notes={notes}
        onNotesChange={setNotes}
        durationConflict={durationConflict}
        bookingConflictWarnings={bookingConflictWarnings}
        appointmentStatus={getFinalAppointmentStatus()}
        appointmentStatusOptions={appointmentStatusOptions}
        onAppointmentStatusChange={handleStatusChange}
        canEditAppointmentStatus={canEditAppointmentStatus}
        paymentStatus={getFinalPaymentStatus()}
        paymentStatusOptions={paymentStatusOptions}
        onPaymentStatusChange={handlePaymentStatusChange}
        canManagePaymentStatuses={canManagePaymentStatuses}
        finalPrice={finalPrice}
        discount={Number(discount) || 0}
        discountedPrice={discountedPrice}
        previouslyPaidAmount={previouslyPaidAmount}
        paymentAmountNow={paymentAmountNow}
        paymentDate={paymentDate}
        repeatOption={repeatOption}
        customRepeatDate={customRepeatDate}
        onRepeatOptionChange={setRepeatOption}
        onCustomRepeatDateChange={setCustomRepeatDate}
        patientId={selectedPatient}
        
        getPersonInitials={getPersonInitials}
        getDoctorInitials={getDoctorInitials}
        getBookingStatusLabel={getBookingStatusLabel}
        getAppointmentStatusOption={getAppointmentStatusOption}
        getPaymentStatusOption={getPaymentStatusOption}
        formatTimeTo12h={formatTimeTo12h}
        isPatientReadonly={isPatientReadonly}
        isCancelled={isCancelled}
        isPatientLevelBookingMode={isPatientLevelBookingMode}
        isCartAppointmentStatus={isCartAppointmentStatus}
        userRole={effectiveRole}
      />

      <AppointmentHistoryView
        open={isSnapshotModalOpen}
        onOpenChange={(val) => {
          setIsSnapshotModalOpen(val);
          if (!val) {
            setSnapshotToView(null);
            setSnapshotIsHistorical(false);
          }
        }}
        appointmentSnapshot={snapshotToView}
        logDate={snapshotToView?.changedAt || new Date().toISOString()}
        onViewCurrent={viewCurrentAppointment}
        isHistorical={snapshotIsHistorical}
        openedFromBookingModal={true}
      />

      <DatePickerModal open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen} selectedDate={selectedDate} onDateSelect={handleManualDateSelect} doctorName={selectedDoctor} patientId={selectedPatient} selectedTime={selectedTime} duration={duration} dateSelectionMode={isEditMode ? "edit" : isPastAppointmentMode ? "past" : "standard"} appointmentSource={isPublicBookingMode ? "cache" : "server"} cachedAppointments={publicBlockingAppointments as any} selectionDisabled={isTourScheduleSelectionLocked} />
      
      <TimePickerModal open={isTimePickerOpen} onOpenChange={setIsTimePickerOpen} selectedDate={selectedDate} selectedTime={selectedTime} doctorName={selectedDoctor} duration={duration} onTimeSelect={handleManualTimeSelect} onDateChange={handleManualDateSelect} excludeAppointmentId={appointmentToEdit?.id} patientId={selectedPatient} dateSelectionMode={isEditMode ? "edit" : isPastAppointmentMode ? "past" : "standard"} appointmentSource={isPublicBookingMode ? "cache" : "server"} cachedAppointments={publicBlockingAppointments as any} selectionDisabled={isTourScheduleSelectionLocked} />
    </>
  );
 }
