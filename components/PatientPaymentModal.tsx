"use client";

import { apiUrl } from "@/lib/api";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { CreditCard, Banknote } from "lucide-react";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import { getAppointmentTypeName } from "@/lib/appointment-types";
import { formatTimeTo12h } from "@/lib/time-slots";
import { formatWordyDate } from "@/lib/utils";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { Appointment } from "@/hooks/useAppointments";
import { getAuthHeaders } from "@/lib/auth-headers";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { isCartAppointmentStatus } from "@/lib/appointment-status";

const getNonClinicPaymentStatus = (status?: string | null) =>
  String(status || "").trim().toLowerCase() === "pay-at-clinic" ? "unpaid" : status || "unpaid";

export function PatientPaymentModal() {
  const {
    isPatientPaymentModalOpen,
    closePaymentModal,
    appointmentId,
    appointments,
  } = usePaymentModal();

  const { refreshAppointments } = useAppointmentModal();

  const [paymentMethod, setPaymentMethod] = useState<string>("GCash");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  // confirm dialog state for partial payments
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);

  const selectedAppointment = appointments.find(
    (a: Appointment) => a.id === appointmentId
  );

  const amountToPay = paymentAmount === "" ? (selectedAppointment?.price || 0) : Number(paymentAmount);

  const handleConfirmPayment = async () => {
    if (!selectedAppointment) return;

    if (isNaN(amountToPay) || amountToPay < 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (paymentMethod !== "Pay at Clinic" && amountToPay === 0) {
      toast.error("Payment amount must be greater than 0 for online payments");
      return;
    }

  const isPartial = amountToPay > 0 && amountToPay < (selectedAppointment.price || 0) && paymentMethod !== "Pay at Clinic";

    try {
      setIsLoading(true);
      const body = {
        appointmentId: selectedAppointment.id,
        patientId: selectedAppointment.patientId,
        amount: amountToPay,
        method: paymentMethod,
        date: new Date().toISOString().split("T")[0],
        transactionId: paymentMethod === "Pay at Clinic" 
          ? `PAC-${Math.random().toString(36).slice(2, 9).toUpperCase()}`
          : `T-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        notes: paymentMethod === "Pay at Clinic" ? "Cash upon appointment" : "Online payment via Patient Portal",
      };

      const res = await fetch(apiUrl(`/api/payments`), {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.message || "Failed to complete payment");
        return;
      }

      if (paymentMethod === "Pay at Clinic") {
        toast.success("Request received! Your appointment is now set to 'To Pay' and is scheduled. See you at the clinic!");
      } else if (isPartial) {
        toast.success("Partial payment received! Your slot is reserved (status: Reserved).");
      } else if (isCartAppointmentStatus(json.data?.appointment?.status)) {
        toast.success("Payment received! Our staff will review your booking shortly.");
      } else {
        toast.success("Payment successful! Your appointment is now confirmed and added to your calendar.");
      }
      // Refresh global appointments and broadcast an update so other UI (availability checks)
      // can react immediately without a manual page refresh.
      refreshAppointments();
      try {
        const appointmentId = json.data?.appointment?.id || selectedAppointment.id;
        const newPaymentStatus = isPartial ? 'half-paid' : (paymentMethod === 'Pay at Clinic' ? getNonClinicPaymentStatus(selectedAppointment.paymentStatus) : 'paid');
        // Map to internal appointment status: full paid -> scheduled, partial -> reserved
        const newStatus = isPartial ? 'reserved' : (paymentMethod === 'Pay at Clinic' ? (json.data?.appointment?.status || selectedAppointment.status) : 'scheduled');
        const ev = new CustomEvent('appointments:updated', { detail: { appointmentId, newStatus, newPaymentStatus } });
        window.dispatchEvent(ev);
      } catch (e) {
        // Fallback for older browsers
        if ((window as any).dispatchEvent) {
          (window as any).dispatchEvent(new Event('appointments:updated'));
        }
      }
      closePaymentModal();
    } catch (err) {
      console.error("Error completing payment", err);
      toast.error("Error completing payment");
    } finally {
      setIsLoading(false);
    }
  };

  // Extracted payment performer so confirm can call it
  const performPayment = async () => {
    if (!selectedAppointment) return;

    try {
      setIsLoading(true);
      const body = {
        appointmentId: selectedAppointment.id,
        patientId: selectedAppointment.patientId,
        amount: amountToPay,
        method: paymentMethod,
        date: new Date().toISOString().split("T")[0],
        transactionId: paymentMethod === "Pay at Clinic"
          ? `PAC-${Math.random().toString(36).slice(2, 9).toUpperCase()}`
          : `T-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        notes: paymentMethod === "Pay at Clinic" ? "Cash upon appointment" : "Online payment via Patient Portal",
      };

      const res = await fetch(apiUrl(`/api/payments`), {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.message || "Failed to complete payment");
        return;
      }

      const isPartial = amountToPay > 0 && amountToPay < (selectedAppointment.price || 0) && paymentMethod !== "Pay at Clinic";

      if (paymentMethod === "Pay at Clinic") {
        toast.success("Request received! Your appointment is now set to 'To Pay' and is scheduled. See you at the clinic!");
      } else if (isPartial) {
        toast.success("Partial payment received! Your slot is reserved (status: Reserved).");
      } else if (isCartAppointmentStatus(json.data?.appointment?.status)) {
        toast.success("Payment received! Our staff will review your booking shortly.");
      } else {
        toast.success("Payment successful! Your appointment is now confirmed and added to your calendar.");
      }
      // Refresh global appointments and broadcast an update so other UI (availability checks)
      // can react immediately without a manual page refresh.
      refreshAppointments();
      try {
        const appointmentId = json.data?.appointment?.id || selectedAppointment.id;
        const newPaymentStatus = isPartial ? 'half-paid' : (paymentMethod === 'Pay at Clinic' ? getNonClinicPaymentStatus(selectedAppointment.paymentStatus) : 'paid');
        const newStatus = isPartial ? 'reserved' : (paymentMethod === 'Pay at Clinic' ? (json.data?.appointment?.status || selectedAppointment.status) : 'scheduled');
        const ev = new CustomEvent('appointments:updated', { detail: { appointmentId, newStatus, newPaymentStatus } });
        window.dispatchEvent(ev);
      } catch (e) {
        if ((window as any).dispatchEvent) {
          (window as any).dispatchEvent(new Event('appointments:updated'));
        }
      }
      closePaymentModal();
    } catch (err) {
      console.error("Error completing payment", err);
      toast.error("Error completing payment");
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedAppointment) return null;

  return (
    <>
    <Dialog open={isPatientPaymentModalOpen} onOpenChange={closePaymentModal}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>
            Secure your appointment by completing the payment process.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Service:</span>
              <span className="font-medium">
                {getAppointmentTypeName(
                  selectedAppointment.type,
                  selectedAppointment.customType
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Date:</span>
              <span className="font-medium">
                {formatWordyDate(selectedAppointment.date, {
                  fallback: selectedAppointment.date || "No date",
                })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Time:</span>
              <span className="font-medium">
                {formatTimeTo12h(selectedAppointment.time)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="font-bold">Total Price:</span>
              <span className="font-bold text-lg text-gray-900">
                ₱{selectedAppointment.price || 0}
              </span>
            </div>
            {selectedAppointment.totalPaid && selectedAppointment.totalPaid > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Already Paid:</span>
                <span className="font-medium text-green-600">
                  ₱{selectedAppointment.totalPaid}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="font-bold">Remaining Balance:</span>
              <span className="font-bold text-lg text-blue-600">
                ₱{selectedAppointment.balance ?? (selectedAppointment.price || 0)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentAmount" className="text-sm font-semibold">Amount to Pay Now</Label>
            <Input
              id="paymentAmount"
              type="number"
              placeholder={`Enter amount (e.g. ${selectedAppointment.balance ?? selectedAppointment.price})`}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="font-bold text-lg h-12"
            />
            <p className="text-[10px] text-gray-500">Leave blank to pay the full remaining balance.</p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Select Payment Method</h3>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className={`h-20 flex flex-col items-center justify-center gap-1 border-2 ${
                  paymentMethod === "GCash"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-blue-200"
                }`}
                onClick={() => setPaymentMethod("GCash")}
              >
                <span className="font-black text-blue-700 italic text-lg">
                  GCash
                </span>
              </Button>
              <Button
                variant="outline"
                className={`h-20 flex flex-col items-center justify-center gap-1 border-2 ${
                  paymentMethod === "Card"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-blue-200"
                }`}
                onClick={() => setPaymentMethod("Card")}
              >
                <CreditCard
                  className={`h-6 w-6 ${
                    paymentMethod === "Card" ? "text-blue-600" : "text-gray-600"
                  }`}
                />
                <span
                  className={`text-[10px] font-bold uppercase ${
                    paymentMethod === "Card" ? "text-blue-700" : "text-gray-500"
                  }`}
                >
                  Card
                </span>
              </Button>
              <Button
                variant="outline"
                className={`h-20 flex flex-col items-center justify-center gap-1 border-2 ${
                  paymentMethod === "Pay at Clinic"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-blue-200"
                }`}
                onClick={() => {
                  setPaymentMethod("Pay at Clinic");
                  setPaymentAmount("0"); // Pay at clinic typically means 0 payment now
                }}
              >
                <Banknote
                  className={`h-6 w-6 ${
                    paymentMethod === "Pay at Clinic" ? "text-blue-600" : "text-gray-600"
                  }`}
                />
                <span
                  className={`text-[10px] font-bold uppercase text-center leading-tight ${
                    paymentMethod === "Pay at Clinic" ? "text-blue-700" : "text-gray-500"
                  }`}
                >
                  Pay at Clinic
                </span>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={closePaymentModal}
            className="w-full sm:flex-1"
          >
            Cancel
          </Button>
          <Button
            className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              const isPartialNow = amountToPay > 0 && amountToPay < (selectedAppointment.price || 0) && paymentMethod !== "Pay at Clinic";
              if (isPartialNow) {
                // queue and open confirm
                setConfirmAction(() => async () => {
                  await performPayment();
                });
                setIsConfirmOpen(true);
                return;
              }
              performPayment();
            }}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Confirm Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
  </Dialog>
  {/* Confirm dialog for partial payments */}
  <ConfirmDialog
      open={isConfirmOpen}
      onOpenChange={(open) => {
        if (!open) {
          setConfirmAction(null);
        }
        setIsConfirmOpen(open);
      }}
      title="Confirm Partial Payment"
      message="Your appointment is not scheduled yet, but the slot is reserved for you until the doctor will accept. Proceed?"
      loading={confirmLoading}
      onConfirm={async () => {
        if (confirmAction) {
          setConfirmLoading(true);
          try {
            await confirmAction();
          } finally {
            setConfirmLoading(false);
            setConfirmAction(null);
          }
        }
      }}
      confirmLabel="Proceed"
      cancelLabel="Cancel"
    />
    </>
  );
}
