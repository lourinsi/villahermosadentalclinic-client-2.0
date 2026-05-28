"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { getAppointmentTypeName } from "@/lib/appointmentTypes";
import { useAppointmentStatuses } from "@/hooks/useAppointmentStatuses";
import { getAppointmentStatusOptionWithColors } from "@/lib/status-colors";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "approve" | "reject";
  appointment?: any | null;
  isProcessing?: boolean;
  onConfirm: () => void | Promise<void>;
}

export default function ApproveRejectDialog({ open, onOpenChange, mode, appointment, isProcessing = false, onConfirm }: Props) {
  const { statuses } = useAppointmentStatuses();

  const patientName = appointment?.patientName || appointment?.patient?.name || appointment?.patient || "Patient";
  const status = appointment?.status || "reserved";

  const doctorName = (() => {
    const d = appointment?.doctor || appointment?.doctorName || "";
    if (typeof d === "string") return d;
    return d?.name || d?.fullName || d?.username || "";
  })();

  const paymentStatus = (appointment?.paymentStatus || "unpaid").toLowerCase();

  const title = mode === "approve"
    ? (status === "tbd" ? "Mark as Completed?" : "Approve Appointment?")
    : "Reject Appointment?";

  const description = mode === "approve"
    ? (status === "tbd"
      ? `Are you sure you want to mark this appointment for ${patientName} as Completed?`
      : `Are you sure you want to approve this appointment for ${patientName}? The status will be set to Scheduled.`)
    : `Are you sure you want to reject this appointment for ${patientName}? The status will be set to Cancelled.`;

  const paymentSummary = (() => {
    if (paymentStatus.includes("paid")) return `✓ ${patientName} has paid in full.`;
    if (paymentStatus.includes("half")) return `⚠ ${patientName} has made a partial payment.`;
    if (paymentStatus.includes("pay")) return `📍 ${patientName} will pay at the clinic.`;
    return `✗ ${patientName} has not paid yet.`;
  })();

  const renderStatusBadge = (s?: string) => {
    const statusOption = getAppointmentStatusOptionWithColors(s, statuses);
    return <Badge className={`${statusOption.bgColor} ${statusOption.textColor} border-none hover:opacity-80 font-medium capitalize`}>{statusOption.label || String(s || "")}</Badge>;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl border-none shadow-2xl" onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-black text-gray-900 uppercase tracking-tight">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-500 font-medium">{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {mode === "approve" && (
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-4">
            <p className="text-sm font-medium text-amber-900">{paymentSummary}</p>
          </div>
        )}

        <div className={`p-4 rounded-lg border space-y-2 ${mode === "reject" ? "bg-red-50 border-red-200" : status === "tbd" ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-200"}`}>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Service:</span>
              <span className="font-semibold text-gray-900">{appointment ? getAppointmentTypeName(appointment.type, appointment.customType) : ""}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date & Time:</span>
              <span className="font-semibold text-gray-900">{appointment?.date} {appointment?.time ? `at ${appointment?.time}` : ""}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Doctor:</span>
              <span className="font-semibold text-gray-900">{doctorName}</span>
            </div>
            <div className={`border-t pt-2 ${status === "tbd" ? "border-emerald-100" : "border-blue-100"}`}>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Current Status:</span>
                <div>{renderStatusBadge(appointment?.status || status)}</div>
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-xs tracking-wider">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm()}
            className={mode === "reject" ? "bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider" : "bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider"}
          >
            {isProcessing ? "Processing..." : mode === "reject" ? "Yes, Reject" : (status === "tbd" ? "Yes, Mark as Completed" : "Yes, Approve")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
