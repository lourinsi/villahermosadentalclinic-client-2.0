"use client";

import { CircleHelp, WalletCards } from "lucide-react";
import type { Staff, StaffFinancialRecordForm } from "@/lib/staff-types";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { staffPasswordManagerIgnoreProps } from "./sharedAddStaffLogic";
import {
  STAFF_FINANCIAL_STATUS_OPTIONS,
  STAFF_FINANCIAL_TYPE_OPTIONS,
  getFinancialStatusLabel,
  getFinancialTypeDescription,
  getFinancialTypeLabel,
} from "./staffModalOptions";

export type StaffFinancialRecordModalMode = "create" | "edit";

type StaffFinancialRecordModalProps = {
  open: boolean;
  mode: StaffFinancialRecordModalMode;
  form: StaffFinancialRecordForm;
  staffMembers: Staff[];
  isSaving: boolean;
  formatCurrency: (amount?: number) => string;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: StaffFinancialRecordForm) => void;
  onSave: () => void;
};

export function StaffFinancialRecordModal({
  open,
  mode,
  form,
  staffMembers,
  isSaving,
  formatCurrency,
  onOpenChange,
  onFormChange,
  onSave,
}: StaffFinancialRecordModalProps) {
  const updateForm = (updates: Partial<StaffFinancialRecordForm>) => onFormChange({ ...form, ...updates });
  const staffOptions = staffMembers.filter((staff): staff is Staff & { id: string } => Boolean(staff.id));
  const selectedStaff = staffOptions.find((staff) => String(staff.id) === String(form.staffId));
  const typeDescription = getFinancialTypeDescription(form.type);
  const isCashAdvance = form.type === "cash_advance";
  const hasRequiredFields = Boolean(form.staffId && form.type && form.date && Number(form.amount) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
        <div className="border-b bg-gray-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-blue-600" />
              {mode === "edit" ? "Edit Financial Transaction" : "Add Financial Transaction"}
            </DialogTitle>
            <DialogDescription>
              Record staff advances, bonuses, salary adjustments, and deductions from backend staff records.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="staff-financial-staff">Staff Member</Label>
            <Select value={form.staffId} onValueChange={(value) => updateForm({ staffId: value })}>
              <SelectTrigger id="staff-financial-staff">
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {staffOptions.map((staff) => (
                  <SelectItem key={staff.id} value={String(staff.id)}>
                    {staff.name} - {staff.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-financial-type">Transaction Type</Label>
            <Select value={form.type} onValueChange={(value) => updateForm({ type: value })}>
              <SelectTrigger id="staff-financial-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {STAFF_FINANCIAL_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typeDescription ? <p className="text-xs text-muted-foreground">{typeDescription}</p> : null}
          </div>

          {mode === "edit" ? (
            <div className="space-y-2">
              <Label htmlFor="staff-financial-status">Status</Label>
              <Select value={form.status} onValueChange={(value) => updateForm({ status: value })}>
                <SelectTrigger id="staff-financial-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_FINANCIAL_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="rounded-md border bg-blue-50 px-3 py-2 text-sm">
              <div className="font-medium text-blue-900">Starts as pending</div>
              <p className="text-blue-700">New transactions go through approval before being marked paid.</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="staff-financial-amount">Amount (PHP)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground" aria-label="Amount guidance">
                    <CircleHelp className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px]">
                  Enter the total amount for this transaction. Use deductions for amounts that reduce payroll.
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="staff-financial-amount"
              type="number"
              min="0"
              step="100"
              placeholder="500"
              {...staffPasswordManagerIgnoreProps}
              value={form.amount}
              onChange={(event) => updateForm({ amount: Number(event.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-financial-date">Date</Label>
            <Input
              id="staff-financial-date"
              type="date"
              {...staffPasswordManagerIgnoreProps}
              value={form.date}
              onChange={(event) => updateForm({ date: event.target.value })}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="staff-financial-repayment">
              {isCashAdvance ? "Repayment Schedule" : "Repayment Schedule (optional)"}
            </Label>
            <Input
              id="staff-financial-repayment"
              placeholder={isCashAdvance ? "e.g., PHP 2,500 x 2 payrolls" : "Optional payroll note"}
              {...staffPasswordManagerIgnoreProps}
              value={form.repaymentSchedule}
              onChange={(event) => updateForm({ repaymentSchedule: event.target.value })}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="staff-financial-notes">Notes</Label>
            <Textarea
              id="staff-financial-notes"
              placeholder="Add the reason, approval context, or payroll instruction..."
              {...staffPasswordManagerIgnoreProps}
              value={form.notes}
              onChange={(event) => updateForm({ notes: event.target.value })}
            />
          </div>

          <div className="rounded-md border bg-gray-50 p-4 sm:col-span-2">
            <div className="text-xs font-medium uppercase text-muted-foreground">Review</div>
            <div className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground">Staff</div>
                <div className="font-medium">{selectedStaff?.name || "Not selected"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Transaction</div>
                <div className="font-medium">{form.type ? getFinancialTypeLabel(form.type) : "Not selected"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Amount</div>
                <div className="font-medium">{formatCurrency(form.amount)}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Status after save: {getFinancialStatusLabel(mode === "create" ? "pending" : form.status)}.
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving || !hasRequiredFields}>
            {isSaving ? "Saving..." : mode === "edit" ? "Save Changes" : "Add Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
