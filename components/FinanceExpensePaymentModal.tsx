"use client";

import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { PAYMENT_METHOD_OPTIONS } from "./financeModalOptions";

type PayableExpense = {
  id: string;
  description: string;
  vendor?: string;
  amount: number;
  paymentMethod?: string;
};

type FinanceExpensePaymentModalProps = {
  expense: PayableExpense | null;
  paymentMethod: string;
  isSaving: boolean;
  formatCurrency: (amount?: number) => string;
  onOpenChange: (open: boolean) => void;
  onPaymentMethodChange: (method: string) => void;
  onConfirm: () => void;
};

export function FinanceExpensePaymentModal({
  expense,
  paymentMethod,
  isSaving,
  formatCurrency,
  onOpenChange,
  onPaymentMethodChange,
  onConfirm,
}: FinanceExpensePaymentModalProps) {
  return (
    <Dialog open={Boolean(expense)} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-md">
        <div className="border-b bg-gray-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle>Pay Expense</DialogTitle>
            <DialogDescription>Mark this clinic expense as paid.</DialogDescription>
          </DialogHeader>
        </div>

        {expense ? (
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-md border bg-white p-4">
              <div className="font-medium text-gray-900">{expense.description}</div>
              <div className="mt-1 text-sm text-muted-foreground">{expense.vendor || "No vendor recorded"}</div>
              <div className="mt-3 text-2xl font-bold">{formatCurrency(expense.amount)}</div>
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
          <Button onClick={onConfirm} disabled={isSaving}>
            {isSaving ? "Paying..." : "Confirm Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
