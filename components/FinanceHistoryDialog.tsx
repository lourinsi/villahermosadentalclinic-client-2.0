"use client";

import { Clock, Eye, History, Loader2, TriangleAlert, X } from "lucide-react";
import { CurrencyText } from "./CurrencyAmount";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { EXPENSE_CATEGORY_OPTIONS, EXPENSE_STATUS_OPTIONS, PAYMENT_METHOD_OPTIONS, formatOptionLabel } from "./financeModalOptions";

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
  amount?: number;
  synthetic?: boolean;
  groupedInitialPayment?: boolean;
};

export type ExpenseHistoricalSnapshot = Record<string, any> & {
  _isHistorical: true;
  _historyLogId: string;
  _historyAction: string;
  _historyChangedAt?: string;
  _historyActor?: string;
  _historyActorRole?: string;
  _historyPreviousState: Record<string, any>;
  _historyNewState: Record<string, any>;
};

type FinanceHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: FinanceHistoryEntityType;
  title: string;
  description: string;
  logs: FinanceHistoryLog[];
  isLoading?: boolean;
  error?: string | null;
  onViewExpenseSnapshot?: (snapshot: ExpenseHistoricalSnapshot, log: FinanceHistoryLog) => void;
};

export type FinanceHistoryChange = {
  key: string;
  label: string;
  before: string;
  after: string;
};
type FinanceHistoryFormatOptions = { inventoryNames?: Record<string, string> };

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const formatCurrency = (amount?: number) => currencyFormatter.format(Number(amount) || 0);
const isNonEmptyObject = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0);

/** Builds an exact persisted expense version. It deliberately never merges current expense data. */
export const createExpenseSnapshotFromLog = (log: FinanceHistoryLog): ExpenseHistoricalSnapshot => {
  const state = isNonEmptyObject(log.newState) ? log.newState : isNonEmptyObject(log.previousState) ? log.previousState : {};

  return {
    ...state,
    _isHistorical: true,
    _historyLogId: log.id,
    _historyAction: log.action,
    _historyChangedAt: log.changedAt,
    _historyActor: log.changedByName || log.changedBy,
    _historyActorRole: log.changedByRole,
    _historyPreviousState: log.previousState || {},
    _historyNewState: log.newState || {},
  };
};

/** Adds a clearly synthetic original only when legacy logs expose a usable oldest before-state. */
export const getExpenseHistoryEntries = (logs: FinanceHistoryLog[]) => {
  const sorted = logs.slice().sort((a, b) => new Date(b.changedAt || 0).getTime() - new Date(a.changedAt || 0).getTime());
  const mergedPaymentIds = new Set<string>();
  const grouped = sorted
    .map((entry) => {
      if (String(entry.action).toLowerCase() !== "create") return entry;
      const createdAt = new Date(entry.changedAt || 0).getTime();
      const entryActor = String(entry.changedBy || entry.changedByName || "");
      const initialPayment = sorted
        .filter((candidate) => String(candidate.action).toLowerCase() === "payment_create" && candidate.entityId === entry.entityId)
        .map((candidate) => ({
          candidate,
          distance: Math.abs(new Date(candidate.changedAt || 0).getTime() - createdAt),
        }))
        .filter(({ candidate, distance }) => {
          const candidateActor = String(candidate.changedBy || candidate.changedByName || "");
          const actorMatches = !entryActor || !candidateActor || entryActor === candidateActor;
          const explicitlyInitial = candidate.newState?.paymentOrigin === "initial_expense_creation";
          const startsFromUnpaid = Number(candidate.previousState?.totalPaid ?? candidate.previousState?.amount ?? 0) === 0;
          return actorMatches && (explicitlyInitial || (startsFromUnpaid && distance < 3_000));
        })
        .sort((a, b) => a.distance - b.distance)[0]?.candidate;

      if (!initialPayment) return entry;
      mergedPaymentIds.add(initialPayment.id);
      return {
        ...entry,
        context: "expense_creation_with_initial_payment",
        newState: { ...entry.newState, ...initialPayment.newState },
        amount: Number(initialPayment.newState?.paymentAmount ?? initialPayment.amount) || 0,
        summary: "Expense created",
        groupedInitialPayment: true,
      };
    })
    .filter((entry) => !mergedPaymentIds.has(entry.id));

  if (!grouped.length || grouped.some((log) => log.action.toLowerCase().includes("create"))) return grouped;

  const oldest = grouped[grouped.length - 1];
  if (!isNonEmptyObject(oldest.previousState)) return grouped;

  return [
    ...grouped,
    {
      id: `${oldest.id}-legacy-original`,
      entityType: "expense",
      entityId: oldest.entityId,
      action: "create",
      previousState: {},
      newState: oldest.previousState,
      changedAt: String(oldest.previousState.createdAt || oldest.changedAt || ""),
      summary: "Original expense (reconstructed from the oldest stored version)",
      synthetic: true,
    },
  ];
};

const FIELD_ORDER: Record<FinanceHistoryEntityType, string[]> = {
  expense: ["date", "category", "description", "price", "amount", "totalPaid", "balance", "vendor", "paymentId", "paymentAmount", "paymentMethod", "paymentDate", "paymentReference", "paymentNotes", "paymentState", "status", "recurring", "inventoryItemId", "inventoryQuantity", "deleted", "deletedAt"],
  inventory: ["item", "quantity", "unit", "costPerUnit", "totalValue", "supplier", "lastOrdered"],
  payroll: ["name", "staffName", "role", "type", "baseSalary", "staffBaseSalary", "amount", "bonus", "managedAdjustment", "total", "date", "paymentDate", "status", "month", "notes", "repaymentSchedule"],
};

const FIELD_LABELS: Record<string, string> = {
  item: "Item name",
  costPerUnit: "Unit cost",
  totalValue: "Total value",
  lastOrdered: "Last ordered",
  price: "Total price",
  amount: "Amount paid",
  totalPaid: "Total paid",
  balance: "Balance",
  paymentId: "Payment record",
  paymentAmount: "Selected payment",
  paymentMethod: "Payment method",
  paymentDate: "Payment date",
  paymentReference: "Payment reference",
  paymentNotes: "Payment notes",
  paymentState: "Payment state",
  inventoryItemId: "Linked stock item",
  inventoryQuantity: "Linked stock quantity",
  baseSalary: "Base salary",
  staffBaseSalary: "Staff base salary",
  managedAdjustment: "Managed adjustment",
  staffName: "Staff member",
  repaymentSchedule: "Repayment schedule",
  deletedAt: "Deleted at",
  deleted: "Deleted state",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  pay: "Paid",
  payment_create: "Payment recorded",
  payment_update: "Payment updated",
  payment_delete: "Payment deleted",
  payment_restore: "Payment restored",
  process: "Processed",
  bonus: "Bonus updated",
  configure: "Configured",
  delete: "Deleted",
  restore: "Restored",
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
const hasMeaningfulValue = (value: any) => value !== null && value !== undefined && (typeof value !== "string" || value.trim().length > 0);
const comparableValue = (value: any) => (typeof value === "number" ? Number(value).toFixed(4) : JSON.stringify(value ?? ""));
const valuesChanged = (before: any, after: any) => comparableValue(before) !== comparableValue(after);

const formatHistoryDate = (value: any, includeTime = false) => {
  const raw = String(value || "");
  if (!raw) return "Not set";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(date.getTime())) return raw;
  return includeTime
    ? date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : date.toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
};

export const formatFinanceHistoryValue = (entityType: FinanceHistoryEntityType, key: string, value: any, state?: Record<string, any>, options?: FinanceHistoryFormatOptions) => {
  if (!hasMeaningfulValue(value)) return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (entityType === "expense" && key === "deletedAt") return formatHistoryDate(value, true);
  if (entityType === "expense" && ["date", "paymentDate"].includes(key)) return formatHistoryDate(value);
  if (["price", "amount", "totalPaid", "balance", "paymentAmount", "baseSalary", "staffBaseSalary", "bonus", "managedAdjustment", "total", "costPerUnit", "totalValue"].includes(key)) return formatCurrency(Number(value));
  if (entityType === "expense" && key === "category") return formatOptionLabel(String(value), EXPENSE_CATEGORY_OPTIONS);
  if (entityType === "expense" && key === "status") return formatOptionLabel(String(value), EXPENSE_STATUS_OPTIONS);
  if (key === "paymentMethod") return formatOptionLabel(String(value), PAYMENT_METHOD_OPTIONS);
  if (entityType === "expense" && key === "inventoryItemId") return options?.inventoryNames?.[String(value)] || "Linked inventory item";
  if (entityType === "inventory" && key === "quantity") return `${Number(value) || 0}${state?.unit ? ` ${state.unit}` : ""}`;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export const getFinanceHistoryChanges = (entityType: FinanceHistoryEntityType, log: FinanceHistoryLog, options?: FinanceHistoryFormatOptions): FinanceHistoryChange[] => {
  const previous = log.previousState || {};
  const next = log.newState || {};
  const hidden = new Set(["id", "entityId", "salaryRecordId", "createdAt", "updatedAt", "paymentOrigin"]);
  if (entityType !== "expense") {
    hidden.add("deleted");
    hidden.add("deletedAt");
  }
  const keys = Array.from(new Set([...FIELD_ORDER[entityType], ...Object.keys(previous), ...Object.keys(next)]));
  const creation = log.action.includes("create") || Object.keys(previous).length === 0;
  return keys
    .filter((key) => !hidden.has(key) && (creation ? hasMeaningfulValue(next[key]) : valuesChanged(previous[key], next[key])))
    .map((key) => ({
      key,
      label: formatLabel(key),
      before: creation ? "Not set" : formatFinanceHistoryValue(entityType, key, previous[key], previous, options),
      after: formatFinanceHistoryValue(entityType, key, next[key], next, options),
    }));
};

const formatTimestamp = (value?: string) => {
  if (!value) return "Unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};
const getActionLabel = (action: string) => ACTION_LABELS[action] || formatLabel(action);
const getActionBadgeClass = (action: string) => (action.includes("delete") ? "border-red-200 bg-red-50 text-red-700" : action.includes("restore") || ["pay", "process"].includes(action) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : action.includes("create") ? "border-violet-200 bg-violet-50 text-violet-700" : "border-amber-200 bg-amber-50 text-amber-700");
const getEntityLabel = (entityType: FinanceHistoryEntityType) => (entityType === "expense" ? "Expense" : entityType === "inventory" ? "Inventory" : "Payroll");

/** Expense history is intentionally summary-only; field-level changes belong to the snapshot view. */
const getExpenseHistorySummary = (log: FinanceHistoryLog) => {
  const explicitSummary = String(log.summary || "").trim();
  if (explicitSummary) return explicitSummary;

  const action = String(log.action || "")
    .trim()
    .toLowerCase();
  if (action === "payment_create") return "Payment recorded";
  if (action === "payment_update") return "Payment updated";
  if (action === "payment_delete") return "Payment deleted";
  if (action === "payment_restore") return "Payment restored";
  if (action.includes("create")) return "Expense created";
  if (action.includes("update")) return "Expense updated";
  if (action.includes("pay")) return "Expense paid";
  if (action.includes("delete")) return "Expense deleted";
  if (action.includes("restore")) return "Expense restored";

  const actionLabel = getActionLabel(action || "updated");
  return `Expense ${actionLabel.toLowerCase()}`;
};

export function FinanceHistoryDialog({ open, onOpenChange, entityType, title, description, logs, isLoading = false, error, onViewExpenseSnapshot }: FinanceHistoryDialogProps) {
  const sortedLogs = entityType === "expense" ? getExpenseHistoryEntries(logs) : logs.slice().sort((a, b) => new Date(b.changedAt || 0).getTime() - new Date(a.changedAt || 0).getTime());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="!fixed !bottom-0 !left-0 !top-auto !flex max-h-[82dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.25rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[88dvh] sm:w-[min(38rem,calc(100vw-2rem))] sm:max-w-xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.5rem] sm:border">
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-slate-50 px-4 pb-3 pt-2.5 text-left sm:p-6">
          <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-100 sm:h-12 sm:w-12 sm:rounded-2xl">
                <History className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-black text-slate-950">{title}</DialogTitle>
                <DialogDescription className="line-clamp-1 text-xs font-semibold text-slate-500 sm:text-sm">{description}</DialogDescription>
              </div>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/70 hover:text-slate-900" aria-label={`Close ${title.toLowerCase()}`}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-white p-3 sleek-scrollbar sm:space-y-3 sm:p-6 sm:pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-8 text-sm font-bold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
              <TriangleAlert className="mx-auto h-5 w-5 text-red-600" />
              <p className="mt-2 text-sm font-black text-red-900">History could not be loaded</p>
              <p className="mt-1 text-xs font-semibold text-red-700">{error}</p>
            </div>
          ) : sortedLogs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50 p-8 text-center">
              <p className="text-sm font-black text-slate-900">No history yet</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">Changes will appear here after this {getEntityLabel(entityType).toLowerCase()} record is updated.</p>
            </div>
          ) : (
            sortedLogs.map((log, index) => {
              const actor = log.changedByName || log.changedBy;
              const isPaymentEvent = String(log.action).toLowerCase().startsWith("payment_") || log.groupedInitialPayment;
              const rawAmount = isPaymentEvent ? (log.newState?.paymentAmount ?? log.previousState?.paymentAmount ?? log.amount) : undefined;
              const amount = Number(rawAmount);
              const hasAmount = entityType === "expense" && rawAmount !== undefined && rawAmount !== null && Number.isFinite(amount);

              if (entityType === "expense") {
                return (
                  <article key={log.id || `${log.action}-${log.changedAt}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate text-sm font-black text-slate-950">{getExpenseHistorySummary(log)}</p>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-tight ${getActionBadgeClass(log.action)}`}>{getActionLabel(log.action)}</span>
                          {log.groupedInitialPayment ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-tight text-emerald-700">Payment recorded</span> : null}
                          {hasAmount ? (
                            <span className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[10px] font-black text-emerald-700">
                              <CurrencyText value={formatCurrency(amount)} />
                            </span>
                          ) : null}
                        </div>
                        {log.groupedInitialPayment ? (
                          <p className="mt-2 text-xs font-bold text-slate-600">
                            Initial payment · {formatOptionLabel(String(log.newState?.paymentMethod || "cash"), PAYMENT_METHOD_OPTIONS)} · {formatHistoryDate(log.newState?.paymentDate)}
                          </p>
                        ) : null}
                        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(log.changedAt)}</span>
                          {actor ? (
                            <span>
                              — {actor}
                              {log.changedByRole ? ` · ${log.changedByRole}` : ""}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      {onViewExpenseSnapshot ? (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChange(false);
                            onViewExpenseSnapshot(createExpenseSnapshotFromLog(log), log);
                          }}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-slate-400 hover:border-violet-100 hover:bg-white hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                          title="View this exact expense snapshot"
                          aria-label="View this exact expense snapshot"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              }

              const changes = getFinanceHistoryChanges(entityType, log);
              return (
                <article key={log.id || `${log.action}-${log.changedAt}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 truncate text-sm font-black text-slate-950">{log.summary || `${getEntityLabel(entityType)} ${getActionLabel(log.action).toLowerCase()}`}</p>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-tight ${getActionBadgeClass(log.action)}`}>{getActionLabel(log.action)}</span>
                      </div>
                      {log.synthetic ? <p className="mt-1 text-xs font-semibold text-amber-700">Legacy reconstruction from the oldest stored before-state.</p> : null}
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span>{formatTimestamp(log.changedAt)}</span>
                        {actor ? (
                          <span>
                            — {actor}
                            {log.changedByRole ? ` · ${log.changedByRole}` : ""}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {changes.length === 0 ? (
                    <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-500">No field-level differences were stored for this log.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {changes.map((change) => (
                        <div key={`${log.id}-${change.key}`} className="rounded-xl bg-white px-3 py-2">
                          <div className="text-xs font-black text-slate-900">{change.label}</div>
                          <div className="mt-1 grid gap-1 text-xs font-semibold text-slate-500 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                            <span className="min-w-0 break-words">
                              <span className="mr-1 text-[9px] font-black uppercase tracking-wider text-slate-400 sm:hidden">Before</span>
                              {change.before}
                            </span>
                            <span className="hidden text-slate-300 sm:block">→</span>
                            <span className="min-w-0 break-words text-slate-700">
                              <span className="mr-1 text-[9px] font-black uppercase tracking-wider text-violet-600 sm:hidden">After</span>
                              {change.after}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
