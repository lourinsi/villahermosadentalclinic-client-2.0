"use client";

export type ExpenseForm = {
  category: string;
  description: string;
  amount: number;
  vendor: string;
  date: string;
  paymentMethod: string;
  status: string;
  inventoryItemId: string;
  inventoryQuantity: number;
};

export type InventoryForm = {
  item: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  supplier: string;
  lastOrdered: string;
};

export type ReorderForm = {
  quantityToAdd: number;
};

type ExpenseRecord = Partial<ExpenseForm>;

type InventoryRecord = Partial<InventoryForm>;

export const todayDate = () => new Date().toISOString().slice(0, 10);

export const currentPayrollMonthKey = () => todayDate().slice(0, 7);

export const getDefaultPayrollPaymentDate = (payrollMonth: string) => {
  const today = todayDate();
  return today.startsWith(`${payrollMonth}-`) ? today : `${payrollMonth}-01`;
};

export const formatPayrollMonthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  );
};

export const getPayrollMonthOptions = () => {
  const now = new Date();
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: formatPayrollMonthLabel(value) };
  });
};

export const EXPENSE_CATEGORY_OPTIONS = [
  { value: "supplies", label: "Supplies" },
  { value: "laboratory", label: "Laboratory" },
  { value: "rent", label: "Rent" },
  { value: "equipment", label: "Equipment" },
  { value: "utilities", label: "Utilities" },
  { value: "insurance", label: "Insurance" },
  { value: "payroll", label: "Payroll" },
  { value: "other", label: "Other" },
];

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Card" },
  { value: "gcash", label: "GCash" },
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH Transfer" },
];

export const EXPENSE_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export const INVENTORY_UNIT_OPTIONS = [
  { value: "Boxes", label: "Boxes" },
  { value: "Pcs", label: "Pcs" },
  { value: "Packs", label: "Packs" },
  { value: "Units", label: "Units" },
];

export const normalizeFinanceValue = (value?: string) =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const resolveOptionValue = (
  value: string | undefined,
  options: { value: string; label: string }[]
) => {
  const normalized = normalizeFinanceValue(value);
  const match = options.find(
    (option) =>
      normalizeFinanceValue(option.value) === normalized ||
      normalizeFinanceValue(option.label) === normalized
  );
  return match?.value || value || "";
};

const INVENTORY_UNIT_ALIASES: Record<string, string> = {
  box: "Boxes",
  boxes: "Boxes",
  pc: "Pcs",
  pcs: "Pcs",
  piece: "Pcs",
  pieces: "Pcs",
  pack: "Packs",
  packs: "Packs",
  unit: "Units",
  units: "Units",
};

export const resolveInventoryUnitValue = (value: string | undefined) => {
  const normalized = normalizeFinanceValue(value);
  return INVENTORY_UNIT_ALIASES[normalized] || resolveOptionValue(value, INVENTORY_UNIT_OPTIONS);
};

export const formatOptionLabel = (
  value: string | undefined,
  options: { value: string; label: string }[]
) => {
  const normalized = normalizeFinanceValue(value);
  const match = options.find(
    (option) =>
      normalizeFinanceValue(option.value) === normalized ||
      normalizeFinanceValue(option.label) === normalized
  );
  if (match) return match.label;
  return value || "-";
};

export const createEmptyExpense = (): ExpenseForm => ({
  category: "",
  description: "",
  amount: 0,
  vendor: "",
  date: todayDate(),
  paymentMethod: "",
  status: "pending",
  inventoryItemId: "",
  inventoryQuantity: 0,
});

export const createEmptyInventoryItem = (): InventoryForm => ({
  item: "",
  quantity: 0,
  unit: "",
  costPerUnit: 0,
  supplier: "",
  lastOrdered: todayDate(),
});

export const createEmptyReorderForm = (): ReorderForm => ({
  quantityToAdd: 1,
});

export const createExpenseFormFromExpense = (expense: ExpenseRecord): ExpenseForm => ({
  category: resolveOptionValue(expense.category, EXPENSE_CATEGORY_OPTIONS),
  description: expense.description || "",
  amount: Number(expense.amount) || 0,
  vendor: expense.vendor || "",
  date: expense.date || todayDate(),
  paymentMethod: resolveOptionValue(expense.paymentMethod, PAYMENT_METHOD_OPTIONS),
  status: resolveOptionValue(expense.status, EXPENSE_STATUS_OPTIONS) || "pending",
  inventoryItemId: expense.inventoryItemId || "",
  inventoryQuantity: Number(expense.inventoryQuantity) || 0,
});

export const createInventoryFormFromItem = (item: InventoryRecord): InventoryForm => ({
  item: item.item || "",
  quantity: Number(item.quantity) || 0,
  unit: resolveInventoryUnitValue(item.unit),
  costPerUnit: Number(item.costPerUnit) || 0,
  supplier: item.supplier || "",
  lastOrdered: item.lastOrdered || todayDate(),
});
