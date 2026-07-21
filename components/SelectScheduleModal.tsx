"use client";

import type { ReactNode } from "react";
import { Calendar, Clock, Loader2, Stethoscope, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatWordyDate } from "@/lib/utils";
import { formatTimeTo12h } from "@/lib/time-slots";

type StatusOption = {
  value: string;
  label?: string;
};

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
  selectedDuration?: number | string | null;
  onDurationChange?: (duration: string) => void;
  status?: string | null;
  statusOptions?: StatusOption[];
  onStatusChange?: (status: string) => void;
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

const parseDuration = (value?: number | string | null) => {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
};

const parseTimeValue = (time?: string | null) => {
  if (!time) return null;
  const [hours, minutes] = String(time).split(":").map(Number);
  if (![hours, minutes].every((n) => Number.isFinite(n))) return null;
  return { hours, minutes };
};

const formatEndTime = (time?: string | null, duration?: number | string | null) => {
  const parsed = parseTimeValue(time);
  const durationMinutes = parseDuration(duration);
  if (!parsed || durationMinutes <= 0) return "";

  const date = new Date();
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  date.setMinutes(date.getMinutes() + durationMinutes);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return formatTimeTo12h(`${hours}:${minutes}`);
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
  selectedDuration,
  onDurationChange,
  status,
  statusOptions,
  onStatusChange,
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
  const durationValue = selectedDuration ? String(selectedDuration) : "";
  const durationOptions = [30, 60, 90, 120];
  const endTimeLabel = formatEndTime(selectedTime, durationValue);
  const timeRangeLabel = hasTime && endTimeLabel
    ? `${formatTimeTo12h(String(selectedTime))} – ${endTimeLabel}`
    : "Choose a time and duration";
  const showDurationInput = typeof onDurationChange === "function" || selectedDuration != null;
  const showStatusSelect = Array.isArray(statusOptions) && statusOptions.length > 0 && typeof onStatusChange === "function";
  const showExtraFields = showDurationInput || showStatusSelect;
  const resolvedCanSave = canSave && hasDate && hasTime && !isSaving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-1.25rem)] sm:w-full sm:max-w-[560px] overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-0 shadow-2xl"
      >
        {/* Header */}
        <DialogHeader className="border-b border-gray-100 px-5 pb-5 pt-5 text-left sm:px-7 sm:pt-7">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-blue-600 text-white shadow-xl shadow-blue-100 ring-4 ring-blue-50">
              <Calendar className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-2xl font-black tracking-tight text-gray-900">
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription className="mt-1 text-sm font-bold text-gray-400">
                  {description}
                </DialogDescription>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onCancel ? onCancel() : onOpenChange?.(false)}
              disabled={isSaving}
              className="h-10 w-10 shrink-0 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close schedule modal"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Body */}
        <div data-tour-id="booking-schedule-step" className="space-y-4 px-5 py-6 sm:px-7">
          {/* Appointment / Doctor context */}
          {(appointmentLabel || doctorLabel) ? (
            <div className="grid gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
              {appointmentLabel ? (
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Visit</p>
                  <p className="mt-1 truncate text-sm font-black text-gray-900">{appointmentLabel}</p>
                </div>
              ) : null}
              {doctorLabel ? (
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Doctor</p>
                  <p className="mt-1 flex min-w-0 items-center gap-2 text-sm font-black text-gray-900">
                    <Stethoscope className="h-4 w-4 shrink-0 text-blue-600" />
                    <span className="truncate">{doctorLabel}</span>
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Date / Time pickers */}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onDateClick}
              className="group min-h-[7.5rem] rounded-2xl border border-gray-100 bg-gray-50 p-4 text-left transition-all hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <Calendar className="h-5 w-5" />
              </span>
              <span className="mt-4 block text-xs font-black uppercase tracking-widest text-gray-400">Date</span>
              <span className="mt-1 block text-base font-black text-gray-900">{selectedDateLabel}</span>
            </button>

            <button
              type="button"
              onClick={onTimeClick}
              disabled={!hasDate}
              className={cn(
                "group min-h-[7.5rem] rounded-2xl border border-gray-100 bg-gray-50 p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2",
                hasDate
                  ? "hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm"
                  : "cursor-not-allowed opacity-50"
              )}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 transition-colors group-hover:bg-violet-600 group-hover:text-white">
                <Clock className="h-5 w-5" />
              </span>
              <span className="mt-4 block text-xs font-black uppercase tracking-widest text-gray-400">Time</span>
              <span className="mt-1 block text-base font-black text-gray-900">{selectedTimeLabel}</span>
            </button>
          </div>

          {/* Duration / Status */}
          {showExtraFields ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {showDurationInput ? (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <Label htmlFor="select-schedule-duration" className="text-xs font-black uppercase tracking-widest text-gray-400">
                      Duration
                    </Label>
                    <Select
                      value={durationValue}
                      onValueChange={(value) => onDurationChange?.(value)}
                      disabled={!hasDate || typeof onDurationChange !== "function"}
                    >
                      <SelectTrigger
                        id="select-schedule-duration"
                        className="mt-2.5 h-12 rounded-2xl border-0 bg-white px-4 text-sm font-black text-gray-900 shadow-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-400"
                      >
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        {durationOptions.map((minutes) => (
                          <SelectItem key={minutes} value={String(minutes)} className="mx-2 my-1 rounded-xl">
                            {minutes} minutes
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {showStatusSelect ? (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <Label htmlFor="select-schedule-status" className="text-xs font-black uppercase tracking-widest text-gray-400">
                      Status
                    </Label>
                    <Select
                      value={status || "scheduled"}
                      onValueChange={(value) => onStatusChange?.(value)}
                      disabled={!showStatusSelect}
                    >
                      <SelectTrigger
                        id="select-schedule-status"
                        className="mt-2.5 h-12 rounded-2xl border-0 bg-white px-4 text-sm font-black text-gray-900 shadow-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-400"
                      >
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        {(statusOptions || []).map((option) => (
                          <SelectItem key={option.value} value={option.value} className="mx-2 my-1 rounded-xl">
                            {option.label || option.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              {/* Scheduled window summary */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-4">
                <p className="text-xs font-black uppercase tracking-widest text-blue-500">Scheduled Window</p>
                <p className="mt-1 text-sm font-bold text-blue-700">{timeRangeLabel}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <DialogFooter className="gap-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:px-7">
          <Button
            type="button"
            variant="outline"
            onClick={() => onCancel ? onCancel() : onOpenChange?.(false)}
            disabled={isSaving}
            className="h-12 flex-1 rounded-2xl border-gray-200 bg-white text-sm font-black text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-12 flex-1 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700"
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
