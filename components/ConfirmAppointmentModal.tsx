"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, Loader2, Clock, Calendar as CalendarIcon } from "lucide-react";
import { CompactNotesField } from "./CompactNotesField";
import { DatePickerModal } from "./DatePickerModal";
import { formatBookingPaymentDateLabel, getBookingDoctorValue, parseLocalDateOnly } from "./sharedBookingLogic";
import { formatDateToYYYYMMDD, formatWordyDate } from "@/lib/utils";

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
  onConfirm: (repeatPayload?: { repeatOption: string; customRepeatDate?: string }) => void | Promise<void>;
  isBooking: boolean;

  // Patient info
  patientName: string;
  patientAvatar?: string;
  patientId?: string;

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
  paymentDate?: string;

  // Repeat / follow-up clone
  repeatOption: string;
  customRepeatDate: string;
  onRepeatOptionChange: (option: string) => void;
  onCustomRepeatDateChange: (date: string) => void;

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
  patientId,
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
  paymentDate,
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
  repeatOption: repeatOptionProp = REPEAT_NONE_OPTION,
  customRepeatDate: customRepeatDateProp = "",
  onRepeatOptionChange,
  onCustomRepeatDateChange,
}: ConfirmAppointmentModalProps) {
  const [repeatOption, setRepeatOption] = useState<string>(repeatOptionProp);
  const [customRepeatDate, setCustomRepeatDate] = useState<string>(customRepeatDateProp);
  const [customRepeatDatePickerOpen, setCustomRepeatDatePickerOpen] = useState(false);

  useEffect(() => {
    setRepeatOption(repeatOptionProp);
  }, [repeatOptionProp]);

  useEffect(() => {
    setCustomRepeatDate(customRepeatDateProp);
  }, [customRepeatDateProp]);

  const handleRepeatOptionChange = (value: string) => {
    setRepeatOption(value);
    onRepeatOptionChange?.(value);

    if (value === "custom") {
      setCustomRepeatDatePickerOpen(true);
    } else {
      setCustomRepeatDatePickerOpen(false);
    }
  };

  const handleCustomRepeatDateChange = (value: string) => {
    setCustomRepeatDate(value);
    onCustomRepeatDateChange?.(value);
  };

  const computedRepeatTarget = useMemo(() => {
    if (repeatOption === REPEAT_NONE_OPTION) {
      return null;
    }

    const baseDate = new Date(selectedDate);
    const target = new Date(baseDate);

    switch (repeatOption) {
      case "next-week":
        target.setDate(baseDate.getDate() + 7);
        return target;
      case "next-month":
        target.setMonth(baseDate.getMonth() + 1);
        return target;
      case "3-months":
        target.setMonth(baseDate.getMonth() + 3);
        return target;
          case "custom":
        if (!customRepeatDate) {
          return null;
        }
        const parsed = parseLocalDateOnly(customRepeatDate);
        return parsed;
      default:
        return null;
    }
  }, [customRepeatDate, repeatOption, selectedDate]);

  const repeatDateLabel = computedRepeatTarget
    ? formatWordyDate(computedRepeatTarget)
    : undefined;

  const treatmentName = appointmentType === "Other" ? customAppointmentTypeName || "Other" : appointmentType;
  const treatmentNotesText = String(treatmentNotes || "").trim();
  const paymentDateLabel = paymentAmountNow > 0 ? formatBookingPaymentDateLabel(paymentDate) : "";
  const handleConfirmClick = () => {
    return onConfirm({ repeatOption, customRepeatDate });
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
                  {formatWordyDate(selectedDate)} at {selectedTime ? formatTimeTo12h(selectedTime) : "—"}
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

              {/* Repeat / Clone */}
              <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 sm:col-span-6">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-70">Repeat this appointment</p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Select value={repeatOption} onValueChange={handleRepeatOptionChange}>
                      <SelectTrigger className="h-10 min-w-[200px] rounded-full border-0 px-3 text-[10px] font-black uppercase tracking-tighter shadow-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-gray-100 text-gray-700">
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

                    {repeatOption === "custom" && (
                      <>
                        <Button
                          variant="outline"
                          className="h-10 rounded-full border-0 px-4 bg-gradient-to-r from-blue-50 to-blue-50 text-blue-700 font-black text-xs uppercase tracking-tighter shadow-sm hover:from-blue-100 hover:to-blue-100 flex items-center gap-2 transition-all"
                          onClick={() => setCustomRepeatDatePickerOpen(true)}
                        >
                          <CalendarIcon className="h-4 w-4" />
                          {customRepeatDate
                            ? formatWordyDate(parseLocalDateOnly(customRepeatDate), { fallback: "Pick date" })
                            : "Pick date"}
                        </Button>
                        <DatePickerModal
                          open={customRepeatDatePickerOpen}
                          onOpenChange={setCustomRepeatDatePickerOpen}
                          selectedDate={customRepeatDate || selectedDate}
                          onDateSelect={(date) => {
                            const formatted = formatDateToYYYYMMDD(date);
                            handleCustomRepeatDateChange(formatted);
                          }}
                          doctorName={getBookingDoctorValue(doctorName)}
                          patientId={patientId}
                          selectedTime={selectedTime}
                          duration={duration}
                          minDate={selectedDate}
                          title="Choose follow-up date"
                          subtitle="Pick a date for the cloned appointment."
                          disableDatesWithTimeConflict={true}
                          timeConflictMessage="This doctor already has an appointment at the selected time on this day."
                          disableDatesOnOrBeforeMinDate={true}
                        />
                      </>
                    )}
                  </div>

                  {repeatOption !== REPEAT_NONE_OPTION && (
                    <p className="text-sm text-gray-600">
                      {repeatOption === "custom"
                        ? customRepeatDate
                          ? `This appointment will be cloned to ${repeatDateLabel}.`
                          : "Choose a custom clone date to schedule the follow-up."
                        : `This appointment will be cloned to ${repeatDateLabel}.`}
                    </p>
                  )}
                </div>
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
              <div className={`grid gap-3 border-t border-gray-100/70 pt-4 ${paymentDateLabel ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
                <div className="text-center">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Already Paid</p>
                  <p className="text-sm font-black text-emerald-600 tracking-tight">₱{previouslyPaidAmount.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Paying Now</p>
                  <p className="text-sm font-black text-blue-600 tracking-tight">₱{paymentAmountNow.toLocaleString()}</p>
                </div>
                {paymentDateLabel && (
                  <div className="text-center">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Payment Date</p>
                    <p className="text-sm font-black text-gray-700 tracking-tight">{paymentDateLabel}</p>
                  </div>
                )}
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
    </>
  );
}
