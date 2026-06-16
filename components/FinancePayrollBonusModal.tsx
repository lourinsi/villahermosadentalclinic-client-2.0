"use client";

import { Gift } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { formatPayrollMonthLabel } from "./financeModalOptions";

type PayrollBonusEntry = {
  id: string;
  name: string;
  role: string;
  total: number;
};

export type PayrollBonusForm = {
  staffId: string;
  amount: number;
  date: string;
  notes: string;
  existingAdjustmentTotal: number;
};

type FinancePayrollBonusModalProps = {
  open: boolean;
  form: PayrollBonusForm;
  payrollData: PayrollBonusEntry[];
  selectedPayrollMonth: string;
  isSaving: boolean;
  formatCurrency: (amount?: number) => string;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: PayrollBonusForm) => void;
  onStaffChange: (staffId: string) => void;
  onSave: () => void;
};

export function FinancePayrollBonusModal({
  open,
  form,
  payrollData,
  selectedPayrollMonth,
  isSaving,
  formatCurrency,
  onOpenChange,
  onFormChange,
  onStaffChange,
  onSave,
}: FinancePayrollBonusModalProps) {
  const selectedStaff = payrollData.find((employee) => employee.id === form.staffId) || null;
  const currentAdjustmentTotal = Number(form.existingAdjustmentTotal) || 0;
  const nextAdjustmentTotal = Number(form.amount) || 0;
  const projectedTotal = (selectedStaff?.total || 0) - currentAdjustmentTotal + nextAdjustmentTotal;
  const hasExistingAdjustment = Math.abs(currentAdjustmentTotal) > 0.009;
  const amountTone = nextAdjustmentTotal < 0 ? "text-red-700" : nextAdjustmentTotal > 0 ? "text-green-700" : "text-gray-900";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-xl">
        <div className="border-b bg-gray-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-violet-600" />
              Bonus / Reduction
            </DialogTitle>
            <DialogDescription>
              Set the net payroll bonus or reduction for {formatPayrollMonthLabel(selectedPayrollMonth)}.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="payroll-bonus-staff">Staff member</Label>
            <Select value={form.staffId} onValueChange={onStaffChange}>
              <SelectTrigger id="payroll-bonus-staff">
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {payrollData.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name} - {employee.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedStaff ? (
            <div className="grid gap-3 rounded-md border bg-white p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Current Payroll Total</div>
                <div className="text-lg font-semibold">{formatCurrency(selectedStaff.total)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">After Bonus / Reduction</div>
                <div className="text-lg font-semibold text-violet-700">{formatCurrency(projectedTotal)}</div>
              </div>
              {hasExistingAdjustment ? (
                <div className="sm:col-span-2 rounded-md bg-gray-50 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Current Bonus / Reduction</div>
                  <div className={`font-medium ${currentAdjustmentTotal < 0 ? "text-red-700" : "text-green-700"}`}>
                    {formatCurrency(currentAdjustmentTotal)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payroll-bonus-amount">Amount</Label>
              <Input
                id="payroll-bonus-amount"
                type="number"
                step="100"
                value={form.amount}
                onChange={(event) => onFormChange({ ...form, amount: Number(event.target.value) || 0 })}
              />
              <div className={`text-xs ${amountTone}`}>
                {formatCurrency(nextAdjustmentTotal)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-bonus-date">Date</Label>
              <Input
                id="payroll-bonus-date"
                type="date"
                value={form.date}
                onChange={(event) => onFormChange({ ...form, date: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payroll-bonus-notes">Notes</Label>
            <Textarea
              id="payroll-bonus-notes"
              placeholder="Performance bonus, overtime, correction, or reduction details"
              value={form.notes}
              onChange={(event) => onFormChange({ ...form, notes: event.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving || !form.staffId || (!hasExistingAdjustment && Math.abs(Number(form.amount) || 0) <= 0.009)}
          >
            {isSaving ? "Saving..." : "Save Bonus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
