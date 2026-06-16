"use client";

import type { StaffFinancialRecordForm } from "@/lib/staff-types";

export const STAFF_FINANCIAL_TYPE_OPTIONS = [
  {
    value: "cash_advance",
    label: "Cash Advance",
    description: "Money released early and usually repaid across payroll cycles.",
  },
  {
    value: "bonus",
    label: "Bonus",
    description: "Additional pay for performance, incentives, or special clinic work.",
  },
  {
    value: "salary_adjustment",
    label: "Salary Adjustment",
    description: "A one-time positive or negative salary correction.",
  },
  {
    value: "deduction",
    label: "Deduction",
    description: "A deduction applied to payroll or a staff balance.",
  },
] as const;

export const STAFF_FINANCIAL_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
] as const;

export const createEmptyStaffFinancialRecordForm = (): StaffFinancialRecordForm => ({
  staffId: "",
  type: "",
  amount: 0,
  date: "",
  status: "pending",
  repaymentSchedule: "",
  notes: "",
});

export const normalizeStaffValue = (value?: string) =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const prettifyStaffValue = (value?: string) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const getFinancialTypeLabel = (value?: string) =>
  STAFF_FINANCIAL_TYPE_OPTIONS.find((option) => option.value === value)?.label ||
  prettifyStaffValue(value);

export const getFinancialTypeDescription = (value?: string) =>
  STAFF_FINANCIAL_TYPE_OPTIONS.find((option) => option.value === value)?.description || "";

export const getFinancialStatusLabel = (value?: string) =>
  STAFF_FINANCIAL_STATUS_OPTIONS.find((option) => option.value === value)?.label ||
  prettifyStaffValue(value || "pending");

export const formatStaffMonthLabel = (monthKey?: string) => {
  if (!monthKey) return "Selected month";
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

export const getWorkingDaysInMonth = (monthKey?: string) => {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if (!year || !month) return 0;

  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const weekday = new Date(year, month - 1, day).getDay();
    if (weekday !== 0 && weekday !== 6) workingDays += 1;
  }
  return workingDays;
};
