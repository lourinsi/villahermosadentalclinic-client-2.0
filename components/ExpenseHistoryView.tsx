"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, History, Landmark, Link2, Pencil, ReceiptText, RotateCcw, UserRound, WalletCards, X } from "lucide-react";
import { CurrencyText } from "./CurrencyAmount";
import { FinanceHistoryDialog, getFinanceHistoryChanges, type ExpenseHistoricalSnapshot, type FinanceHistoryLog } from "./FinanceHistoryDialog";
import { EXPENSE_CATEGORY_OPTIONS, EXPENSE_STATUS_OPTIONS, PAYMENT_METHOD_OPTIONS, formatOptionLabel } from "./financeModalOptions";
import { CurrentChangeIndicator, DetailedAuditHistory, createCurrentFieldChange, type CurrentFieldChange } from "./HistorySnapshotUI";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

export type ExpenseSnapshot = Record<string, any> & {
  id?: string; date?: string; category?: string; description?: string; amount?: number; vendor?: string;
  paymentMethod?: string; paymentDate?: string; status?: string; recurring?: boolean; createdAt?: string;
  updatedAt?: string; deleted?: boolean; deletedAt?: string; inventoryItemId?: string; inventoryQuantity?: number;
};
type InventoryOption = { id: string; item: string; unit?: string };
type ExpenseHistoryViewProps = { open: boolean; onOpenChange: (open: boolean) => void; currentExpense: ExpenseSnapshot | null; historyLogs: FinanceHistoryLog[]; isHistoryLoading?: boolean; historyError?: string | null; inventoryItems?: InventoryOption[]; onEdit?: (expense: ExpenseSnapshot) => void };

const pesoFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatTimestamp = (value?: unknown, fallback = "Not set") => {
  if (!value) return fallback;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
const formatDate = (value?: unknown) => {
  if (!value) return "Not set";
  const raw = String(value); const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
};
const hasOwnValue = (record: ExpenseSnapshot | null, key: string) => Boolean(record && Object.prototype.hasOwnProperty.call(record, key) && record[key] !== null && record[key] !== undefined);
const normalizeText = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const normalizeNumber = (value: unknown) => Number.isFinite(Number(value)) ? String(Number(value)) : normalizeText(value);
const normalizeDate = (value: unknown) => value ? String(value).slice(0, 10) : "";
const stateBadgeClass = (historical: boolean, deleted: boolean, status?: string) => historical ? "border-amber-200 bg-amber-50 text-amber-700" : deleted ? "border-red-200 bg-red-50 text-red-700" : String(status).toLowerCase() === "paid" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-violet-200 bg-violet-50 text-violet-700";

const PreviousLabel = ({ value }: { value?: string }) => value ? <p className="mt-1 flex items-center gap-1 truncate text-[10px] font-bold text-slate-400 sm:text-[11px]"><History className="h-3 w-3 shrink-0" />Was {value}</p> : null;
const SummaryBadge = ({ value, previous, currentChange, className = "bg-white/10 text-white" }: { value: string; previous?: string; currentChange?: CurrentFieldChange | null; className?: string }) => <div className="min-w-0"><div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black ${className}`}><span className="truncate">{value}</span><CurrentChangeIndicator change={currentChange} /></div><PreviousLabel value={previous} /></div>;
const Detail = ({ label, value, icon: Icon, previous, currentChange }: { label: string; value: React.ReactNode; icon?: React.ElementType; previous?: string; currentChange?: CurrentFieldChange | null }) => (
  <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3">
    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{Icon ? <Icon className="h-3.5 w-3.5" /> : null}{label}</div>
    <div className="mt-1.5 flex min-w-0 items-center gap-2"><div className="min-w-0 break-words text-sm font-bold text-slate-800">{value ?? "Not set"}</div><CurrentChangeIndicator change={currentChange} /></div>
    <PreviousLabel value={previous} />
  </div>
);

export default function ExpenseHistoryView({ open, onOpenChange, currentExpense, historyLogs, isHistoryLoading = false, historyError, inventoryItems = [], onEdit }: ExpenseHistoryViewProps) {
  const [displayedSnapshot, setDisplayedSnapshot] = useState<ExpenseSnapshot | null>(currentExpense);
  const [backStack, setBackStack] = useState<ExpenseSnapshot[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState(false);

  useEffect(() => { if (!open) { setHistoryOpen(false); setBackStack([]); return; } setDisplayedSnapshot(currentExpense); setBackStack([]); }, [open, currentExpense?.id]);
  useEffect(() => { if (open && currentExpense && !displayedSnapshot?._isHistorical) setDisplayedSnapshot(currentExpense); }, [currentExpense, displayedSnapshot?._isHistorical, open]);
  useEffect(() => setAuditExpanded(false), [displayedSnapshot?._historyLogId]);

  const isHistorical = Boolean(displayedSnapshot?._isHistorical);
  const historyLog = useMemo(() => isHistorical ? historyLogs.find((log) => log.id === displayedSnapshot?._historyLogId) : undefined, [displayedSnapshot?._historyLogId, historyLogs, isHistorical]);
  const inventoryNames = useMemo(() => Object.fromEntries(inventoryItems.map((item) => [String(item.id), item.item])), [inventoryItems]);
  const changes = historyLog ? getFinanceHistoryChanges("expense", historyLog, { inventoryNames }) : [];
  const changeByKey = new Map(changes.map((change) => [change.key, change]));
  const inventory = inventoryItems.find((item) => String(item.id) === String(displayedSnapshot?.inventoryItemId || ""));
  const currentInventory = inventoryItems.find((item) => String(item.id) === String(currentExpense?.inventoryItemId || ""));
  const actor = displayedSnapshot?._historyActor; const actorRole = displayedSnapshot?._historyActorRole;
  const savedAt = isHistorical ? displayedSnapshot?._historyChangedAt : displayedSnapshot?.updatedAt || displayedSnapshot?.createdAt;
  const labelFor = (record: ExpenseSnapshot | null, key: string) => {
    if (!record) return "Not set";
    if (key === "amount") return hasOwnValue(record, key) ? pesoFormatter.format(Number(record.amount) || 0) : "Not set";
    if (key === "date" || key === "paymentDate") return formatDate(record[key]);
    if (key === "category") return record.category ? formatOptionLabel(record.category, EXPENSE_CATEGORY_OPTIONS) : "Not set";
    if (key === "status") return record.deleted ? "Deleted" : record.status ? formatOptionLabel(record.status, EXPENSE_STATUS_OPTIONS) : "Not set";
    if (key === "paymentMethod") return record.paymentMethod ? formatOptionLabel(record.paymentMethod, PAYMENT_METHOD_OPTIONS) : "Not set";
    if (key === "recurring") return hasOwnValue(record, key) ? record.recurring ? "Yes" : "No" : "Not set";
    if (key === "inventoryItemId") return record.inventoryItemId ? inventoryNames[String(record.inventoryItemId)] || "Linked inventory item" : "Not set";
    if (key === "inventoryQuantity") return record.inventoryItemId ? `${Number(record.inventoryQuantity) || 0}${(record === currentExpense ? currentInventory : inventory)?.unit ? ` ${(record === currentExpense ? currentInventory : inventory)?.unit}` : ""}` : "Not set";
    return String(record[key] ?? "").trim() || "Not set";
  };
  const fieldNames: Record<string, string> = { status: "payment status", paymentMethod: "payment method", date: "expense date", paymentDate: "payment date", recurring: "recurring status", inventoryItemId: "linked inventory", inventoryQuantity: "inventory quantity" };
  const warningFor = (key: string, normalizer = normalizeText) => {
    if (!isHistorical || !currentExpense) return null;
    const snapshotValue = key === "status" ? `${displayedSnapshot?.status || ""}|${Boolean(displayedSnapshot?.deleted)}` : displayedSnapshot?.[key];
    const currentValue = key === "status" ? `${currentExpense.status || ""}|${Boolean(currentExpense.deleted)}` : currentExpense[key];
    return createCurrentFieldChange(fieldNames[key] || key.replace(/([A-Z])/g, " $1").toLowerCase(), snapshotValue, currentValue, labelFor(displayedSnapshot, key), labelFor(currentExpense, key), normalizer);
  };
  const previousFor = (key: string) => {
    if (!isHistorical) return undefined;
    const value = changeByKey.get(key)?.before;
    if (key === "recurring") return value === "Yes" ? "Recurring" : value === "No" ? "One-time" : value;
    return value;
  };
  const statusLabel = labelFor(displayedSnapshot, "status"); const amountLabel = labelFor(displayedSnapshot, "amount");

  const showHistoricalSnapshot = (snapshot: ExpenseHistoricalSnapshot) => { if (displayedSnapshot) setBackStack((stack) => [...stack.slice(-4), displayedSnapshot]); setDisplayedSnapshot(snapshot); };
  const goBack = () => setBackStack((stack) => { const prior = stack[stack.length - 1]; if (prior) setDisplayedSnapshot(prior); return stack.slice(0, -1); });
  const showLatest = () => { if (displayedSnapshot && currentExpense && displayedSnapshot !== currentExpense) setBackStack((stack) => [...stack.slice(-4), displayedSnapshot]); setDisplayedSnapshot(currentExpense); };
  if (!displayedSnapshot) return null;

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="!fixed !bottom-0 !left-0 !top-auto !flex h-auto max-h-[92dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[90vh] sm:w-[min(52rem,calc(100vw-2rem))] sm:max-w-[52rem] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-2xl sm:border sm:border-slate-200">
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-4 pb-4 pt-3 text-left shadow-sm sm:px-6 sm:py-5"><div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100"><ReceiptText className="h-5 w-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><DialogTitle className="text-xl font-black tracking-tight text-slate-950">Expense Snapshot</DialogTitle><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${stateBadgeClass(isHistorical, Boolean(displayedSnapshot.deleted), displayedSnapshot.status)}`}>{isHistorical ? "LOG" : "CURRENT"}</span></div><DialogDescription className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500 sm:text-sm">Saved {formatTimestamp(savedAt)}{actor ? ` by ${actor}${actorRole ? ` · ${actorRole}` : ""}` : ""}</DialogDescription></div></div>
            <div className="flex shrink-0 items-center gap-0.5">{backStack.length ? <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={goBack} title="Back to previous snapshot"><ArrowLeft className="h-4 w-4" /></Button> : null}<Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full text-violet-600" onClick={() => setHistoryOpen(true)} title="View expense history"><History className="h-4 w-4" />{historyLogs.length ? <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[8px] font-black text-white">{historyLogs.length}</span> : null}</Button>{isHistorical ? <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs font-black text-violet-700" onClick={showLatest}><RotateCcw className="h-3.5 w-3.5" />Latest</Button> : null}{!isHistorical && !displayedSnapshot.deleted && onEdit ? <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => onEdit(currentExpense || displayedSnapshot)} title="Edit current expense"><Pencil className="h-4 w-4" /></Button> : null}<Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => onOpenChange(false)} title="Close snapshot"><X className="h-5 w-5" /></Button></div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-4 py-5 sleek-scrollbar sm:px-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm"><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Saved expense amount</p><div className="mt-1 flex items-center gap-2"><CurrencyText value={amountLabel} className="block text-3xl font-black tracking-tight text-red-300 sm:text-4xl" /><CurrentChangeIndicator change={warningFor("amount", normalizeNumber)} /></div><PreviousLabel value={previousFor("amount")} /></div><div className="flex flex-wrap items-start gap-2"><SummaryBadge value={labelFor(displayedSnapshot, "category")} previous={previousFor("category")} currentChange={warningFor("category")} /><SummaryBadge value={statusLabel} previous={previousFor("status")} currentChange={warningFor("status")} className={displayedSnapshot.deleted ? "bg-red-500/20 text-red-200" : String(displayedSnapshot.status).toLowerCase() === "paid" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"} /><SummaryBadge value={labelFor(displayedSnapshot, "paymentMethod")} previous={previousFor("paymentMethod")} currentChange={warningFor("paymentMethod")} /><SummaryBadge value={displayedSnapshot.recurring ? "Recurring" : "One-time"} previous={previousFor("recurring")} currentChange={warningFor("recurring")} /></div></div><div className="border-t border-white/10 bg-white/[0.04] px-5 py-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Description</p><div className="mt-1 flex items-start gap-2"><p className="text-base font-bold leading-6 text-white">{labelFor(displayedSnapshot, "description")}</p><CurrentChangeIndicator change={warningFor("description")} /></div><PreviousLabel value={previousFor("description")} /></div></section>
          <section><h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Expense record</h3><div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Expense date" value={labelFor(displayedSnapshot, "date")} icon={CalendarDays} previous={previousFor("date")} currentChange={warningFor("date", normalizeDate)} />
            <Detail label="Vendor / Supplier" value={labelFor(displayedSnapshot, "vendor")} icon={UserRound} previous={previousFor("vendor")} currentChange={warningFor("vendor")} />
            <Detail label="Payment date" value={labelFor(displayedSnapshot, "paymentDate")} icon={Landmark} previous={previousFor("paymentDate")} currentChange={warningFor("paymentDate", normalizeDate)} />
            <Detail label="Linked inventory" value={labelFor(displayedSnapshot, "inventoryItemId")} icon={Link2} previous={previousFor("inventoryItemId")} currentChange={warningFor("inventoryItemId")} />
            {displayedSnapshot.inventoryItemId ? <Detail label="Inventory quantity" value={labelFor(displayedSnapshot, "inventoryQuantity")} icon={Link2} previous={previousFor("inventoryQuantity")} currentChange={warningFor("inventoryQuantity", normalizeNumber)} /> : null}
          </div></section>
          {isHistorical ? <DetailedAuditHistory changes={changes.map((change) => ({ field: change.label, previousValue: change.before, snapshotValue: change.after }))} expanded={auditExpanded} onExpandedChange={setAuditExpanded} id="expense-detailed-audit-history" /> : null}
        </div>
        <DialogFooter className="shrink-0 border-t border-slate-100 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgba(15,23,42,0.06)] sm:px-6 sm:pb-4 sm:shadow-none"><Button variant="outline" className="h-11 w-full rounded-xl font-bold sm:w-auto" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <FinanceHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} entityType="expense" title="Expense History" description={`Complete saved history${currentExpense?.description ? ` for ${currentExpense.description}` : ""}`} logs={historyLogs} isLoading={isHistoryLoading} error={historyError} onViewExpenseSnapshot={(snapshot) => showHistoricalSnapshot(snapshot)} />
  </>;
}
