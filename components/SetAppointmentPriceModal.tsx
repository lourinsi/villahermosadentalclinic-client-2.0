"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { DollarSign, Tag, Loader2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import type { Appointment } from "@/hooks/useAppointments";
import { getAppointmentPatientDisplayName } from "@/lib/patient-identity";
import { getBookingTreatmentDisplay } from "./sharedBookingLogic";
import { getAppointmentTypeName } from "@/lib/appointment-types";

interface SetAppointmentPriceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onSuccess?: (updatedAppointment: Appointment) => void;
}

export function SetAppointmentPriceModal({
  open,
  onOpenChange,
  appointment,
  onSuccess,
}: SetAppointmentPriceModalProps) {
  const [totalPrice, setTotalPrice] = useState<string>("");
  const [discount, setDiscount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (appointment && open) {
      setTotalPrice(String(appointment.price ?? 0));
      setDiscount(String(appointment.discount ?? 0));
    } else {
      setTotalPrice("");
      setDiscount("");
    }
  }, [appointment, open]);

  if (!appointment) return null;

  const patientName = getAppointmentPatientDisplayName(appointment);
  const treatmentLabels = getBookingTreatmentDisplay(appointment, getAppointmentTypeName).labels.join(", ");

  const numTotalPrice = Math.max(0, Number(totalPrice) || 0);
  const numDiscount = Math.max(0, Number(discount) || 0);
  const netTotal = Math.max(0, numTotalPrice - numDiscount);
  const paid = Math.max(0, Number(appointment.totalPaid) || 0);
  const balance = Math.max(0, netTotal - paid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment?.id) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(String(appointment.id))}`), {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          price: numTotalPrice,
          discount: numDiscount,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to update price");
      }

      const updatedAppointment = result.data || {
        ...appointment,
        price: numTotalPrice,
        discount: numDiscount,
      };

      toast.success("Total price updated successfully");
      if (onSuccess) {
        onSuccess(updatedAppointment);
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating appointment price:", error);
      toast.error(error?.message || "Failed to update price");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <Calculator className="h-5 w-5" />
            </div>
            Set New Price Total
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Adjust the total price and discount for <span className="font-semibold text-slate-700">{patientName}</span> ({treatmentLabels || "Treatment"}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="totalPrice" className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Total Price (₱)
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="totalPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                className="pl-9 text-base font-semibold"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount" className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Discount (₱)
            </Label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="discount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="pl-9 text-base font-semibold text-rose-600"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Summary Box */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Base Price:</span>
              <span className="font-semibold text-slate-900">₱{numTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {numDiscount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span className="font-semibold">-₱{numDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900 text-base">
              <span>Net Total Due:</span>
              <span className="text-violet-700">₱{netTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 pt-1">
              <span>Total Paid: ₱{paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={balance > 0 ? "font-bold text-amber-600" : "font-bold text-emerald-600"}>
                New Balance: ₱{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-violet-600 hover:bg-violet-700 font-bold text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Price"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
