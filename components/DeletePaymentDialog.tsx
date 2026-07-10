"use client";

import { AlertTriangle, CreditCard, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface DeletePaymentDialogDetails {
  amountLabel?: string;
  patientName?: string;
  appointmentLabel?: string;
  dateLabel?: string;
  method?: string;
  reference?: string;
}

interface DeletePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
  details?: DeletePaymentDialogDetails | null;
  description?: string;
}

export default function DeletePaymentDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  details,
  description = "This will soft-delete the payment and update the appointment balance.",
}: DeletePaymentDialogProps) {
  const detailRows = [
    details?.patientName ? { label: "Patient", value: details.patientName } : null,
    details?.appointmentLabel ? { label: "Appointment", value: details.appointmentLabel } : null,
    details?.dateLabel ? { label: "Payment date", value: details.dateLabel } : null,
    details?.method ? { label: "Method", value: details.method } : null,
    details?.reference ? { label: "Reference", value: details.reference } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <DialogContent
        showCloseButton={false}
        className="!fixed !bottom-0 !left-0 !top-auto !flex max-h-[76dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.25rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[82dvh] sm:w-[min(28rem,calc(100vw-2rem))] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-2xl sm:border"
      >
        <DialogHeader className="border-b border-slate-100 px-4 pb-3 pt-2.5 text-left sm:px-6 sm:pb-4 sm:pt-3">
          <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 sm:h-11 sm:w-11 sm:rounded-2xl">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">
                  Delete Payment
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs font-semibold leading-5 text-slate-500 sm:text-sm sm:leading-6">
                  {description}
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-10 w-10 shrink-0 rounded-full text-slate-500 hover:bg-slate-100"
              aria-label="Close delete payment dialog"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-4 py-3 sleek-scrollbar sm:px-6 sm:py-4">
          <div className="rounded-2xl border border-red-100 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 sm:h-10 sm:w-10">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Payment to delete</p>
                <p className="truncate text-xl font-black text-slate-950 sm:text-2xl">
                  {details?.amountLabel || "Selected payment"}
                </p>
              </div>
            </div>

            {detailRows.length > 0 ? (
              <dl className="mt-3 grid gap-2.5 text-xs sm:mt-4 sm:gap-3 sm:text-sm">
                {detailRows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4">
                    <dt className="shrink-0 font-bold text-slate-500">{row.label}</dt>
                    <dd className="min-w-0 truncate text-right font-black text-slate-800">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>

        <DialogFooter className="!grid grid-cols-2 gap-2.5 border-t border-slate-100 bg-white px-4 pb-[calc(0.8rem+env(safe-area-inset-bottom))] pt-3 sm:gap-3 sm:px-6 sm:pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-10 rounded-full text-sm font-bold sm:h-11"
          >
            Keep Payment
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="h-10 rounded-full text-sm font-black sm:h-11"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
