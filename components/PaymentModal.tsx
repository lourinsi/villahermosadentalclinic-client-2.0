"use client";

import { apiUrl } from "@/lib/api";

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { toast } from "sonner";
import { CheckCircle, Edit } from "lucide-react";
import { Appointment } from "@/hooks/useAppointments";
import { getAuthHeaders } from "@/lib/auth-headers";
import { getAppointmentTypeName } from "@/lib/appointment-types";
import { formatTimeTo12h } from "@/lib/time-slots";

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

  const { refreshPatients } = useAppointmentModal();

  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [transactionId, setTransactionId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isFetchingPaymentMethods, setIsFetchingPaymentMethods] = useState(false);
  const paymentAmountPrefilledRef = useRef(false);

  useEffect(() => {
    if (!isPaymentModalOpen) return;

    // If we're opening to edit but paymentData wasn't provided, try to fetch the payment
    if (!paymentData && paymentId) {
      (async () => {
        try {
          if (patientId) {
            const res = await fetch(apiUrl(`/api/payments/patient/${patientId}`), {
              headers: getAuthHeaders({ "Content-Type": "application/json" }),
              credentials: "include",
            });
            const json = await res.json();
            if (json?.success && Array.isArray(json.data)) {
              const found = json.data.find((p: any) => String(p.id) === String(paymentId));
              if (found) {
                const method = found.method || null;
                setPaymentMethod(method);
                const amt = found.amount != null ? found.amount : (found.value != null ? found.value : "");
                setAmount(amt ? String(amt) : "");
                let formattedDate = "";
                if (found.date) {
                  if (typeof found.date === "string") {
                    formattedDate = found.date.includes("T") ? found.date.split("T")[0] : found.date;
                  }
                }
                setPaymentDate(formattedDate || new Date().toISOString().split("T")[0]);
                setTransactionId(found.transactionId || "");
                setNotes(found.notes || "");
                setSelectedAppointment(found.appointmentId || null);

                if (modalAppointments && modalAppointments.length > 0) {
                  setAppointments(modalAppointments);
                } else {
                  const targetPatientId = patientId || found.patientId;
                  if (targetPatientId) {
                    try {
                      const r = await fetch(apiUrl(`/api/appointments?patientId=${targetPatientId}`), {
                        headers: getAuthHeaders({ "Content-Type": "application/json" }),
                        credentials: "include",
                      });
                      const j = await r.json();
                      if (j?.success) setAppointments(j.data || []);
                    } catch (err) {
                      console.error("Error fetching appointments for patient", err);
                      setAppointments([]);
                    }
                  } else {
                    setAppointments([]);
                  }
                }
                return;
              }
            }
          }
        } catch (err) {
          console.error("Error fetching payment for edit fallback", err);
        }
      })();
    }

    if (paymentData) {
      // Edit mode: initialize values from paymentData
      const method = paymentData.method || null;
      setPaymentMethod(method);
      const amt = paymentData.amount != null ? paymentData.amount : (paymentData.value != null ? paymentData.value : "");
      setAmount(amt ? String(amt) : "");
      let formattedDate = "";
      if (paymentData.date) {
        if (typeof paymentData.date === "string") {
          formattedDate = paymentData.date.includes("T") ? paymentData.date.split("T")[0] : paymentData.date;
        }
      }
      setPaymentDate(formattedDate || new Date().toISOString().split("T")[0]);
      setTransactionId(paymentData.transactionId || "");
      setNotes(paymentData.notes || "");
      setSelectedAppointment(paymentData.appointmentId || null);

      if (modalAppointments && modalAppointments.length > 0) {
        setAppointments(modalAppointments);
      } else {
        const targetPatientId = patientId || paymentData.patientId;
        if (targetPatientId) {
          (async () => {
            try {
              const res = await fetch(apiUrl(`/api/appointments?patientId=${targetPatientId}`), {
                headers: getAuthHeaders({ "Content-Type": "application/json" }),
                credentials: "include",
              });
              const json = await res.json();
              if (json.success) setAppointments(json.data || []);
            } catch (err) {
              console.error("Error fetching appointments for patient", err);
            }
          })();
        } else {
          setAppointments([]);
        }
      }
    } else {
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
    }
  }, [isPaymentModalOpen, paymentData, appointmentId, modalAppointments, patientId, initialRecord]);

  useEffect(() => {
    if (!isPaymentModalOpen) return;
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
  }, [isPaymentModalOpen]);

  const selectedApt = appointments.find((a) => a.id === selectedAppointment) || (appointmentId ? appointments.find((a) => a.id === appointmentId) : undefined);
  const outstandingBalance = selectedApt ? (selectedApt.price || 0) - (selectedApt.totalPaid || 0) : 0;
  const isEditing = Boolean(paymentData) || Boolean(paymentId);

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

  const handleSubmit = async () => {
    const amt = parseFloat(amount) || 0;
    if (isEditing) {
      // Edit flow (paymentData or paymentId present)
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
          transactionId,
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
    } else {
      // Record flow
      if (!selectedAppointment && !appointmentId) {
        toast.error("Select an appointment");
        return;
      }
      if (!paymentMethod) {
        toast.error("Select payment method");
        return;
      }
      if (!amount || parseFloat(amount) <= 0) {
        toast.error("Enter a valid amount");
        return;
      }

      const aptId = selectedAppointment || appointmentId!;

      try {
        const body = {
          appointmentId: aptId,
          amount: parseFloat(amount) || 0,
          method: paymentMethod,
          date: paymentDate,
          transactionId: `T-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
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
          return;
        }

        refreshPatients();
        closePaymentModal();
        toast.success("Payment recorded");
      } catch (err) {
        console.error("Error recording payment", err);
        toast.error("Error recording payment");
      }
    }
  };

  return (
    <Dialog open={isPaymentModalOpen} onOpenChange={closePaymentModal}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Payment" : `Record Payment for ${patientName || ""}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {selectedApt && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm font-semibold text-blue-900 mb-3">Appointment & Payment Summary</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Appointment Type</div>
                  <div className="text-sm font-semibold text-gray-900">{getAppointmentTypeName(selectedApt.type, selectedApt.customType)}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Appointment Date</div>
                  <div className="text-sm font-semibold text-gray-900">{selectedApt.date}</div>
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
            <div>
              <Label className="text-base font-semibold mb-2 block">Select Appointment</Label>
              <Select value={selectedAppointment || ""} onValueChange={(v) => setSelectedAppointment(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select appointment" />
                </SelectTrigger>
                <SelectContent>
                  {appointments.map((apt: Appointment) => (
                    <SelectItem key={apt.id} value={apt.id}>
                      {getAppointmentTypeName(apt.type, apt.customType)} - {apt.date}{apt.time ? ` ${formatTimeTo12h(apt.time)}` : ""} (Balance: ₱{(((apt.price || 0) - (apt.totalPaid || 0))).toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">Payment Method</Label>
              <Select value={paymentMethod || ""} onValueChange={(v) => setPaymentMethod(v || null)}>
                <SelectTrigger>
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

            <div>
              <Label className="text-sm font-semibold">Payment Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-7" />
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

            <div>
              <Label className="text-sm font-semibold">Payment Date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>

            <div>
              <Label className="text-sm font-semibold">Transaction ID</Label>
              <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Transaction ID" />
            </div>

            <div>
              <Label className="text-sm font-semibold">Transaction Notes (Optional)</Label>
              <Textarea placeholder="Additional payment details..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t">
            <Button variant="outline" onClick={closePaymentModal}>Cancel</Button>
            <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90" disabled={isEditing ? (!paymentMethod || !amount || parseFloat(amount) <= 0 || !selectedAppointment) : ((!selectedAppointment && !appointmentId) || !paymentMethod || !amount || parseFloat(amount) <= 0)}>
              {isEditing ? <Edit className="h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {isEditing ? "Update Payment" : "Record Payment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
