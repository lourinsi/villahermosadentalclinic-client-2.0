import { apiUrl } from "@/lib/api";
import React, { useEffect, useRef } from "react";
import {
  CART_APPOINTMENT_STATUS,
  CART_APPOINTMENT_STATUS_LABEL,
  formatAppointmentStatusLabel,
  isCartAppointmentStatus,
  normalizeAppointmentStatus,
} from "@/lib/appointment-status";
import {
  DEFAULT_APPOINTMENT_STATUS_OPTIONS as DEFAULT_APPOINTMENT_STATUS_COLOR_OPTIONS,
  DEFAULT_PAYMENT_STATUS_OPTIONS as DEFAULT_PAYMENT_STATUS_COLOR_OPTIONS,
  getDefaultAppointmentStatusColors,
  getDefaultPaymentStatusColors,
  normalizePaymentStatus,
} from "@/lib/status-colors";

export {
  CART_APPOINTMENT_STATUS,
  CART_APPOINTMENT_STATUS_LABEL,
  formatAppointmentStatusLabel,
  isCartAppointmentStatus,
  normalizeAppointmentStatus,
};

type Toast = { error?: (msg: string) => void } | ((msg: string) => void);

type BookingFlow = 'details-payment' | 'multi-step';
type BookingStep = 'details' | 'patient' | 'schedule' | 'treatment' | 'doctor' | 'payment';
type BookingActorRole = 'public' | 'patient' | 'admin' | 'doctor' | 'receptionist' | '';
export type BookingMode = 'standard' | 'public';
export type BookingCreationMode = 'standard' | 'past' | 'edit';

export const PAST_APPOINTMENT_STATUS_VALUES = ['tbd', 'cancelled', 'completed'] as const;
type PastAppointmentStatus = typeof PAST_APPOINTMENT_STATUS_VALUES[number];

export function parseLocalDateOnly(dateInput?: Date | string | null): Date | null {
  if (!dateInput) return null;

  if (dateInput instanceof Date) {
    if (Number.isNaN(dateInput.getTime())) return null;
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }

  const value = String(dateInput).trim();
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isPastAppointmentDate(dateInput?: Date | string | null, now: Date = new Date()) {
  const appointmentDate = parseLocalDateOnly(dateInput);
  if (!appointmentDate) return false;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return appointmentDate.getTime() < today.getTime();
}

export function isPastAppointmentStatusValue(status?: string | null): status is PastAppointmentStatus {
  return PAST_APPOINTMENT_STATUS_VALUES.includes(
    String(status || '').toLowerCase().trim() as PastAppointmentStatus
  );
}

export function normalizePastAppointmentStatus(status?: string | null): PastAppointmentStatus {
  const normalized = String(status || '').toLowerCase().trim();
  return isPastAppointmentStatusValue(normalized) ? normalized : 'tbd';
}

export function getPastAppointmentStatusOptions<T extends { value: string }>(options: T[]): T[] {
  const optionsByValue = new Map(options.map((option) => [option.value, option]));
  return PAST_APPOINTMENT_STATUS_VALUES
    .map((value) => optionsByValue.get(value))
    .filter((option): option is T => Boolean(option));
}

export function getDefaultPastAppointmentDate(now: Date = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() - 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

export function getDefaultPastAppointmentTime() {
  return '09:00';
}

export type BookingConflictWarning = {
  type: 'duration' | 'patient';
  label: string;
  message: string;
};

export type BookingStatusOption = {
  key: number;
  value: string;
  label: string;
  description?: string;
  bgColor?: string;
  textColor?: string;
};

export const DEFAULT_APPOINTMENT_STATUS_OPTIONS: BookingStatusOption[] = DEFAULT_APPOINTMENT_STATUS_COLOR_OPTIONS;

export const DEFAULT_PAYMENT_STATUS_OPTIONS: BookingStatusOption[] = DEFAULT_PAYMENT_STATUS_COLOR_OPTIONS;
const HIDDEN_PAYMENT_STATUS_VALUES = new Set(["pay-at-clinic"]);

export const ALLOWED_BOOKING_DURATIONS = [30, 60, 90, 120] as const;
export type BookingDuration = typeof ALLOWED_BOOKING_DURATIONS[number];

const ALLOWED_BOOKING_DURATION_SET = new Set<number>(ALLOWED_BOOKING_DURATIONS);

export function isAllowedBookingDuration(value?: unknown) {
  const duration = Number(value);
  return Number.isInteger(duration) && ALLOWED_BOOKING_DURATION_SET.has(duration);
}

export function normalizeBookingDuration(
  value?: unknown,
  fallback: BookingDuration = 30
): BookingDuration {
  const duration = Number(value);
  return isAllowedBookingDuration(duration) ? (duration as BookingDuration) : fallback;
}

type AppointmentTypeDurations = Record<string, BookingDuration>;

export const DEFAULT_APPOINTMENT_TYPE_DURATIONS: AppointmentTypeDurations = {
  "Routine Cleaning": 30,
  "Checkup": 30,
  "Filling": 60,
  "Root Canal": 90,
  "Extraction": 60,
  "Whitening": 60,
  "Other": 30,
};

type DefaultScheduleAction =
  | { type: 'none' }
  | {
      type: 'apply';
      source: 'doctor_availability' | 'clicked_slot';
      date: Date;
      time: string;
      doctorName?: string | null;
      scheduleKey: string;
      shouldApplySchedule: boolean;
    };

type AutoPreselectConfig =
  | { type: 'skip' }
  | { type: 'preserve_schedule'; defaultAppointmentType: string }
  | { type: 'wait_for_doctor'; defaultAppointmentType: string }
  | {
      type: 'search';
      defaultAppointmentType: string;
      doctorToSearch: string;
      durationToSearch: string;
      patientToSearch?: string;
    };

export type BookingSlot = {
  date: Date;
  time: string;
};

export const RECURRING_APPOINTMENT_OPTIONS = ["1 month", "3 months", "6 months", "Custom"] as const;
export type RecurringAppointmentOption = typeof RECURRING_APPOINTMENT_OPTIONS[number];

export type BookingRecurrencePayload = {
  enabled: boolean;
  option: RecurringAppointmentOption;
  customDate?: string | null;
  generatedAppointmentId?: string | null;
  generatedAppointmentDate?: string | null;
  generatedFromId?: string | null;
  generatedFromDate?: string | null;
  sourceAppointmentId?: string | null;
  sourceAppointmentDate?: string | null;
  createdFromAppointmentId?: string | null;
  createdFromAppointmentDate?: string | null;
  originalGeneratedFromId?: string | null;
  originalGeneratedFromDate?: string | null;
  [key: string]: any;
};

export type BookingRecurrenceState = {
  isRecurring: boolean;
  recurrenceOption: RecurringAppointmentOption;
  customRecurrenceDate: string;
  generatedAppointmentId?: string | null;
  generatedAppointmentDate?: string | null;
  recurrence?: BookingRecurrencePayload | null;
};

export type BookingRecurringDeletionItem = {
  id?: string;
  date: string;
  time?: string | null;
  status?: string | null;
  generatedFromId?: string | null;
};

const DEFAULT_RECURRING_APPOINTMENT_OPTION: RecurringAppointmentOption = RECURRING_APPOINTMENT_OPTIONS[0];

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const normalizeRecurrenceOption = (option?: unknown): RecurringAppointmentOption => {
  const value = String(option || "").trim();
  return RECURRING_APPOINTMENT_OPTIONS.includes(value as RecurringAppointmentOption)
    ? (value as RecurringAppointmentOption)
    : DEFAULT_RECURRING_APPOINTMENT_OPTION;
};

const normalizeRecurrenceDate = (date?: unknown) => {
  const value = String(date || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
};

const addMonthsClamped = (date: Date, months: number) => {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + months;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(date.getDate(), lastDayOfTargetMonth);
  return new Date(targetYear, targetMonth, day);
};

export function normalizeBookingRecurrence(
  recurrence?: unknown,
  fallback?: unknown
): BookingRecurrencePayload | null {
  const fallbackRecord = isRecord(fallback) ? fallback : {};

  if (recurrence === undefined) {
    if (!isRecord(fallback)) return null;
    return normalizeBookingRecurrence(fallbackRecord);
  }

  if (recurrence === null || recurrence === false) {
    return {
      ...fallbackRecord,
      enabled: false,
      option: normalizeRecurrenceOption(fallbackRecord.option),
      customDate: normalizeRecurrenceDate(fallbackRecord.customDate) || null,
    };
  }

  const record = isRecord(recurrence) ? recurrence : { enabled: Boolean(recurrence) };
  const option = normalizeRecurrenceOption(record.option ?? fallbackRecord.option);
  const customDate = normalizeRecurrenceDate(record.customDate ?? fallbackRecord.customDate);
  const hasExplicitEnabled = Object.prototype.hasOwnProperty.call(record, "enabled");
  const enabled = hasExplicitEnabled
    ? Boolean(record.enabled)
    : Boolean(record.option || record.customDate || fallbackRecord.enabled);

  return {
    ...fallbackRecord,
    ...record,
    enabled,
    option,
    customDate: customDate || null,
    generatedAppointmentId:
      record.generatedAppointmentId ?? fallbackRecord.generatedAppointmentId ?? null,
    generatedAppointmentDate:
      normalizeRecurrenceDate(record.generatedAppointmentDate ?? fallbackRecord.generatedAppointmentDate) || null,
    generatedFromId: record.generatedFromId ?? fallbackRecord.generatedFromId ?? null,
    generatedFromDate:
      normalizeRecurrenceDate(record.generatedFromDate ?? fallbackRecord.generatedFromDate) || null,
    sourceAppointmentId: record.sourceAppointmentId ?? fallbackRecord.sourceAppointmentId ?? null,
    sourceAppointmentDate:
      normalizeRecurrenceDate(record.sourceAppointmentDate ?? fallbackRecord.sourceAppointmentDate) || null,
    createdFromAppointmentId:
      record.createdFromAppointmentId ??
      record.originalGeneratedFromId ??
      fallbackRecord.createdFromAppointmentId ??
      fallbackRecord.originalGeneratedFromId ??
      null,
    createdFromAppointmentDate:
      normalizeRecurrenceDate(
        record.createdFromAppointmentDate ??
        record.originalGeneratedFromDate ??
        fallbackRecord.createdFromAppointmentDate ??
        fallbackRecord.originalGeneratedFromDate
      ) || null,
    originalGeneratedFromId:
      record.originalGeneratedFromId ??
      record.createdFromAppointmentId ??
      fallbackRecord.originalGeneratedFromId ??
      fallbackRecord.createdFromAppointmentId ??
      null,
    originalGeneratedFromDate:
      normalizeRecurrenceDate(
        record.originalGeneratedFromDate ??
        record.createdFromAppointmentDate ??
        fallbackRecord.originalGeneratedFromDate ??
        fallbackRecord.createdFromAppointmentDate
      ) || null,
  };
}

const hasBookingRecurrenceValue = (value: unknown) => {
  if (!isRecord(value)) return false;
  return (
    Object.prototype.hasOwnProperty.call(value, "enabled") ||
    Boolean(value.option || value.customDate || value.generatedAppointmentId || value.generatedAppointmentDate)
  );
};

export function getBookingRecurrenceState(
  appointment?: any,
  appointmentLogs: any[] = []
): BookingRecurrenceState {
  const sortedLogs = appointmentLogs
    .slice()
    .sort((a, b) => new Date(b?.changedAt || 0).getTime() - new Date(a?.changedAt || 0).getTime());

  const recurrenceCandidates = [
    appointment?.recurrence,
    appointment?.newState?.recurrence,
    appointment?.previousState?.recurrence,
    ...sortedLogs.flatMap((log) => [log?.newState?.recurrence, log?.previousState?.recurrence]),
  ];
  const recurringFlagCandidates = [
    appointment?.isRecurring,
    appointment?.newState?.isRecurring,
    appointment?.previousState?.isRecurring,
    ...sortedLogs.flatMap((log) => [log?.newState?.isRecurring, log?.previousState?.isRecurring]),
  ];

  const recurrenceSource = recurrenceCandidates.find(hasBookingRecurrenceValue);
  const normalized = normalizeBookingRecurrence(recurrenceSource);
  const recurringFlag = recurringFlagCandidates.find((value) => value !== undefined && value !== null);

  return {
    isRecurring: normalized ? Boolean(normalized.enabled) : Boolean(recurringFlag),
    recurrenceOption: normalizeRecurrenceOption(normalized?.option),
    customRecurrenceDate: normalizeRecurrenceDate(normalized?.customDate),
    generatedAppointmentId: normalized?.generatedAppointmentId || null,
    generatedAppointmentDate: normalized?.generatedAppointmentDate || null,
    recurrence: normalized,
  };
}

export function getDirectBookingRecurringDeletionItems(
  recurrenceState: BookingRecurrenceState
): BookingRecurringDeletionItem[] {
  return recurrenceState.generatedAppointmentDate
    ? [{
        id: recurrenceState.generatedAppointmentId || undefined,
        date: recurrenceState.generatedAppointmentDate,
      }]
    : [];
}

export function normalizeBookingRecurringDeletionItems(
  items: BookingRecurringDeletionItem[]
): BookingRecurringDeletionItem[] {
  return Array.from(
    items.reduce((map, item) => {
      const id = String(item.id || "").trim();
      const date = String(item.date || "").trim();
      const time = String(item.time || "").trim();
      if (!date) return map;

      map.set(id ? `id:${id}` : `date:${date}:${time || "no-time"}`, {
        ...item,
        id: id || undefined,
        date,
        time: time || undefined,
        generatedFromId: item.generatedFromId || undefined,
      });
      return map;
    }, new Map<string, BookingRecurringDeletionItem>()).values()
  );
}

export function mapBookingRecurringChainResponse(data: unknown): BookingRecurringDeletionItem[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((appointment: any) => ({
      id: String(appointment?.id || "").trim() || undefined,
      date: String(appointment?.date || "").trim(),
      time: String(appointment?.time || "").trim() || undefined,
      status: String(appointment?.status || "").trim() || undefined,
      generatedFromId: String(
        appointment?.recurrence?.generatedFromId ||
        appointment?.recurrence?.sourceAppointmentId ||
        ""
      ).trim() || undefined,
    }))
    .filter((item: BookingRecurringDeletionItem) => Boolean(item.date));
}

export async function fetchBookingRecurringDeletionItems({
  appointment,
  recurrenceState,
  isPublicCachedAppointment,
  getAuthHeaders,
}: {
  appointment?: any;
  recurrenceState: BookingRecurrenceState;
  isPublicCachedAppointment: boolean;
  getAuthHeaders: () => Record<string, string>;
}): Promise<BookingRecurringDeletionItem[]> {
  const directItems = getDirectBookingRecurringDeletionItems(recurrenceState);

  if (!appointment?.id || isPublicCachedAppointment) {
    console.info("[Recurring Cancel] Skipping recurrence-chain fetch", {
      appointmentId: appointment?.id || null,
      isPublicCachedAppointment,
    });
    return directItems;
  }

  try {
    const res = await fetch(
      apiUrl(`/api/appointments/${encodeURIComponent(String(appointment.id))}/recurrence-chain`),
      {
        credentials: "include",
        headers: getAuthHeaders(),
      }
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !Array.isArray(json.data)) {
      console.warn("[Recurring Cancel] recurrence-chain fetch returned no usable data", {
        appointmentId: appointment.id,
        status: res.status,
        ok: res.ok,
        payload: json,
        fallbackItems: directItems,
      });
      return directItems;
    }

    return mapBookingRecurringChainResponse(json.data);
  } catch (error) {
    console.warn("[Recurring Cancel] recurrence-chain fetch failed", {
      appointmentId: appointment.id,
      error,
      fallbackItems: directItems,
    });
    return directItems;
  }
}

export function logBookingRecurringCancelPreview({
  appointment,
  items,
}: {
  appointment?: any;
  items: BookingRecurringDeletionItem[];
}) {
  const currentAppointment = {
    id: appointment?.id || null,
    date: appointment?.date || null,
    time: appointment?.time || null,
    status: appointment?.status || null,
    recurringSeriesId:
      appointment?.recurringSeriesId ||
      appointment?.recurrence?.recurringSeriesId ||
      null,
  };
  const linkedAppointments = items.map((item, index) => ({
    index: index + 1,
    id: item.id || null,
    date: item.date,
    time: item.time || null,
    status: item.status || null,
    generatedFromId: item.generatedFromId || null,
  }));

  console.groupCollapsed?.(
    `[Recurring Cancel] ${linkedAppointments.length} linked recurring appointment(s) for ${currentAppointment.id || "appointment"}`
  );
  console.info("[Recurring Cancel] Current appointment", currentAppointment);
  console.table?.(linkedAppointments);
  console.info("[Recurring Cancel] Linked appointments", linkedAppointments);
  console.groupEnd?.();
}

export function hasActiveBookingRecurringChild({
  appointmentId,
  recurrenceState,
  items,
}: {
  appointmentId?: string | null;
  recurrenceState: BookingRecurrenceState;
  items: BookingRecurringDeletionItem[];
}) {
  const inactiveStatuses = new Set(["cancelled", "canceled", "deleted", "stopped"]);
  const hasActiveLinkedAppointment = items.some((item) => {
    const status = String(item.status || "").trim().toLowerCase();
    return !status || !inactiveStatuses.has(status);
  });

  if (hasActiveLinkedAppointment) return true;

  return items.some((item) => {
    const status = String(item.status || "").trim().toLowerCase();
    if (status && inactiveStatuses.has(status)) return false;

    return Boolean(
      item.generatedFromId &&
      appointmentId &&
      String(item.generatedFromId) === String(appointmentId)
    ) || Boolean(
      recurrenceState.generatedAppointmentId
        ? item.id && String(item.id) === String(recurrenceState.generatedAppointmentId)
        : recurrenceState.generatedAppointmentDate && item.date === recurrenceState.generatedAppointmentDate
    );
  });
}

export function getBookingRecurringNextDate({
  appointmentDate,
  recurrenceOption,
  customRecurrenceDate,
}: {
  appointmentDate?: Date | string | null;
  recurrenceOption?: string | null;
  customRecurrenceDate?: string | null;
}) {
  const option = normalizeRecurrenceOption(recurrenceOption);

  if (option === "Custom") {
    return formatBookingDateKey(customRecurrenceDate);
  }

  const sourceDate = parseLocalDateOnly(appointmentDate);
  if (!sourceDate) return "";

  const monthsByOption: Record<RecurringAppointmentOption, number> = {
    "1 month": 1,
    "3 months": 3,
    "6 months": 6,
    Custom: 1,
  };

  return formatBookingDateKey(addMonthsClamped(sourceDate, monthsByOption[option] || 1));
}

export function buildBookingRecurrencePayload({
  isRecurring,
  recurrenceOption,
  customRecurrenceDate,
  existingRecurrence,
}: {
  isRecurring: boolean;
  recurrenceOption?: string | null;
  customRecurrenceDate?: string | null;
  existingRecurrence?: unknown;
}): BookingRecurrencePayload {
  const existing = normalizeBookingRecurrence(existingRecurrence);
  const option = normalizeRecurrenceOption(recurrenceOption ?? existing?.option);
  const customDate = normalizeRecurrenceDate(customRecurrenceDate ?? existing?.customDate);

  return {
    ...(existing || {}),
    enabled: isRecurring,
    option,
    customDate: customDate || null,
  };
}

export function formatBookingRecurringDate(dateInput?: string | null) {
  const date = parseLocalDateOnly(dateInput);
  if (!date) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getBookingRecurringDescription({
  isRecurring,
  recurrenceOption,
  customRecurrenceDate,
}: {
  isRecurring: boolean;
  recurrenceOption?: string | null;
  customRecurrenceDate?: string | null;
}) {
  if (!isRecurring) {
    return "One-time appointment";
  }

  const normalizedOption = String(recurrenceOption || "").trim();
  if (normalizedOption.toLowerCase() === "custom") {
    if (customRecurrenceDate) {
      const date = new Date(customRecurrenceDate);
      if (!Number.isNaN(date.getTime())) {
        return `Reoccurs on ${date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;
      }
    }
    return "Reoccurs on a custom date";
  }

  return `Reoccurs every ${normalizedOption}`;
}

export function getBookingAppointmentTypeIndex(typeName: string): number {
  const typeMap: Record<string, number> = {
    "Routine Cleaning": 0,
    "Checkup": 1,
    "Filling": 2,
    "Root Canal": 3,
    "Extraction": 4,
    "Whitening": 5,
    "Other": 6,
  };
  return typeMap[typeName] ?? 6;
}

export function formatBookingDoctorName(name?: string): string {
  if (!name || name === "—" || name === "â€”") return "—";
  const cleanName = name.replace(/^Dr\.\s+/i, "").trim();
  if (/^(none|null|undefined|unassigned|no doctor assigned)$/i.test(cleanName)) return "No doctor assigned";
  return `Dr. ${cleanName}`;
}

export function normalizeBookingDoctorName(name?: string) {
  const cleanName = (name || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();
  return /^(none|null|undefined|unassigned|no doctor assigned)$/.test(cleanName) ? "" : cleanName;
}

export function normalizeBookingHistoryStatus(value?: unknown) {
  const normalized = String(value ?? "").toLowerCase().trim();
  return /^(|none|null|undefined)$/.test(normalized) ? "" : normalized;
}

export function formatBookingHistoryStatusLabel(value?: unknown) {
  const normalized = normalizeBookingHistoryStatus(value);
  if (!normalized) return "Updated";

  const labels: Record<string, string> = {
    "add-to-cart": "Add to Cart",
    "half paid": "Partial",
    "half-paid": "Partial",
    "half_paid": "Partial",
    "paid": "Fully Paid",
    "tbd": "TBD",
  };

  if (labels[normalized]) return labels[normalized];

  return normalized
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getBookingHistoryPaymentStatusChange(log: any) {
  const previousStatus = normalizeBookingHistoryStatus(log?.previousState?.paymentStatus);
  const nextStatus = normalizeBookingHistoryStatus(log?.newState?.paymentStatus || log?.paymentStatus);

  return {
    previousStatus,
    nextStatus,
    changed: Boolean(previousStatus && nextStatus && previousStatus !== nextStatus),
  };
}

export function isSignificantBookingPaymentStatus(value?: unknown) {
  const normalized = normalizeBookingHistoryStatus(value);
  return /^(paid|fully-paid|half-paid|partial|partially-paid)$/.test(normalized);
}

export function shouldShowBookingHistoryLog(log: any) {
  if (log?.logType !== "payment") return true;

  const { nextStatus } = getBookingHistoryPaymentStatusChange(log);
  return Number(log?.amount || 0) > 0 || isSignificantBookingPaymentStatus(nextStatus);
}

const hasHistoryNotesField = (state?: any) =>
  Boolean(state && Object.prototype.hasOwnProperty.call(state, "notes"));

const normalizeBookingHistoryNotes = (value?: unknown) => {
  const text = String(value ?? "").trim();
  if (!text || /^(?:-|none|null|undefined)$/i.test(text)) return "";
  return text;
};

export function getBookingHistoryNotes(log: any) {
  if (!log) return "";

  const topLevelNotes = normalizeBookingHistoryNotes(log.notes);
  if (topLevelNotes) return topLevelNotes;

  if (hasHistoryNotesField(log.newState)) {
    return normalizeBookingHistoryNotes(log.newState.notes);
  }

  if (hasHistoryNotesField(log.previousState)) {
    return normalizeBookingHistoryNotes(log.previousState.notes);
  }

  return "";
}

export function getBookingDoctorInitials(name?: string) {
  const cleanName = (name || "Doctor").replace(/^Dr\.\s+/i, "").trim();
  return cleanName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function toBookingPatientOption(patient: any) {
  return {
    id: String(patient.id),
    name: patient.name || `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Patient",
    ...patient,
  };
}

export function getBookingStatusLabel<T extends { value: string; label: string }>(
  statusValue: string,
  statuses: T[]
) {
  const normalizedStatusValue = normalizeAppointmentStatus(statusValue);
  const status = statuses.find((item) => normalizeAppointmentStatus(item.value) === normalizedStatusValue);
  return status?.label || formatAppointmentStatusLabel(statusValue);
}

const buildCurrentStatusOption = <T extends BookingStatusOption>(
  value: string,
  label: string,
  description: string,
  statusType: "appointment" | "payment" = "appointment"
): T => ({
  key: 0,
  value,
  label,
  description,
  ...(statusType === "payment"
    ? getDefaultPaymentStatusColors(value)
    : getDefaultAppointmentStatusColors(value)),
}) as T;

export function getBookingAppointmentStatusConfig<T extends BookingStatusOption>({
  appointmentStatus,
  existingStatus,
  isPastStatusRestricted,
  canManageStatuses,
  statusOptions,
  fallbackStatusOptions = DEFAULT_APPOINTMENT_STATUS_OPTIONS as T[],
}: {
  appointmentStatus?: string | null;
  existingStatus?: string | null;
  isPastStatusRestricted: boolean;
  canManageStatuses: boolean;
  statusOptions: T[];
  fallbackStatusOptions?: T[];
}) {
  const defaultAppointmentStatusValue = isPastStatusRestricted ? "tbd" : "scheduled";
  const rawCurrentAppointmentStatusValue = appointmentStatus || existingStatus || defaultAppointmentStatusValue;
  const currentAppointmentStatusValue = isPastStatusRestricted
    ? normalizePastAppointmentStatus(rawCurrentAppointmentStatusValue)
    : normalizeAppointmentStatus(rawCurrentAppointmentStatusValue);
  const baseAppointmentStatusOptions = statusOptions.length > 0 ? statusOptions : fallbackStatusOptions;
  const selectableAppointmentStatusOptions = isPastStatusRestricted
    ? getPastAppointmentStatusOptions(baseAppointmentStatusOptions)
    : canManageStatuses
      ? baseAppointmentStatusOptions.filter((status) => !isCartAppointmentStatus(status.value))
      : baseAppointmentStatusOptions;
  const appointmentStatusOptions =
    currentAppointmentStatusValue &&
    !(canManageStatuses && isCartAppointmentStatus(currentAppointmentStatusValue)) &&
    !selectableAppointmentStatusOptions.some((status) => normalizeAppointmentStatus(status.value) === currentAppointmentStatusValue)
      ? [
          buildCurrentStatusOption<T>(
            currentAppointmentStatusValue,
            getBookingStatusLabel(currentAppointmentStatusValue, selectableAppointmentStatusOptions),
            "Current appointment status",
            "appointment"
          ),
          ...selectableAppointmentStatusOptions,
        ]
      : selectableAppointmentStatusOptions;

  return {
    currentAppointmentStatusValue,
    appointmentStatusOptions,
  };
}

export function getBookingPaymentStatusConfig<T extends BookingStatusOption>({
  paymentStatus,
  existingStatus,
  statusOptions,
  fallbackStatusOptions = DEFAULT_PAYMENT_STATUS_OPTIONS as T[],
}: {
  paymentStatus?: string | null;
  existingStatus?: string | null;
  statusOptions: T[];
  fallbackStatusOptions?: T[];
}) {
  const currentPaymentStatusValue = normalizePaymentStatus(paymentStatus || existingStatus || "unpaid");
  const sourcePaymentStatusOptions = statusOptions.length > 0
    ? [...statusOptions, ...fallbackStatusOptions]
    : fallbackStatusOptions;
  const basePaymentStatusOptions = sourcePaymentStatusOptions.reduce<T[]>((options, status) => {
    const normalizedValue = normalizePaymentStatus(status.value);
    if (
      !normalizedValue ||
      HIDDEN_PAYMENT_STATUS_VALUES.has(normalizedValue) ||
      options.some((option) => normalizePaymentStatus(option.value) === normalizedValue)
    ) {
      return options;
    }

    return [...options, status];
  }, []);
  const isHiddenCurrentPaymentStatus = HIDDEN_PAYMENT_STATUS_VALUES.has(currentPaymentStatusValue);
  const paymentStatusOptions =
    currentPaymentStatusValue &&
    !isHiddenCurrentPaymentStatus &&
    !basePaymentStatusOptions.some((status) => normalizePaymentStatus(status.value) === currentPaymentStatusValue)
      ? [
          buildCurrentStatusOption<T>(
            currentPaymentStatusValue,
            getBookingStatusLabel(currentPaymentStatusValue, basePaymentStatusOptions),
            "Current payment status",
            "payment"
          ),
          ...basePaymentStatusOptions,
        ]
      : basePaymentStatusOptions;

  return {
    currentPaymentStatusValue,
    paymentStatusOptions,
  };
}

export function formatBookingDateKey(dateInput?: Date | string | null) {
  const date = parseLocalDateOnly(dateInput);
  if (!date) return "";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function bookingTimeToMinutes(time: string) {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function getBookingDefaultDate(defaultDate?: Date | null) {
  return parseLocalDateOnly(defaultDate) ?? new Date();
}

export function getBookingDefaultTime(defaultTime?: string | null) {
  return defaultTime ?? "";
}

export type UseBookingPaymentPrefillArgs = {
  open: boolean;
  modalStep: BookingStep;
  amountToPay: string;
  remainingBalance: number;
  setAmountToPay: (value: string) => void;
};

export function useBookingPaymentPrefill({
  open,
  modalStep,
  amountToPay,
  remainingBalance,
  setAmountToPay,
}: UseBookingPaymentPrefillArgs) {
  const paymentAmountPrefilledRef = useRef(false);

  useEffect(() => {
    if (!open) {
      paymentAmountPrefilledRef.current = false;
      return;
    }

    if (modalStep !== "payment" || remainingBalance <= 0 || paymentAmountPrefilledRef.current) return;
    if (amountToPay.trim() !== "") {
      paymentAmountPrefilledRef.current = true;
      return;
    }

    setAmountToPay(String(remainingBalance));
    paymentAmountPrefilledRef.current = true;
  }, [open, modalStep, amountToPay, remainingBalance, setAmountToPay]);
}

export function getBookingEditDate({
  appointmentDate,
  defaultDate,
}: {
  appointmentDate?: Date | string | null;
  defaultDate?: Date | null;
}) {
  return parseLocalDateOnly(appointmentDate) ?? parseLocalDateOnly(defaultDate) ?? new Date();
}

export function getBookingEditTime({
  appointmentTime,
  defaultTime,
}: {
  appointmentTime?: string | null;
  defaultTime?: string | null;
}) {
  return appointmentTime || (defaultTime ?? "");
}

export function getBookingCreateDate({
  defaultDate,
  isPastAppointmentMode,
}: {
  defaultDate?: Date | null;
  isPastAppointmentMode?: boolean;
}) {
  return parseLocalDateOnly(defaultDate) ?? (isPastAppointmentMode ? getDefaultPastAppointmentDate() : new Date());
}

export function getBookingCreateTime(defaultTime?: string | null) {
  return defaultTime ?? "";
}

export function getBookingScheduleKey({
  date,
  time,
  doctorName,
}: {
  date?: Date | string | null;
  time?: string | null;
  doctorName?: string | null;
}) {
  return `${formatBookingDateKey(date)}|${time || ""}|${doctorName || ""}`;
}

export function getBookingDefaultScheduleAction({
  open,
  isEditing,
  defaultDate,
  defaultTime,
  doctorName,
  appliedScheduleKey,
}: {
  open: boolean;
  isEditing: boolean;
  defaultDate?: Date | null;
  defaultTime?: string | null;
  doctorName?: string | null;
  appliedScheduleKey?: string | null;
}): DefaultScheduleAction {
  if (!open || isEditing || !defaultDate || !defaultTime) return { type: "none" };

  const scheduleDate = parseLocalDateOnly(defaultDate);
  if (!scheduleDate) return { type: "none" };

  const scheduleKey = getBookingScheduleKey({ date: scheduleDate, time: defaultTime, doctorName });
  return {
    type: "apply",
    source: doctorName ? "doctor_availability" : "clicked_slot",
    date: scheduleDate,
    time: defaultTime,
    doctorName,
    scheduleKey,
    shouldApplySchedule: appliedScheduleKey !== scheduleKey,
  };
}

export function getBookingAutoPreselectConfig({
  isEditing,
  defaultDate,
  defaultTime,
  selectedTime,
  appointmentType,
  selectedDoctor,
  selectedPatient,
  defaultPatientId,
  patientId,
  appointmentTypeDurations,
  defaultAppointmentType = "Routine Cleaning",
}: {
  isEditing: boolean;
  defaultDate?: Date | null;
  defaultTime?: string | null;
  selectedTime?: string | null;
  appointmentType?: string | null;
  selectedDoctor?: string | null;
  selectedPatient?: string | null;
  defaultPatientId?: string | null;
  patientId?: string | null;
  appointmentTypeDurations: AppointmentTypeDurations;
  defaultAppointmentType?: string;
}): AutoPreselectConfig {
  if (isEditing) return { type: "skip" };

  if ((defaultDate && defaultTime) || selectedTime) {
    return { type: "preserve_schedule", defaultAppointmentType };
  }

  if (!selectedDoctor) {
    return { type: "wait_for_doctor", defaultAppointmentType };
  }

  const selectedAppointmentType = appointmentType || defaultAppointmentType;
  const durationToSearch = String(normalizeBookingDuration(appointmentTypeDurations[selectedAppointmentType]));

  return {
    type: "search",
    defaultAppointmentType,
    doctorToSearch: selectedDoctor,
    durationToSearch,
    patientToSearch: patientId || selectedPatient || defaultPatientId || undefined,
  };
}

export async function findNextAvailableBookingSlot({
  startDate,
  doctorToCheck,
  durationToCheck,
  patientToCheck,
  timeSlots,
  maxDaysToCheck = 30,
  logPrefix = "BookingModal",
  availabilityMode = "authenticated",
  localBlockingAppointments = [],
}: {
  startDate: Date;
  doctorToCheck: string;
  durationToCheck: string;
  patientToCheck?: string;
  timeSlots: string[];
  maxDaysToCheck?: number;
  logPrefix?: string;
  availabilityMode?: "authenticated" | "public";
  localBlockingAppointments?: any[];
}): Promise<BookingSlot | null> {
  if (!doctorToCheck) return null;

  const durationMins = normalizeBookingDuration(durationToCheck);
  const start = parseLocalDateOnly(startDate) ?? new Date();
  const normalizeDoctor = (doctor?: string) =>
    String(doctor || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();
  const targetDoctor = normalizeDoctor(doctorToCheck);

  const getSlotsForDate = async (date: Date) => {
    try {
      const dateStr = formatBookingDateKey(date);
      if (!dateStr) return [];

      const endpoint =
        availabilityMode === "public"
          ? `/api/appointments/public-availability?doctor=${encodeURIComponent(doctorToCheck)}&startDate=${dateStr}&endDate=${dateStr}`
          : `/api/appointments?doctor=${encodeURIComponent(doctorToCheck)}&startDate=${dateStr}&endDate=${dateStr}&includeUnpaid=true`;
      const response = await fetch(
        apiUrl(endpoint),
        { credentials: "include" }
      );

      if (!response.ok && availabilityMode !== "public") return [];

      const json = response.ok ? await response.json() : { data: [] };
      const remoteAppointments = Array.isArray(json.data) ? json.data : [];
      const localAppointmentsForDate = localBlockingAppointments.filter((appointment) => {
        if (appointment.date !== dateStr) return false;
        if (!targetDoctor) return true;
        return normalizeDoctor(appointment.doctorId || appointment.doctorName || appointment.doctor) === targetDoctor;
      });
      const appointments = [...remoteAppointments, ...localAppointmentsForDate];
      console.log(`[${logPrefix}] findNextAvailableSlot fetched appointments for`, dateStr, {
        doctorToCheck,
        appointmentsCount: appointments.length,
      });

      const localPatientAppointmentsForDate = localBlockingAppointments.filter(
        (appointment) => appointment.date === dateStr && patientToCheck && String(appointment.patientId) === String(patientToCheck)
      );
      let patientAppointmentsForDate: any[] = localPatientAppointmentsForDate;
      if (patientToCheck) {
        try {
          if (availabilityMode !== "public") {
            const patientResponse = await fetch(
              apiUrl(`/api/appointments?patientId=${encodeURIComponent(patientToCheck)}&startDate=${dateStr}&endDate=${dateStr}&includeUnpaid=true`),
              { credentials: "include" }
            );

            if (patientResponse.ok) {
              const patientJson = await patientResponse.json();
              patientAppointmentsForDate = [
                ...patientAppointmentsForDate,
                ...(Array.isArray(patientJson.data) ? patientJson.data : []),
              ];
            }
          }
        } catch (err) {
          console.warn(`[${logPrefix}] Failed to fetch patient appointments for auto-search`, err);
          patientAppointmentsForDate = localPatientAppointmentsForDate;
        }

        console.log(`[${logPrefix}] findNextAvailableSlot fetched patient appointments for`, dateStr, {
          patientToCheck,
          patientCount: patientAppointmentsForDate.length,
        });
      }

      const now = new Date();
      const isToday = dateStr === formatBookingDateKey(now);
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const availableSlots: string[] = [];

      for (const slot of timeSlots) {
        const [hour, minute] = slot.split(":").map(Number);
        const isPastTime = isToday && (hour < currentHour || (hour === currentHour && minute <= currentMinute));
        if (isPastTime) continue;

        const slotMinutes = bookingTimeToMinutes(slot);
        const slotEndMinutes = slotMinutes + durationMins;
        let isConflict = false;

        for (const appointment of appointments) {
          if (appointment.status === "cancelled") continue;
          if (isCartAppointmentStatus(appointment.status)) continue;

          const appointmentStart = bookingTimeToMinutes(appointment.time);
          const appointmentEnd = appointmentStart + normalizeBookingDuration(appointment.duration);
          if (slotMinutes < appointmentEnd && slotEndMinutes > appointmentStart) {
            isConflict = true;
            break;
          }
        }

        if (!isConflict && patientAppointmentsForDate.length > 0) {
          for (const appointment of patientAppointmentsForDate) {
            if (appointment.status === "cancelled") continue;
            if (isCartAppointmentStatus(appointment.status)) continue;

            const appointmentStart = bookingTimeToMinutes(appointment.time);
            const appointmentEnd = appointmentStart + normalizeBookingDuration(appointment.duration);
            if (slotMinutes < appointmentEnd && slotEndMinutes > appointmentStart) {
              isConflict = true;
              break;
            }
          }
        }

        if (!isConflict) availableSlots.push(slot);
      }

      return availableSlots;
    } catch (err) {
      console.warn(`[${logPrefix}] Failed to fetch appointments for date ${formatBookingDateKey(date)}:`, err);
      return [];
    }
  };

  for (let daysAhead = 0; daysAhead < maxDaysToCheck; daysAhead += 1) {
    const checkDate = new Date(start);
    checkDate.setDate(start.getDate() + daysAhead);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkDate < today) continue;

    const availableSlots = await getSlotsForDate(checkDate);
    if (availableSlots.length > 0) {
      return {
        date: checkDate,
        time: availableSlots[0],
      };
    }
  }

  return null;
}

export function getBookingActor({
  userRole,
  bookingMode = 'standard',
  isEditing = false,
}: {
  userRole?: string | null;
  bookingMode?: BookingMode;
  isEditing?: boolean;
}) {
  const isPublicBookingMode = bookingMode === 'public';
  const effectiveRole = (isPublicBookingMode ? 'public' : userRole || '') as BookingActorRole;
  const isStaffBookingMode = effectiveRole === 'admin' || effectiveRole === 'doctor' || effectiveRole === 'receptionist';
  const isPatientLevelBookingMode = effectiveRole === 'patient' || effectiveRole === 'public';
  const canManageStatuses = Boolean(effectiveRole) && !isPatientLevelBookingMode;
  const canManagePaymentStatuses = effectiveRole === 'admin';

  return {
    effectiveRole,
    isPublicBookingMode,
    isStaffBookingMode,
    isPatientLevelBookingMode,
    canCreatePatients: isStaffBookingMode || effectiveRole === 'public',
    canManagePricing: isStaffBookingMode,
    canManageStatuses,
    canManagePaymentStatuses,
    // Doctors should have the doctor selection locked in the doctor portal
    // (they should not be able to pick other doctors). Keep this true
    // regardless of editing mode so the doctor step is hidden for doctors.
    isDoctorSelectionLocked: userRole === 'doctor',
  };
}

export function getBookingCancellationConfig({
  appointmentToEdit,
  appointmentStatus,
}: {
  appointmentToEdit?: any;
  appointmentStatus?: string | null;
}) {
  const currentStatus = String(
    appointmentStatus || appointmentToEdit?.status || ""
  ).toLowerCase();
  const isCancelled = currentStatus === "cancelled";

  return {
    isCancelled,
    canCancelAppointment: Boolean(appointmentToEdit) && !isCancelled,
  };
}

type UseSharedBookingLogicArgs = {
  modalStep: BookingStep;
  flow?: BookingFlow;
  selectedPatient?: string | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  appointmentType?: string | null;
  customAppointmentTypeName?: string;
  selectedDoctor?: string | null;
  setModalStep: (step: BookingStep) => void;
  setIsConfirmSummaryOpen?: (v: boolean) => void;
  toast: Toast;
  durationConflict?: string;
  patientConflict?: string;
  skipDoctorStep?: boolean;
  allowConflictSummary?: boolean;
  scheduleMode?: BookingCreationMode;
};

export function getBookingConflictWarnings({
  durationConflict,
  patientConflict,
  duration,
}: {
  durationConflict?: string;
  patientConflict?: string;
  duration?: string | number | null;
}): BookingConflictWarning[] {
  const warnings: BookingConflictWarning[] = [];
  const durationLabel = duration ? `${normalizeBookingDuration(duration)} minute duration` : 'Selected duration';

  if (durationConflict) {
    warnings.push({
      type: 'duration',
      label: 'Duration conflict',
      message: `${durationLabel} conflicts with ${durationConflict.replace(/^conflicts with\s+/i, '')}.`,
    });
  }

  if (patientConflict) {
    warnings.push({
      type: 'patient',
      label: 'Patient conflict',
      message: patientConflict,
    });
  }

  return warnings;
}

export function getBookingSummaryNotes(notes?: string | null) {
  const text = String(notes || '').trim();

  return {
    hasNotes: text.length > 0,
    text: text || 'No notes added.',
  };
}

export function getProjectedBookingStatus({
  userRole,
  bookingMode = 'standard',
  isEditing,
  statusChangedByUser,
  selectedStatus,
  existingStatus,
  amountPaid,
  previouslyPaidAmount,
  totalPrice,
}: {
  userRole?: string | null;
  bookingMode?: BookingMode;
  isEditing: boolean;
  statusChangedByUser: boolean;
  selectedStatus?: string | null;
  existingStatus?: string | null;
  amountPaid: number;
  previouslyPaidAmount: number;
  totalPrice: number;
}) {
  const { isStaffBookingMode } = getBookingActor({ userRole, bookingMode });
  const normalizedSelectedStatus = normalizeAppointmentStatus(selectedStatus);
  const normalizedExistingStatus = normalizeAppointmentStatus(existingStatus);
  const safeSelectedStatus =
    isStaffBookingMode && isCartAppointmentStatus(normalizedSelectedStatus)
      ? 'reserved'
      : normalizedSelectedStatus || normalizedExistingStatus || (isStaffBookingMode ? 'reserved' : CART_APPOINTMENT_STATUS);

  if (statusChangedByUser) {
    return safeSelectedStatus;
  }

  if (isEditing) {
    if (amountPaid <= 0) {
      return safeSelectedStatus;
    }

    const newTotalPaid = previouslyPaidAmount + amountPaid;
    const newBalance = Math.max(0, totalPrice - newTotalPaid);

    if (newBalance <= 0) return 'scheduled';
    if (newTotalPaid > 0) return 'reserved';
    return safeSelectedStatus;
  }

  const balance = Math.max(0, totalPrice - amountPaid);

  if (isStaffBookingMode && amountPaid <= 0) return 'reserved';
  if (balance <= 0) return 'scheduled';
  if (amountPaid > 0) return 'reserved';

  return isStaffBookingMode ? 'reserved' : CART_APPOINTMENT_STATUS;
}

export function getProjectedPaymentStatus({
  paymentMethod,
  statusChangedByUser,
  selectedStatus,
  existingStatus,
  amountPaid,
  previouslyPaidAmount,
  totalPrice,
}: {
  paymentMethod?: string | null;
  statusChangedByUser: boolean;
  selectedStatus?: string | null;
  existingStatus?: string | null;
  amountPaid: number;
  previouslyPaidAmount: number;
  totalPrice: number;
}) {
  if (statusChangedByUser) {
    return selectedStatus || existingStatus || 'unpaid';
  }

  const safeAmountPaid = Number.isFinite(amountPaid) ? Math.max(0, amountPaid) : 0;
  const safePreviouslyPaidAmount = Number.isFinite(previouslyPaidAmount) ? Math.max(0, previouslyPaidAmount) : 0;
  const safeTotalPrice = Number.isFinite(totalPrice) ? Math.max(0, totalPrice) : 0;
  const newTotalPaid = safeAmountPaid > 0 ? safePreviouslyPaidAmount + safeAmountPaid : safePreviouslyPaidAmount;
  const newBalance = Math.max(0, safeTotalPrice - newTotalPaid);

  if (newBalance <= 0) return 'paid';
  if (newTotalPaid > 0) return 'half-paid';

  return 'unpaid';
}

function safeToastError(toast: Toast, msg: string) {
  try {
    if (!toast) return;
    if (typeof toast === 'function') return toast(msg);
    if (typeof toast.error === 'function') return toast.error(msg);
  } catch {
    // no-op
  }
}

export default function useSharedBookingLogic({
  modalStep,
  flow,
  selectedPatient,
  selectedDate,
  selectedTime,
  appointmentType,
  customAppointmentTypeName,
  selectedDoctor,
  setModalStep,
  setIsConfirmSummaryOpen,
  toast,
  durationConflict,
  patientConflict,
  skipDoctorStep = false,
  allowConflictSummary = false,
  scheduleMode = 'standard',
}: UseSharedBookingLogicArgs) {
  const isDetailsPaymentFlow = flow === 'details-payment' || modalStep === 'details';

  function getSelectedAppointmentDateTime() {
    if (!selectedDate || !selectedTime) return null;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

    const appointmentDateTime = new Date(selectedDate);
    appointmentDateTime.setHours(hours, minutes, 0, 0);
    return appointmentDateTime;
  }

  function validatePatient() {
    if (!selectedPatient) {
      safeToastError(toast, 'Please select a patient before continuing.');
      return false;
    }

    return true;
  }

  function validateScheduleAvailability() {
    if (durationConflict) {
      safeToastError(toast, durationConflict);
      return false;
    }

    if (patientConflict) {
      safeToastError(toast, patientConflict);
      return false;
    }

    return true;
  }

  function validateSchedule() {
    if (!selectedDate || !selectedTime) {
      safeToastError(toast, 'Please choose a date and time for the appointment.');
      return false;
    }

    if (!validateScheduleWindow()) return false;

    return validateScheduleAvailability();
  }

  function validateScheduleSelection() {
    if (!selectedDate || !selectedTime) {
      safeToastError(toast, 'Please choose a date and time for the appointment.');
      return false;
    }

    return validateScheduleWindow();
  }

  function validateScheduleWindow() {
    if (scheduleMode !== 'past') return true;

    const appointmentDateTime = getSelectedAppointmentDateTime();
    if (!appointmentDateTime) return true;

    if (appointmentDateTime.getTime() > Date.now()) {
      safeToastError(toast, 'Past appointment entries must use a date and time that have already passed.');
      return false;
    }

    return true;
  }

  function validateTreatment() {
    if (!appointmentType) {
      safeToastError(toast, 'Please select a treatment before continuing.');
      return false;
    }

    if (appointmentType === 'Other' && !String(customAppointmentTypeName || '').trim()) {
      safeToastError(toast, 'Please type the name of the custom treatment.');
      return false;
    }

    return true;
  }

  function validateDoctor() {
    if (!selectedDoctor) {
      safeToastError(toast, 'Please select a doctor before continuing.');
      return false;
    }

    return validateScheduleAvailability();
  }

  function openSummary() {
    if (typeof setIsConfirmSummaryOpen === 'function') {
      setIsConfirmSummaryOpen(true);
      return true;
    }

    return false;
  }

  function handleNextStep() {
    if (isDetailsPaymentFlow) {
      if (modalStep === 'details') {
        if (!validatePatient() || !(allowConflictSummary ? validateScheduleSelection() : validateSchedule()) || !validateTreatment()) return false;
        setModalStep('payment');
        return true;
      }

      if (modalStep === 'payment') {
        if (!validatePatient() || !validateSchedule() || !validateTreatment() || !validateDoctor()) return false;
        return openSummary();
      }

      return false;
    }

    if (modalStep === 'patient') {
      if (!validatePatient()) return false;
      setModalStep('schedule');
      return true;
    }

    if (modalStep === 'schedule') {
      if (!validateSchedule()) return false;
      if (skipDoctorStep) {
        if (!validateDoctor()) return false;
        setModalStep('treatment');
      } else {
        setModalStep('doctor');
      }
      return true;
    }

    if (modalStep === 'treatment') {
      if (!validateTreatment()) return false;
      setModalStep('payment');
      return true;
    }

    if (modalStep === 'doctor') {
      if (!validateDoctor()) return false;
      setModalStep('treatment');
      return true;
    }

    if (modalStep === 'payment') {
      if (!validatePatient() || !validateSchedule() || !validateTreatment() || !validateDoctor()) return false;
      return openSummary();
    }

    return false;
  }

  function handlePrevStep() {
    if (isDetailsPaymentFlow && modalStep === 'payment') return setModalStep('details');
    if (modalStep === 'payment') return setModalStep('treatment');
    if (modalStep === 'treatment') return setModalStep(skipDoctorStep ? 'schedule' : 'doctor');
    if (modalStep === 'doctor') return setModalStep('schedule');
    if (modalStep === 'schedule') return setModalStep('patient');
    return setModalStep('patient');
  }

  return { handleNextStep, handlePrevStep };
}
