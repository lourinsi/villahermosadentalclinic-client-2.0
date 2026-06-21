"use client";

import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

export type InventoryChange = {
  label: string;
  before: string;
  after: string;
  important?: boolean;
};

type FinanceInventoryChangeReviewModalProps = {
  open: boolean;
  itemName: string;
  changes: InventoryChange[];
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function FinanceInventoryChangeReviewModal({
  open,
  itemName,
  changes,
  isSaving,
  onOpenChange,
  onConfirm,
}: FinanceInventoryChangeReviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-lg">
        <div className="border-b bg-gray-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle>Review Inventory Changes</DialogTitle>
            <DialogDescription>Confirm the updates before saving {itemName || "this stock item"}.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-6 py-5">
          {changes.map((change) => (
            <div
              key={change.label}
              className={`rounded-md border p-4 ${change.important ? "border-amber-200 bg-amber-50" : "bg-white"}`}
            >
              <div className="mb-2 text-sm font-medium text-gray-900">{change.label}</div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Current</div>
                  <div className="font-medium">{change.before}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">New</div>
                  <div className="font-medium">{change.after}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Back to Edit
          </Button>
          <Button onClick={onConfirm} disabled={isSaving}>
            {isSaving ? "Saving..." : "Confirm Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
