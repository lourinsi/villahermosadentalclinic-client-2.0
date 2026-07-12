"use client";

import { Banknote, CalendarDays, Check, CircleDollarSign, CreditCard, Landmark, ReceiptText, WalletCards, X } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { PAYMENT_METHOD_OPTIONS } from "./financeModalOptions";
import { cn } from "@/lib/utils";

type PayableExpense = {
  id: string;
  description: string;
  vendor?: string;
  amount: number;
  price?: number;
  totalPaid?: number;
  balance?: number;
  status?: string;
  paymentMethod?: string;
  date?: string;
};

export type ExpensePayment = {
  id: string;
  expenseId: string;
  amount: number;
  method: string;
  date?: string;
  paymentDate?: string;
  transactionId?: string;
  notes?: string;
  deleted?: boolean;
  deletedAt?: string | null;
  legacy?: boolean;
  createdAt?: string;
  updatedAt?: string;
  changedByName?: string;
  logs?: Array<{
    id: string;
    changeType: string;
    previousState?: Record<string, any>;
    newState?: Record<string, any>;
    changedAt?: string;
  }>;
};

type FinanceExpensePaymentModalProps = {
  expense: PayableExpense | null;
  paymentMethod: string;
  paymentAmount: number;
  paymentDate: string;
  mode?: "create" | "edit";
  payment?: ExpensePayment | null;
  transactionId?: string;
  notes?: string;
  isSaving: boolean;
  formatCurrency: (amount?: number) => string;
  onOpenChange: (open: boolean) => void;
  onPaymentMethodChange: (method: string) => void;
  onPaymentAmountChange: (amount: number) => void;
  onPaymentDateChange: (date: string) => void;
  onTransactionIdChange?: (value: string) => void;
  onNotesChange?: (value: string) => void;
  onConfirm: () => void;
};

export function FinanceExpensePaymentModal({
  expense,
  paymentMethod,
  paymentAmount,
  paymentDate,
  mode = "create",
  payment,
  transactionId = "",
  notes = "",
  isSaving,
  formatCurrency,
  onOpenChange,
  onPaymentMethodChange,
  onPaymentAmountChange,
  onPaymentDateChange,
  onTransactionIdChange,
  onNotesChange,
  onConfirm,
}: FinanceExpensePaymentModalProps) {
  const totalPrice = Number(expense?.price ?? expense?.amount) || 0;
  const totalPaid = Number(expense?.totalPaid ?? (expense && ["paid", "partial", "overpaid"].includes(String(expense.status || "").toLowerCase()) ? expense.amount : 0)) || 0;
  const balance = Math.max(0, Number(expense?.balance ?? (totalPrice - totalPaid)) || 0);
  const originalAmount = mode === "edit" ? Number(payment?.amount) || 0 : 0;
  const projectedPaid = Math.max(0, totalPaid - originalAmount + (Number(paymentAmount) || 0));
  const remainingAfterPayment = Math.max(0, totalPrice - projectedPaid);
  const methodIcon = (method: string) => {
    const value = method.toLowerCase();
    if (value.includes("cash")) return <Banknote className="h-4 w-4 text-emerald-600" />;
    if (value.includes("bank") || value.includes("transfer")) return <Landmark className="h-4 w-4 text-blue-600" />;
    if (value.includes("check")) return <ReceiptText className="h-4 w-4 text-amber-600" />;
    if (value.includes("insurance")) return <CircleDollarSign className="h-4 w-4 text-teal-600" />;
    return <CreditCard className="h-4 w-4 text-violet-600" />;
  };

  return (
    <Dialog open={Boolean(expense)} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!fixed !bottom-0 !left-0 !top-auto !flex h-auto max-h-[88dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[calc(100dvh-2rem)] sm:w-[min(52rem,calc(100vw-2rem))] sm:max-w-3xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.75rem] sm:border sm:border-slate-200"
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-3 text-left shadow-sm sm:px-7 sm:py-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><WalletCards className="h-5 w-5" /></div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-black tracking-tight text-slate-950">{mode === "edit" ? "Edit Expense Payment" : "Add Expense Payment"}</DialogTitle>
                <DialogDescription className="mt-0.5 text-sm font-medium text-slate-500">{mode === "edit" ? "Update only this payment record." : "Record a new payment against this clinic expense."}</DialogDescription>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full text-slate-500 hover:bg-slate-100" onClick={() => onOpenChange(false)} aria-label="Close payment modal"><X className="h-5 w-5" /></Button>
          </div>
        </DialogHeader>

        {expense ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5 custom-scrollbar sm:px-7 sm:py-7">
            <div className="mx-auto max-w-2xl space-y-6">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100"><ReceiptText className="h-6 w-6" /></div>
                    <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Paying this expense</p><p className="truncate text-xl font-black tracking-tight text-slate-950">{expense.description}</p><p className="mt-0.5 text-sm font-semibold text-slate-500">{expense.vendor || "No vendor recorded"}</p></div>
                  </div>
                  <div className="rounded-2xl bg-blue-50 px-4 py-3 sm:min-w-40"><p className="flex items-center gap-1.5 text-xs font-black text-blue-600"><CalendarDays className="h-3.5 w-3.5" /> Expense date</p><p className="mt-1 text-sm font-black text-slate-900">{expense.date || "Not recorded"}</p></div>
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="text-xl font-black tracking-tight text-slate-950">Bill Summary</h3>
                <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">Total Price</dt><dd className="mt-2 text-xl font-black text-slate-950">{formatCurrency(totalPrice)}</dd></div>
                  <div className="rounded-2xl bg-emerald-50 p-4"><dt className="text-xs font-black uppercase tracking-wide text-emerald-700">Total Paid</dt><dd className="mt-2 text-xl font-black text-emerald-600">{formatCurrency(totalPaid)}</dd></div>
                  <div className="rounded-2xl bg-blue-50 p-4"><dt className="text-xs font-black uppercase tracking-wide text-blue-700">Balance Due</dt><dd className="mt-2 text-xl font-black text-blue-700">{formatCurrency(balance)}</dd></div>
                </dl>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="text-xl font-black tracking-tight text-slate-950">Payment Details</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">Enter the amount, date, and method for this payment.</p>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="expense-payment-amount" className="text-xs font-black uppercase tracking-widest text-slate-500">Amount to Pay</Label><div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-700">{"\u20b1"}</span><Input id="expense-payment-amount" type="number" min="0.01" value={paymentAmount} onChange={(event) => onPaymentAmountChange(Number(event.target.value))} className="h-16 rounded-2xl border-slate-200 bg-white pl-9 pr-24 text-2xl font-black shadow-sm focus-visible:ring-blue-500" /><Button type="button" variant="ghost" onClick={() => onPaymentAmountChange(mode === "edit" ? balance + originalAmount : balance)} disabled={balance <= 0 && mode !== "edit"} className="absolute right-1.5 top-1/2 h-11 -translate-y-1/2 rounded-xl px-3 text-xs font-black uppercase tracking-wide text-blue-600 hover:bg-blue-50 hover:text-blue-700">Pay Full</Button></div><p className="text-xs font-bold text-slate-500">Remaining after payment: <span className={remainingAfterPayment > 0 ? "text-amber-600" : "text-emerald-600"}>{formatCurrency(remainingAfterPayment)}</span></p></div>
                  <div className="space-y-2"><Label htmlFor="expense-pay-date" className="text-xs font-black uppercase tracking-widest text-slate-500">Payment Date</Label><div className="relative"><Input id="expense-pay-date" type="date" value={paymentDate} onChange={(event) => onPaymentDateChange(event.target.value)} className="h-16 rounded-2xl border-slate-200 bg-white px-4 pr-12 text-lg font-black shadow-sm focus-visible:ring-blue-500" /><CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-700" /></div></div>
                </div>
                <div className="mt-5 space-y-2"><Label className="text-xs font-black uppercase tracking-widest text-slate-500">Payment Method</Label><div className="grid gap-3 sm:grid-cols-3">{PAYMENT_METHOD_OPTIONS.map((option) => { const selected = paymentMethod === option.value; return <button key={option.value} type="button" onClick={() => onPaymentMethodChange(option.value)} className={cn("flex min-h-16 items-center justify-between rounded-2xl border px-4 text-left transition-colors", selected ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/40")} aria-pressed={selected}><span className="flex items-center gap-2 font-bold">{methodIcon(option.value)}{option.label}</span><span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300")}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span></button>; })}</div></div>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="expense-payment-reference" className="text-xs font-black uppercase tracking-widest text-slate-500">Reference ID (optional)</Label><Input id="expense-payment-reference" value={transactionId} onChange={(event) => onTransactionIdChange?.(event.target.value)} placeholder="Receipt, cheque, or transfer ID" className="h-12 rounded-xl border-slate-200" /></div>
                  <div className="space-y-2"><Label htmlFor="expense-payment-notes" className="text-xs font-black uppercase tracking-widest text-slate-500">Notes (optional)</Label><Textarea id="expense-payment-notes" value={notes} onChange={(event) => onNotesChange?.(event.target.value)} placeholder="Additional payment details" className="min-h-12 rounded-xl border-slate-200" /></div>
                </div>
              </section>
            </div>
          </div>
        ) : null}

        <DialogFooter className="shrink-0 !grid grid-cols-2 gap-3 border-t border-slate-100 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] sm:px-7 sm:pb-5">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-12 rounded-full font-bold">Cancel</Button>
          <Button onClick={onConfirm} disabled={isSaving || paymentAmount <= 0} className="h-12 rounded-full bg-blue-600 font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700"><CircleDollarSign className="mr-2 h-4 w-4" />{isSaving ? "Saving..." : mode === "edit" ? "Save Payment" : "Confirm Payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
