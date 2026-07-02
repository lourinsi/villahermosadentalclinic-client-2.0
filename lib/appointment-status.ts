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
