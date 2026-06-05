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
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Calendar as CalendarIcon, DollarSign } from "lucide-react";
import { getAppointmentTypeName } from "@/lib/appointmentTypes";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useAppointmentStatuses } from "@/hooks/useAppointmentStatuses";
import { getAppointmentStatusOptionWithColors } from "@/lib/status-colors";
import {
  RecurringAppointmentCancelSelector,
  type RecurringAppointmentDeletionItem,
} from "./RecurringAppointmentCancelSelector";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "approve" | "reject" | "cancel";
  appointment?: any | null;
  isProcessing?: boolean;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  recurringAppointmentDeletionItems?: RecurringAppointmentDeletionItem[];
  selectedRecurringAppointmentDeletionIds?: string[];
  onRecurringAppointmentDeletionIdsChange?: (ids: string[]) => void;
  formatTimeTo12h?: (time: string) => string;
}

export default function ApproveRejectDialog({
  open,
  onOpenChange,
  mode,
  appointment,
  isProcessing = false,
  onConfirm,
  title: titleOverride,
  description: descriptionOverride,
  cancelLabel,
  confirmLabel,
  recurringAppointmentDeletionItems = [],
  selectedRecurringAppointmentDeletionIds = [],
  onRecurringAppointmentDeletionIdsChange,
  formatTimeTo12h = (time: string) => time,
}: Props) {
  const { statuses } = useAppointmentStatuses();
  const { openEditModal } = useAppointmentModal();
  const isCancelMode = mode === "cancel";

  const patientName = appointment?.patientName || appointment?.patient?.name || appointment?.patient || "Patient";
  const status = appointment?.status || "reserved";

  const doctorName = (() => {
    const d = appointment?.doctor || appointment?.doctorName || "";
    if (typeof d === "string") return d;
    return d?.name || d?.fullName || d?.username || "";
  })();

  const paymentStatusRaw = String(appointment?.paymentStatus || "unpaid").toLowerCase().trim();
  const paymentStatus = paymentStatusRaw.replace(/\s+/g, "-").replace(/_+/g, "-");

  const title = titleOverride || (mode === "approve"
    ? (status === "tbd" ? "Mark as Completed?" : "Approve Appointment?")
    : isCancelMode ? "Cancel Appointment?" : "Reject Appointment?");

  const description = descriptionOverride || (mode === "approve"
    ? (status === "tbd"
      ? `Are you sure you want to mark this appointment for ${patientName} as Completed?`
      : `Are you sure you want to approve this appointment for ${patientName}? The status will be set to Scheduled.`)
    : isCancelMode
      ? "This releases the time slot. This action is permanent."
      : `Are you sure you want to reject this appointment for ${patientName}? The status will be set to Cancelled.`);

  const paymentSummary = (() => {
    if (/half|partial/.test(paymentStatus)) return `⚠ ${patientName} has made a partial payment.`;
    if (/^paid$/.test(paymentStatus)) return `✓ ${patientName} has paid in full.`;
    if (/pay/.test(paymentStatus)) return `📍 ${patientName} will pay at the clinic.`;
    return `✗ ${patientName} has not paid yet.`;
  })();

  const hasPaymentDue = !/^(paid|over-paid|overpaid)$/.test(paymentStatus);

  const handleOpenPayment = () => {
    if (!appointment) return;
    onOpenChange(false);
    openEditModal(appointment, false, true);
  };

  const renderStatusBadge = (s?: string) => {
    const statusOption = getAppointmentStatusOptionWithColors(s, statuses);
    return <Badge className={`${statusOption.bgColor} ${statusOption.textColor} border-none hover:opacity-80 font-medium capitalize`}>{statusOption.label || String(s || "")}</Badge>;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={isCancelMode ? "w-[calc(100vw-2rem)] max-w-2xl rounded-[2rem] border-none p-8 shadow-2xl" : "rounded-2xl border-none shadow-2xl"}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onOverlayClick={() => onOpenChange(false)}
      >
        {isCancelMode ? (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500">
              <CalendarIcon className="h-10 w-10" />
            </div>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-black text-gray-950">{title}</AlertDialogTitle>
              <AlertDialogDescription className="text-base font-medium text-gray-500">{description}</AlertDialogDescription>
            </AlertDialogHeader>
          </div>
        ) : (
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-gray-900 uppercase tracking-tight">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 font-medium">{description}</AlertDialogDescription>
          </AlertDialogHeader>
        )}

        {mode === "approve" && (
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-4">
            <p className="text-sm font-medium text-amber-900">{paymentSummary}</p>
          </div>
        )}

        {!isCancelMode && (
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
        )}

        {isCancelMode && recurringAppointmentDeletionItems.length > 0 ? (
          <div className="mt-8">
            <RecurringAppointmentCancelSelector
              items={recurringAppointmentDeletionItems}
              selectedIds={selectedRecurringAppointmentDeletionIds}
              onSelectedIdsChange={onRecurringAppointmentDeletionIdsChange || (() => undefined)}
              formatTimeTo12h={formatTimeTo12h}
            />
          </div>
        ) : null}

        {isCancelMode ? (
          <div className="mt-8 grid grid-cols-2 gap-3">
            <AlertDialogCancel
              disabled={isProcessing}
              className="h-14 rounded-2xl border-gray-200 font-bold"
            >
              {cancelLabel || "No, Keep It"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isProcessing}
              onClick={() => onConfirm()}
              className="h-14 rounded-2xl bg-rose-600 text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-700"
            >
              {isProcessing ? "Processing..." : confirmLabel || "Yes, Cancel"}
            </AlertDialogAction>
          </div>
        ) : (
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              disabled={isProcessing}
              className="rounded-xl border-gray-100 font-bold uppercase text-xs tracking-wider"
            >
              {cancelLabel || "Cancel"}
            </AlertDialogCancel>
            {mode === "approve" && hasPaymentDue ? (
              <Button
                onClick={handleOpenPayment}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-xs tracking-wider"
                size="sm"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Pay now
              </Button>
            ) : null}
            <AlertDialogAction
              disabled={isProcessing}
              onClick={() => onConfirm()}
              className={mode === "reject" ? "bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider" : "bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider"}
            >
              {isProcessing ? "Processing..." : confirmLabel || (mode === "reject" ? "Yes, Reject" : (status === "tbd" ? "Yes, Mark as Completed" : "Yes, Approve"))}
            </AlertDialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}