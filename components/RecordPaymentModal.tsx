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
import { CheckCircle, DollarSign } from "lucide-react";
import { Appointment } from "@/hooks/useAppointments";
import { getAuthHeaders } from "@/lib/auth-headers";
import { getAppointmentTypeName } from "../lib/appointment-types";
import { formatTimeTo12h } from "@/lib/time-slots";

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

  useEffect(() => {
    if (isPaymentModalOpen) {
      setSelectedAppointment(appointmentId);
      setPaymentMethod(null);
      setAmount("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setNotes("");
    }
  }, [isPaymentModalOpen, appointmentId]);

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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment for {patientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!appointmentId && (
            <div>
              <Label className="text-base font-semibold mb-2 block">Select Appointment</Label>
              <Select
                value={selectedAppointment || ""}
                onValueChange={(v) => setSelectedAppointment(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select appointment" />
                </SelectTrigger>
                <SelectContent>
                  {appointments.map((apt: Appointment) => (
                    <SelectItem key={apt.id} value={apt.id}>
                      {getAppointmentTypeName(apt.type, apt.customType)} - {apt.date}{apt.time ? ` ${formatTimeTo12h(apt.time)}` : ""} (Balance: ₱{(
                        (apt.price || 0) - (apt.totalPaid || 0)
                      ).toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {(appointmentId || selectedAppointment) && selectedApt && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm font-semibold text-blue-900 mb-3">Appointment & Payment Summary</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Appointment Type</div>
                  <div className="text-sm font-semibold text-gray-900">{selectedApt ? getAppointmentTypeName(selectedApt.type, selectedApt.customType) : ''}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-medium mb-1">Appointment Date</div>
                  <div className="text-sm font-semibold text-gray-900">{selectedApt?.date}</div>
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
            <div>
              <Label className="text-sm font-semibold">Payment Method</Label>
              <Select
                value={paymentMethod || ""}
                onValueChange={(v) => setPaymentMethod(v || null)}
              >
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
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={outstandingBalance > 0 ? outstandingBalance : undefined}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
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
            
            <div>
              <Label className="text-sm font-semibold">Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
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
            
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-900">
                  Transaction ID will be auto-generated upon submission
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t">
            <Button variant="outline" onClick={closePaymentModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-primary hover:bg-primary/90"
              disabled={
                (!selectedAppointment && !appointmentId) ||
                !paymentMethod ||
                !amount ||
                parseFloat(amount) <= 0
              }
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
