"use client";

import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { PAYMENT_METHOD_OPTIONS } from "./financeModalOptions";

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
};

type FinanceExpensePaymentModalProps = {
  expense: PayableExpense | null;
  paymentMethod: string;
  paymentAmount: number;
  paymentDate: string;
  isSaving: boolean;
  formatCurrency: (amount?: number) => string;
  onOpenChange: (open: boolean) => void;
  onPaymentMethodChange: (method: string) => void;
  onPaymentAmountChange: (amount: number) => void;
  onPaymentDateChange: (date: string) => void;
  onConfirm: () => void;
};

export function FinanceExpensePaymentModal({
  expense,
  paymentMethod,
  paymentAmount,
  paymentDate,
  isSaving,
  formatCurrency,
  onOpenChange,
  onPaymentMethodChange,
  onPaymentAmountChange,
  onPaymentDateChange,
  onConfirm,
}: FinanceExpensePaymentModalProps) {
  const totalPrice = Number(expense?.price ?? expense?.amount) || 0;
  const totalPaid = Number(expense?.totalPaid ?? (expense && ["paid", "partial", "overpaid"].includes(String(expense.status || "").toLowerCase()) ? expense.amount : 0)) || 0;
  const balance = Number(expense?.balance ?? (totalPrice - totalPaid)) || 0;
  return (
    <Dialog open={Boolean(expense)} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-md">
        <div className="border-b bg-gray-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle>Pay Expense</DialogTitle>
            <DialogDescription>Record a payment against this clinic expense.</DialogDescription>
          </DialogHeader>
        </div>

        {expense ? (
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-md border bg-white p-4">
              <div className="font-medium text-gray-900">{expense.description}</div>
              <div className="mt-1 text-sm text-muted-foreground">{expense.vendor || "No vendor recorded"}</div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Total price</p><p className="mt-1 font-bold">{formatCurrency(totalPrice)}</p></div>
                <div><p className="text-xs text-muted-foreground">Paid</p><p className="mt-1 font-bold text-emerald-700">{formatCurrency(totalPaid)}</p></div>
                <div><p className="text-xs text-muted-foreground">Balance</p><p className="mt-1 font-bold text-amber-700">{formatCurrency(balance)}</p></div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-payment-amount">Payment Now</Label>
              <Input id="expense-payment-amount" type="number" min="0.01" value={paymentAmount} onChange={(event) => onPaymentAmountChange(Number(event.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-pay-date">Payment Date</Label>
              <Input id="expense-pay-date" type="date" value={paymentDate} onChange={(event) => onPaymentDateChange(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-pay-method">Paid With</Label>
              <Select value={paymentMethod} onValueChange={onPaymentMethodChange}>
                <SelectTrigger id="expense-pay-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isSaving || paymentAmount <= 0 || balance <= 0}>
            {isSaving ? "Paying..." : "Confirm Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
