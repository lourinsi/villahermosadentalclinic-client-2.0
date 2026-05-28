"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message?: string;
  onConfirm: () => Promise<void> | void;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

export default function ConfirmDialog({ open, onOpenChange, title, message, onConfirm, confirmLabel = "Confirm", cancelLabel = "Cancel", loading = false }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title || "Confirm"}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>{cancelLabel}</Button>
          <Button
            variant="destructive"
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
            disabled={loading}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
