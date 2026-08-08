export const CART_APPOINTMENT_STATUS = "add-to-cart";
export const LEGACY_CART_APPOINTMENT_STATUS = "pending";
export const CART_APPOINTMENT_STATUS_LABEL = "Add to Cart";

const STATUS_ALIASES: Record<string, string> = {
  "add to cart": CART_APPOINTMENT_STATUS,
  "add-to-cart": CART_APPOINTMENT_STATUS,
  pending: CART_APPOINTMENT_STATUS,
  tentative: "reserved",
  confirmed: "scheduled",
  canceled: "cancelled",
  deleted: "deleted",
  topay: "to-pay",
  "to pay": "to-pay",
  halfpaid: "half-paid",
};

export function normalizeAppointmentStatus(status?: string | null): string {
  const normalized = String(status || "").toLowerCase().trim();
  if (!normalized) return "";

  return STATUS_ALIASES[normalized] || normalized;
}

export function isCartAppointmentStatus(status?: string | null): boolean {
  return normalizeAppointmentStatus(status) === CART_APPOINTMENT_STATUS;
}

export function isReservedAppointmentStatus(status?: string | null): boolean {
  return normalizeAppointmentStatus(status) === "reserved";
}

export function isFullyPaidAppointmentStatus(paymentStatus?: string | null): boolean {
  const normalizedPayment = String(paymentStatus || "").toLowerCase().trim();
  return normalizedPayment === "paid" || normalizedPayment === "over-paid" || normalizedPayment === "fully-paid";
}

export function isOverdueAppointmentDisplay(status?: string | null, paymentStatus?: string | null): boolean {
  const normalizedStatus = normalizeAppointmentStatus(status);
  if (normalizedStatus === "overdue") return true;

  const isFullyPaid = isFullyPaidAppointmentStatus(paymentStatus);
  // Only TBD (when not fully paid) should display as overdue; completed should always display as completed.
  return normalizedStatus === "tbd" && !isFullyPaid;
}

export function formatAppointmentStatusLabel(status?: string | null): string {
  const normalized = normalizeAppointmentStatus(status);
  if (!normalized) return "";
  if (normalized === CART_APPOINTMENT_STATUS) return CART_APPOINTMENT_STATUS_LABEL;
  if (normalized === "tbd") return "TBD";

  return normalized
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const PAST_APPOINTMENT_STATUSES = new Set(["tbd", "cancelled", "overdue", "completed"]);

export function isPastAppointmentDate(dateValue?: string | Date | null, now: Date = new Date()): boolean {
  if (!dateValue) return false;
  let dateObj: Date | null = null;
  if (dateValue instanceof Date) {
    dateObj = dateValue;
  } else {
    const str = String(dateValue).trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (match) {
      dateObj = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    } else {
      const d = new Date(str);
      if (!isNaN(d.getTime())) dateObj = d;
    }
  }
  if (!dateObj || isNaN(dateObj.getTime())) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const apptDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  return apptDate.getTime() < today.getTime();
}

export function isPastStatus(status?: string | null): boolean {
  const norm = normalizeAppointmentStatus(status);
  return PAST_APPOINTMENT_STATUSES.has(norm);
}

export function isFutureStatus(status?: string | null): boolean {
  const norm = normalizeAppointmentStatus(status);
  if (!norm || norm === "deleted" || isCartAppointmentStatus(norm)) return false;
  return !PAST_APPOINTMENT_STATUSES.has(norm);
}

export function isStatusAllowedForAppointment(
  targetStatus: string,
  appointmentDate?: string | Date | null,
  paymentStatus?: string | null,
  userRoleOrIsAdmin?: string | boolean | null
): boolean {
  const normTarget = normalizeAppointmentStatus(targetStatus);
  if (!normTarget || isCartAppointmentStatus(normTarget)) return false;

  const isAdmin = typeof userRoleOrIsAdmin === "boolean" ? userRoleOrIsAdmin : String(userRoleOrIsAdmin || "").toLowerCase().trim() === "admin";
  if (normTarget === "deleted") return isAdmin;
  if (normTarget === "cancelled" || normTarget === "completed") return true;

  const isPast = isPastAppointmentDate(appointmentDate);

  if (isPast) {
    // For past appointments, only past statuses (tbd, cancelled, overdue, completed) are valid
    // Prevent selecting `tbd` for past appointments that are not fully paid because
    // such a state will be auto-converted to `overdue` by backend lifecycle logic.
    if (normTarget === "tbd") {
      const isFullyPaid = isFullyPaidAppointmentStatus(paymentStatus);
      if (!isFullyPaid) return false;
    }
    return PAST_APPOINTMENT_STATUSES.has(normTarget);
  } else {
    // For current/future appointments, only current/future statuses (scheduled, reserved, etc.) are valid
    return !PAST_APPOINTMENT_STATUSES.has(normTarget);
  }
}

export function getAutoConvertedStatusOnPayment(
  currentStatus: string,
  paymentStatus: string,
  appointmentDate?: string | Date | null
): string {
  const normStatus = normalizeAppointmentStatus(currentStatus);
  if (normStatus === "cancelled" || normStatus === "completed" || normStatus === "deleted") {
    return normStatus;
  }
  const isFullyPaid = isFullyPaidAppointmentStatus(paymentStatus);
  const isPast = isPastAppointmentDate(appointmentDate);

  if (isPast && (normStatus === "overdue" || normStatus === "tbd") && isFullyPaid) {
    return "tbd";
  }
  return normStatus;
}

export function getOverdueStatusQuery(): string {
  return "tbd,completed,overdue";
}


