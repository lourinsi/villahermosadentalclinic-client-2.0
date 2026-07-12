import React from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OverpaymentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTotalDue: number;
  previousPaidAmount: number;
  paymentAmount: number;
  adjustedPrice: string;
  onAdjustedPriceChange: (value: string) => void;
  onKeepPrice: () => void;
  onAdjustPrice: () => void;
  loadingAction?: "keep" | "adjust" | null;
  subjectLabel?: string;
}

const money = (value: number) => `\u20b1${Math.max(0, Number(value) || 0).toLocaleString()}`;

export default function OverpaymentConfirmDialog({
  open,
  onOpenChange,
  currentTotalDue,
  previousPaidAmount,
  paymentAmount,
  adjustedPrice,
  onAdjustedPriceChange,
  onKeepPrice,
  onAdjustPrice,
  loadingAction = null,
  subjectLabel = "treatment",
}: OverpaymentConfirmDialogProps) {
  const nextTotalPaid = Math.max(0, previousPaidAmount + paymentAmount);
  const overpaidBy = Math.max(0, nextTotalPaid - currentTotalDue);
  const isWorking = Boolean(loadingAction);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (isWorking && !nextOpen) return;
      onOpenChange(nextOpen);
    }}>
      <DialogContent showCloseButton={false} className="!fixed !bottom-0 !left-0 !top-auto !flex max-h-[82dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:w-[min(32rem,calc(100vw-2rem))] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.75rem] sm:border sm:border-slate-200">
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-3 text-left shadow-sm sm:px-7 sm:py-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-black text-slate-950">Confirm overpayment</DialogTitle>
              <DialogDescription className="mt-1 text-sm font-medium text-slate-600">
                This payment is {money(overpaidBy)} more than the current {subjectLabel} total.
              </DialogDescription>
            </div>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full text-slate-500 hover:bg-slate-100" onClick={() => onOpenChange(false)} disabled={isWorking} aria-label="Close overpayment confirmation"><X className="h-5 w-5" /></Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/70 px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-500">Current {subjectLabel} total</span>
              <span className="font-black text-slate-950">{money(currentTotalDue)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-500">Already paid</span>
              <span className="font-black text-slate-950">{money(previousPaidAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-500">This payment</span>
              <span className="font-black text-emerald-700">{money(paymentAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
              <span className="font-bold text-slate-700">Total paid after</span>
              <span className="font-black text-blue-700">{money(nextTotalPaid)}</span>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-amber-100 bg-white p-5 shadow-sm">
            <div className="space-y-2">
            <Label htmlFor="overpaymentAdjustedPrice" className="text-sm font-bold text-slate-800">
              Adjusted {subjectLabel} price
            </Label>
            <Input
              id="overpaymentAdjustedPrice"
              type="number"
              min="0"
              value={adjustedPrice}
              onChange={(event) => onAdjustedPriceChange(event.target.value)}
              disabled={isWorking}
              className="h-14 rounded-2xl border-slate-200 text-xl font-black shadow-sm"
            />
            <p className="text-xs font-medium text-slate-500">
              Adjusting keeps the {subjectLabel} total aligned with the total payment. Keeping the current total records the payment as overpaid.
            </p>
            </div>
          </div>
        </div>

        <DialogFooter className="!grid grid-cols-2 gap-3 border-t border-slate-100 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] sm:px-7 sm:pb-5">
          <Button type="button" variant="outline" onClick={onKeepPrice} disabled={isWorking} className="h-12 rounded-full font-bold">
            {loadingAction === "keep" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loadingAction === "keep" ? "Recording..." : "Keep Current Total"}
          </Button>
          <Button type="button" onClick={onAdjustPrice} disabled={isWorking} className="h-12 rounded-full bg-blue-600 font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700">
            {loadingAction === "adjust" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loadingAction === "adjust" ? "Recording..." : "Adjust Total & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
