"use client";

import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { formatPayrollMonthLabel, normalizeFinanceValue } from "./financeModalOptions";

export type FinancePayrollModalMode = "pay" | "process";

type PayrollModalEntry = {
  id: string;
  name: string;
  role: string;
  baseSalary: number;
  bonus: number;
  total: number;
  status: string;
  salaryRecordId?: string;
  paymentDate?: string;
  month?: string;
};

type FinancePayrollModalProps = {
  open: boolean;
  mode: FinancePayrollModalMode;
  entry: PayrollModalEntry | null;
  payrollData: PayrollModalEntry[];
  selectedPayrollMonth: string;
  paymentDate: string;
  isSaving: boolean;
  formatCurrency: (amount?: number) => string;
  onOpenChange: (open: boolean) => void;
  onPaymentDateChange: (date: string) => void;
  onProcess: () => void;
  onPay: () => void;
};

export function FinancePayrollModal({
  open,
  mode,
  entry,
  payrollData,
  selectedPayrollMonth,
  paymentDate,
  isSaving,
  formatCurrency,
  onOpenChange,
  onPaymentDateChange,
  onProcess,
  onPay,
}: FinancePayrollModalProps) {
  const pendingCount = payrollData.filter((employee) => normalizeFinanceValue(employee.status) !== "paid").length;
  const payrollTotal = payrollData.reduce((sum, employee) => sum + employee.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-lg">
        <div className="border-b bg-gray-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle>{mode === "process" ? "Process Payroll" : "Pay Payroll"}</DialogTitle>
            <DialogDescription>
              {mode === "process"
                ? `Prepare salary records for ${formatPayrollMonthLabel(selectedPayrollMonth)}.`
                : `Pay this payroll entry for ${formatPayrollMonthLabel(selectedPayrollMonth)}.`}
            </DialogDescription>
          </DialogHeader>
        </div>

        {mode === "process" ? (
          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border bg-white p-3 text-center">
                <div className="text-2xl font-bold">{payrollData.length}</div>
                <div className="text-xs text-muted-foreground">Employees</div>
              </div>
              <div className="rounded-md border bg-white p-3 text-center">
                <div className="text-2xl font-bold">{pendingCount}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="rounded-md border bg-white p-3 text-center">
                <div className="text-2xl font-bold">{formatCurrency(payrollTotal)}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              This creates any missing salary records for the selected month. Existing paid payroll entries are left unchanged.
            </p>
          </div>
        ) : entry ? (
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-md border bg-white p-4">
              <div className="font-medium text-gray-900">{entry.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{entry.role}</div>
              <div className="mt-3 text-2xl font-bold">{formatCurrency(entry.total)}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-gray-50 p-3">
                <div className="text-xs text-muted-foreground">Base Salary</div>
                <div className="font-medium">{formatCurrency(entry.baseSalary)}</div>
              </div>
              <div className="rounded-md border bg-gray-50 p-3">
                <div className="text-xs text-muted-foreground">Bonus</div>
                <div className="font-medium">{formatCurrency(entry.bonus)}</div>
              </div>
              <div className="rounded-md border bg-gray-50 p-3">
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="font-medium">{entry.status || "pending"}</div>
              </div>
              <div className="rounded-md border bg-gray-50 p-3">
                <div className="text-xs text-muted-foreground">Payment Date</div>
                <div className="font-medium">{entry.paymentDate || "-"}</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-payment-date">Payment Date</Label>
              <Input id="payroll-payment-date" type="date" value={paymentDate} onChange={(event) => onPaymentDateChange(event.target.value)} />
            </div>
          </div>
        ) : null}

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === "process" ? (
            <Button onClick={onProcess} disabled={isSaving}>
              {isSaving ? "Processing..." : "Process Payroll"}
            </Button>
          ) : (
            <Button onClick={onPay} disabled={isSaving || !entry}>
              {isSaving ? "Paying..." : "Confirm Payment"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
