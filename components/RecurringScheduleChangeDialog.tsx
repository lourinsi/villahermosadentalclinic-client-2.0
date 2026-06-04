"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { CalendarDays, Clock, Loader2, Repeat2, TriangleAlert } from "lucide-react";
import {
  formatBookingRecurringDate,
  type BookingRecurringDeletionItem,
} from "./sharedBookingLogic";

type RecurringScheduleChangeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isProcessing?: boolean;
  items: BookingRecurringDeletionItem[];
  formatTimeTo12h: (time: string) => string;
  mode?: "cancel" | "update";
};

const formatStatusLabel = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "Unknown";

  return normalized
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export function RecurringScheduleChangeDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing = false,
  items,
  formatTimeTo12h,
  mode = "cancel",
}: RecurringScheduleChangeDialogProps) {
  const isUpdateMode = mode === "update";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="w-[calc(100vw-2rem)] max-w-2xl gap-0 overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl"
        onOverlayClick={() => onOpenChange(false)}
      >
        <div className="border-b bg-slate-50 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <TriangleAlert className="h-6 w-6" />
            </div>
            <AlertDialogHeader className="space-y-1 text-left">
              <AlertDialogTitle className="text-xl font-black text-slate-950">
                {isUpdateMode ? "Apply changes to future recurring appointments?" : "Change recurring schedule?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm font-semibold leading-6 text-slate-500">
                {isUpdateMode
                  ? "This will update the upcoming appointments in this series to honor the schedule, service, or doctor changes you made."
                  : "You are changing the repetition settings for this appointment."}
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
        </div>

        <div className="space-y-5 bg-white px-6 py-5">
          <div className={`rounded-2xl border p-4 text-sm font-semibold leading-6 ${isUpdateMode ? "border-sky-100 bg-sky-50/60 text-slate-600" : "border-rose-100 bg-rose-50/60 text-slate-600"}`}>
            {isUpdateMode
              ? "This will update all upcoming repeating appointments in this series after this date."
              : "This will cancel and remove all upcoming repeating appointments in this series after this date."}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isUpdateMode ? "bg-sky-50 text-sky-600" : "bg-blue-50 text-blue-600"}`}>
                  <Repeat2 className="h-4 w-4" />
                </span>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {isUpdateMode ? "Schedules to be updated" : "Schedules to be cancelled"}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {items.length} {items.length === 1 ? "appointment" : "appointments"}
              </span>
            </div>

            <div className="max-h-64 space-y-2 overflow-auto pr-1">
              {items.map((item) => {
                const dateLabel = formatBookingRecurringDate(item.date) || item.date;
                const timeLabel = item.time ? formatTimeTo12h(item.time) : "";

                return (
                  <div
                    key={`${item.id || item.date}-${item.time || "time"}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">{dateLabel}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                        {timeLabel ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {timeLabel}
                          </span>
                        ) : null}
                        <span>Appointment: {formatStatusLabel(item.status)}</span>
                        <span>Payment: {formatStatusLabel(item.paymentStatus)}</span>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${isUpdateMode ? 'bg-sky-100 text-sky-600' : 'bg-rose-100 text-rose-600'}`}>
                      {isUpdateMode ? 'Update' : 'Cancel'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm font-semibold leading-6 text-slate-600">
            <p>
              {isUpdateMode
                ? "This will apply the current appointment's treatment, doctor, price, and schedule changes to upcoming appointments in this series. Payment and appointment status history are not carried over."
                : "This will start a new repeating schedule beginning on this date."}
            </p>
            <p className="text-slate-500">Note: Past appointment history will not be affected.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t bg-slate-50 px-6 py-5">
          <AlertDialogCancel
            disabled={isProcessing}
            className="h-12 rounded-2xl border-2 border-slate-200 bg-white font-bold text-slate-900 hover:bg-slate-100"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isProcessing}
            onClick={() => onConfirm()}
            className="h-12 rounded-2xl bg-blue-600 font-black uppercase tracking-widest text-white shadow-lg shadow-blue-100 hover:bg-blue-700"
          >
            {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            Confirm & Update
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
