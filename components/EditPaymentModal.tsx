"use client";

import { apiUrl } from "@/lib/api";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
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

  useEffect(() => {
    if (isPaymentModalOpen && paymentData) {
      console.log("Payment Data received:", paymentData);
      
      // Set payment method with hardcoded fallback options
      const method = paymentData.method || null;
      setPaymentMethod(method);
      
      // Set amount - handle both 'amount' and 'value' fields
      const amt = paymentData.amount != null ? paymentData.amount : (paymentData.value != null ? paymentData.value : "");
      setAmount(amt ? String(amt) : "");
      
      // Format and set payment date - ensure it's in YYYY-MM-DD format
      let formattedDate = "";
      if (paymentData.date) {
        if (typeof paymentData.date === "string") {
          if (paymentData.date.includes("T")) {
            // ISO format - extract just the date part
            formattedDate = paymentData.date.split("T")[0];
          } else {
            formattedDate = paymentData.date;
          }
        }
      }
      setPaymentDate(formattedDate);
      
      // Set other fields
      setTransactionId(paymentData.transactionId || "");
      setNotes(paymentData.notes || "");
      setSelectedAppointment(paymentData.appointmentId || null);
      
      console.log("Form state set:", {
        method,
        amount: amt,
        date: formattedDate,
        transactionId: paymentData.transactionId,
        appointmentId: paymentData.appointmentId
      });
    }
  }, [isPaymentModalOpen, paymentData]);

  useEffect(() => {
    if (isPaymentModalOpen && (patientId || paymentData?.patientId)) {
      const targetPatientId = patientId || paymentData?.patientId;

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
  }, [isPaymentModalOpen, patientId, paymentData, contextAppointments]);

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
    if (!paymentId) {
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

      const res = await fetch(apiUrl(`/api/payments/${paymentId}`), {
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
      refreshPatients();
      closePaymentModal();
    } catch (err) {
      console.error("Error updating payment", err);
      toast.error("Error updating payment");
    }
  };

  // Only show if we have payment data (edit mode)
  if (!paymentData) {
    return null;
  }

  return (
    <Dialog key={paymentId} open={isPaymentModalOpen} onOpenChange={closePaymentModal}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Combined Summary Box */}
          {paymentData && selectedAppointment && appointments.length > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm font-semibold text-blue-900 mb-3">Appointment & Payment Summary</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Appointment Type</div>
                  <div className="text-sm font-semibold text-gray-900">{appointments.find((a: Appointment) => a.id === selectedAppointment)?.type}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Appointment Date</div>
                  <div className="text-sm font-semibold text-gray-900">{appointments.find((a: Appointment) => a.id === selectedAppointment)?.date}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Current Amount</div>
                  <div className="text-sm font-semibold text-gray-900">
                    ${paymentData?.amount ? parseFloat(String(paymentData.amount)).toFixed(2) : "0.00"}
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
              disabled={!paymentMethod || !amount || parseFloat(amount) <= 0}
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
