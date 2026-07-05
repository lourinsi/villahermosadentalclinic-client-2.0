"use client";

import { apiUrl } from "@/lib/api";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { buildModalMemoryKey, usePersistentModalMemory } from "@/hooks/usePersistentModalMemory";
import { toast } from "sonner";
import { CreditCard, DollarSign, Edit, Loader2, X } from "lucide-react";
import { Appointment } from "@/hooks/useAppointments";
import { getAuthHeaders } from "@/lib/auth-headers";
import { getAppointmentTypeName } from "@/lib/appointment-types";
import { formatWordyDate } from "@/lib/utils";
import { normalizeBookingPaymentMethod, NO_PAYMENT_METHOD_LABEL } from "./sharedBookingLogic";
import {
  BookingPaymentPage,
  getAdjustedAppointmentPrice,
  getAppointmentPaid,
  getAppointmentTotalDue,
  toPaymentNumber,
} from "./PaymentModal";
import OverpaymentConfirmDialog from "./OverpaymentConfirmDialog";

const getPaymentLookupCandidates = (paymentId?: string | null, paymentData?: any) => {
  const rawValues = [
    paymentId,
    paymentData?.id,
    paymentData?.paymentId,
    paymentData?.paymentRecordId,
    paymentData?.transactionId,
  ];
  const candidates = new Set<string>();

  rawValues.forEach((value) => {
    const raw = String(value || "").trim();
    if (!raw) return;

    candidates.add(raw);
    if (raw.startsWith("payment-log-")) candidates.add(raw.replace(/^payment-log-/, ""));
    if (raw.startsWith("appointment-log-")) candidates.add(raw.replace(/^appointment-log-/, ""));
  });

  return Array.from(candidates);
};

const getPaymentRecordId = (payment?: any) =>
  String(payment?.id || payment?.paymentId || payment?.paymentRecordId || "").trim();

const getPaymentMethodValue = (payment?: any) =>
  normalizeBookingPaymentMethod(
    payment?.method ||
    payment?.paymentMethod ||
    payment?.appointmentSnapshot?.paymentMethod
  );

const getPaymentOptionLabel = (payment?: any) => {
  const id = getPaymentRecordId(payment) || "Payment";
  const amount = payment?.amount != null ? ` - PHP ${Number(payment.amount || 0).toLocaleString()}` : "";
  const method = getPaymentMethodValue(payment);

  return `${id}${amount} (${method})`;
};

const EDIT_PAYMENT_METHOD_OPTIONS = [
  NO_PAYMENT_METHOD_LABEL,
  "GCash",
  "Card",
  "Cash",
  "Maya",
  "Credit Card",
  "Debit Card",
  "Insurance",
  "Check",
  "Bank Transfer",
  "Pay at Clinic",
];

type EditPaymentModalMemory = {
  paymentMethod: string | null;
  amount: string;
  paymentDate: string;
  transactionId: string;
  notes: string;
  selectedAppointment: string | null;
};

export function EditPaymentModal() {
  const {
    isPaymentModalOpen,
    closePaymentModal,
    paymentId,
    paymentData,
    patientId,
    appointmentId: contextAppointmentId,
    appointments: contextAppointments,
  } = usePaymentModal();
  const { refreshPatients, updateAppointment } = useAppointmentModal();

  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentPayments, setAppointmentPayments] = useState<any[]>([]);
  const [isFetchingPaymentMethods, setIsFetchingPaymentMethods] = useState(false);
  const [isFetchingAppointmentPayments, setIsFetchingAppointmentPayments] = useState(false);
  const [fetchedPaymentData, setFetchedPaymentData] = useState<any | null>(null);
  const [isFetchingPayment, setIsFetchingPayment] = useState(false);
  const [resolvedPaymentId, setResolvedPaymentId] = useState<string | null>(null);
  const [isOverpaymentDialogOpen, setIsOverpaymentDialogOpen] = useState(false);
  const [overpaymentAdjustedPrice, setOverpaymentAdjustedPrice] = useState("");
  const [pendingOverpaymentAmount, setPendingOverpaymentAmount] = useState(0);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [overpaymentLoadingAction, setOverpaymentLoadingAction] = useState<"keep" | "adjust" | null>(null);
  const modalMemoryPausedRef = useRef(false);

  const effectivePaymentData = fetchedPaymentData || paymentData;
  const paymentMethodOptions = useMemo(() => {
    const options = new Set(EDIT_PAYMENT_METHOD_OPTIONS);
    const currentMethod = normalizeBookingPaymentMethod(paymentMethod);
    if (currentMethod) options.add(currentMethod);

    return Array.from(options);
  }, [paymentMethod]);
  const currentAppointmentId = String(
    effectivePaymentData?.appointmentId ||
    contextAppointmentId ||
    selectedAppointment ||
    ""
  ).trim();
  const activePaymentLookupId = resolvedPaymentId || paymentId;
  const editPaymentMemoryKey = useMemo(
    () =>
      buildModalMemoryKey(
        "edit-payment-modal",
        paymentId || effectivePaymentData?.id || "payment",
        patientId || effectivePaymentData?.patientId || ""
      ),
    [effectivePaymentData?.id, effectivePaymentData?.patientId, patientId, paymentId]
  );

  useEffect(() => {
    if (isPaymentModalOpen) {
      modalMemoryPausedRef.current = false;
    }
  }, [isPaymentModalOpen]);

  useEffect(() => {
    if (isPaymentModalOpen) {
      setResolvedPaymentId(null);
      setFetchedPaymentData(null);
      setAppointmentPayments([]);
    }
  }, [isPaymentModalOpen, paymentId]);

  const restoreEditPaymentMemory = useCallback((memory: EditPaymentModalMemory) => {
    setPaymentMethod(memory.paymentMethod || null);
    setAmount(memory.amount || "");
    setPaymentDate(memory.paymentDate || "");
    setTransactionId(memory.transactionId || "");
    setNotes(memory.notes || "");
    setSelectedAppointment(memory.selectedAppointment || null);
  }, []);

  const isEditPaymentMemoryPaused = useCallback(() => modalMemoryPausedRef.current, []);

  const clearEditPaymentMemory = usePersistentModalMemory({
    key: editPaymentMemoryKey,
    open: isPaymentModalOpen,
    value: {
      paymentMethod,
      amount,
      paymentDate,
      transactionId,
      notes,
      selectedAppointment,
    },
    restore: restoreEditPaymentMemory,
    enabled: false,
    isPaused: isEditPaymentMemoryPaused,
  });

  const clearCompletedEditPaymentDraft = useCallback(() => {
    modalMemoryPausedRef.current = true;
    clearEditPaymentMemory();
  }, [clearEditPaymentMemory]);

  useEffect(() => {
    if (!isPaymentModalOpen || !activePaymentLookupId) {
      setFetchedPaymentData(null);
      setIsFetchingPayment(false);
      return;
    }

    let cancelled = false;

    const fetchPayment = async () => {
      setIsFetchingPayment(true);
      try {
        const candidates = getPaymentLookupCandidates(activePaymentLookupId, paymentData);
        let lastError = "Failed to fetch payment";

        for (const candidate of candidates) {
          const res = await fetch(apiUrl(`/api/payments/${encodeURIComponent(candidate)}`), {
            headers: getAuthHeaders({ "Content-Type": "application/json" }),
            credentials: "include",
          });
          const json = await res.json().catch(() => ({}));

          if (!res.ok || !json?.success) {
            lastError = json?.message || lastError;
            continue;
          }

          const nextPaymentData = json.data?.payment || json.data;
          if (!cancelled) {
            setFetchedPaymentData(nextPaymentData || null);
            setResolvedPaymentId(nextPaymentData?.id ? String(nextPaymentData.id) : candidate);
          }
          return;
        }

        throw new Error(lastError);
      } catch (err) {
        console.error("Error fetching payment", err);
        if (!cancelled) {
          setFetchedPaymentData(null);
          toast.error(err instanceof Error ? err.message : "Failed to fetch payment");
        }
      } finally {
        if (!cancelled) setIsFetchingPayment(false);
      }
    };

    fetchPayment();

    return () => {
      cancelled = true;
    };
  }, [isPaymentModalOpen, activePaymentLookupId, paymentData]);

  useEffect(() => {
    if (isPaymentModalOpen && effectivePaymentData) {
      console.log("Payment Data received:", effectivePaymentData);
      
      // Set payment method with hardcoded fallback options
      const method = getPaymentMethodValue(effectivePaymentData);
      setPaymentMethod(method);
      
      // Set amount - handle both 'amount' and 'value' fields
      const amt = effectivePaymentData.amount != null ? effectivePaymentData.amount : (effectivePaymentData.value != null ? effectivePaymentData.value : "");
      setAmount(amt ? String(amt) : "");
      
      // Format and set payment date - ensure it's in YYYY-MM-DD format
      let formattedDate = "";
      const rawDate = effectivePaymentData.paymentDate || effectivePaymentData.date;
      if (rawDate) {
        if (typeof rawDate === "string") {
          if (rawDate.includes("T")) {
            // ISO format - extract just the date part
            formattedDate = rawDate.split("T")[0];
          } else {
            formattedDate = rawDate;
          }
        }
      }
      setPaymentDate(formattedDate);
      
      // Set other fields
      setTransactionId(effectivePaymentData.transactionId || "");
      setNotes(effectivePaymentData.notes || "");
      setSelectedAppointment(
        effectivePaymentData.appointmentId ||
        contextAppointmentId ||
        null
      );
      
      console.log("Form state set:", {
        method,
        amount: amt,
        date: formattedDate,
        transactionId: effectivePaymentData.transactionId,
        appointmentId: effectivePaymentData.appointmentId
      });
    }
  }, [contextAppointmentId, editPaymentMemoryKey, isPaymentModalOpen, effectivePaymentData]);

  useEffect(() => {
    if (!isPaymentModalOpen || !currentAppointmentId) {
      setAppointmentPayments([]);
      setIsFetchingAppointmentPayments(false);
      return;
    }

    let cancelled = false;

    const fetchAppointmentPayments = async () => {
      setIsFetchingAppointmentPayments(true);
      try {
        const res = await fetch(apiUrl(`/api/payments/appointment/${encodeURIComponent(currentAppointmentId)}`), {
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        const rows = res.ok && json?.success && Array.isArray(json.data) ? json.data : [];

        if (cancelled) return;

        const merged = [...rows];
        const effectiveId = getPaymentRecordId(effectivePaymentData);
        if (effectivePaymentData && effectiveId && !merged.some((row) => getPaymentRecordId(row) === effectiveId)) {
          merged.unshift(effectivePaymentData);
        }

        setAppointmentPayments(merged);
      } catch (err) {
        console.error("Error fetching appointment payments", err);
        if (!cancelled) {
          const effectiveId = getPaymentRecordId(effectivePaymentData);
          setAppointmentPayments(effectiveId ? [effectivePaymentData] : []);
        }
      } finally {
        if (!cancelled) setIsFetchingAppointmentPayments(false);
      }
    };

    fetchAppointmentPayments();

    return () => {
      cancelled = true;
    };
  }, [currentAppointmentId, effectivePaymentData, isPaymentModalOpen]);

  useEffect(() => {
    if (isPaymentModalOpen && (patientId || effectivePaymentData?.patientId)) {
      const targetPatientId = patientId || effectivePaymentData?.patientId;

      if (contextAppointments && contextAppointments.length > 0) {
        setAppointments(contextAppointments);
      } else if (targetPatientId) {
        // Fetch appointments if not provided by context
        const fetchAppointments = async () => {
          try {
            const res = await fetch(apiUrl(`/api/appointments?patientId=${targetPatientId}`), {
              headers: getAuthHeaders({ "Content-Type": "application/json" }),
              credentials: "include",
            });
            const json = await res.json();
            if (json.success) {
              setAppointments(json.data);
            }
          } catch (err) {
            console.error("Error fetching appointments for patient", err);
          }
        };
        fetchAppointments();
      }
    }
  }, [isPaymentModalOpen, patientId, effectivePaymentData, contextAppointments]);

  useEffect(() => {
    if (isPaymentModalOpen) {
      // Fetch payment methods
      const fetchPaymentMethods = async () => {
        try {
          setIsFetchingPaymentMethods(true);
          const res = await fetch(apiUrl(`/api/payment-methods`), {
            headers: getAuthHeaders({ "Content-Type": "application/json" }),
            credentials: "include",
          });
          const json = await res.json();
          if (json.success) {
            // paymentMethods state removed as it was unused
          }
        } catch (err) {
          console.error("Error fetching payment methods", err);
        } finally {
          setIsFetchingPaymentMethods(false);
        }
      };
      fetchPaymentMethods();
    }
  }, [isPaymentModalOpen]);

  const selectedAppointmentRecord = appointments.find(
    (appointment: Appointment) => String(appointment.id) === String(selectedAppointment || currentAppointmentId)
  );
  const effectiveAppointmentForTotals = selectedAppointmentRecord || effectivePaymentData?.appointmentSnapshot || null;
  const currentPaymentAmount = toPaymentNumber(effectivePaymentData?.amount ?? effectivePaymentData?.value);
  const totalBilled = getAppointmentTotalDue(effectiveAppointmentForTotals);
  const totalPaid = effectiveAppointmentForTotals ? getAppointmentPaid(effectiveAppointmentForTotals) : currentPaymentAmount;
  const currentBalanceDue = Math.max(0, totalBilled - totalPaid);
  const selectedTreatmentName = selectedAppointmentRecord
    ? getAppointmentTypeName(selectedAppointmentRecord.type, selectedAppointmentRecord.customType)
    : effectivePaymentData?.appointmentSnapshot?.customType || effectivePaymentData?.appointmentSnapshot?.type || "Selected appointment";

  const performUpdatePayment = async ({ adjustedTotalDue }: { adjustedTotalDue?: number } = {}): Promise<boolean> => {
    if (isSubmittingPayment) return false;
    const amt = parseFloat(amount) || 0;
    const paymentRecordId = resolvedPaymentId || effectivePaymentData?.id || paymentId;
    if (!paymentRecordId) {
      toast.error("Payment ID is missing");
      return false;
    }
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return false;
    }
    if (!selectedAppointment) {
      toast.error("Select an appointment");
      return false;
    }

    setIsSubmittingPayment(true);
    try {
      if (adjustedTotalDue !== undefined) {
        if (!currentAppointmentId || !effectiveAppointmentForTotals) {
          toast.error("Appointment details are missing");
          return false;
        }

        await updateAppointment(currentAppointmentId, {
          price: getAdjustedAppointmentPrice(effectiveAppointmentForTotals, adjustedTotalDue),
        });
      }

      const body = {
        amount: amt,
        method: normalizeBookingPaymentMethod(paymentMethod),
        date: paymentDate,
        transactionId: transactionId,
        notes,
        appointmentId: selectedAppointment,
      };

      const res = await fetch(apiUrl(`/api/payments/${encodeURIComponent(paymentRecordId)}`), {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.message || "Failed to update payment");
        return false;
      }
      toast.success("Payment updated successfully");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("payments:updated"));
        window.dispatchEvent(new CustomEvent("appointments:updated"));
      }
      refreshPatients();
      clearCompletedEditPaymentDraft();
      closePaymentModal();
      return true;
    } catch (err) {
      console.error("Error updating payment", err);
      toast.error("Error updating payment");
      return false;
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleSubmit = async () => {
    const amt = parseFloat(amount) || 0;
    const paymentRecordId = resolvedPaymentId || effectivePaymentData?.id || paymentId;
    if (!paymentRecordId) {
      toast.error("Payment ID is missing");
      return;
    }
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!selectedAppointment) {
      toast.error("Select an appointment");
      return;
    }

    const nextTotalPaid = Math.max(0, totalPaid - currentPaymentAmount + amt);
    if (effectiveAppointmentForTotals && nextTotalPaid > totalBilled) {
      setPendingOverpaymentAmount(amt);
      setOverpaymentAdjustedPrice(String(nextTotalPaid));
      setIsOverpaymentDialogOpen(true);
      return;
    }

    await performUpdatePayment();
  };

  // Only show in edit mode.
  if (!paymentId && !effectivePaymentData) {
    return null;
  }

  return (
    <>
    <Dialog key={paymentId} open={isPaymentModalOpen} onOpenChange={closePaymentModal}>
      <DialogContent
        showCloseButton={false}
        className="!fixed !bottom-0 !left-0 !top-auto !flex h-auto max-h-[88dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[calc(100dvh-2rem)] sm:w-[min(56rem,calc(100vw-2rem))] sm:max-w-4xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.75rem]"
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-3 shadow-sm sm:px-6">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="truncate text-xl font-black tracking-tight text-slate-950">Edit Payment</DialogTitle>
                <DialogDescription className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-500">
                  Update payment details and appointment link.
                </DialogDescription>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={closePaymentModal} className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close edit payment modal">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5 custom-scrollbar sm:px-6">
          <BookingPaymentPage
            title="Edit Payment"
            description="Update payment details and appointment link."
            selectedTreatmentName={selectedTreatmentName}
            totalBilled={totalBilled}
            totalPaid={totalPaid}
            currentBalanceDue={currentBalanceDue}
            amount={amount}
            onAmountChange={setAmount}
            paymentDate={paymentDate}
            onPaymentDateChange={setPaymentDate}
            paymentMethod={paymentMethod || ""}
            onPaymentMethodChange={(value) => setPaymentMethod(normalizeBookingPaymentMethod(value))}
            projectedRemainingBalance={Math.max(0, currentBalanceDue - (parseFloat(amount) || 0))}
            onPayFull={() => setAmount(String(currentBalanceDue.toFixed(2)))}
            payFullDisabled={currentBalanceDue <= 0}
            loadingMessage={isFetchingPayment && !effectivePaymentData ? (
              <div className="rounded-[1.25rem] border border-gray-100 bg-white p-4 text-center text-sm font-semibold text-muted-foreground shadow-sm">
                Loading payment record...
              </div>
            ) : null}
            paymentIdSelector={(
              <div className="rounded-[1.25rem] border border-gray-100 bg-white p-4 shadow-sm">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Payment ID</Label>
                <Select
                  value={resolvedPaymentId || getPaymentRecordId(effectivePaymentData) || paymentId || ""}
                  onValueChange={(value) => {
                    setResolvedPaymentId(value);
                    setFetchedPaymentData(null);
                  }}
                  disabled={isFetchingPayment || isFetchingAppointmentPayments || appointmentPayments.length <= 1}
                >
                  <SelectTrigger className="mt-2 h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                    <SelectValue placeholder={isFetchingAppointmentPayments ? "Loading payment ids..." : "Select payment id"} />
                  </SelectTrigger>
                  <SelectContent>
                    {appointmentPayments.length > 0 ? (
                      appointmentPayments.map((payment) => {
                        const optionId = getPaymentRecordId(payment);
                        if (!optionId) return null;

                        return (
                          <SelectItem key={optionId} value={optionId}>
                            {getPaymentOptionLabel(payment)}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value={getPaymentRecordId(effectivePaymentData) || paymentId || "payment"} disabled>
                        {getPaymentRecordId(effectivePaymentData) || paymentId || "No payment id"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            appointmentIdField={(
              <div className="rounded-[1.25rem] border border-gray-100 bg-white p-4 shadow-sm">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Appointment ID</Label>
                <Input
                  value={currentAppointmentId || "N/A"}
                  readOnly
                  className="mt-2 h-12 rounded-xl border-slate-200 bg-slate-100 font-mono text-xs font-semibold text-slate-600 shadow-sm"
                />
              </div>
            )}
            transactionIdField={(
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Transaction ID</Label>
                <Input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Transaction ID"
                  className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm"
                />
              </div>
            )}
            notesField={(
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Transaction Notes (Optional)</Label>
                <Textarea
                  placeholder="Additional payment details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="rounded-xl border-slate-200 bg-white font-medium shadow-sm"
                />
              </div>
            )}
            showHeaderCard={false}
          />
          <div className="hidden">
          {isFetchingPayment && !effectivePaymentData ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading payment record...
            </div>
          ) : null}

          {/* Combined Summary Box */}
          {effectivePaymentData && selectedAppointment && appointments.length > 0 && (
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm">
              <div className="mb-3 text-sm font-black text-blue-900">Appointment & Payment Summary</div>
              <div className="grid grid-cols-2 gap-3 max-[380px]:grid-cols-1">
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Appointment Type</div>
                  <div className="text-sm font-semibold text-gray-900">{appointments.find((a: Appointment) => a.id === selectedAppointment)?.type}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Appointment Date</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatWordyDate(appointments.find((a: Appointment) => a.id === selectedAppointment)?.date, { fallback: "No date" })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Current Amount</div>
                  <div className="text-sm font-semibold text-gray-900">
                    ${effectivePaymentData?.amount ? parseFloat(String(effectivePaymentData.amount)).toFixed(2) : "0.00"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Outstanding Balance</div>
                  <div className="text-sm font-bold text-red-600">${(
                    (appointments.find((a: Appointment) => a.id === selectedAppointment)?.price || 0) - 
                    (appointments.find((a: Appointment) => a.id === selectedAppointment)?.totalPaid || 0)
                  ).toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Payment ID</Label>
              <Select
                value={resolvedPaymentId || getPaymentRecordId(effectivePaymentData) || paymentId || ""}
                onValueChange={(value) => {
                  setResolvedPaymentId(value);
                  setFetchedPaymentData(null);
                }}
                disabled={isFetchingPayment || isFetchingAppointmentPayments || appointmentPayments.length <= 1}
              >
                <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                  <SelectValue placeholder={isFetchingAppointmentPayments ? "Loading payment ids..." : "Select payment id"} />
                </SelectTrigger>
                <SelectContent>
                  {appointmentPayments.length > 0 ? (
                    appointmentPayments.map((payment) => {
                      const optionId = getPaymentRecordId(payment);
                      if (!optionId) return null;

                      return (
                        <SelectItem key={optionId} value={optionId}>
                          {getPaymentOptionLabel(payment)}
                        </SelectItem>
                      );
                    })
                  ) : (
                    <SelectItem value={getPaymentRecordId(effectivePaymentData) || paymentId || "payment"} disabled>
                      {getPaymentRecordId(effectivePaymentData) || paymentId || "No payment id"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Appointment ID</Label>
              <Input
                value={currentAppointmentId || "N/A"}
                readOnly
                className="h-12 rounded-xl border-slate-200 bg-slate-100 font-mono text-xs font-semibold text-slate-600 shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Payment Method</Label>
              <Select
                value={paymentMethod || NO_PAYMENT_METHOD_LABEL}
                onValueChange={(v) => setPaymentMethod(normalizeBookingPaymentMethod(v))}
                disabled={isFetchingPaymentMethods}
              >
                <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                  <SelectValue placeholder={isFetchingPaymentMethods ? "Loading payment methods..." : "Select payment method"} />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodOptions.map((method) => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Payment Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-white pl-9 font-semibold shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Transaction ID</Label>
              <Input
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Transaction ID"
                className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Transaction Notes (Optional)</Label>
              <Textarea
                placeholder="Additional payment details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="rounded-xl border-slate-200 bg-white font-medium shadow-sm"
              />
            </div>
          </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:px-6">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={closePaymentModal} className="h-12 rounded-full font-bold">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="h-12 rounded-full bg-violet-600 font-black text-white shadow-lg shadow-violet-100 hover:bg-violet-700"
              disabled={isSubmittingPayment || isFetchingPayment || !paymentMethod || !amount || parseFloat(amount) <= 0}
            >
              {isSubmittingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4 mr-2" />}
              {isSubmittingPayment ? "Updating..." : "Update"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <OverpaymentConfirmDialog
      open={isOverpaymentDialogOpen}
      onOpenChange={setIsOverpaymentDialogOpen}
      currentTotalDue={totalBilled}
      previousPaidAmount={Math.max(0, totalPaid - currentPaymentAmount)}
      paymentAmount={pendingOverpaymentAmount}
      adjustedPrice={overpaymentAdjustedPrice}
      onAdjustedPriceChange={setOverpaymentAdjustedPrice}
      loadingAction={overpaymentLoadingAction}
      onKeepPrice={() => {
        setOverpaymentLoadingAction("keep");
        void (async () => {
          const didUpdate = await performUpdatePayment();
          if (didUpdate) setIsOverpaymentDialogOpen(false);
          setOverpaymentLoadingAction(null);
        })();
      }}
      onAdjustPrice={() => {
        const previousPaidAmount = Math.max(0, totalPaid - currentPaymentAmount);
        const nextTotalPaid = previousPaidAmount + pendingOverpaymentAmount;
        const parsedAdjustedPrice = Number(overpaymentAdjustedPrice);
        const adjustedTotalDue = Number.isFinite(parsedAdjustedPrice)
          ? Math.max(nextTotalPaid, parsedAdjustedPrice)
          : nextTotalPaid;

        setOverpaymentAdjustedPrice(String(adjustedTotalDue));
        setOverpaymentLoadingAction("adjust");
        void (async () => {
          const didUpdate = await performUpdatePayment({ adjustedTotalDue });
          if (didUpdate) setIsOverpaymentDialogOpen(false);
          setOverpaymentLoadingAction(null);
        })();
      }}
    />
    </>
  );
}
