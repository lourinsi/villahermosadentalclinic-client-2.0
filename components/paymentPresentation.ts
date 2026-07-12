/**
 * Canonical payment-method presentation shared by appointment and expense
 * payments. Persisted data may contain older title-cased aliases; callers
 * should normalize on input and always use `formatPaymentMethod` for display.
 */
export type PaymentMethodOption = {
  value: string;
  label: string;
  shortLabel?: string;
};

export const PAYMENT_METHOD_OPTIONS: readonly PaymentMethodOption[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Card", shortLabel: "Card" },
  { value: "gcash", label: "GCash" },
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH Transfer" },
] as const;

const normalizeComparablePaymentMethod = (value?: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const PAYMENT_METHOD_ALIASES: Record<string, string> = {
  card: "credit_card",
  creditcard: "credit_card",
  debitcard: "credit_card",
  bank: "bank_transfer",
  banktransfer: "bank_transfer",
  wiretransfer: "bank_transfer",
  gcash: "gcash",
  cash: "cash",
  cheque: "check",
  check: "check",
  ach: "ach",
  achtransfer: "ach",
};

export const normalizePaymentMethod = (value?: unknown) => {
  const comparable = normalizeComparablePaymentMethod(value);
  if (!comparable) return "";
  const matchingOption = PAYMENT_METHOD_OPTIONS.find(
    (option) =>
      normalizeComparablePaymentMethod(option.value) === comparable ||
      normalizeComparablePaymentMethod(option.label) === comparable,
  );
  return matchingOption?.value || PAYMENT_METHOD_ALIASES[comparable] || String(value || "").trim();
};

export const getPaymentMethodOption = (value?: unknown) => {
  const normalized = normalizePaymentMethod(value);
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === normalized);
};

export const formatPaymentMethod = (value?: unknown, fallback = "Not set") =>
  getPaymentMethodOption(value)?.label || String(value || "").trim() || fallback;
