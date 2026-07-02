"use client";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { AlertCircle, Calendar as CalendarIcon, Clock, Loader2 } from "lucide-react";
import { formatWordyDate } from "@/lib/utils";
// RecurringAppointmentDeletionItem type removed with recurrence deprecation

interface RecurringScheduleChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isProcessing: boolean;
  items: any[];
  formatTimeTo12h: (time: string) => string;
}

export function RecurringScheduleChangeDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing,
  items,
  formatTimeTo12h,
}: RecurringScheduleChangeDialogProps) {
  const modeLabel = "Updated";
  const modeDescription = "The following future recurring appointments may be affected by this change:";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl gap-0 overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl">
        <DialogHeader className="border-b bg-amber-50 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-lg shadow-amber-100">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-black text-gray-900">
                Recurring Appointments Will Be {modeLabel}
              </DialogTitle>
              <p className="mt-1 text-sm font-bold text-gray-600">{modeDescription}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto bg-white p-6">
          {items.length === 0 ? (
            <p className="text-center text-sm text-gray-500">No future appointments will be affected.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <CalendarIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatWordyDate(item.date, { fallback: item.date || "No date" })}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTimeTo12h(item.time || "00:00")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-3 border-t bg-gray-50/60 p-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="h-12 flex-1 rounded-2xl border-2 font-bold"
          >
            Cancel
          </Button>
          <Button
            className="h-12 flex-1 rounded-2xl bg-amber-600 font-black uppercase tracking-widest text-white shadow-lg shadow-amber-100 hover:bg-amber-700"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
            Confirm Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
