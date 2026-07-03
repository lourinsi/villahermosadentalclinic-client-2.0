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
import { Banknote, CreditCard, X } from "lucide-react";
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
      <DialogContent
        showCloseButton={false}
        className="!fixed !bottom-0 !left-0 !top-auto !flex h-auto max-h-[88dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-md sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.75rem]"
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-3 shadow-sm sm:px-6">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="truncate text-xl font-black tracking-tight text-slate-950">Complete Payment</DialogTitle>
                <DialogDescription className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-500">
                  Secure your appointment with a payment option.
                </DialogDescription>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={closePaymentModal} className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close payment modal">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 px-5 py-5 custom-scrollbar sm:px-6">
          <div className="space-y-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm">
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
            <Label htmlFor="paymentAmount" className="text-xs font-black uppercase tracking-widest text-slate-500">Amount to Pay Now</Label>
            <Input
              id="paymentAmount"
              type="number"
              placeholder={`Enter amount (e.g. ${selectedAppointment.balance ?? selectedAppointment.price})`}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="h-12 rounded-xl border-slate-200 bg-white text-lg font-bold shadow-sm"
            />
            <p className="text-[10px] text-gray-500">Leave blank to pay the full remaining balance.</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Select Payment Method</h3>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className={`h-16 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 ${
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
                className={`h-16 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 ${
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
                className={`h-16 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 ${
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

        <DialogFooter className="shrink-0 !grid grid-cols-2 gap-3 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:px-6">
          <Button
            variant="outline"
            onClick={closePaymentModal}
            className="h-12 w-full rounded-full font-bold"
          >
            Cancel
          </Button>
          <Button
            className="h-12 w-full rounded-full bg-blue-600 font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700"
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
