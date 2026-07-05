"use client";

import type { ReactNode } from "react";
import { Calendar, Clock, Loader2, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatWordyDate } from "@/lib/utils";
import { formatTimeTo12h } from "@/lib/time-slots";

type SelectScheduleModalProps = {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  appointmentLabel?: string;
  doctorLabel?: string;
  selectedDate?: Date | string | null;
  selectedTime?: string | null;
  onDateClick?: () => void;
  onTimeClick?: () => void;
  onSave?: () => void | Promise<void>;
  onCancel?: () => void;
  isSaving?: boolean;
  canSave?: boolean;
  saveLabel?: string;
};

const hasUsableDate = (date?: Date | string | null) => {
  if (!date) return false;
  const parsed = date instanceof Date ? date : new Date(String(date));
  return !Number.isNaN(parsed.getTime());
};

export function SelectScheduleModal({
  children,
  open,
  onOpenChange,
  title = "Select Schedule",
  description,
  appointmentLabel,
  doctorLabel,
  selectedDate,
  selectedTime,
  onDateClick,
  onTimeClick,
  onSave,
  onCancel,
  isSaving = false,
  canSave = true,
  saveLabel = "Save Schedule",
}: SelectScheduleModalProps) {
  if (open === undefined) {
    return (
      <div data-tour-id="booking-schedule-step" className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
        {children}
      </div>
    );
  }

  const hasDate = hasUsableDate(selectedDate);
  const hasTime = Boolean(String(selectedTime || "").trim());
  const selectedDateLabel = hasDate
    ? formatWordyDate(selectedDate as Date | string, { fallback: "Select date" })
    : "Select date";
  const selectedTimeLabel = hasTime ? formatTimeTo12h(String(selectedTime)) : "Select time";
  const resolvedCanSave = canSave && hasDate && hasTime && !isSaving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl font-black text-slate-950">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="font-semibold text-slate-500">
                {description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
        </div>

        <div data-tour-id="booking-schedule-step" className="space-y-4 px-5 py-5 sm:px-6">
          {(appointmentLabel || doctorLabel) ? (
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              {appointmentLabel ? (
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Visit</p>
                  <p className="mt-1 truncate text-sm font-black text-slate-950">{appointmentLabel}</p>
                </div>
              ) : null}
              {doctorLabel ? (
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Doctor</p>
                  <p className="mt-1 flex min-w-0 items-center gap-2 text-sm font-black text-slate-950">
                    <Stethoscope className="h-4 w-4 shrink-0 text-blue-600" />
                    <span className="truncate">{doctorLabel}</span>
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onDateClick}
              className="group min-h-[8rem] rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <Calendar className="h-5 w-5" />
              </span>
              <span className="mt-4 block text-xs font-black uppercase tracking-widest text-slate-500">Date</span>
              <span className="mt-1 block text-base font-black text-slate-950">{selectedDateLabel}</span>
            </button>

            <button
              type="button"
              onClick={onTimeClick}
              disabled={!hasDate}
              className={cn(
                "group min-h-[8rem] rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                hasDate
                  ? "hover:border-blue-200 hover:shadow-md"
                  : "cursor-not-allowed opacity-60"
              )}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700 transition-colors group-hover:bg-violet-600 group-hover:text-white">
                <Clock className="h-5 w-5" />
              </span>
              <span className="mt-4 block text-xs font-black uppercase tracking-widest text-slate-500">Time</span>
              <span className="mt-1 block text-base font-black text-slate-950">{selectedTimeLabel}</span>
            </button>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-blue-600 hover:bg-blue-700"
            onClick={() => void onSave?.()}
            disabled={!resolvedCanSave}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? "Saving..." : saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
