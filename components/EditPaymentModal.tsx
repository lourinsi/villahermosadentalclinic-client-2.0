"use client";

import { apiUrl } from "@/lib/api";

import React, { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { DollarSign, Edit } from "lucide-react";
import { Appointment } from "@/hooks/useAppointments";
import { getAuthHeaders } from "@/lib/auth-headers";
import { formatWordyDate } from "@/lib/utils";

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

export function EditPaymentModal() {
  const {
    isPaymentModalOpen,
    closePaymentModal,
    paymentId,
    paymentData,
    patientId,
    appointments: contextAppointments,
  } = usePaymentModal();
  const { refreshPatients } = useAppointmentModal();

  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isFetchingPaymentMethods, setIsFetchingPaymentMethods] = useState(false);
  const [fetchedPaymentData, setFetchedPaymentData] = useState<any | null>(null);
  const [isFetchingPayment, setIsFetchingPayment] = useState(false);
  const [resolvedPaymentId, setResolvedPaymentId] = useState<string | null>(null);

  const effectivePaymentData = fetchedPaymentData || paymentData;

  useEffect(() => {
    if (!isPaymentModalOpen || !paymentId) {
      setFetchedPaymentData(null);
      setIsFetchingPayment(false);
      setResolvedPaymentId(null);
      return;
    }

    let cancelled = false;

    const fetchPayment = async () => {
      setIsFetchingPayment(true);
      try {
        const candidates = getPaymentLookupCandidates(paymentId, paymentData);
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
  }, [isPaymentModalOpen, paymentId, paymentData]);

  useEffect(() => {
    if (isPaymentModalOpen && effectivePaymentData) {
      console.log("Payment Data received:", effectivePaymentData);
      
      // Set payment method with hardcoded fallback options
      const method = effectivePaymentData.method || null;
      setPaymentMethod(method);
      
      // Set amount - handle both 'amount' and 'value' fields
      const amt = effectivePaymentData.amount != null ? effectivePaymentData.amount : (effectivePaymentData.value != null ? effectivePaymentData.value : "");
      setAmount(amt ? String(amt) : "");
      
      // Format and set payment date - ensure it's in YYYY-MM-DD format
      let formattedDate = "";
      if (effectivePaymentData.date) {
        if (typeof effectivePaymentData.date === "string") {
          if (effectivePaymentData.date.includes("T")) {
            // ISO format - extract just the date part
            formattedDate = effectivePaymentData.date.split("T")[0];
          } else {
            formattedDate = effectivePaymentData.date;
          }
        }
      }
      setPaymentDate(formattedDate);
      
      // Set other fields
      setTransactionId(effectivePaymentData.transactionId || "");
      setNotes(effectivePaymentData.notes || "");
      setSelectedAppointment(effectivePaymentData.appointmentId || null);
      
      console.log("Form state set:", {
        method,
        amount: amt,
        date: formattedDate,
        transactionId: effectivePaymentData.transactionId,
        appointmentId: effectivePaymentData.appointmentId
      });
    }
  }, [isPaymentModalOpen, effectivePaymentData]);

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

  const handleSubmit = async () => {
    const amt = parseFloat(amount) || 0;
    const paymentRecordId = resolvedPaymentId || effectivePaymentData?.id || paymentId;
    if (!paymentRecordId) {
      toast.error("Payment ID is missing");
      return;
    }
    if (!paymentMethod) {
      toast.error("Select payment method");
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

    try {
      const body = {
        amount: amt,
        method: paymentMethod,
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
        return;
      }
      toast.success("Payment updated successfully");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("payments:updated"));
        window.dispatchEvent(new CustomEvent("appointments:updated"));
      }
      refreshPatients();
      closePaymentModal();
    } catch (err) {
      console.error("Error updating payment", err);
      toast.error("Error updating payment");
    }
  };

  // Only show in edit mode.
  if (!paymentId && !effectivePaymentData) {
    return null;
  }

  return (
    <Dialog key={paymentId} open={isPaymentModalOpen} onOpenChange={closePaymentModal}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Payment</DialogTitle>
          <DialogDescription>
            Update the payment amount, method, date, transaction ID, and notes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {isFetchingPayment && !effectivePaymentData ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading payment record...
            </div>
          ) : null}

          {/* Combined Summary Box */}
          {effectivePaymentData && selectedAppointment && appointments.length > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm font-semibold text-blue-900 mb-3">Appointment & Payment Summary</div>
              <div className="grid grid-cols-2 gap-4">
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
            <div>
              <Label className="text-sm font-semibold">Payment Method</Label>
              <Select
                value={paymentMethod || ""}
                onValueChange={(v) => setPaymentMethod(v || null)}
                disabled={isFetchingPaymentMethods}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isFetchingPaymentMethods ? "Loading payment methods..." : "Select payment method"} />
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

            <div>
              <Label className="text-sm font-semibold">Payment Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold">Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-sm font-semibold">Transaction ID</Label>
              <Input
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Transaction ID"
              />
            </div>

            <div>
              <Label className="text-sm font-semibold">Transaction Notes (Optional)</Label>
              <Textarea
                placeholder="Additional payment details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t">
            <Button variant="outline" onClick={closePaymentModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-primary hover:bg-primary/90"
              disabled={isFetchingPayment || !paymentMethod || !amount || parseFloat(amount) <= 0}
            >
              <Edit className="h-4 w-4 mr-2" />
              Update Payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
