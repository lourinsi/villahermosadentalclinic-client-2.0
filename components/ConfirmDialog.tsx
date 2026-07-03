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
      <DialogContent className="!fixed !bottom-0 !left-0 !top-auto h-auto max-h-[70dvh] w-full max-w-full !translate-x-0 !translate-y-0 overflow-hidden rounded-b-none rounded-t-[1.5rem] border-none p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:w-full sm:max-w-md sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-2xl sm:border sm:p-0">
        <DialogHeader className="border-b border-slate-100 px-5 pb-4 pt-3 text-left">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <DialogTitle className="pr-8 text-xl font-black text-slate-950">{title || "Confirm"}</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4">
          <p className="text-sm leading-6 text-slate-600">{message}</p>
        </div>
        <DialogFooter className="!grid grid-cols-2 gap-3 border-t border-slate-100 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="h-11 rounded-full font-bold">{cancelLabel}</Button>
          <Button
            variant="destructive"
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
            disabled={loading}
            className="h-11 rounded-full font-black"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
