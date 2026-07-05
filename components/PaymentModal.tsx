"use client";

import { apiUrl } from "@/lib/api";

import React, { ReactNode, RefObject, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { buildModalMemoryKey, readModalMemory, usePersistentModalMemory } from "@/hooks/usePersistentModalMemory";
import { toast } from "sonner";
import { Banknote, Calendar as CalendarIcon, Check, CheckCircle, ClipboardList, CreditCard, Edit, Loader2, X } from "lucide-react";
import { Appointment } from "@/hooks/useAppointments";
import { getAuthHeaders } from "@/lib/auth-headers";
import { formatWordyDate } from "@/lib/utils";
import { getAppointmentTypeName } from "@/lib/appointment-types";
import { formatTimeTo12h } from "@/lib/time-slots";
import OverpaymentConfirmDialog from "./OverpaymentConfirmDialog";

type PaymentModalMemory = {
  selectedAppointment: string | null;
  paymentMethod: string | null;
  amount: string;
  paymentDate: string;
  transactionId: string;
  notes: string;
};

type PaymentMethodCardOption = {
  id: string;
  label: string;
  icon?: ReactNode;
  color?: string;
  shadow?: string;
};

const DEFAULT_PAYMENT_METHOD_OPTIONS: PaymentMethodCardOption[] = [
  { id: "GCash", label: "GCash", icon: "GC", color: "bg-blue-600", shadow: "shadow-blue-100" },
  { id: "Card", label: "Credit Card", icon: <CreditCard className="h-5 w-5" />, color: "bg-violet-600", shadow: "shadow-violet-100" },
  { id: "Cash", label: "Cash", icon: <Banknote className="h-4 w-4" />, color: "bg-slate-700", shadow: "shadow-slate-100" },
];

type BookingPaymentPageProps = {
  title?: string;
  description?: string;
  selectedTreatmentName?: string;
  totalBilled: number;
  totalPaid: number;
  currentBalanceDue: number;
  amount: string;
  onAmountChange: (value: string) => void;
  paymentDate: string;
  onPaymentDateChange: (value: string) => void;
  paymentMethod: string;
  onPaymentMethodChange: (value: string) => void;
  projectedRemainingBalance?: number;
  methodOptions?: PaymentMethodCardOption[];
  onPayFull?: () => void;
  payFullDisabled?: boolean;
  paymentDateInputRef?: RefObject<HTMLInputElement | null>;
  maxPaymentDate?: string;
  onOpenPaymentDatePicker?: () => void;
  paymentDateDisabled?: boolean;
  paymentDateHelp?: string;
  appointmentSelector?: ReactNode;
  paymentIdSelector?: ReactNode;
  appointmentIdField?: ReactNode;
  transactionIdField?: ReactNode;
  notesField?: ReactNode;
  loadingMessage?: ReactNode;
  showHeaderCard?: boolean;
};

const formatCurrency = (value: number) => `PHP ${Math.max(0, Number(value) || 0).toLocaleString()}`;
export const toPaymentNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
export const getAppointmentTotalDue = (appointment?: Partial<Appointment> | null) =>
  Math.max(0, toPaymentNumber(appointment?.price) - toPaymentNumber(appointment?.discount));
export const getAppointmentPaid = (appointment?: Partial<Appointment> | null) =>
  Math.max(0, toPaymentNumber(appointment?.totalPaid));
export const getAdjustedAppointmentPrice = (appointment: Partial<Appointment>, adjustedTotalDue: number) =>
  Math.max(0, adjustedTotalDue + toPaymentNumber(appointment.discount));

export function BookingPaymentPage({
  title = "Payment & Status",
  description = "Review the balance and record the payment.",
  selectedTreatmentName = "Selected Treatment",
  totalBilled,
  totalPaid,
  currentBalanceDue,
  amount,
  onAmountChange,
  paymentDate,
  onPaymentDateChange,
  paymentMethod,
  onPaymentMethodChange,
  projectedRemainingBalance,
  methodOptions,
  onPayFull,
  payFullDisabled,
  paymentDateInputRef,
  maxPaymentDate,
  onOpenPaymentDatePicker,
  paymentDateDisabled = false,
  paymentDateHelp,
  appointmentSelector,
  paymentIdSelector,
  appointmentIdField,
  transactionIdField,
  notesField,
  loadingMessage,
  showHeaderCard = true,
}: BookingPaymentPageProps) {
  const internalPaymentDateInputRef = useRef<HTMLInputElement | null>(null);
  const effectivePaymentDateInputRef = paymentDateInputRef ?? internalPaymentDateInputRef;
  const paymentMethods = useMemo(() => {
    const baseOptions = methodOptions?.length ? methodOptions : DEFAULT_PAYMENT_METHOD_OPTIONS;
    const hasCurrentMethod = baseOptions.some((option) => option.id === paymentMethod);
    if (!paymentMethod || hasCurrentMethod) return baseOptions;

    return [
      ...baseOptions,
      {
        id: paymentMethod,
        label: paymentMethod,
        icon: paymentMethod.slice(0, 2).toUpperCase(),
        color: "bg-emerald-600",
        shadow: "shadow-emerald-100",
      },
    ];
  }, [methodOptions, paymentMethod]);
  const openNativePaymentDatePicker = useCallback(() => {
    if (paymentDateDisabled) return;

    if (onOpenPaymentDatePicker) {
      onOpenPaymentDatePicker();
      return;
    }

    const input = effectivePaymentDateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
  }, [effectivePaymentDateInputRef, onOpenPaymentDatePicker, paymentDateDisabled]);
  const paymentDateInputClassName = `h-16 rounded-2xl border-2 px-4 pr-16 text-xl font-black tracking-tight shadow-none focus:ring-0 min-[860px]:h-20 min-[860px]:px-6 min-[860px]:pr-20 min-[860px]:text-3xl [&::-webkit-calendar-picker-indicator]:opacity-0 ${
    paymentDateDisabled
      ? "pointer-events-none cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70"
      : "border-slate-200 bg-white text-slate-950 focus:border-blue-500 focus:bg-white"
  }`;
  const paymentDateButtonClassName = `absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 min-[860px]:right-5 ${
    paymentDateDisabled
      ? "cursor-not-allowed text-slate-300"
      : "text-slate-950 hover:bg-slate-100"
  }`;

  return (
    <div data-tour-id="booking-payment-step" className="mx-auto max-w-5xl space-y-4 py-1 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:space-y-5 sm:py-2">
      {showHeaderCard ? (
        <div className="flex items-center gap-4 px-1 sm:gap-6 sm:rounded-[1.25rem] sm:border sm:border-gray-100 sm:bg-white sm:p-6 sm:shadow-sm">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.25rem] bg-emerald-600 text-white shadow-xl shadow-emerald-100 sm:h-16 sm:w-16">
            <CreditCard className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h3 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">{title}</h3>
            <p className="mt-1 text-base font-medium leading-snug text-slate-500">{description}</p>
          </div>
        </div>
      ) : null}

      {loadingMessage}
      {appointmentSelector}
      {paymentIdSelector}
      {appointmentIdField}

      <div className="rounded-[1.25rem] border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <h4 className="mb-4 text-xl font-black text-gray-900 sm:text-lg">Bill Summary</h4>
        <div className="divide-y divide-gray-100">
          <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <ClipboardList className="h-6 w-6" />
              </span>
              <p className="text-base font-bold text-slate-500">Total Billed</p>
            </div>
            <p className="text-xl font-black tracking-tight text-gray-900">{formatCurrency(totalBilled)}</p>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <CreditCard className="h-6 w-6" />
              </span>
              <p className="text-base font-bold text-slate-500">Total Paid</p>
            </div>
            <p className="text-xl font-black tracking-tight text-gray-900">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Banknote className="h-6 w-6" />
              </span>
              <p className="text-base font-bold text-slate-500">Current Balance Due</p>
            </div>
            <p className="text-2xl font-black tracking-tight text-emerald-600">{formatCurrency(currentBalanceDue)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="space-y-6">
          <div>
            <h4 className="text-xl font-black text-gray-900 sm:text-2xl">Payment Details</h4>
            <p className="mt-3 text-base font-medium text-slate-500">
              Payment for: <span className="font-black text-emerald-600">{selectedTreatmentName}</span>
            </p>
          </div>

          <div className="grid gap-5 min-[860px]:grid-cols-2 min-[860px]:items-start">
            <div className="space-y-3">
              <Label htmlFor="sharedPaymentAmount" className="text-base font-semibold text-slate-900">
                Amount to Pay
              </Label>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center">
                  <span className="text-2xl font-black text-slate-300 transition-colors group-focus-within:text-emerald-600">PHP</span>
                </div>
                <Input
                  id="sharedPaymentAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={amount}
                  onChange={(event) => onAmountChange(event.target.value)}
                  className="h-16 rounded-2xl border-2 border-emerald-200/80 bg-white pl-20 pr-28 text-2xl font-black tracking-tight text-slate-950 shadow-none transition-all appearance-none focus:border-emerald-500 focus:bg-white focus:ring-0 min-[860px]:h-20 min-[860px]:pr-32 min-[860px]:text-3xl"
                />
                {onPayFull ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onPayFull}
                    disabled={payFullDisabled}
                    className="absolute right-3 top-1/2 h-9 -translate-y-1/2 rounded-xl px-3 text-xs font-black uppercase tracking-wide text-blue-700 hover:bg-blue-50 disabled:opacity-40 min-[860px]:right-4 min-[860px]:h-10 min-[860px]:text-sm"
                  >
                    PAY FULL
                  </Button>
                ) : null}
              </div>
              {projectedRemainingBalance !== undefined ? (
                <p className="hidden text-sm font-medium text-slate-500 sm:block">
                  Remaining balance after payment: <span className="font-black text-emerald-600">{formatCurrency(projectedRemainingBalance)}</span>
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <Label htmlFor="sharedPaymentDate" className="text-base font-semibold text-slate-700">
                Payment Date
              </Label>
              <div className={`relative ${paymentDateDisabled ? "cursor-not-allowed" : ""}`}>
                <Input
                  ref={effectivePaymentDateInputRef}
                  id="sharedPaymentDate"
                  type="date"
                  value={paymentDate}
                  max={maxPaymentDate}
                  disabled={paymentDateDisabled}
                  onChange={(event) => onPaymentDateChange(event.target.value)}
                  onMouseDown={(event) => {
                    if (!onOpenPaymentDatePicker || paymentDateDisabled) return;
                    event.preventDefault();
                    openNativePaymentDatePicker();
                  }}
                  onClick={(event) => {
                    if (!onOpenPaymentDatePicker || paymentDateDisabled) return;
                    event.preventDefault();
                    openNativePaymentDatePicker();
                  }}
                  aria-disabled={paymentDateDisabled}
                  className={paymentDateInputClassName}
                />
                <button
                  type="button"
                  onClick={openNativePaymentDatePicker}
                  disabled={paymentDateDisabled}
                  aria-disabled={paymentDateDisabled}
                  aria-label="Open payment date calendar"
                  className={paymentDateButtonClassName}
                >
                  <CalendarIcon className="h-6 w-6" />
                </button>
              </div>
              {paymentDateHelp ? (
                <p className="hidden text-sm font-medium text-slate-500 sm:block">{paymentDateHelp}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-6">
          <p className="text-base font-semibold text-gray-900">Payment Method</p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-3 sm:gap-4">
            {paymentMethods.map((pm) => (
              <button
                key={pm.id}
                type="button"
                aria-pressed={paymentMethod === pm.id}
                onClick={() => onPaymentMethodChange(pm.id)}
                className={`relative flex min-h-[5.25rem] items-center gap-4 rounded-2xl border-2 px-4 pr-12 text-left transition-all group sm:gap-5 sm:px-5 ${
                  paymentMethod === pm.id
                    ? `border-blue-600 bg-white text-blue-700 shadow-lg ${pm.shadow || "shadow-blue-100"}`
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${pm.color || "bg-slate-700"} text-sm font-black text-white shadow-lg transition-transform group-hover:scale-105 sm:h-16 sm:w-16`}>
                  {pm.icon || pm.label.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-base font-black text-gray-900">{pm.label}</span>
                <div className={`absolute right-5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 ${
                  paymentMethod === pm.id ? "border-blue-600 text-blue-600" : "border-gray-200 text-transparent"
                }`}>
                  <Check className="h-5 w-5" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {(transactionIdField || notesField) && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4 pt-6">
            {transactionIdField}
            {notesField}
          </div>
        )}
      </div>
    </div>
  );
}

export function PaymentModal() {
  const {
    isPaymentModalOpen,
    closePaymentModal,
    appointmentId,
    patientName,
    appointments: modalAppointments,
    paymentData,
    paymentId,
    patientId,
    initialRecord,
  } = usePaymentModal();

  const { refreshPatients, updateAppointment } = useAppointmentModal();

  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [transactionId, setTransactionId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isFetchingPaymentMethods, setIsFetchingPaymentMethods] = useState(false);
  const [isOverpaymentDialogOpen, setIsOverpaymentDialogOpen] = useState(false);
  const [overpaymentAdjustedPrice, setOverpaymentAdjustedPrice] = useState("");
  const [pendingOverpaymentAmount, setPendingOverpaymentAmount] = useState(0);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [overpaymentLoadingAction, setOverpaymentLoadingAction] = useState<"keep" | "adjust" | null>(null);
  const paymentAmountPrefilledRef = useRef(false);
  const modalMemoryPausedRef = useRef(false);
  const shouldRememberPaymentDraft = !appointmentId && !paymentData && !paymentId;
  const paymentMemoryKey = useMemo(
    () =>
      buildModalMemoryKey(
        "payment-modal",
        appointmentId || "appointment",
        patientId || patientName || "",
        initialRecord?.transactionId || ""
      ),
    [appointmentId, initialRecord?.transactionId, patientId, patientName]
  );

  useEffect(() => {
    if (isPaymentModalOpen) {
      modalMemoryPausedRef.current = false;
    }
  }, [isPaymentModalOpen]);

  const restorePaymentMemory = useCallback((memory: PaymentModalMemory) => {
    setSelectedAppointment(memory.selectedAppointment || null);
    setPaymentMethod(memory.paymentMethod || null);
    setAmount(memory.amount || "");
    setPaymentDate(memory.paymentDate || new Date().toISOString().split("T")[0]);
    setTransactionId(memory.transactionId || "");
    setNotes(memory.notes || "");
  }, []);

  const isPaymentMemoryPaused = useCallback(() => modalMemoryPausedRef.current, []);

  const clearPaymentMemory = usePersistentModalMemory({
    key: paymentMemoryKey,
    open: isPaymentModalOpen && !paymentData && !paymentId,
    value: {
      selectedAppointment,
      paymentMethod,
      amount,
      paymentDate,
      transactionId,
      notes,
    },
    restore: restorePaymentMemory,
    enabled: shouldRememberPaymentDraft,
    isPaused: isPaymentMemoryPaused,
  });

  const clearCompletedPaymentDraft = useCallback(() => {
    modalMemoryPausedRef.current = true;
    clearPaymentMemory();
  }, [clearPaymentMemory]);

  useEffect(() => {
    if (!isPaymentModalOpen) return;
    if (paymentData || paymentId) return;
    if (shouldRememberPaymentDraft && readModalMemory<PaymentModalMemory>(paymentMemoryKey)) {
      setAppointments(modalAppointments || []);
      return;
    }

    // Record mode: reset fields and use modalAppointments
    setSelectedAppointment(appointmentId || null);
    setPaymentMethod(null);
    // If an initialRecord was provided (legacy recorded total), prefill amount/transactionId/notes
    if (initialRecord && initialRecord.amount != null) {
      setAmount(String(initialRecord.amount));
    } else {
      setAmount("");
    }
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setTransactionId(initialRecord?.transactionId || "");
    setNotes(initialRecord?.notes || "");
    setAppointments(modalAppointments || []);
    // Clear initialRecord after using it so subsequent opens don't reuse it
    // (usePaymentModal.closePaymentModal will also clear it on modal close)
  }, [isPaymentModalOpen, paymentData, paymentId, appointmentId, modalAppointments, patientId, initialRecord, paymentMemoryKey, shouldRememberPaymentDraft]);

  useEffect(() => {
    if (!isPaymentModalOpen) return;
    if (paymentData || paymentId) return;
    try {
      // eslint-disable-next-line no-console
      const aptIds = (modalAppointments || []).slice(0, 20).map((a) => a.id);
      const lookupId = selectedAppointment || appointmentId || null;
      const found = (modalAppointments || []).find((a) => String(a.id) === String(lookupId));
      console.log("[PaymentModal] opened", { isPaymentModalOpen, paymentId, paymentData, appointmentId, selectedAppointment, patientId, modalAppointmentsLength: modalAppointments?.length, modalAppointmentIds: aptIds, lookupId, foundId: found?.id || null, initialRecord });
    } catch (e) {}
  }, [isPaymentModalOpen, paymentId, paymentData, appointmentId, patientId, modalAppointments]);

  useEffect(() => {
    if (!isPaymentModalOpen) return;
    if (paymentData || paymentId) return;
    const fetchPaymentMethods = async () => {
      try {
        setIsFetchingPaymentMethods(true);
        const res = await fetch(apiUrl(`/api/payment-methods`), {
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          credentials: "include",
        });
        const json = await res.json();
        // not used directly — UI keeps static options
      } catch (err) {
        console.error("Error fetching payment methods", err);
      } finally {
        setIsFetchingPaymentMethods(false);
      }
    };
    fetchPaymentMethods();
  }, [isPaymentModalOpen, paymentData, paymentId]);

  const selectedApt = appointments.find((a) => a.id === selectedAppointment) || (appointmentId ? appointments.find((a) => a.id === appointmentId) : undefined);
  const selectedAptTotalDue = getAppointmentTotalDue(selectedApt);
  const selectedAptPaid = getAppointmentPaid(selectedApt);
  const outstandingBalance = selectedApt ? selectedAptTotalDue - selectedAptPaid : 0;
  const isEditing = Boolean(paymentData) || Boolean(paymentId);
  const isPaymentDateDisabled = (parseFloat(amount) || 0) <= 0;

  useEffect(() => {
    if (!isPaymentModalOpen) {
      paymentAmountPrefilledRef.current = false;
      return;
    }

    if (isEditing || !selectedApt || outstandingBalance <= 0 || paymentAmountPrefilledRef.current) return;
    if (amount.trim() !== "") {
      paymentAmountPrefilledRef.current = true;
      return;
    }

    setAmount(String(outstandingBalance.toFixed(2)));
    paymentAmountPrefilledRef.current = true;
  }, [isPaymentModalOpen, isEditing, selectedApt, amount, outstandingBalance]);

  if (isEditing) {
    return null;
  }

  const performRecordPayment = async ({ adjustedTotalDue }: { adjustedTotalDue?: number } = {}): Promise<boolean> => {
    if (isSubmittingPayment) return false;
    if (!selectedAppointment && !appointmentId) {
      toast.error("Select an appointment");
      return false;
    }
    if (!paymentMethod) {
      toast.error("Select payment method");
      return false;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return false;
    }

    const aptId = selectedAppointment || appointmentId!;

    setIsSubmittingPayment(true);
    try {
      if (selectedApt && adjustedTotalDue !== undefined) {
        await updateAppointment(String(selectedApt.id), {
          price: getAdjustedAppointmentPrice(selectedApt, adjustedTotalDue),
        });
      }

      const body = {
        appointmentId: aptId,
        amount: parseFloat(amount) || 0,
        method: paymentMethod,
        date: paymentDate,
        transactionId: transactionId || `T-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        notes,
      };

      const res = await fetch(apiUrl(`/api/payments`), {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.message || "Failed to record payment");
        return false;
      }

      refreshPatients();
      clearCompletedPaymentDraft();
      closePaymentModal();
      toast.success("Payment recorded");
      return true;
    } catch (err) {
      console.error("Error recording payment", err);
      toast.error("Error recording payment");
      return false;
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleSubmit = async () => {
    const amt = parseFloat(amount) || 0;

    if (!selectedAppointment && !appointmentId) {
      toast.error("Select an appointment");
      return;
    }
    if (!paymentMethod) {
      toast.error("Select payment method");
      return;
    }
    if (!amount || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    const nextTotalPaid = selectedAptPaid + amt;
    if (selectedApt && nextTotalPaid > selectedAptTotalDue) {
      setPendingOverpaymentAmount(amt);
      setOverpaymentAdjustedPrice(String(nextTotalPaid));
      setIsOverpaymentDialogOpen(true);
      return;
    }

    await performRecordPayment();
  };

  return (
    <>
    <Dialog open={isPaymentModalOpen} onOpenChange={closePaymentModal}>
      <DialogContent
        showCloseButton={false}
        className="!fixed !bottom-0 !left-0 !top-auto !flex h-auto max-h-[88dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[calc(100dvh-2rem)] sm:w-[min(56rem,calc(100vw-2rem))] sm:max-w-4xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.75rem]"
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-3 shadow-sm sm:px-6">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="truncate text-xl font-black tracking-tight text-slate-950">
                  {isEditing ? "Edit Payment" : "Record Payment"}
                </DialogTitle>
                <DialogDescription className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-500">
                  {patientName ? `For ${patientName}` : "Apply a payment to an appointment."}
                </DialogDescription>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={closePaymentModal} className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close payment modal">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5 custom-scrollbar sm:px-6">
          <BookingPaymentPage
            title="Record Payment"
            description={patientName ? `For ${patientName}` : "Apply a payment to an appointment."}
            selectedTreatmentName={selectedApt ? getAppointmentTypeName(selectedApt.type, selectedApt.customType) : "Selected appointment"}
            totalBilled={selectedApt?.price || 0}
            totalPaid={selectedApt?.totalPaid || 0}
            currentBalanceDue={outstandingBalance}
            amount={amount}
            onAmountChange={setAmount}
            paymentDate={paymentDate}
            onPaymentDateChange={setPaymentDate}
            paymentDateDisabled={isPaymentDateDisabled}
            paymentMethod={paymentMethod || ""}
            onPaymentMethodChange={(value) => setPaymentMethod(value || null)}
            projectedRemainingBalance={Math.max(0, outstandingBalance - (parseFloat(amount) || 0))}
            onPayFull={() => setAmount(String(outstandingBalance.toFixed(2)))}
            payFullDisabled={outstandingBalance <= 0}
            appointmentSelector={!paymentData && !appointmentId ? (
              <div className="rounded-[1.25rem] border border-gray-100 bg-white p-4 shadow-sm">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Select Appointment</Label>
                <Select value={selectedAppointment || ""} onValueChange={(v) => setSelectedAppointment(v || null)}>
                  <SelectTrigger className="mt-2 h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                    <SelectValue placeholder="Select appointment" />
                  </SelectTrigger>
                  <SelectContent>
                    {appointments.map((apt: Appointment) => (
                      <SelectItem key={apt.id} value={apt.id}>
                        {getAppointmentTypeName(apt.type, apt.customType)} - {formatWordyDate(apt.date, { fallback: apt.date || "No date" })}{apt.time ? ` ${formatTimeTo12h(apt.time)}` : ""} (Balance: PHP {(((apt.price || 0) - (apt.totalPaid || 0))).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            paymentDateHelp={selectedApt ? formatWordyDate(selectedApt.date, { fallback: selectedApt.date || "No appointment date" }) : undefined}
            transactionIdField={(
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Transaction ID</Label>
                <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Transaction ID" className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm" />
              </div>
            )}
            notesField={(
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Transaction Notes (Optional)</Label>
                <Textarea placeholder="Additional payment details..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="rounded-xl border-slate-200 bg-white font-medium shadow-sm" />
              </div>
            )}
            showHeaderCard={false}
          />
          <div className="hidden">
          {selectedApt && (
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm">
              <div className="mb-3 text-sm font-black text-blue-900">Appointment & Payment Summary</div>
              <div className="grid grid-cols-2 gap-3 max-[380px]:grid-cols-1">
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Appointment Type</div>
                  <div className="text-sm font-semibold text-gray-900">{getAppointmentTypeName(selectedApt.type, selectedApt.customType)}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Appointment Date</div>
                  <div className="text-sm font-semibold text-gray-900">{formatWordyDate(selectedApt.date, { fallback: selectedApt.date || "No date" })}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Total Price</div>
                  <div className="text-sm font-semibold text-gray-900">₱{(selectedApt.price || 0).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Outstanding Balance</div>
                  <div className="text-sm font-bold text-red-600">₱{outstandingBalance.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {!paymentData && !appointmentId && (
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Select Appointment</Label>
              <Select value={selectedAppointment || ""} onValueChange={(v) => setSelectedAppointment(v || null)}>
                <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                  <SelectValue placeholder="Select appointment" />
                </SelectTrigger>
                <SelectContent>
                  {appointments.map((apt: Appointment) => (
                    <SelectItem key={apt.id} value={apt.id}>
                      {getAppointmentTypeName(apt.type, apt.customType)} - {formatWordyDate(apt.date, { fallback: apt.date || "No date" })}{apt.time ? ` ${formatTimeTo12h(apt.time)}` : ""} (Balance: ₱{(((apt.price || 0) - (apt.totalPaid || 0))).toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Payment Method</Label>
              <Select value={paymentMethod || ""} onValueChange={(v) => setPaymentMethod(v || null)}>
                <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Debit Card">Debit Card</SelectItem>
                  <SelectItem value="Insurance">Insurance</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Payment Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 rounded-xl border-slate-200 bg-white pl-7 font-semibold shadow-sm" />
              </div>
              {outstandingBalance > 0 && parseFloat(amount) > outstandingBalance && (
                <p className="text-xs text-red-600 mt-1">Amount exceeds outstanding balance</p>
              )}
              {outstandingBalance > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <span>Outstanding: ₱{outstandingBalance.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Payment Date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Transaction ID</Label>
              <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Transaction ID" className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Transaction Notes (Optional)</Label>
              <Textarea placeholder="Additional payment details..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="rounded-xl border-slate-200 bg-white font-medium shadow-sm" />
            </div>
          </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:px-6">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={closePaymentModal} className="h-12 rounded-full font-bold">Cancel</Button>
            <Button onClick={handleSubmit} className="h-12 rounded-full bg-blue-600 font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700" disabled={isSubmittingPayment || (isEditing ? (!paymentMethod || !amount || parseFloat(amount) <= 0 || !selectedAppointment) : ((!selectedAppointment && !appointmentId) || !paymentMethod || !amount || parseFloat(amount) <= 0))}>
              {isSubmittingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEditing ? <Edit className="mr-2 h-4 w-4" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              {isSubmittingPayment ? "Recording..." : isEditing ? "Update" : "Record"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <OverpaymentConfirmDialog
      open={isOverpaymentDialogOpen}
      onOpenChange={setIsOverpaymentDialogOpen}
      currentTotalDue={selectedAptTotalDue}
      previousPaidAmount={selectedAptPaid}
      paymentAmount={pendingOverpaymentAmount}
      adjustedPrice={overpaymentAdjustedPrice}
      onAdjustedPriceChange={setOverpaymentAdjustedPrice}
      loadingAction={overpaymentLoadingAction}
      onKeepPrice={() => {
        setOverpaymentLoadingAction("keep");
        void (async () => {
          const didRecord = await performRecordPayment();
          if (didRecord) setIsOverpaymentDialogOpen(false);
          setOverpaymentLoadingAction(null);
        })();
      }}
      onAdjustPrice={() => {
        const nextTotalPaid = selectedAptPaid + pendingOverpaymentAmount;
        const parsedAdjustedPrice = Number(overpaymentAdjustedPrice);
        const adjustedTotalDue = Number.isFinite(parsedAdjustedPrice)
          ? Math.max(nextTotalPaid, parsedAdjustedPrice)
          : nextTotalPaid;

        setOverpaymentAdjustedPrice(String(adjustedTotalDue));
        setOverpaymentLoadingAction("adjust");
        void (async () => {
          const didRecord = await performRecordPayment({ adjustedTotalDue });
          if (didRecord) setIsOverpaymentDialogOpen(false);
          setOverpaymentLoadingAction(null);
        })();
      }}
    />
    </>
  );
}
