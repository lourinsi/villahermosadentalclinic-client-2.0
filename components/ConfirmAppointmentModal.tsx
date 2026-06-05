"use client";

import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, Calendar as CalendarIcon, Clock, Loader2 } from "lucide-react";
import { CompactNotesField } from "./CompactNotesField";
import {
  formatBookingDateKey,
  parseLocalDateOnly,
  type BookingRecurringDeletionItem,
} from "./sharedBookingLogic";
import { RecurringScheduleChangeDialog } from "./RecurringScheduleChangeDialog";

export type RecurringAppointmentDeletionItem = BookingRecurringDeletionItem;

const REPEAT_NONE_OPTION = "do-not-repeat";
const REPEAT_OPTIONS = [
  { value: "next-week", label: "Next week" },
  { value: "next-month", label: "Next month" },
  { value: "3-months", label: "3 months from now" },
  { value: "custom", label: "Custom date" },
];

interface ConfirmAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isBooking: boolean;
  shouldWarnBeforeRecurringScheduleChange?: boolean;
  recurringScheduleChangeMode?: "cancel" | "update";

  // Patient info
  patientName: string;
  patientAvatar?: string;

  // Doctor info
  doctorName: string;
  doctorAvatar?: string;

  // Appointment details
  appointmentType: string;
  customAppointmentTypeName?: string;
  selectedDate: Date;
  selectedTime: string;
  duration: string;
  treatmentNotes?: string;
  notes: string;
  onNotesChange: (notes: string) => void;
  durationConflict?: string;
  bookingConflictWarnings?: Array<{ type: string; message: string }>;

  // Status
  appointmentStatus: string;
  appointmentStatusOptions: Array<{ value: string; label: string; bgColor?: string; textColor?: string }>;
  onAppointmentStatusChange: (status: string) => void;
  canEditAppointmentStatus: boolean;

  paymentStatus: string;
  paymentStatusOptions: Array<{ value: string; label: string; bgColor?: string; textColor?: string }>;
  onPaymentStatusChange: (status: string) => void;
  canManagePaymentStatuses: boolean;

  // Pricing
  finalPrice: number;
  discount: number;
  discountedPrice: number;

  // Payment tracking
  previouslyPaidAmount: number;
  paymentAmountNow: number;

  // Recurrence
  isRecurring: boolean;
  onRecurringChange: (isRecurring: boolean) => void;
  recurrenceOption: string;
  onRecurrenceOptionChange: (option: string) => void;
  customRecurrenceDate: string;
  onCustomRecurrenceDateChange: (date: string) => void;
  onOpenCustomRecurrenceDatePicker?: () => void;
  isCustomRecurrenceDateLoading?: boolean;
  recurringAppointmentDate?: string | null;
  recurringAppointmentDates?: string[];
  recurringAppointmentDeletionItems?: RecurringAppointmentDeletionItem[];
  selectedRecurringAppointmentDeletionIds?: string[];
  onRecurringAppointmentDeletionIdsChange?: (ids: string[]) => void;

  // Utilities
  getPersonInitials: (name?: string) => string;
  getDoctorInitials: (name: string) => string;
  getBookingStatusLabel: (value: string, options: Array<{ value: string; label: string }>) => string;
  getAppointmentStatusOption?: (value: string) => { bgColor?: string; textColor?: string } | undefined;
  getPaymentStatusOption?: (value: string) => { bgColor?: string; textColor?: string } | undefined;
  formatTimeTo12h: (time: string) => string;
  isPatientReadonly?: boolean;
  isCancelled?: boolean;
  isPatientLevelBookingMode?: boolean;
  isCartAppointmentStatus: (status: string) => boolean;
  userRole?: string;
}

export function ConfirmAppointmentModal({
  open,
  onOpenChange,
  onConfirm,
  isBooking,
  patientName,
  patientAvatar,
  doctorName,
  doctorAvatar,
  appointmentType,
  customAppointmentTypeName,
  selectedDate,
  selectedTime,
  duration,
  treatmentNotes = "",
  notes,
  onNotesChange,
  durationConflict,
  bookingConflictWarnings = [],
  appointmentStatus,
  appointmentStatusOptions,
  onAppointmentStatusChange,
  canEditAppointmentStatus,
  paymentStatus,
  paymentStatusOptions,
  onPaymentStatusChange,
  canManagePaymentStatuses,
  finalPrice,
  discount,
  discountedPrice,
  previouslyPaidAmount,
  paymentAmountNow,
  isRecurring,
  onRecurringChange,
  recurrenceOption,
  onRecurrenceOptionChange,
  customRecurrenceDate,
  onCustomRecurrenceDateChange,
  onOpenCustomRecurrenceDatePicker,
  isCustomRecurrenceDateLoading = false,
  recurringAppointmentDate,
  recurringAppointmentDates = [],
  recurringAppointmentDeletionItems = [],
  selectedRecurringAppointmentDeletionIds = [],
  onRecurringAppointmentDeletionIdsChange,
  shouldWarnBeforeRecurringScheduleChange: shouldWarnRecurringScheduleChangeProp,
  recurringScheduleChangeMode,
  getPersonInitials,
  getDoctorInitials,
  getBookingStatusLabel,
  getAppointmentStatusOption = () => undefined,
  getPaymentStatusOption = () => undefined,
  formatTimeTo12h,
  isPatientReadonly = false,
  isCancelled = false,
  isPatientLevelBookingMode = false,
  isCartAppointmentStatus,
  userRole,
}: ConfirmAppointmentModalProps) {
  const [isRecurringScheduleChangeOpen, setIsRecurringScheduleChangeOpen] = useState(false);

  // Map recurrence options to relative labels
  const mapRecurrenceOptionToLabel = (option: string) => {
    const mapping: Record<string, string> = {
      "7 days": "next-week",
      "1 month": "next-month",
      "3 months": "3-months",
      "Custom": "custom",
    };
    return mapping[option] || option;
  };

  const mapLabelToRecurrenceOption = (label: string) => {
    const mapping: Record<string, string> = {
      "next-week": "7 days",
      "next-month": "1 month",
      "3-months": "3 months",
      "custom": "Custom",
    };
    return mapping[label] || label;
  };

  const treatmentName = appointmentType === "Other" ? customAppointmentTypeName || "Other" : appointmentType;
  const treatmentNotesText = String(treatmentNotes || "").trim();
  const customRecurrenceDateValue = parseLocalDateOnly(customRecurrenceDate);
  const customRecurrenceDateLabel = customRecurrenceDateValue
    ? customRecurrenceDateValue.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Choose repeat date";
  const inheritedRecurrenceTimeLabel = selectedTime ? formatTimeTo12h(selectedTime) : "Same time";

  const repeatSelectValue = isRecurring ? mapRecurrenceOptionToLabel(recurrenceOption) : REPEAT_NONE_OPTION;

  const handleRepeatSelectChange = (value: string) => {
    if (value === REPEAT_NONE_OPTION) {
      onRecurringChange(false);
      onCustomRecurrenceDateChange("");
      return;
    }

    onRecurringChange(true);
    const recOption = mapLabelToRecurrenceOption(value);
    onRecurrenceOptionChange(recOption);
    if (value !== "custom") {
      onCustomRecurrenceDateChange("");
    }
  };

  const futureRecurringChangeItems = useMemo(() => {
    const selectedDateKey = formatBookingDateKey(selectedDate);
    const inactiveStatuses = new Set(["cancelled", "canceled", "deleted", "stopped"]);
    const seen = new Set<string>();

    return recurringAppointmentDeletionItems
      .filter((item) => {
        const date = formatBookingDateKey(item.date);
        const status = String(item.status || "").trim().toLowerCase();
        if (!date || date <= selectedDateKey || inactiveStatuses.has(status)) return false;

        const key = item.id || `${date}|${item.time || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => {
        const dateCompare = String(left.date || "").localeCompare(String(right.date || ""));
        if (dateCompare !== 0) return dateCompare;
        return String(left.time || "").localeCompare(String(right.time || ""));
      });
  }, [recurringAppointmentDeletionItems, selectedDate]);

  const shouldWarnRecurringScheduleChange =
    typeof shouldWarnRecurringScheduleChangeProp === "boolean"
      ? shouldWarnRecurringScheduleChangeProp
      : isRecurring && futureRecurringChangeItems.length > 0;

  const isRepeatNoneSelected = !isRecurring;
  const recurringScheduleChangeDialogMode =
    recurringScheduleChangeMode ??
    (futureRecurringChangeItems.length > 0 ? (isRepeatNoneSelected ? "update" : "cancel") : "update");

  const handleConfirmClick = () => {
    if (shouldWarnRecurringScheduleChange) {
      setIsRecurringScheduleChangeOpen(true);
      return;
    }
    return onConfirm();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-tour-id="booking-summary-modal" className="w-[calc(100vw-2rem)] max-w-2xl gap-0 overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-2xl">
        <DialogHeader className="border-b bg-gray-50 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-black text-gray-900">Confirm Appointment</DialogTitle>
              <p className="mt-1 text-sm font-bold text-gray-500">Please review all details before saving</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 bg-white p-6">
          <div className="rounded-[1.75rem] border border-gray-100/70 bg-gray-50/60 p-5">
            <div className="grid gap-4 sm:grid-cols-6">
              {/* Patient */}
              <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 sm:col-span-3">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 opacity-70">Patient</p>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0 border-2 border-white shadow-md">
                    {patientAvatar && <AvatarImage src={patientAvatar} alt={patientName} className="object-cover" />}
                    <AvatarFallback className="bg-blue-600 text-[11px] font-black text-white">
                      {getPersonInitials(patientName)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="min-w-0 truncate text-base font-black text-gray-900 tracking-tight">{patientName}</p>
                </div>
              </div>

              {/* Doctor */}
              <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 sm:col-span-3">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 opacity-70">Doctor</p>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0 border-2 border-white shadow-md">
                    {doctorAvatar && <AvatarImage src={doctorAvatar} alt={doctorName} className="object-cover" />}
                    <AvatarFallback className="bg-emerald-500 text-[11px] font-black text-white">
                      {getDoctorInitials(doctorName)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="min-w-0 truncate text-base font-black text-gray-900 tracking-tight">{doctorName}</p>
                </div>
              </div>

              {/* Service */}
              <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 sm:col-span-3">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-70">Service</p>
                <p className="text-base font-black leading-snug text-gray-900 tracking-tight">
                  {treatmentName}
                </p>
              </div>

              {/* Treatment Notes */}
              <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 sm:col-span-3">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-70">Treatment Notes</p>
                <p className={`line-clamp-3 text-sm font-bold leading-snug ${treatmentNotesText ? "text-gray-900" : "text-gray-400"}`}>
                  {treatmentNotesText || "No treatment notes added."}
                </p>
              </div>

              {/* Schedule */}
              <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 sm:col-span-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-70">Schedule</p>
                <p className="text-base font-black leading-snug text-gray-900 tracking-tight">
                  {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {selectedTime ? formatTimeTo12h(selectedTime) : "—"}
                </p>
              </div>

              {/* Duration */}
              <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 sm:col-span-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-70">Duration</p>
                <div className="flex items-center gap-2">
                  <p className="text-base font-black text-gray-900 tracking-tight">{duration} mins</p>
                  {durationConflict && (
                    <span title={bookingConflictWarnings.find((w) => w.type === "duration")?.message || durationConflict} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 sm:col-span-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-70">Status</p>
                {canEditAppointmentStatus ? (
                  <Select value={appointmentStatus} onValueChange={onAppointmentStatusChange} disabled={appointmentStatusOptions.length === 0}>
                    <SelectTrigger
                      className={`h-9 w-full rounded-full border-0 px-3 text-[10px] font-black uppercase tracking-tighter shadow-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 sm:max-w-[180px] ${getAppointmentStatusOption(appointmentStatus)?.bgColor || "bg-gray-100"} ${getAppointmentStatusOption(appointmentStatus)?.textColor || "text-gray-700"}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      {appointmentStatusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value} className="rounded-xl my-1 mx-2">
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className={`inline-flex h-9 items-center rounded-full px-3 text-[10px] font-black uppercase tracking-tighter shadow-sm ${getAppointmentStatusOption(appointmentStatus)?.bgColor || "bg-gray-100"} ${getAppointmentStatusOption(appointmentStatus)?.textColor || "text-gray-700"}`}
                  >
                    {getBookingStatusLabel(appointmentStatus, appointmentStatusOptions)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <CompactNotesField
            id="confirm-summary-notes"
            label={isPatientLevelBookingMode ? "My Notes" : "Additional Notes"}
            placeholder={isPatientLevelBookingMode ? "Add any notes for your dentist..." : "Any special instructions or clinical notes..."}
            value={notes}
            onChange={onNotesChange}
            disabled={isPatientReadonly && isCancelled}
            className="rounded-[1.5rem] border border-gray-100 bg-gray-50/50 p-4"
            labelClassName="mb-2 text-[9px] font-black uppercase tracking-widest text-gray-400 opacity-70"
            textareaClassName="min-h-[58px] resize-none rounded-xl border border-gray-100 bg-white p-3 text-sm font-medium transition-all focus:border-blue-500 focus:bg-white"
          />

          {/* Repeat */}
          <div className="rounded-[1.5rem] border border-gray-100 bg-white p-4">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700">Repeat</Label>
                <Select value={repeatSelectValue} onValueChange={handleRepeatSelectChange}>
                  <SelectTrigger className="mt-2 h-10 w-full rounded-full border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value={REPEAT_NONE_OPTION} className="rounded-xl my-1 mx-2">
                      Do not repeat
                    </SelectItem>
                    {REPEAT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="rounded-xl my-1 mx-2">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isRecurring && recurrenceOption === "Custom" && (
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Custom repeat date</Label>
                  <button
                    type="button"
                    onClick={onOpenCustomRecurrenceDatePicker}
                    disabled={isCustomRecurrenceDateLoading || !onOpenCustomRecurrenceDatePicker}
                    className="mt-2 flex min-h-[58px] w-full items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50/40 disabled:cursor-wait disabled:opacity-70"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <CalendarIcon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-gray-900">{customRecurrenceDateLabel}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          {inheritedRecurrenceTimeLabel} for {duration} mins
                        </span>
                      </span>
                    </span>
                    {isCustomRecurrenceDateLoading ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" />
                    ) : (
                      <CalendarIcon className="h-5 w-5 shrink-0 text-gray-400" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>


          {/* Conflict warnings */}
          {bookingConflictWarnings.length > 0 && (
            <div className="rounded-2xl border-2 border-amber-100 bg-amber-50 p-4 text-xs font-bold text-amber-800 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <p>This appointment has a scheduling conflict. Hover the warning icon for details.</p>
            </div>
          )}

          {/* Financial Summary */}
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-100"></div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Financial Summary</p>
              <div className="h-px flex-1 bg-gray-100"></div>
            </div>

            <div className="space-y-5 rounded-[1.75rem] border border-gray-100/70 bg-gray-50/60 p-5">
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_180px] md:items-start">
                {/* Final Price */}
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Final Price</p>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                    {discount > 0 && <span className="text-sm font-bold text-gray-400 line-through decoration-gray-400/50">₱{finalPrice.toLocaleString()}</span>}
                    <p className="text-3xl font-black text-blue-600 tracking-tighter">₱{discountedPrice.toLocaleString()}</p>
                    {discount > 0 && <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 shadow-sm">Saved ₱{discount.toLocaleString()}</span>}
                  </div>
                </div>

                {/* Payment Status */}
                <div className="min-w-0 md:justify-self-end md:text-right">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-70">Payment Status</p>
                    {canManagePaymentStatuses ? (
                      <Select value={paymentStatus} onValueChange={onPaymentStatusChange}>
                        <SelectTrigger
                          className={`h-9 w-full rounded-full border-0 px-3 text-[10px] font-black uppercase tracking-tighter shadow-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 md:w-[160px] ${getPaymentStatusOption(paymentStatus)?.bgColor || "bg-gray-100"} ${getPaymentStatusOption(paymentStatus)?.textColor || "text-gray-700"}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                          {paymentStatusOptions.map((status) => (
                            <SelectItem key={status.value} value={status.value} className="rounded-xl my-1 mx-2">
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span
                        className={`inline-flex h-9 items-center rounded-full px-3 text-[10px] font-black uppercase tracking-tighter shadow-sm ${getPaymentStatusOption(paymentStatus)?.bgColor || "bg-gray-100"} ${getPaymentStatusOption(paymentStatus)?.textColor || "text-gray-700"}`}
                      >
                        {getBookingStatusLabel(paymentStatus, paymentStatusOptions)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment breakdown */}
              <div className="grid grid-cols-3 gap-3 border-t border-gray-100/70 pt-4">
                <div className="text-center">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Already Paid</p>
                  <p className="text-sm font-black text-emerald-600 tracking-tight">₱{previouslyPaidAmount.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Paying Now</p>
                  <p className="text-sm font-black text-blue-600 tracking-tight">₱{paymentAmountNow.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Remaining</p>
                  <p className="text-sm font-black text-gray-400 tracking-tight">₱{Math.max(0, discountedPrice - previouslyPaidAmount - paymentAmountNow).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Patient-facing note for cart bookings */}
        {userRole === "patient" && isCartAppointmentStatus(appointmentStatus) && (
          <div className="px-6 pb-5">
            <div className="rounded-lg p-3 bg-yellow-50 border border-yellow-100 text-yellow-800 text-sm font-semibold">
              Note: This booking will be added to your cart. Adding a payment will reserve this schedule.
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="flex gap-3 border-t bg-gray-50/60 p-6">
          <Button data-tour-id="booking-summary-back" variant="outline" onClick={() => onOpenChange(false)} disabled={isBooking} className="h-12 flex-1 rounded-2xl border-2 font-bold">
            Back to Edit
          </Button>
          <Button className="h-12 flex-1 rounded-2xl bg-blue-600 font-black uppercase tracking-widest text-white shadow-lg shadow-blue-100 hover:bg-blue-700" onClick={handleConfirmClick} disabled={isBooking}>
            {isBooking ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
            {isCartAppointmentStatus(appointmentStatus) ? "Add to Cart" : "Confirm & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <RecurringScheduleChangeDialog
      open={isRecurringScheduleChangeOpen}
      onOpenChange={setIsRecurringScheduleChangeOpen}
      onConfirm={onConfirm}
      isProcessing={isBooking}
      items={futureRecurringChangeItems}
      formatTimeTo12h={formatTimeTo12h}
      mode={recurringScheduleChangeDialogMode}
    />
    </>
  );
}
