import React from "react";
import { AlertTriangle } from "lucide-react";
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
}

const money = (value: number) => `PHP ${Math.max(0, Number(value) || 0).toLocaleString()}`;

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
}: OverpaymentConfirmDialogProps) {
  const nextTotalPaid = Math.max(0, previousPaidAmount + paymentAmount);
  const overpaidBy = Math.max(0, nextTotalPaid - currentTotalDue);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="border-b bg-amber-50 px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-black text-slate-950">Confirm overpayment</DialogTitle>
              <DialogDescription className="mt-1 text-sm font-medium text-slate-600">
                This payment is {money(overpaidBy)} more than the current treatment total.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-500">Current treatment total</span>
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

          <div className="space-y-2">
            <Label htmlFor="overpaymentAdjustedPrice" className="text-sm font-bold text-slate-800">
              Adjusted treatment total
            </Label>
            <Input
              id="overpaymentAdjustedPrice"
              type="number"
              min="0"
              value={adjustedPrice}
              onChange={(event) => onAdjustedPriceChange(event.target.value)}
              className="h-12 rounded-xl text-lg font-black"
            />
            <p className="text-xs font-medium text-slate-500">
              Adjusting keeps the appointment total aligned with the total payment. Keeping the current total records the payment as overpaid.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t bg-slate-50 px-6 py-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={onKeepPrice} className="h-11 rounded-xl font-bold">
            Keep Current Total
          </Button>
          <Button type="button" onClick={onAdjustPrice} className="h-11 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700">
            Adjust Total & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
