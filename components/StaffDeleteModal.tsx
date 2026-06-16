"use client";

import { AlertTriangle, Mail, UserRound } from "lucide-react";
import type { Staff } from "@/lib/staff-types";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

type StaffDeleteModalProps = {
  open: boolean;
  staff: Staff | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
};

export function StaffDeleteModal({
  open,
  staff,
  isDeleting,
  onOpenChange,
  onDelete,
}: StaffDeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-md">
        <div className="border-b bg-red-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="h-5 w-5" />
              Remove Staff Member
            </DialogTitle>
            <DialogDescription className="text-red-800">
              This soft-deletes the staff profile from the backend. Existing historical records are preserved.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-muted-foreground">
            {staff ? `Are you sure you want to remove ${staff.name}?` : "Are you sure you want to remove this staff member?"}
          </p>
          {staff ? (
            <div className="rounded-md border bg-gray-50 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-gray-900">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                {staff.name}
              </div>
              <div className="mt-2 text-muted-foreground">{staff.role || "Staff"}{staff.department ? ` - ${staff.department}` : ""}</div>
              {staff.email ? (
                <div className="mt-2 flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {staff.email}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={isDeleting || !staff}>
            {isDeleting ? "Removing..." : "Remove Staff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
