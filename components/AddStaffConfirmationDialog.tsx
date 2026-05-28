"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddStaffPayload, getStaffInitials } from "./sharedAddStaffLogic";

interface AddStaffConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: AddStaffPayload;
  summaryRows: Array<{ label: string; value: string }>;
  loading: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<boolean> | boolean;
}

export default function AddStaffConfirmationDialog({
  open,
  onOpenChange,
  staff,
  summaryRows,
  loading,
  title = "Confirm Staff Member",
  description = "Review these details before adding the staff member.",
  confirmLabel = "Confirm & Add",
  onConfirm,
}: AddStaffConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <Avatar className="h-16 w-16 border border-blue-100 bg-white">
            {staff.profilePicture ? (
              <AvatarImage src={staff.profilePicture} alt={staff.name || "Staff photo"} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-blue-100 text-lg font-bold text-blue-700">
              {getStaffInitials(staff.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">{staff.name || "New staff member"}</p>
            <p className="truncate text-sm text-muted-foreground">{staff.email || "No email provided"}</p>
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="grid gap-3 text-sm">
            {summaryRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[130px_1fr] gap-3">
                <span className="text-gray-600">{row.label}</span>
                <span className="break-words text-right font-semibold text-gray-900">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="flex-1">
            Back
          </Button>
          <Button onClick={onConfirm} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700">
            {loading ? "Saving..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
