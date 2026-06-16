"use client";

import { AlertTriangle } from "lucide-react";
import type { StaffFinancialRecord } from "@/lib/staff-types";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { getFinancialStatusLabel, getFinancialTypeLabel } from "./staffModalOptions";

type StaffFinancialDeleteModalProps = {
  open: boolean;
  record: StaffFinancialRecord | null;
  isDeleting: boolean;
  formatCurrency: (amount?: number) => string;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
};

export function StaffFinancialDeleteModal({
  open,
  record,
  isDeleting,
  formatCurrency,
  onOpenChange,
  onDelete,
}: StaffFinancialDeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-md">
        <div className="border-b bg-red-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="h-5 w-5" />
              Remove Financial Record
            </DialogTitle>
            <DialogDescription className="text-red-800">
              This deletes the selected staff financial transaction from the backend.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-muted-foreground">
            {record
              ? `Remove ${record.staffName}'s ${getFinancialTypeLabel(record.type).toLowerCase()} record?`
              : "Remove this financial record?"}
          </p>
          {record ? (
            <div className="grid gap-3 rounded-md border bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground">Amount</div>
                <div className="font-medium">{formatCurrency(record.amount)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <div className="font-medium">{getFinancialStatusLabel(record.status)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Date</div>
                <div className="font-medium">{record.date || "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Type</div>
                <div className="font-medium">{getFinancialTypeLabel(record.type)}</div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={isDeleting || !record}>
            {isDeleting ? "Deleting..." : "Delete Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
