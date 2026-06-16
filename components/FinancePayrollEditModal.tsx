"use client";

import { Calculator, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { formatPayrollMonthLabel } from "./financeModalOptions";

type PayrollEditEntry = {
  id: string;
  name: string;
  role: string;
  baseSalary: number;
  staffBaseSalary?: number;
  bonus: number;
  total: number;
  status: string;
};

export type PayrollEditForm = {
  baseSalary: number;
  date: string;
  salaryNotes: string;
};

type FinancePayrollEditModalProps = {
  open: boolean;
  entry: PayrollEditEntry | null;
  form: PayrollEditForm;
  selectedPayrollMonth: string;
  isSaving: boolean;
  formatCurrency: (amount?: number) => string;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: PayrollEditForm) => void;
  onSave: () => void;
};

export function FinancePayrollEditModal({
  open,
  entry,
  form,
  selectedPayrollMonth,
  isSaving,
  formatCurrency,
  onOpenChange,
  onFormChange,
  onSave,
}: FinancePayrollEditModalProps) {
  const activeBonus = Number(entry?.bonus) || 0;
  const projectedTotal = (Number(form.baseSalary) || 0) + activeBonus;
  const permanentDelta = (Number(form.baseSalary) || 0) - (Number(entry?.staffBaseSalary ?? entry?.baseSalary) || 0);
  const bonusTone = activeBonus < 0 ? "text-red-700" : activeBonus > 0 ? "text-green-700" : "text-gray-900";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-xl">
        <div className="border-b bg-gray-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-violet-600" />
              Edit Salary
            </DialogTitle>
            <DialogDescription>
              {entry
                ? `${entry.name} for ${formatPayrollMonthLabel(selectedPayrollMonth)}.`
                : `Payroll configuration for ${formatPayrollMonthLabel(selectedPayrollMonth)}.`}
            </DialogDescription>
          </DialogHeader>
        </div>

        {entry ? (
          <div className="space-y-5 px-6 py-5">
            <div className="grid gap-3 rounded-md border bg-white p-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <div className="text-xs text-muted-foreground">Staff</div>
                <div className="font-semibold text-gray-900">{entry.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">{entry.role}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Projected Total</div>
                <div className="font-semibold text-violet-700">{formatCurrency(projectedTotal)}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-gray-50 p-3">
                <div className="text-xs text-muted-foreground">Current Staff Salary</div>
                <div className="font-medium">{formatCurrency(entry.staffBaseSalary ?? entry.baseSalary)}</div>
              </div>
              {Math.abs(activeBonus) > 0.009 ? (
                <div className="rounded-md border bg-gray-50 p-3">
                  <div className="text-xs text-muted-foreground">Active Bonus / Reduction</div>
                  <div className={`font-medium ${bonusTone}`}>{formatCurrency(activeBonus)}</div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payroll-edit-base-salary">Permanent base salary</Label>
              <Input
                id="payroll-edit-base-salary"
                type="number"
                min="0"
                step="100"
                value={form.baseSalary}
                onChange={(event) => onFormChange({ ...form, baseSalary: Number(event.target.value) || 0 })}
              />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {permanentDelta >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span>{formatCurrency(permanentDelta)} from current staff salary</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payroll-edit-date">Effective date</Label>
                <Input
                  id="payroll-edit-date"
                  type="date"
                  value={form.date}
                  onChange={(event) => onFormChange({ ...form, date: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payroll-edit-salary-notes">Salary notes</Label>
                <Input
                  id="payroll-edit-salary-notes"
                  placeholder="Salary increase, correction, or review"
                  value={form.salaryNotes}
                  onChange={(event) => onFormChange({ ...form, salaryNotes: event.target.value })}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 text-sm text-muted-foreground">No payroll entry selected.</div>
        )}

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving || !entry}>
            {isSaving ? "Saving..." : "Save Salary"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
