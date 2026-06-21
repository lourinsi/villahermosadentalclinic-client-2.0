"use client";

import { History, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  formatOptionLabel,
} from "./financeModalOptions";

export type FinanceHistoryEntityType = "expense" | "inventory" | "payroll";

export type FinanceHistoryLog = {
  id: string;
  entityType: FinanceHistoryEntityType | string;
  entityId: string;
  context?: string;
  action: string;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  changedBy?: string;
  changedByName?: string;
  changedByRole?: string;
  changedAt?: string;
  summary?: string;
};

type FinanceHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: FinanceHistoryEntityType;
  title: string;
  description: string;
  logs: FinanceHistoryLog[];
  isLoading?: boolean;
};

type FinanceHistoryChange = {
  key: string;
  label: string;
  before: string;
  after: string;
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const formatCurrency = (amount?: number) => currencyFormatter.format(Number(amount) || 0);

const FIELD_ORDER: Record<FinanceHistoryEntityType, string[]> = {
  expense: [
    "date",
    "category",
    "description",
    "amount",
    "vendor",
    "paymentMethod",
    "paymentDate",
    "status",
    "recurring",
    "inventoryItemId",
    "inventoryQuantity",
  ],
  inventory: ["item", "quantity", "unit", "costPerUnit", "totalValue", "supplier", "lastOrdered"],
  payroll: [
    "name",
    "staffName",
    "role",
    "type",
    "baseSalary",
    "staffBaseSalary",
    "amount",
    "bonus",
    "managedAdjustment",
    "total",
    "date",
    "paymentDate",
    "status",
    "month",
    "notes",
    "repaymentSchedule",
  ],
};

const FIELD_LABELS: Record<string, string> = {
  item: "Item name",
  costPerUnit: "Unit cost",
  totalValue: "Total value",
  lastOrdered: "Last ordered",
  paymentMethod: "Payment method",
  paymentDate: "Payment date",
  inventoryItemId: "Linked stock item",
  inventoryQuantity: "Linked stock quantity",
  baseSalary: "Base salary",
  staffBaseSalary: "Staff base salary",
  managedAdjustment: "Managed adjustment",
  staffName: "Staff member",
  repaymentSchedule: "Repayment schedule",
};

const HIDDEN_FIELDS = new Set([
  "id",
  "entityId",
  "salaryRecordId",
  "createdAt",
  "updatedAt",
  "deleted",
  "deletedAt",
]);

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  pay: "Paid",
  process: "Processed",
  bonus: "Bonus updated",
  configure: "Configured",
  delete: "Deleted",
  stock_from_expense: "Stock from expense",
  financial_record_create: "Payroll record created",
  financial_record_update: "Payroll record updated",
  financial_record_approve: "Payroll record approved",
  financial_record_delete: "Payroll record deleted",
};

const formatLabel = (key: string) =>
  FIELD_LABELS[key] ||
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const hasMeaningfulValue = (value: any) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

const comparableValue = (value: any) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number(value).toFixed(4);
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
};

const valuesChanged = (before: any, after: any) => comparableValue(before) !== comparableValue(after);

const formatBoolean = (value: boolean) => (value ? "Yes" : "No");

const formatValue = (
  entityType: FinanceHistoryEntityType,
  key: string,
  value: any,
  state?: Record<string, any>
) => {
  if (!hasMeaningfulValue(value)) return "-";

  if (typeof value === "boolean") return formatBoolean(value);

  if (["amount", "baseSalary", "staffBaseSalary", "bonus", "managedAdjustment", "total", "costPerUnit", "totalValue"].includes(key)) {
    return formatCurrency(Number(value) || 0);
  }

  if (entityType === "expense" && key === "category") {
    return formatOptionLabel(String(value), EXPENSE_CATEGORY_OPTIONS);
  }

  if (entityType === "expense" && key === "status") {
    return formatOptionLabel(String(value), EXPENSE_STATUS_OPTIONS);
  }

  if (key === "paymentMethod") {
    return formatOptionLabel(String(value), PAYMENT_METHOD_OPTIONS);
  }

  if (entityType === "inventory" && key === "quantity") {
    const unit = String(state?.unit || "").trim();
    return `${Number(value) || 0}${unit ? ` ${unit}` : ""}`;
  }

  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const getHistoryFields = (
  entityType: FinanceHistoryEntityType,
  previousState: Record<string, any>,
  newState: Record<string, any>
) => {
  const ordered = FIELD_ORDER[entityType] || [];
  const allKeys = Array.from(new Set([...ordered, ...Object.keys(previousState), ...Object.keys(newState)]));
  return allKeys.filter((key) => !HIDDEN_FIELDS.has(key));
};

const getFinanceHistoryChanges = (
  entityType: FinanceHistoryEntityType,
  log: FinanceHistoryLog
): FinanceHistoryChange[] => {
  const previousState = log.previousState || {};
  const newState = log.newState || {};
  const fields = getHistoryFields(entityType, previousState, newState);
  const isCreation = log.action.includes("create") || Object.keys(previousState).length === 0;
  const isDeletion = log.action.includes("delete") || Object.keys(newState).length === 0;

  return fields
    .filter((key) => {
      if (isCreation) return hasMeaningfulValue(newState[key]);
      if (isDeletion) return hasMeaningfulValue(previousState[key]);
      return valuesChanged(previousState[key], newState[key]);
    })
    .map((key) => ({
      key,
      label: formatLabel(key),
      before: isCreation ? "-" : formatValue(entityType, key, previousState[key], previousState),
      after: isDeletion ? "-" : formatValue(entityType, key, newState[key], newState),
    }));
};

const formatTimestamp = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("en-PH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getActionLabel = (action: string) => ACTION_LABELS[action] || formatLabel(action);

const getActionBadgeClass = (action: string) => {
  if (["pay", "process", "financial_record_approve"].includes(action)) return "bg-green-100 text-green-800";
  if (action.includes("delete")) return "bg-red-100 text-red-800";
  if (action.includes("create")) return "bg-blue-100 text-blue-800";
  if (action.includes("expense")) return "bg-violet-100 text-violet-800";
  return "bg-amber-100 text-amber-800";
};

const getEntityLabel = (entityType: FinanceHistoryEntityType) => {
  if (entityType === "expense") return "Expense";
  if (entityType === "inventory") return "Inventory";
  return "Payroll";
};

export function FinanceHistoryDialog({
  open,
  onOpenChange,
  entityType,
  title,
  description,
  logs,
  isLoading = false,
}: FinanceHistoryDialogProps) {
  const sortedLogs = logs
    .slice()
    .sort((left, right) => new Date(right.changedAt || 0).getTime() - new Date(left.changedAt || 0).getTime());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl">
        <DialogHeader className="border-b bg-gray-50 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-100">
              <History className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-gray-900">{title}</DialogTitle>
              <DialogDescription className="text-sm font-semibold text-gray-500">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[64vh] space-y-3 overflow-y-auto bg-white p-6 pr-4 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-8 text-sm font-bold text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history...
            </div>
          ) : sortedLogs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50 p-8 text-center">
              <p className="text-sm font-black text-gray-900">No history yet</p>
              <p className="mt-1 text-xs font-semibold text-gray-400">
                Changes will appear here after this {getEntityLabel(entityType).toLowerCase()} record is updated.
              </p>
            </div>
          ) : (
            sortedLogs.map((log, index) => {
              const changes = getFinanceHistoryChanges(entityType, log);
              const changedBy = [log.changedByName || log.changedBy, log.changedByRole].filter(Boolean).join(" - ");
              const timestamp = formatTimestamp(log.changedAt);

              return (
                <div key={log.id || `${log.action}-${log.changedAt}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-gray-900">
                      {log.summary || `${getEntityLabel(entityType)} ${getActionLabel(log.action).toLowerCase()}`}
                    </p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-tight ${getActionBadgeClass(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                  </div>

                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {timestamp || "Unknown time"}
                    {changedBy ? ` - ${changedBy}` : ""}
                  </p>

                  {changes.length === 0 ? (
                    <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-500">
                      No field-level differences were stored for this log.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {changes.map((change) => (
                        <div key={`${log.id}-${change.key}`} className="rounded-xl bg-white px-3 py-2">
                          <div className="text-xs font-black text-gray-900">{change.label}</div>
                          <div className="mt-1 grid gap-1 text-xs font-semibold text-gray-500 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                            <span className="min-w-0 break-words">{change.before}</span>
                            <span className="hidden text-gray-300 sm:block">-&gt;</span>
                            <span className="min-w-0 break-words text-gray-700">{change.after}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
