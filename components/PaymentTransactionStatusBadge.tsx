"use client";

import { AlertTriangle, CheckCircle2, Clock, X } from "lucide-react";

import type { RecentTransaction } from "@/lib/finance-types";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

export const deletedPaymentRowClass = "bg-gray-50/60 border-l-2 border-gray-200 ml-2 opacity-75";
export const deletedPaymentBadgeClass = "bg-gray-200 text-gray-700 border-transparent";
export const cancelledPaymentBadgeClass = "bg-red-100 text-red-700 border-transparent";

export type PaymentStatusDisplay = {
  label: string;
  status?: string;
  className?: string;
};

type PaymentTransactionLike = Partial<RecentTransaction> & Record<string, any>;

const hasDeletedDate = (value: unknown) => {
  if (value === null || value === undefined) return false;
  const text = String(value).trim().toLowerCase();
  return Boolean(text) && text !== "null" && text !== "undefined";
};

const hasTrueFlag = (value: unknown) => value === true || String(value).trim().toLowerCase() === "true";
const hasFalseFlag = (value: unknown) => value === false || String(value).trim().toLowerCase() === "false";

const normalizeStatus = (value: unknown) =>
  String(value || "").trim().toLowerCase().replace(/_/g, "-");

const getAppointmentSnapshot = (transaction?: PaymentTransactionLike | null) => {
  const snapshot = transaction?.appointmentSnapshot;
  return snapshot && typeof snapshot === "object" ? snapshot as Record<string, any> : {};
};

export const isAppointmentDeletedStatusTransaction = (
  transaction?: Partial<RecentTransaction> | null
) => {
  const row = transaction as PaymentTransactionLike | null | undefined;
  const appointmentSnapshot = getAppointmentSnapshot(row);
  const appointmentStatus = normalizeStatus(
    appointmentSnapshot.status ||
    appointmentSnapshot.appointmentStatus ||
    row?.appointmentStatus
  );
  const hasActiveAppointmentSignal =
    hasFalseFlag(row?.appointmentDeleted) ||
    hasFalseFlag(appointmentSnapshot.deleted) ||
    Boolean(appointmentStatus && appointmentStatus !== "deleted");

  if (
    hasTrueFlag(row?.appointmentDeleted) ||
    appointmentStatus === "deleted" ||
    hasTrueFlag(appointmentSnapshot.deleted)
  ) {
    return true;
  }

  if (hasActiveAppointmentSignal) return false;

  return (
    hasDeletedDate(row?.appointmentDeletedAt) ||
    hasDeletedDate(appointmentSnapshot.deletedAt)
  );
};

export const isActualDeletedPaymentTransaction = (
  transaction?: Partial<RecentTransaction> | null
) => {
  const row = transaction as PaymentTransactionLike | null | undefined;
  if (!row) return false;

  if (row.paymentDeleted !== undefined) {
    if (hasTrueFlag(row.paymentDeleted)) return true;
    if (hasFalseFlag(row.paymentDeleted)) return false;
    return hasDeletedDate(row.paymentDeletedAt);
  }

  if (hasDeletedDate(row.paymentDeletedAt)) return true;

  const appointmentDeleted = isAppointmentDeletedStatusTransaction(transaction);
  if (appointmentDeleted) return false;

  if (hasTrueFlag(row.deleted)) return true;
  if (hasFalseFlag(row.deleted)) return false;
  return hasDeletedDate(row.deletedAt);
};

export const isSoftDeletedPaymentTransaction = (
  transaction?: Partial<RecentTransaction> | null
) => isActualDeletedPaymentTransaction(transaction) || isAppointmentDeletedStatusTransaction(transaction);

export const isAppointmentCancelledStatusTransaction = (
  transaction?: Partial<RecentTransaction> | null
) => {
  const row = transaction as PaymentTransactionLike | null | undefined;
  const appointmentSnapshot = getAppointmentSnapshot(row);
  const appointmentStatus = normalizeStatus(
    row?.appointmentStatus ||
    appointmentSnapshot.status ||
    appointmentSnapshot.appointmentStatus
  );

  return appointmentStatus === "cancelled" || appointmentStatus === "canceled";
};

export const getDeletedPaymentLabel = (
  transaction: Partial<RecentTransaction> | null | undefined
) => {
  const appointmentDeleted = isAppointmentDeletedStatusTransaction(transaction);
  const paymentDeleted = isActualDeletedPaymentTransaction(transaction);

  if (appointmentDeleted && paymentDeleted) return "Deleted appointment + deleted payment";
  if (appointmentDeleted) return "Deleted appointment";
  if (paymentDeleted) return "Deleted payment";
  return "Deleted";
};

export function PaymentTransactionStatusBadge({
  display,
  className,
  showIcon = true,
}: {
  display?: PaymentStatusDisplay | null;
  className?: string;
  showIcon?: boolean;
}) {
  if (!display?.label) return null;

  const status = normalizeStatus(display.status);
  const StatusIcon =
    status === "deleted" || status === "cancelled" || status === "canceled"
      ? X
      : status === "over-paid"
        ? AlertTriangle
        : status === "half-paid"
          ? Clock
          : CheckCircle2;

  return (
    <Badge
      variant="outline"
      className={cn("rounded-md px-3 py-1 text-sm font-bold", display.className, className)}
    >
      {display.label}
      {showIcon ? <StatusIcon className="ml-1.5 h-3.5 w-3.5" /> : null}
    </Badge>
  );
}
