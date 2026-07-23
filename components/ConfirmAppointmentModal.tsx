"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock,
  Loader2,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import { CompactNotesField } from "./CompactNotesField";
import { DatePickerModal } from "./DatePickerModal";
import { formatBookingPaymentDateLabel, getBookingDoctorValue, normalizeBookingToothNumbers, parseLocalDateOnly } from "./sharedBookingLogic";
import { formatDateToYYYYMMDD, formatWordyDate } from "@/lib/utils";
import { ToothNumbersEditor } from "./ToothNumbersEditor";

const REPEAT_NONE_OPTION = "do-not-repeat";
const REPEAT_OPTIONS = [
  { value: "next-week", label: "Next week" },
  { value: "next-month", label: "Next month" },
  { value: "3-months", label: "3 months from now" },
  { value: "custom", label: "Custom date" },
];

function DetailIcon({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "green";
}) {
  return (
    <span
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm ${
        tone === "green" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
      }`}
    >
      {children}
    </span>
  );
}

function DetailCell({
  label,
  children,
  icon,
  className = "",
}: {
  label: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 p-5 sm:p-6 ${className}`}>
      <p className="mb-3 text-[12px] font-black uppercase tracking-[0.16em] text-slate-500/80">{label}</p>
      <div className="flex min-w-0 items-center gap-4">
        {icon}
        <div className="min-w-0 text-[19px] font-black leading-tight tracking-tight text-slate-950">{children}</div>
      </div>
    </div>
  );
}

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
  serviceSummary?: string;
  selectedDate: Date;
  selectedTime: string;
  duration: string;
  toothNumbers?: string;
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

  // Editable callbacks (optional – cells become interactive when provided)
  onPatientClick?: () => void;
  onDoctorClick?: () => void;
  onServiceClick?: () => void;
  onScheduleClick?: () => void;
  onToothNumbersChange?: (value: string) => void;
  onDurationChange?: (duration: string) => void;
  onTreatmentNotesChange?: (treatmentNotes: string) => void;

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
  serviceSummary,
  selectedDate,
  selectedTime,
  duration,
  toothNumbers = "",
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
  onPatientClick,
  onDoctorClick,
  onServiceClick,
  onScheduleClick,
  onToothNumbersChange,
  onDurationChange,
  onTreatmentNotesChange,
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
  const [isToothEditorOpen, setIsToothEditorOpen] = useState(false);
  const [localToothNumbers, setLocalToothNumbers] = useState(String(toothNumbers || ""));

  useEffect(() => {
    setRepeatOption(repeatOptionProp);
  }, [repeatOptionProp]);

  useEffect(() => {
    setLocalToothNumbers(String(toothNumbers || ""));
    setIsToothEditorOpen(false);
  }, [toothNumbers, open]);

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
        return parseLocalDateOnly(customRepeatDate);
      default:
        return null;
    }
  }, [customRepeatDate, repeatOption, selectedDate]);

  const repeatDateLabel = computedRepeatTarget ? formatWordyDate(computedRepeatTarget) : undefined;
  const treatmentName = serviceSummary ?? (appointmentType === "Other" ? customAppointmentTypeName || "Other" : appointmentType);
  const toothNumbersText = String(toothNumbers || "").trim();
  const treatmentNotesText = String(treatmentNotes || "").trim();
  const paymentDateLabel = paymentAmountNow > 0 ? formatBookingPaymentDateLabel(paymentDate) : "";
  const remainingBalance = Math.max(0, discountedPrice - previouslyPaidAmount - paymentAmountNow);

  const handleConfirmClick = () => {
    return onConfirm({ repeatOption, customRepeatDate });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-tour-id="booking-summary-modal"
          showCloseButton={false}
          className="w-[calc(100vw-1.25rem)] max-w-[960px] gap-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-[960px]"
        >
          <DialogHeader className="relative bg-white px-6 pb-5 pt-7 text-left sm:px-10 sm:pt-9">
            <div className="flex items-start gap-5 pr-10">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-200">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div className="min-w-0 pt-1">
                <DialogTitle className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Confirm Appointment
                </DialogTitle>
                <p className="mt-2 text-lg font-semibold text-slate-500">Please review all details before saving</p>
              </div>
            </div>
            <DialogClose
              className="absolute right-6 top-7 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:right-9 sm:top-9"
              aria-label="Close"
            >
              <X className="h-7 w-7" />
            </DialogClose>
          </DialogHeader>

          <div className="space-y-6 bg-white px-5 pb-7 sm:px-9">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="grid sm:grid-cols-2">
                {/* Patient cell */}
                <div
                  className="min-w-0 border-b border-slate-200 sm:border-r group cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={onPatientClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPatientClick?.(); }}
                  aria-label={`Change patient: ${patientName}`}
                >
                  <DetailCell
                    label="Patient"
                    className=""
                    icon={
                      <Avatar className="h-14 w-14 shrink-0 border-4 border-white shadow-lg">
                        {patientAvatar && <AvatarImage src={patientAvatar} alt={patientName} className="object-cover" />}
                        <AvatarFallback className="bg-blue-600 text-base font-black text-white">
                          {getPersonInitials(patientName)}
                        </AvatarFallback>
                      </Avatar>
                    }
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2 pr-2">
                      <span className="block truncate">{patientName}</span>
                      <Pencil className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:scale-110" />
                    </div>
                  </DetailCell>
                </div>

                {/* Doctor cell */}
                <div
                  className="min-w-0 border-b border-slate-200 group cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={onDoctorClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onDoctorClick?.(); }}
                  aria-label={`Change doctor: ${doctorName}`}
                >
                  <DetailCell
                    label="Doctor"
                    className=""
                    icon={
                      <Avatar className="h-14 w-14 shrink-0 border-4 border-white shadow-lg">
                        {doctorAvatar && <AvatarImage src={doctorAvatar} alt={doctorName} className="object-cover" />}
                        <AvatarFallback className="bg-emerald-500 text-base font-black text-white">
                          {getDoctorInitials(doctorName)}
                        </AvatarFallback>
                      </Avatar>
                    }
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2 pr-2">
                      <span className="block truncate">{doctorName}</span>
                      <Pencil className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:scale-110" />
                    </div>
                  </DetailCell>
                </div>

                {/* Service cell */}
                <div
                  className="min-w-0 border-b border-slate-200 sm:border-r group cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={onServiceClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onServiceClick?.(); }}
                  aria-label={`Change service: ${treatmentName}`}
                >
                  <DetailCell
                    label="Service"
                    className=""
                    icon={
                      <DetailIcon>
                        <CircleDot className="h-7 w-7" />
                      </DetailIcon>
                    }
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2 pr-2">
                      <span className="block truncate">{treatmentName}</span>
                      <Pencil className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:scale-110" />
                    </div>
                  </DetailCell>
                </div>

                {/* Tooth No./s cell - always clickable to toggle inline editor */}
                <div
                  className="min-w-0 border-b border-slate-200 cursor-pointer hover:bg-blue-50/50 transition-colors group"
                  onClick={!isToothEditorOpen ? () => { setLocalToothNumbers(String(toothNumbers || "")); setIsToothEditorOpen(true); } : undefined}
                  role={!isToothEditorOpen ? "button" : undefined}
                  tabIndex={!isToothEditorOpen ? 0 : undefined}
                  onKeyDown={!isToothEditorOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { setLocalToothNumbers(String(toothNumbers || "")); setIsToothEditorOpen(true); } } : undefined}
                  aria-label="Click to edit tooth numbers"
                >
                  <div className="min-w-0 p-5 sm:p-6">
                    <p className="mb-3 text-[12px] font-black uppercase tracking-[0.16em] text-slate-500/80">Tooth No./s</p>
                    {isToothEditorOpen ? (
                      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                        <ToothNumbersEditor
                          value={localToothNumbers}
                          onChange={(val) => {
                            setLocalToothNumbers(val);
                          }}
                          size="sm"
                          autoFocusFirst
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToothNumbersChange?.(localToothNumbers);
                            setIsToothEditorOpen(false);
                          }}
                          className="mt-1 text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline block"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-center justify-between gap-2 pr-2">
                        <div className="min-w-0 text-[19px] font-black leading-tight tracking-tight text-slate-950">
                          <span className={localToothNumbers ? "block truncate" : "block truncate text-slate-400"}>
                            {localToothNumbers || "Click to add tooth numbers"}
                          </span>
                        </div>
                        <Pencil className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:scale-110" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Schedule cell */}
                <div
                  className="min-w-0 border-b border-slate-200 sm:border-r group cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={onScheduleClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onScheduleClick?.(); }}
                  aria-label="Change schedule"
                >
                  <DetailCell
                    label="Schedule"
                    className=""
                    icon={
                      <DetailIcon>
                        <CalendarIcon className="h-7 w-7" />
                      </DetailIcon>
                    }
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2 pr-2">
                      <span className="block truncate">
                        {formatWordyDate(selectedDate)} at {selectedTime ? formatTimeTo12h(selectedTime) : "-"}
                      </span>
                      <Pencil className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:scale-110" />
                    </div>
                  </DetailCell>
                </div>

                <DetailCell
                  label="Duration"
                  className="border-b border-slate-200"
                  icon={
                    <DetailIcon>
                      <Clock className="h-7 w-7" />
                    </DetailIcon>
                  }
                >
                  <div className="flex items-center gap-2">
                    {onDurationChange ? (
                      <Select value={String(duration)} onValueChange={onDurationChange}>
                        <SelectTrigger className="h-10 min-w-[130px] rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 shadow-sm focus:ring-0 focus:ring-offset-0">
                          <SelectValue placeholder={`${duration} mins`} />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                          {["30", "60", "90", "120"].map((mins) => (
                            <SelectItem key={mins} value={mins} className="mx-2 my-1 rounded-xl font-bold">
                              {mins} mins
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="truncate text-sm font-bold text-slate-900">{duration} mins</span>
                    )}
                    {durationConflict && (
                      <span
                        title={bookingConflictWarnings.find((warning) => warning.type === "duration")?.message || durationConflict}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
                      >
                        <AlertCircle className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </DetailCell>

                <DetailCell
                  label="Status"
                  className="border-b border-slate-200 sm:border-r"
                  icon={
                    <DetailIcon tone="green">
                      <CheckCircle2 className="h-7 w-7" />
                    </DetailIcon>
                  }
                >
                  {canEditAppointmentStatus ? (
                    <Select value={appointmentStatus} onValueChange={onAppointmentStatusChange} disabled={appointmentStatusOptions.length === 0}>
                      <SelectTrigger
                        className={`h-11 min-w-[150px] rounded-full border-0 px-4 text-sm font-black uppercase tracking-wide shadow-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${getAppointmentStatusOption(appointmentStatus)?.bgColor || "bg-emerald-100"} ${getAppointmentStatusOption(appointmentStatus)?.textColor || "text-emerald-700"}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        {appointmentStatusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value} className="mx-2 my-1 rounded-xl">
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span
                      className={`inline-flex h-11 items-center rounded-full px-5 text-sm font-black uppercase tracking-wide shadow-sm ${getAppointmentStatusOption(appointmentStatus)?.bgColor || "bg-emerald-100"} ${getAppointmentStatusOption(appointmentStatus)?.textColor || "text-emerald-700"}`}
                    >
                      {getBookingStatusLabel(appointmentStatus, appointmentStatusOptions)}
                    </span>
                  )}
                </DetailCell>

                <DetailCell
                  label="Repeat this appointment"
                  className="border-b border-slate-200"
                  icon={
                    <DetailIcon>
                      <RotateCcw className="h-7 w-7" />
                    </DetailIcon>
                  }
                >
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Select value={repeatOption} onValueChange={handleRepeatOptionChange}>
                        <SelectTrigger className="h-11 min-w-[190px] rounded-full border-0 bg-slate-100 px-4 text-sm font-black text-slate-900 shadow-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                          <SelectItem value={REPEAT_NONE_OPTION} className="mx-2 my-1 rounded-xl">
                            Do not repeat
                          </SelectItem>
                          {REPEAT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="mx-2 my-1 rounded-xl">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {repeatOption === "custom" && (
                        <Button
                          variant="outline"
                          className="h-11 rounded-full border-0 bg-blue-50 px-4 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-100"
                          onClick={() => setCustomRepeatDatePickerOpen(true)}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customRepeatDate
                            ? formatWordyDate(parseLocalDateOnly(customRepeatDate), { fallback: "Pick date" })
                            : "Pick date"}
                        </Button>
                      )}
                    </div>

                    {repeatOption !== REPEAT_NONE_OPTION && (
                      <p className="text-sm font-semibold leading-snug text-slate-500">
                        {repeatOption === "custom"
                          ? customRepeatDate
                            ? `This appointment will be cloned to ${repeatDateLabel}.`
                            : "Choose a custom clone date to schedule the follow-up."
                          : `This appointment will be cloned to ${repeatDateLabel}.`}
                      </p>
                    )}
                  </div>
                </DetailCell>

                <div className="flex min-w-0 gap-4 border-b border-slate-200 p-5 sm:col-span-2 sm:p-6">
                  <DetailIcon>
                    <ClipboardList className="h-7 w-7" />
                  </DetailIcon>
                  <CompactNotesField
                    id="confirm-summary-treatment-notes"
                    label="Treatment Notes"
                    placeholder="No treatment notes added. Click to add..."
                    value={treatmentNotes}
                    onChange={(val) => onTreatmentNotesChange?.(val)}
                    disabled={isPatientReadonly && isCancelled}
                    className="min-w-0 flex-1 space-y-0 [&_button]:h-auto [&_button]:border-transparent [&_button]:pb-0 [&_button]:text-lg"
                    labelClassName="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-slate-500/80"
                  />
                </div>

                <div className="flex min-w-0 gap-4 p-5 sm:col-span-2 sm:p-6">
                  <DetailIcon>
                    <Pencil className="h-7 w-7" />
                  </DetailIcon>
                  <CompactNotesField
                    id="confirm-summary-notes"
                    label={isPatientLevelBookingMode ? "My Notes" : "Additional Notes"}
                    placeholder={isPatientLevelBookingMode ? "Add any notes for your dentist..." : "Any special instructions or clinical notes..."}
                    value={notes}
                    onChange={onNotesChange}
                    disabled={isPatientReadonly && isCancelled}
                    className="min-w-0 flex-1 space-y-0 [&_button]:h-auto [&_button]:border-transparent [&_button]:pb-0 [&_button]:text-lg"
                    labelClassName="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-slate-500/80"
                    textareaClassName="min-h-[72px] resize-none rounded-xl border-slate-200 bg-white p-3 text-base font-semibold text-slate-700 transition-all focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>

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

            {bookingConflictWarnings.length > 0 && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
                <p>This appointment has a scheduling conflict. Hover the warning icon for details.</p>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
              <div className="mb-4 grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-start">
                <div className="min-w-0">
                  <p className="mb-4 text-[12px] font-black uppercase tracking-[0.16em] text-slate-500/80">Financial Summary</p>
                  <p className="mb-1 text-[12px] font-black uppercase tracking-[0.16em] text-slate-500/80">Final Price</p>
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                    {discount > 0 && (
                      <span className="text-xl font-black text-slate-400 line-through decoration-slate-400/60">
                        ₱{finalPrice.toLocaleString()}
                      </span>
                    )}
                    <p className="text-5xl font-black tracking-tight text-blue-600 sm:text-6xl">₱{discountedPrice.toLocaleString()}</p>
                    {discount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700 shadow-sm">
                        Saved ₱{discount.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="min-w-0 sm:justify-self-end sm:text-right">
                  <p className="mb-3 text-[12px] font-black uppercase tracking-[0.16em] text-slate-500/80">Payment Status</p>
                  {canManagePaymentStatuses ? (
                    <Select value={paymentStatus} onValueChange={onPaymentStatusChange}>
                      <SelectTrigger
                        className={`h-14 w-full rounded-full border border-slate-200 px-6 text-base font-black uppercase tracking-wide shadow-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 sm:w-[190px] ${getPaymentStatusOption(paymentStatus)?.bgColor || "bg-white"} ${getPaymentStatusOption(paymentStatus)?.textColor || "text-slate-900"}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        {paymentStatusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value} className="mx-2 my-1 rounded-xl">
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span
                      className={`inline-flex h-14 items-center rounded-full border border-slate-200 px-6 text-base font-black uppercase tracking-wide shadow-sm ${getPaymentStatusOption(paymentStatus)?.bgColor || "bg-white"} ${getPaymentStatusOption(paymentStatus)?.textColor || "text-slate-900"}`}
                    >
                      {getBookingStatusLabel(paymentStatus, paymentStatusOptions)}
                    </span>
                  )}
                </div>
              </div>

              <div className={`grid border-t border-slate-200 pt-5 ${paymentDateLabel ? "grid-cols-2 gap-y-5 sm:grid-cols-4" : "grid-cols-3"}`}>
                <div className="px-2 text-center">
                  <p className="mb-2 text-[12px] font-black uppercase tracking-[0.16em] text-slate-500/80">Already Paid</p>
                  <p className="text-2xl font-black tracking-tight text-emerald-600">₱{previouslyPaidAmount.toLocaleString()}</p>
                </div>
                <div className="border-l border-slate-200 px-2 text-center">
                  <p className="mb-2 text-[12px] font-black uppercase tracking-[0.16em] text-slate-500/80">Paying Now</p>
                  <p className="text-2xl font-black tracking-tight text-blue-600">₱{paymentAmountNow.toLocaleString()}</p>
                </div>
                {paymentDateLabel && (
                  <div className="border-l border-slate-200 px-2 text-center">
                    <p className="mb-2 text-[12px] font-black uppercase tracking-[0.16em] text-slate-500/80">Payment Date</p>
                    <p className="text-lg font-black tracking-tight text-slate-700">{paymentDateLabel}</p>
                  </div>
                )}
                <div className="border-l border-slate-200 px-2 text-center">
                  <p className="mb-2 text-[12px] font-black uppercase tracking-[0.16em] text-slate-500/80">Remaining</p>
                  <p className="text-2xl font-black tracking-tight text-slate-950">₱{remainingBalance.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {userRole === "patient" && isCartAppointmentStatus(appointmentStatus) && (
            <div className="px-5 pb-5 sm:px-9">
              <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">
                Note: This booking will be added to your cart. Adding a payment will reserve this schedule.
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-4 border-t border-slate-200 bg-slate-50/80 p-5 sm:p-6">
            <Button
              data-tour-id="booking-summary-back"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isBooking}
              className="h-16 flex-1 rounded-xl border-2 border-slate-300 bg-white text-lg font-black text-slate-950 hover:bg-slate-50"
            >
              Back to Edit
            </Button>
            <Button
              className="h-16 flex-1 rounded-xl bg-blue-600 text-lg font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-blue-200 hover:bg-blue-700"
              onClick={handleConfirmClick}
              disabled={isBooking}
            >
              {isBooking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {isCartAppointmentStatus(appointmentStatus) ? "Add to Cart" : "Confirm & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
