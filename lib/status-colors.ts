import {
  CART_APPOINTMENT_STATUS,
  CART_APPOINTMENT_STATUS_LABEL,
  formatAppointmentStatusLabel,
  normalizeAppointmentStatus,
} from "@/lib/appointment-status";

export type StatusColorClasses = {
  bgColor: string;
  textColor: string;
};

export type StatusOptionWithColors = {
  key: number;
  value: string;
  label: string;
  description: string;
  bgColor?: string;
  textColor?: string;
};

export const DEFAULT_UNKNOWN_STATUS_COLORS: StatusColorClasses = {
  bgColor: "bg-gray-100",
  textColor: "text-gray-700",
};

export const DEFAULT_APPOINTMENT_STATUS_COLORS: Record<string, StatusColorClasses> = {
  scheduled: { bgColor: "bg-emerald-100", textColor: "text-emerald-700" },
  [CART_APPOINTMENT_STATUS]: { bgColor: "bg-orange-100", textColor: "text-orange-700" },
  reserved: { bgColor: "bg-amber-100", textColor: "text-amber-700" },
  cancelled: { bgColor: "bg-red-100", textColor: "text-red-700" },
  deleted: { bgColor: "bg-slate-200", textColor: "text-slate-700" },
  completed: { bgColor: "bg-blue-100", textColor: "text-blue-700" },
  tbd: { bgColor: "bg-violet-100", textColor: "text-violet-700" },
  "to-pay": { bgColor: "bg-cyan-100", textColor: "text-cyan-700" },
};

export const DEFAULT_APPOINTMENT_STATUS_OPTIONS: StatusOptionWithColors[] = [
  {
    key: 1,
    value: "scheduled",
    label: "Scheduled",
    description: "Confirmed and scheduled",
    ...DEFAULT_APPOINTMENT_STATUS_COLORS.scheduled,
  },
  {
    key: 2,
    value: CART_APPOINTMENT_STATUS,
    label: CART_APPOINTMENT_STATUS_LABEL,
    description: "In the patient's appointment cart awaiting checkout",
    ...DEFAULT_APPOINTMENT_STATUS_COLORS[CART_APPOINTMENT_STATUS],
  },
  {
    key: 3,
    value: "reserved",
    label: "Reserved",
    description: "Reserved awaiting payment or clinic confirmation",
    ...DEFAULT_APPOINTMENT_STATUS_COLORS.reserved,
  },
  {
    key: 4,
    value: "cancelled",
    label: "Cancelled",
    description: "Appointment cancelled",
    ...DEFAULT_APPOINTMENT_STATUS_COLORS.cancelled,
  },
  {
    key: 5,
    value: "completed",
    label: "Completed",
    description: "Appointment completed",
    ...DEFAULT_APPOINTMENT_STATUS_COLORS.completed,
  },
  {
    key: 6,
    value: "tbd",
    label: "TBD",
    description: "Past appointment awaiting completion status",
    ...DEFAULT_APPOINTMENT_STATUS_COLORS.tbd,
  },
  {
    key: 7,
    value: "deleted",
    label: "Deleted",
    description: "Hidden from receptionist views",
    ...DEFAULT_APPOINTMENT_STATUS_COLORS.deleted,
  },
];

const PAYMENT_STATUS_ALIASES: Record<string, string> = {
  "fully-paid": "paid",
  "full-paid": "paid",
  "paid-in-full": "paid",
  "half paid": "half-paid",
  halfpaid: "half-paid",
  half_paid: "half-paid",
  partial: "half-paid",
  "partial-paid": "half-paid",
  "partially-paid": "half-paid",
  payatclinic: "pay-at-clinic",
  "pay at clinic": "pay-at-clinic",
  "pay-at-clinic": "pay-at-clinic",
  overpaid: "over-paid",
  "over paid": "over-paid",
};

export const DEFAULT_PAYMENT_STATUS_COLORS: Record<string, StatusColorClasses> = {
  paid: { bgColor: "bg-emerald-100", textColor: "text-emerald-700" },
  unpaid: { bgColor: "bg-slate-100", textColor: "text-slate-700" },
  "half-paid": { bgColor: "bg-amber-100", textColor: "text-amber-700" },
  overdue: { bgColor: "bg-red-100", textColor: "text-red-700" },
  "pay-at-clinic": { bgColor: "bg-sky-100", textColor: "text-sky-700" },
  "over-paid": { bgColor: "bg-teal-100", textColor: "text-teal-700" },
};

const PAYMENT_STATUS_DISPLAY_LABELS: Record<string, string> = {
  "half-paid": "Partial",
};

export const DEFAULT_PAYMENT_STATUS_OPTIONS: StatusOptionWithColors[] = [
  {
    key: 1,
    value: "paid",
    label: "Paid",
    description: "Payment completed in full",
    ...DEFAULT_PAYMENT_STATUS_COLORS.paid,
  },
  {
    key: 2,
    value: "unpaid",
    label: "Unpaid",
    description: "Payment not yet made",
    ...DEFAULT_PAYMENT_STATUS_COLORS.unpaid,
  },
  {
    key: 3,
    value: "half-paid",
    label: "Partial",
    description: "Partial payment received",
    ...DEFAULT_PAYMENT_STATUS_COLORS["half-paid"],
  },
  {
    key: 4,
    value: "overdue",
    label: "Overdue",
    description: "Payment past due date",
    ...DEFAULT_PAYMENT_STATUS_COLORS.overdue,
  },
  {
    key: 5,
    value: "over-paid",
    label: "Over-paid",
    description: "Payment exceeds appointment total",
    ...DEFAULT_PAYMENT_STATUS_COLORS["over-paid"],
  },
];

export function normalizePaymentStatus(status?: string | null): string {
  const normalized = String(status || "").toLowerCase().trim();
  if (!normalized) return "";

  return PAYMENT_STATUS_ALIASES[normalized] || normalized;
}

export function formatPaymentStatusLabel(status?: string | null): string {
  const normalized = normalizePaymentStatus(status);
  if (!normalized) return "Unpaid";

  if (PAYMENT_STATUS_DISPLAY_LABELS[normalized]) return PAYMENT_STATUS_DISPLAY_LABELS[normalized];

  const statusOption = DEFAULT_PAYMENT_STATUS_OPTIONS.find((option) => option.value === normalized);
  if (statusOption) return statusOption.label;
  if (normalized === "over-paid") return "Over-paid";

  return normalized
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPaymentStatusOptionLabel(status?: string | null, label?: string | null): string {
  const statusLabel = PAYMENT_STATUS_DISPLAY_LABELS[normalizePaymentStatus(status)];
  const fallbackLabel = PAYMENT_STATUS_DISPLAY_LABELS[normalizePaymentStatus(label)];

  return statusLabel || fallbackLabel || String(label || "").trim() || formatPaymentStatusLabel(status);
}

export function hasDefaultAppointmentStatusColors(status?: string | null): boolean {
  const normalized = normalizeAppointmentStatus(status);
  return Boolean(normalized && DEFAULT_APPOINTMENT_STATUS_COLORS[normalized]);
}

export function getDefaultAppointmentStatusColors(status?: string | null): StatusColorClasses {
  const normalized = normalizeAppointmentStatus(status);
  return DEFAULT_APPOINTMENT_STATUS_COLORS[normalized] || DEFAULT_UNKNOWN_STATUS_COLORS;
}

export function hasDefaultPaymentStatusColors(status?: string | null): boolean {
  const normalized = normalizePaymentStatus(status);
  return Boolean(normalized && DEFAULT_PAYMENT_STATUS_COLORS[normalized]);
}

export function getDefaultPaymentStatusColors(status?: string | null): StatusColorClasses {
  const normalized = normalizePaymentStatus(status);
  return DEFAULT_PAYMENT_STATUS_COLORS[normalized] || DEFAULT_UNKNOWN_STATUS_COLORS;
}

export function applyDefaultAppointmentStatusColors<T extends { value: string; bgColor?: string; textColor?: string }>(
  status: T
): T & StatusColorClasses {
  const defaultColors = getDefaultAppointmentStatusColors(status.value);
  const shouldUseDefault = hasDefaultAppointmentStatusColors(status.value);

  return {
    ...status,
    bgColor: shouldUseDefault ? defaultColors.bgColor : status.bgColor || defaultColors.bgColor,
    textColor: shouldUseDefault ? defaultColors.textColor : status.textColor || defaultColors.textColor,
  };
}

export function applyDefaultPaymentStatusColors<T extends { value: string; label?: string; bgColor?: string; textColor?: string }>(
  status: T
): T & StatusColorClasses {
  const defaultColors = getDefaultPaymentStatusColors(status.value);
  const shouldUseDefault = hasDefaultPaymentStatusColors(status.value);

  return {
    ...status,
    label: formatPaymentStatusOptionLabel(status.value, status.label),
    bgColor: shouldUseDefault ? defaultColors.bgColor : status.bgColor || defaultColors.bgColor,
    textColor: shouldUseDefault ? defaultColors.textColor : status.textColor || defaultColors.textColor,
  };
}

export function getAppointmentStatusOptionWithColors<T extends { value: string; label?: string; bgColor?: string; textColor?: string }>(
  status: string | undefined | null,
  options: T[] = []
) {
  const normalized = normalizeAppointmentStatus(status);
  const statusOption = options.find((option) => normalizeAppointmentStatus(option.value) === normalized);

  if (statusOption) return applyDefaultAppointmentStatusColors(statusOption);

  return {
    value: normalized,
    label: formatAppointmentStatusLabel(normalized),
    ...getDefaultAppointmentStatusColors(normalized),
  };
}

export function getPaymentStatusOptionWithColors<T extends { value: string; label?: string; bgColor?: string; textColor?: string }>(
  status: string | undefined | null,
  options: T[] = []
) {
  const normalized = normalizePaymentStatus(status) || "unpaid";
  const statusOption = options.find((option) => normalizePaymentStatus(option.value) === normalized);

  if (statusOption) return applyDefaultPaymentStatusColors(statusOption);

  return {
    value: normalized,
    label: formatPaymentStatusLabel(normalized),
    ...getDefaultPaymentStatusColors(normalized),
  };
}

export function getAppointmentStatusBadgeClassName(
  status: string | undefined | null,
  options: { value: string; bgColor?: string; textColor?: string }[] = []
): string {
  const colors = getAppointmentStatusOptionWithColors(status, options);
  return `${colors.bgColor} ${colors.textColor} border-none`;
}

export function getPaymentStatusBadgeClassName(
  status: string | undefined | null,
  options: { value: string; bgColor?: string; textColor?: string }[] = []
): string {
  const colors = getPaymentStatusOptionWithColors(status, options);
  return `${colors.bgColor} ${colors.textColor} border-none`;
}

const STATUS_COLOR_FAMILIES: Record<string, { softBg: string; border: string; dot: string }> = {
  amber: { softBg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
  blue: { softBg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500" },
  cyan: { softBg: "bg-cyan-50", border: "border-cyan-200", dot: "bg-cyan-500" },
  emerald: { softBg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  gray: { softBg: "bg-gray-50", border: "border-gray-200", dot: "bg-gray-500" },
  orange: { softBg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500" },
  red: { softBg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" },
  sky: { softBg: "bg-sky-50", border: "border-sky-200", dot: "bg-sky-500" },
  slate: { softBg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-500" },
  teal: { softBg: "bg-teal-50", border: "border-teal-200", dot: "bg-teal-500" },
  violet: { softBg: "bg-violet-50", border: "border-violet-200", dot: "bg-violet-500" },
};

const colorFamilyFromBg = (bgColor?: string) => {
  const match = String(bgColor || "").match(/^bg-([a-z]+)-\d+$/);
  return match?.[1] || "gray";
};

export function getStatusBorderColorClass(bgColor?: string): string {
  return STATUS_COLOR_FAMILIES[colorFamilyFromBg(bgColor)]?.border || STATUS_COLOR_FAMILIES.gray.border;
}

export function getStatusSoftBgColorClass(bgColor?: string): string {
  return STATUS_COLOR_FAMILIES[colorFamilyFromBg(bgColor)]?.softBg || STATUS_COLOR_FAMILIES.gray.softBg;
}

export function getStatusDotColorClass(bgColor?: string): string {
  return STATUS_COLOR_FAMILIES[colorFamilyFromBg(bgColor)]?.dot || STATUS_COLOR_FAMILIES.gray.dot;
}

export function getAppointmentCalendarStatusColors(
  status: string | undefined | null,
  options: { value: string; bgColor?: string; textColor?: string }[] = []
) {
  const colors = getAppointmentStatusOptionWithColors(status, options);

  return {
    bg: getStatusSoftBgColorClass(colors.bgColor),
    text: colors.textColor,
    border: getStatusBorderColorClass(colors.bgColor),
  };
}
