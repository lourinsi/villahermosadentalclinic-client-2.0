"use client";

import { AlertTriangle, FileText, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface DeleteExpenseDialogDetails {
  amountLabel?: string;
  description?: string;
  dateLabel?: string;
  categoryLabel?: string;
  vendor?: string;
  statusLabel?: string;
  inventoryLabel?: string;
}

interface DeleteExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
  details?: DeleteExpenseDialogDetails | null;
  description?: string;
}

export default function DeleteExpenseDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  details,
  description = "This will mark the expense as deleted, remove it from default finance reports, and keep it available for restoration later.",
}: DeleteExpenseDialogProps) {
  const detailRows = [
    details?.dateLabel ? { label: "Expense date", value: details.dateLabel } : null,
    details?.categoryLabel ? { label: "Category", value: details.categoryLabel } : null,
    details?.vendor ? { label: "Vendor", value: details.vendor } : null,
    details?.statusLabel ? { label: "Status", value: details.statusLabel } : null,
    details?.inventoryLabel ? { label: "Inventory link", value: details.inventoryLabel } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <DialogContent
        showCloseButton={false}
        className="!fixed !bottom-0 !left-0 !top-auto !flex max-h-[76dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[82dvh] sm:w-[min(32rem,calc(100vw-2rem))] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.75rem] sm:border sm:border-slate-200"
      >
        <DialogHeader className="border-b border-slate-100 bg-white px-5 pb-4 pt-3 text-left shadow-sm sm:px-7 sm:py-5">
          <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 sm:h-11 sm:w-11 sm:rounded-2xl">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">
                  Delete Expense
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
              aria-label="Close delete expense dialog"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5 sleek-scrollbar sm:px-7 sm:py-6">
          <div className="rounded-[1.5rem] border border-red-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 sm:h-10 sm:w-10">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Expense to delete</p>
                <p className="truncate text-lg font-black text-slate-950 sm:text-xl">
                  {details?.description || "Selected expense"}
                </p>
                {details?.amountLabel ? (
                  <p className="mt-1 text-2xl font-black text-red-600">{details.amountLabel}</p>
                ) : null}
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

        <DialogFooter className="!grid grid-cols-2 gap-3 border-t border-slate-100 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] sm:px-7 sm:pb-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-12 rounded-full font-bold"
          >
            Keep Expense
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="h-12 rounded-full font-black shadow-lg shadow-red-100"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete Expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
