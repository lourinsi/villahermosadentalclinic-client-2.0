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
import { buildModalMemoryKey, readModalMemory, usePersistentModalMemory } from "@/hooks/usePersistentModalMemory";
import { toast } from "sonner";
import { CheckCircle, CreditCard, X } from "lucide-react";
import { Appointment } from "@/hooks/useAppointments";
import { getAuthHeaders } from "@/lib/auth-headers";
import { formatWordyDate } from "@/lib/utils";
import { getAppointmentTypeName } from "../lib/appointment-types";
import { formatTimeTo12h } from "@/lib/time-slots";

type RecordPaymentModalMemory = {
  selectedAppointment: string | null;
  paymentMethod: string | null;
  amount: string;
  paymentDate: string;
  notes: string;
};

export function RecordPaymentModal() {
  const {
    isPaymentModalOpen,
    closePaymentModal,
    appointmentId,
    patientName,
    appointments,
    paymentData,
  } = usePaymentModal();
  const { refreshPatients } = useAppointmentModal();

  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState<string>("");
  const modalMemoryPausedRef = useRef(false);
  const shouldRememberRecordPaymentDraft = !appointmentId && !paymentData;
  const recordPaymentMemoryKey = useMemo(
    () => buildModalMemoryKey("record-payment-modal", appointmentId || "appointment", patientName || ""),
    [appointmentId, patientName]
  );

  useEffect(() => {
    if (isPaymentModalOpen) {
      modalMemoryPausedRef.current = false;
    }
  }, [isPaymentModalOpen]);

  const restoreRecordPaymentMemory = useCallback((memory: RecordPaymentModalMemory) => {
    setSelectedAppointment(memory.selectedAppointment || null);
    setPaymentMethod(memory.paymentMethod || null);
    setAmount(memory.amount || "");
    setPaymentDate(memory.paymentDate || new Date().toISOString().split("T")[0]);
    setNotes(memory.notes || "");
  }, []);

  const isRecordPaymentMemoryPaused = useCallback(() => modalMemoryPausedRef.current, []);

  const clearRecordPaymentMemory = usePersistentModalMemory({
    key: recordPaymentMemoryKey,
    open: isPaymentModalOpen && !paymentData,
    value: { selectedAppointment, paymentMethod, amount, paymentDate, notes },
    restore: restoreRecordPaymentMemory,
    enabled: shouldRememberRecordPaymentDraft,
    isPaused: isRecordPaymentMemoryPaused,
  });

  const clearCompletedRecordPaymentDraft = useCallback(() => {
    modalMemoryPausedRef.current = true;
    clearRecordPaymentMemory();
  }, [clearRecordPaymentMemory]);

  useEffect(() => {
    if (isPaymentModalOpen) {
      if (shouldRememberRecordPaymentDraft && readModalMemory<RecordPaymentModalMemory>(recordPaymentMemoryKey)) return;
      setSelectedAppointment(appointmentId);
      setPaymentMethod(null);
      setAmount("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setNotes("");
    }
  }, [isPaymentModalOpen, appointmentId, recordPaymentMemoryKey, shouldRememberRecordPaymentDraft]);

  const selectedApt = appointments.find(
    (a: Appointment) => a.id === selectedAppointment
  ) || (appointmentId ? appointments.find((a: Appointment) => a.id === appointmentId) : undefined);
  
  const outstandingBalance = selectedApt
    ? (selectedApt.price || 0) - (selectedApt.totalPaid || 0)
    : 0;

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

    const aptId = selectedAppointment || appointmentId!;

    try {
      const body = {
        appointmentId: aptId,
        amount: amt,
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
      clearCompletedRecordPaymentDraft();
      closePaymentModal();
      toast.success("Payment recorded");
    } catch (err) {
      console.error("Error recording payment", err);
      toast.error("Error recording payment");
    }
  };

  // Only show if we're NOT in edit mode (paymentData would be set for edit mode)
  if (paymentData) {
    return null;
  }

  return (
    <Dialog open={isPaymentModalOpen} onOpenChange={closePaymentModal}>
      <DialogContent
        showCloseButton={false}
        className="!fixed !bottom-0 !left-0 !top-auto !flex h-auto max-h-[86dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-lg sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.75rem]"
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-3 shadow-sm sm:px-6">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="truncate text-xl font-black tracking-tight text-slate-950">Record Payment</DialogTitle>
                <DialogDescription className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-500">
                  {patientName ? `For ${patientName}` : "Apply a payment to an appointment."}
                </DialogDescription>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={closePaymentModal} className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close record payment modal">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 px-5 py-5 custom-scrollbar sm:px-6">
          {!appointmentId && (
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Select Appointment</Label>
              <Select
                value={selectedAppointment || ""}
                onValueChange={(v) => setSelectedAppointment(v || null)}
              >
                <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                  <SelectValue placeholder="Select appointment" />
                </SelectTrigger>
                <SelectContent>
                  {appointments.map((apt: Appointment) => (
                    <SelectItem key={apt.id} value={apt.id}>
                      {getAppointmentTypeName(apt.type, apt.customType)} - {formatWordyDate(apt.date, { fallback: apt.date || "No date" })}{apt.time ? ` ${formatTimeTo12h(apt.time)}` : ""} (Balance: ₱{(
                        (apt.price || 0) - (apt.totalPaid || 0)
                      ).toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {(appointmentId || selectedAppointment) && selectedApt && (
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm">
              <div className="mb-3 text-sm font-black text-blue-900">Appointment & Payment Summary</div>
              <div className="grid grid-cols-2 gap-3 max-[380px]:grid-cols-1">
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Appointment Type</div>
                  <div className="text-sm font-semibold text-gray-900">{selectedApt ? getAppointmentTypeName(selectedApt.type, selectedApt.customType) : ''}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Appointment Date</div>
                  <div className="text-sm font-semibold text-gray-900">{formatWordyDate(selectedApt?.date, { fallback: selectedApt?.date || "No date" })}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Total Price</div>
                  <div className="text-sm font-semibold text-gray-900">₱{(selectedApt?.price || 0).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Outstanding Balance</div>
                  <div className="text-sm font-bold text-red-600">₱{outstandingBalance.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Payment Method</Label>
              <Select
                value={paymentMethod || ""}
                onValueChange={(v) => setPaymentMethod(v || null)}
              >
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
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={outstandingBalance > 0 ? outstandingBalance : undefined}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-white pl-7 font-semibold shadow-sm"
                />
              </div>
              {outstandingBalance > 0 && parseFloat(amount) > outstandingBalance && (
                <p className="text-xs text-red-600 mt-1">
                  Amount exceeds outstanding balance
                </p>
              )}
              {outstandingBalance > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <span>Outstanding: ₱{outstandingBalance.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => setAmount(String(outstandingBalance.toFixed(2)))}
                    className="text-primary font-semibold underline-offset-2 hover:underline"
                  >
                    Pay in full
                  </button>
                </div>
              )}
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
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Transaction Notes (Optional)</Label>
              <Textarea
                placeholder="Additional payment details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="rounded-xl border-slate-200 bg-white font-medium shadow-sm"
              />
            </div>
            
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-900">
                  Transaction ID will be auto-generated upon submission
                </div>
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
              className="h-12 rounded-full bg-blue-600 font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700"
              disabled={
                (!selectedAppointment && !appointmentId) ||
                !paymentMethod ||
                !amount ||
                parseFloat(amount) <= 0
              }
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Record
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
