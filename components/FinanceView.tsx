"use client";

import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import { getPaymentStatusOptionWithColors, normalizePaymentStatus } from "@/lib/status-colors";
import { formatWordyDate } from "@/lib/utils";
import AppointmentHistoryView from "./AppointmentHistoryView";
import ConfirmDialog from "./ConfirmDialog";
import { fetchSnapshotFromLogs } from "@/lib/appointmentSnapshots";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
import { usePaymentModal } from "@/hooks/usePaymentModal";

import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { FinanceExpenseModal, type FinanceExpenseModalMode } from "./FinanceExpenseModal";
import { FinanceExpensePaymentModal } from "./FinanceExpensePaymentModal";
import { FinanceInventoryChangeReviewModal, type InventoryChange } from "./FinanceInventoryChangeReviewModal";
import { FinanceInventoryModal, type FinanceInventoryModalMode } from "./FinanceInventoryModal";
import { FinanceInventoryReorderModal } from "./FinanceInventoryReorderModal";
import { FinancePayrollModal, type FinancePayrollModalMode } from "./FinancePayrollModal";
import { FinancePayrollBonusModal, type PayrollBonusForm } from "./FinancePayrollBonusModal";
import { FinancePayrollEditModal, type PayrollEditForm } from "./FinancePayrollEditModal";
import type { FinanceHistoryEntityType, FinanceHistoryLog } from "./FinanceHistoryDialog";
import {
  PaymentTransactionStatusBadge,
  deletedPaymentBadgeClass,
  deletedPaymentRowClass,
  getDeletedPaymentLabel,
  isActualDeletedPaymentTransaction,
  isSoftDeletedPaymentTransaction,
} from "./PaymentTransactionStatusBadge";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  createEmptyExpense,
  createEmptyInventoryItem,
  createEmptyReorderForm,
  createExpenseFormFromExpense,
  createInventoryFormFromItem,
  currentPayrollMonthKey,
  formatOptionLabel,
  formatPayrollMonthLabel,
  getDefaultPayrollPaymentDate,
  getPayrollMonthOptions,
  resolveOptionValue,
  todayDate,
  type ExpenseForm,
  type InventoryForm,
  type ReorderForm,
} from "./financeModalOptions";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Download,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Edit,
  Plus,
  Filter,
  User,
  PackagePlus,
  RotateCcw,
  Wallet,
  Gift,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Menu,
  Search,
  ShieldCheck,
  Trash2
} from "lucide-react";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const formatCurrency = (amount?: number) => currencyFormatter.format(Number(amount) || 0);

const PAYROLL_DISABLED = true;

const normalizeFilterValue = (value?: string) =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const downloadCsv = (filename: string, rows: Record<string, string | number>[]) => {
  if (!rows.length) {
    toast.error("No records to export");
    return;
  }

  const headers = Object.keys(rows[0]);
  const escapeValue = (value: string | number) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const dateKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const getPeriodRange = (period: string) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (period) {
    case "today":
      return { start: dateKey(now), end: dateKey(now) };
    case "yesterday": {
      start.setDate(now.getDate() - 1);
      return { start: dateKey(start), end: dateKey(start) };
    }
    case "this_week": {
      const day = now.getDay();
      start.setDate(now.getDate() - day);
      return { start: dateKey(start), end: dateKey(end) };
    }
    case "last_week": {
      const day = now.getDay();
      start.setDate(now.getDate() - day - 7);
      end.setDate(now.getDate() - day - 1);
      return { start: dateKey(start), end: dateKey(end) };
    }
    case "this_month":
      return {
        start: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: dateKey(end),
      };
    case "last_month":
      return {
        start: dateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        end: dateKey(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    default:
      return null;
  }
};

type FinanceMetricPeriod = "day" | "week" | "month";

const getMetricPeriodRange = (period: FinanceMetricPeriod) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "week") {
    const day = now.getDay();
    start.setDate(now.getDate() - day);
  } else if (period === "month") {
    start.setDate(1);
  }

  return {
    start: dateKey(start),
    end: dateKey(end),
    label: period === "day" ? "Today" : period === "week" ? "This Week" : "This Month",
    title: period === "day" ? "Daily" : period === "week" ? "Weekly" : "Monthly",
  };
};

const isDateWithinRange = (date: string | undefined, range: { start: string; end: string }) => {
  if (!date) return false;
  return date >= range.start && date <= range.end;
};

const toDateOnly = (value?: string | null) => String(value || "").split("T")[0].trim();

const getExpenseReportingDate = (expense: { date?: string | null }) =>
  toDateOnly(expense.date);

const getTransactionReportingDate = (transaction: {
  date?: string | null;
  paymentDate?: string | null;
}) =>
  toDateOnly(transaction.paymentDate) || toDateOnly(transaction.date);

const buildAuthRequest = (init: RequestInit = {}): RequestInit => ({
  ...init,
  credentials: "include",
  headers: getAuthHeaders({
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...((init.headers as Record<string, string> | undefined) || {}),
  }),
});

const fetchApiData = async <T,>(path: string, label: string, init: RequestInit = {}) => {
  const response = await fetch(apiUrl(path), buildAuthRequest(init));
  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;

  if (!response.ok) {
    throw new Error(payload.message || `HTTP error! status: ${response.status} for ${label}`);
  }

  return payload.data as T;
};

const getAppointmentIdFromDescription = (description?: string) => {
  const text = String(description || "");
  const appointmentMatch = text.match(/\bappointment\s+([A-Za-z0-9_-]+)/i);
  if (appointmentMatch?.[1]) return appointmentMatch[1];

  const idMatch = text.match(/\bapt_[A-Za-z0-9_-]+/i);
  return idMatch?.[0] || "";
};

const getAppointmentIdFromSnapshot = (snapshot?: any) =>
  String(snapshot?.id || snapshot?.appointmentId || snapshot?._id || "");

const formatTransactionTimestamp = (value?: string) => {
  if (!value) return "";

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return formatWordyDate(value, {
    fallback: value,
    includeTime: !isDateOnly,
  });
};

const formatFinanceDate = (value?: string) =>
  formatWordyDate(value, { fallback: value || "-" });

const getFinanceTimelineDateParts = (value?: string | null) => {
  const fallback = { month: "---", day: "--", year: "" };
  if (!value) return fallback;

  const rawValue = String(value);
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
    ? `${rawValue}T00:00:00`
    : rawValue;
  const parsed = new Date(normalizedValue);

  if (Number.isNaN(parsed.getTime())) return fallback;

  return {
    month: parsed.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: parsed.toLocaleDateString("en-US", { day: "2-digit" }),
    year: parsed.toLocaleDateString("en-US", { year: "numeric" }),
  };
};

const hasTimeComponent = (value?: string) =>
  Boolean(value && !/^\d{4}-\d{2}-\d{2}$/.test(value));

const resolveImageSource = (source?: string) => {
  if (!source) return undefined;
  if (
    source.startsWith("http") ||
    source.startsWith("data:") ||
    source.startsWith("blob:")
  ) {
    return source;
  }
  return apiUrl(source);
};

const getAnyImageFromSnapshot = (snapshot: any) =>
  resolveImageSource(
    snapshot?.patientProfile ||
    snapshot?.patientProfilePicture ||
    snapshot?.patientPhoto ||
    snapshot?.patientImage ||
    snapshot?.patientAvatar ||
    snapshot?.patient?.profilePicture ||
    snapshot?.profilePicture ||
    snapshot?.patient?.profilePictureUrl ||
    snapshot?.patient?.photoUrl ||
    snapshot?.patient?.avatar ||
    snapshot?.patient?.imageUrl ||
    snapshot?.patient?.photo
  );

const getAvatarFromSnapshot = (snapshot: any, nameToMatch?: string) => {
  if (!snapshot) return undefined;

  const patientName =
    snapshot.patientName ||
    snapshot.patient?.name ||
    snapshot.patient?.fullName ||
    [snapshot.patient?.firstName, snapshot.patient?.lastName].filter(Boolean).join(" ");

  const doctorName =
    snapshot.doctorName ||
    snapshot.doctor?.name ||
    snapshot.doctor?.fullName ||
    snapshot.doctor?.username;

  const normalizedMatch = nameToMatch?.toLowerCase().trim() || "";
  const normalizedPatient = String(patientName || "").toLowerCase().trim();
  const normalizedDoctor = String(doctorName || "").toLowerCase().trim();

  if (normalizedMatch && normalizedMatch === normalizedPatient) {
    return resolveImageSource(
      snapshot.patientProfile ||
      snapshot.patientProfilePicture ||
      snapshot.patientPhoto ||
      snapshot.patientImage ||
      snapshot.patientAvatar ||
      snapshot.patient?.profilePicture ||
      snapshot.patient?.profilePictureUrl ||
      snapshot.patient?.photo ||
      snapshot.patient?.photoUrl ||
      snapshot.patient?.avatar ||
      snapshot.profilePicture
    );
  }

  if (normalizedMatch && normalizedMatch === normalizedDoctor || normalizedMatch === `dr. ${normalizedDoctor}`) {
    return resolveImageSource(
      snapshot.doctorProfile ||
      snapshot.doctorProfilePicture ||
      snapshot.doctorPhoto ||
      snapshot.doctor?.profilePicture ||
      snapshot.doctor?.profilePictureUrl ||
      snapshot.doctorImage
    );
  }

  return undefined;
};


// Define interfaces for fetched data
export interface RevenueEntry {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface ExpenseBreakdownEntry {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  [key: string]: string | number; // Explicitly define index signature for string and number types
}

export interface DetailedExpense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  vendor: string;
  paymentMethod: string;
  paymentDate?: string;
  status: string;
  recurring: boolean;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  deletedAt?: string;
  inventoryItemId?: string;
  inventoryQuantity?: number;
  notes?: string;
}

export interface InventoryItem {
  id: string; // Changed from number for consistency
  item: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalValue: number;
  supplier: string;
  lastOrdered: string;
}

export interface PayrollEntry {
  id: string; // Changed from number for consistency
  name: string;
  role: string;
  baseSalary: number;
  staffBaseSalary?: number;
  bonus: number;
  managedAdjustment?: number;
  total: number;
  status: string;
  salaryRecordId?: string;
  paymentDate?: string;
  month?: string;
}

type StaffFinancialRecord = {
  id: string;
  staffId: string;
  staffName: string;
  type: string;
  amount: number;
  date: string;
  status: string;
  notes?: string;
  repaymentSchedule?: string;
};

type StaffRecordUpdate = {
  baseSalary?: number;
};

type ExpenseFieldErrors = Partial<Record<keyof ExpenseForm, string>>;
type InventoryFieldErrors = Partial<Record<keyof InventoryForm, string>>;
type ReorderFieldErrors = Partial<Record<keyof ReorderForm, string>>;

const MANAGED_PAYROLL_ADJUSTMENT_PREFIX = "[payroll-adjustment]";

const resolvePayrollFormDate = (payrollMonth: string, entry?: PayrollEntry | null) =>
  entry?.paymentDate?.startsWith(`${payrollMonth}-`)
    ? entry.paymentDate
    : getDefaultPayrollPaymentDate(payrollMonth);

const createPayrollBonusForm = (payrollMonth: string, staffId = ""): PayrollBonusForm => ({
  staffId,
  amount: 0,
  date: getDefaultPayrollPaymentDate(payrollMonth),
  notes: "",
  existingAdjustmentTotal: 0,
});

const createPayrollEditFormFromEntry = (entry: PayrollEntry, payrollMonth: string): PayrollEditForm => ({
  baseSalary: Number(entry.staffBaseSalary ?? entry.baseSalary) || 0,
  date: resolvePayrollFormDate(payrollMonth, entry),
  salaryNotes: "",
});

const isPayrollMonthDate = (date: string, payrollMonth: string) =>
  String(date || "").startsWith(`${payrollMonth}-`);

const isSalaryFinancialRecord = (record: StaffFinancialRecord) =>
  normalizeFilterValue(record.type) === "salary" ||
  normalizeFilterValue(record.type) === "payroll" ||
  normalizeFilterValue(record.type) === "monthlysalary";

const isPayrollBonusFinancialRecord = (record: StaffFinancialRecord) => {
  const type = normalizeFilterValue(record.type);
  const status = normalizeFilterValue(record.status);
  if (["cancelled", "canceled", "void", "voided"].includes(status)) return false;
  return (
    type === "bonus" ||
    type === "commission" ||
    type === "overtime" ||
    String(record.notes || "").includes(MANAGED_PAYROLL_ADJUSTMENT_PREFIX)
  );
};

const payrollAdjustmentMarker = (payrollMonth: string) =>
  `${MANAGED_PAYROLL_ADJUSTMENT_PREFIX} ${payrollMonth}`;

const payrollAdjustmentNotes = (payrollMonth: string, notes: string) => {
  const cleanNotes = notes.trim();
  return `${payrollAdjustmentMarker(payrollMonth)}${cleanNotes ? ` ${cleanNotes}` : " Current month payroll adjustment"}`;
};

const findManagedPayrollAdjustment = (
  records: StaffFinancialRecord[],
  staffId: string,
  payrollMonth: string
) => {
  const marker = payrollAdjustmentMarker(payrollMonth);
  return records.find(
    (record) =>
      record.staffId === staffId &&
      isPayrollMonthDate(record.date, payrollMonth) &&
      normalizeFilterValue(record.type) === "bonus" &&
      String(record.notes || "").includes(marker)
  );
};

const getPayrollBonusRecords = (
  records: StaffFinancialRecord[],
  staffId: string,
  payrollMonth: string
) =>
  records.filter(
    (record) =>
      record.staffId === staffId &&
      isPayrollMonthDate(record.date, payrollMonth) &&
      isPayrollBonusFinancialRecord(record)
  );

const findPayrollSalaryRecord = (
  records: StaffFinancialRecord[],
  staffId: string,
  payrollMonth: string
) =>
  records.find(
    (record) =>
      record.staffId === staffId &&
      isPayrollMonthDate(record.date, payrollMonth) &&
      isSalaryFinancialRecord(record)
  );

export interface RecentTransaction {
  id: string; // Changed from number for consistency
  date: string;
  description: string;
  amount: number;
  type: string;
  method: string;
  transactionId?: string;
  appointmentId?: string;
  appointmentDate?: string;
  appointmentType?: string;
  appointmentSnapshot?: any;
  paymentDate?: string;
  paymentAmount?: number;
  previousBalance?: number;
  newBalance?: number;
  changedBy?: string;
  logDate?: string;
  changedByName?: string;
  changedByAvatar?: string;
  doctor?: string;
  doctorName?: string;
  source?: string;
  patientId?: string;
  patientName?: string;
  paymentId?: string;
  paymentRecordId?: string;
  currentAppointmentBalance?: number;
  currentAppointmentTotalPaid?: number;
  currentAppointmentPrice?: number;
  currentAppointmentDiscount?: number;
  currentPaymentStatus?: string;
  deleted?: boolean;
  deletedAt?: string | null;
  paymentDeleted?: boolean;
  paymentDeletedAt?: string | null;
  appointmentDeleted?: boolean;
  appointmentDeletedAt?: string | null;
}

type TransactionLedgerMode = "all" | "patients" | "doctors";
type TransactionFilterValue = "all" | "income" | "expense" | "patients" | "doctors";
type SortDirection = "asc" | "desc";

type FinanceAppointmentGroup = {
  key: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  appointmentType: string;
  transactions: RecentTransaction[];
};

type FinancePatientGroup = {
  patientName: string;
  appointments: FinanceAppointmentGroup[];
};

type FinanceDoctorGroup = {
  doctorName: string;
  appointments: FinanceAppointmentGroup[];
};

const getFinanceDateTimestamp = (value?: string | null) => {
  const date = toDateOnly(value);
  if (!date) return 0;

  const parsed = new Date(`${date}T00:00:00`).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getFinanceTransactionSortDate = (
  transaction: RecentTransaction,
  linkedExpense?: DetailedExpense | null
) => {
  if (transaction.type === "expense" && linkedExpense) {
    return getExpenseReportingDate(linkedExpense);
  }

  return getTransactionReportingDate(transaction);
};

const getFinanceSnapshot = (transaction: RecentTransaction) =>
  transaction.appointmentSnapshot && typeof transaction.appointmentSnapshot === "object"
    ? transaction.appointmentSnapshot
    : {};

const getFinancePatientIdentity = (transaction: RecentTransaction) => {
  const snapshot = getFinanceSnapshot(transaction);
  const patient = snapshot.patient && typeof snapshot.patient === "object" ? snapshot.patient : {};
  const firstLast = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim();
  const patientId = String(
    transaction.patientId ||
    snapshot.patientId ||
    patient.id ||
    snapshot.patient?._id ||
    ""
  ).trim();
  const patientName = String(
    transaction.patientName ||
    snapshot.patientName ||
    patient.name ||
    patient.fullName ||
    firstLast ||
    ""
  ).trim();

  return {
    id: patientId,
    name: patientName || "Unassigned Patient",
  };
};

const getFinanceDoctorName = (transaction: RecentTransaction) => {
  const snapshot = getFinanceSnapshot(transaction);
  const doctor = snapshot.doctor && typeof snapshot.doctor === "object" ? snapshot.doctor : {};
  return String(
    transaction.doctorName ||
    transaction.doctor ||
    snapshot.doctorName ||
    doctor.name ||
    doctor.fullName ||
    doctor.username ||
    snapshot.doctor ||
    ""
  ).trim() || "Unassigned Doctor";
};

const getFinanceDoctorOptionValue = (name?: string) =>
  normalizeFilterValue(name || "Unassigned Doctor") || "unassigneddoctor";

const getFinanceTransactionAppointmentId = (transaction: RecentTransaction) =>
  String(
    transaction.appointmentId ||
    getAppointmentIdFromSnapshot(transaction.appointmentSnapshot) ||
    getAppointmentIdFromDescription(transaction.description) ||
    ""
  ).trim();

const isPaymentLogLikeTransaction = (transaction?: Partial<RecentTransaction> | null) => {
  const source = String(transaction?.source || "").trim().toLowerCase();
  if (source === "payment-log" || source === "appointment-log") return true;
  if (/\bpay_log_[A-Za-z0-9_-]+/.test(String(transaction?.description || ""))) return true;

  return [
    transaction?.id,
    transaction?.transactionId,
    transaction?.paymentId,
    transaction?.paymentRecordId,
  ].some((value) => {
    const id = String(value || "").trim();
    return (
      id.startsWith("pay_log_") ||
      id.startsWith("payment-log-") ||
      id.startsWith("appointment-log-") ||
      id.startsWith("apt_log_")
    );
  });
};

const isFinanceAppointmentPaymentTransaction = (transaction: RecentTransaction) =>
  transaction.type === "income" &&
  Number(transaction.amount || 0) > 0 &&
  !isPaymentLogLikeTransaction(transaction) &&
  (
    transaction.source === "payment" ||
    Boolean(getFinanceTransactionAppointmentId(transaction)) ||
    Boolean(transaction.appointmentSnapshot)
  );

const getFinanceAppointmentDate = (transaction: RecentTransaction) => {
  const snapshot = getFinanceSnapshot(transaction);
  return toDateOnly(
    transaction.appointmentDate ||
    snapshot.appointmentDate ||
    snapshot.date ||
    snapshot.scheduledDate ||
    snapshot.appointment?.date ||
    ""
  );
};

const getFinanceAppointmentType = (transaction: RecentTransaction) => {
  const snapshot = getFinanceSnapshot(transaction);
  return String(
    transaction.appointmentType ||
    snapshot.appointmentType ||
    snapshot.typeLabel ||
    snapshot.treatmentName ||
    snapshot.procedure ||
    snapshot.type ||
    "Appointment"
  );
};

const PAYMENT_BALANCE_EPSILON = 0.01;
const PAYMENT_TRANSACTION_STATUS_VALUES = new Set(["paid", "half-paid", "over-paid", "unpaid", "overdue"]);

const toFinitePaymentNumber = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const getFinancePaymentStatusValue = (transaction: RecentTransaction) => {
  const balance = toFinitePaymentNumber(transaction.currentAppointmentBalance);
  const price = toFinitePaymentNumber(transaction.currentAppointmentPrice) ?? 0;
  const discount = toFinitePaymentNumber(transaction.currentAppointmentDiscount) ?? 0;
  const totalPaid = toFinitePaymentNumber(transaction.currentAppointmentTotalPaid);
  const totalDue = Math.max(0, price - discount);
  const computedBalance = totalPaid !== undefined ? totalDue - totalPaid : undefined;
  const effectiveBalance = balance ?? computedBalance;
  const hasOverpayment = totalPaid !== undefined && totalPaid - totalDue > PAYMENT_BALANCE_EPSILON;

  if (hasOverpayment || (effectiveBalance !== undefined && effectiveBalance < -PAYMENT_BALANCE_EPSILON)) {
    return "over-paid";
  }

  if (effectiveBalance !== undefined) {
    return effectiveBalance <= PAYMENT_BALANCE_EPSILON ? "paid" : "half-paid";
  }

  const normalizedFallback = normalizePaymentStatus(transaction.currentPaymentStatus);
  return PAYMENT_TRANSACTION_STATUS_VALUES.has(normalizedFallback) ? normalizedFallback : "paid";
};

const getFinancePaymentStatusDisplay = (transaction: RecentTransaction) => {
  if (isSoftDeletedPaymentTransaction(transaction)) {
    return {
      label: getDeletedPaymentLabel(transaction),
      status: "deleted",
      className: deletedPaymentBadgeClass,
    };
  }

  const status = getFinancePaymentStatusValue(transaction);
  const statusOption = getPaymentStatusOptionWithColors(status);

  return {
    label: statusOption.label || "Paid",
    status: normalizePaymentStatus(statusOption.value) || status,
    className: `${statusOption.bgColor} ${statusOption.textColor} border-transparent`,
  };
};

const isCountableIncomeTransaction = (transaction: RecentTransaction) =>
  transaction.type === "income" && !isSoftDeletedPaymentTransaction(transaction);

export function FinanceView() {
  const { effectiveRole } = useAdminViewMode();
  const { openEditModalById, isEditModalOpen, selectedAppointment } = useAppointmentModal();
  const { openEditPaymentModal } = usePaymentModal();
  const normalizedEffectiveRole = normalizeFilterValue(effectiveRole);
  const canManageExpenseStatus = normalizedEffectiveRole === "admin";
  const canSeeDeletedPayments = normalizedEffectiveRole === "admin" || normalizedEffectiveRole === "doctor";
  const [expenseModalMode, setExpenseModalMode] = useState<FinanceExpenseModalMode | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<DetailedExpense | null>(null);
  const [expenseForm, setExpenseForm] = useState(createEmptyExpense);
  const [expenseFieldErrors, setExpenseFieldErrors] = useState<ExpenseFieldErrors>({});
  const [expenseToPay, setExpenseToPay] = useState<DetailedExpense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<DetailedExpense | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<RecentTransaction | null>(null);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState("cash");
  const [inventoryModalMode, setInventoryModalMode] = useState<FinanceInventoryModalMode | null>(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [inventoryForm, setInventoryForm] = useState(createEmptyInventoryItem);
  const [inventoryFieldErrors, setInventoryFieldErrors] = useState<InventoryFieldErrors>({});
  const [inventoryChangesToReview, setInventoryChangesToReview] = useState<InventoryChange[]>([]);
  const [inventoryItemToReorder, setInventoryItemToReorder] = useState<InventoryItem | null>(null);
  const [reorderForm, setReorderForm] = useState(createEmptyReorderForm);
  const [reorderFieldErrors, setReorderFieldErrors] = useState<ReorderFieldErrors>({});
  const [inventoryStockFilter, setInventoryStockFilter] = useState("all");
  const [selectedPayrollMonth, setSelectedPayrollMonth] = useState(currentPayrollMonthKey);
  const [payrollModalMode, setPayrollModalMode] = useState<FinancePayrollModalMode | null>(null);
  const [selectedPayrollEntry, setSelectedPayrollEntry] = useState<PayrollEntry | null>(null);
  const [payrollEntryToUnpay, setPayrollEntryToUnpay] = useState<PayrollEntry | null>(null);
  const [payrollPaymentDate, setPayrollPaymentDate] = useState(todayDate());
  const [isPayrollBonusModalOpen, setIsPayrollBonusModalOpen] = useState(false);
  const [payrollBonusForm, setPayrollBonusForm] = useState(() => createPayrollBonusForm(currentPayrollMonthKey()));
  const [payrollEntryToEdit, setPayrollEntryToEdit] = useState<PayrollEntry | null>(null);
  const [payrollEditForm, setPayrollEditForm] = useState<PayrollEditForm>({
    baseSalary: 0,
    date: todayDate(),
    salaryNotes: "",
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [timePeriodFilter, setTimePeriodFilter] = useState("all");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("all");
  const [transactionSearchFilter, setTransactionSearchFilter] = useState("");
  const [transactionLedgerMode, setTransactionLedgerMode] = useState<TransactionLedgerMode>("all");
  const [transactionDateSortDirection, setTransactionDateSortDirection] = useState<SortDirection>("desc");
  const [metricPeriod, setMetricPeriod] = useState<FinanceMetricPeriod>("day");
  
  // State for fetched data
  const [revenueData, setRevenueData] = useState<RevenueEntry[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdownEntry[]>([]);
  const [detailedExpenses, setDetailedExpenses] = useState<DetailedExpense[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [payrollData, setPayrollData] = useState<PayrollEntry[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [patientImages, setPatientImages] = useState<Record<string, string | undefined>>({});
  const [financeHistoryLogs, setFinanceHistoryLogs] = useState<FinanceHistoryLog[]>([]);
  const [isFinanceHistoryLoading, setIsFinanceHistoryLoading] = useState(false);
  const [financeRefreshKey, setFinanceRefreshKey] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isSavingExpensePayment, setIsSavingExpensePayment] = useState(false);
  const [isDeletingExpense, setIsDeletingExpense] = useState(false);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [isSavingInventory, setIsSavingInventory] = useState(false);
  const [isSavingReorder, setIsSavingReorder] = useState(false);
  const [isSavingPayroll, setIsSavingPayroll] = useState(false);
  const [isAppointmentHistoryOpen, setIsAppointmentHistoryOpen] = useState(false);
  const [appointmentSnapshot, setAppointmentSnapshot] = useState<any | null>(null);
  const [appointmentPaymentSnapshot, setAppointmentPaymentSnapshot] = useState<any | null>(null);
  const [appointmentSnapshotLogDate, setAppointmentSnapshotLogDate] = useState("");
  const [appointmentSnapshotIsHistorical, setAppointmentSnapshotIsHistorical] = useState(false);
  const [loadingAppointmentId, setLoadingAppointmentId] = useState<string | null>(null);
  const isSnapshotAppointmentOpen = Boolean(
    isEditModalOpen &&
    selectedAppointment?.id &&
    getAppointmentIdFromSnapshot(appointmentSnapshot) &&
    String(selectedAppointment.id) === getAppointmentIdFromSnapshot(appointmentSnapshot)
  );

  const fetchData = async (payrollMonth = selectedPayrollMonth) => {
    setIsLoading(true);
    try {
      const recentTransactionsPath = `/api/finance/recent-transactions?limit=500${canSeeDeletedPayments ? "&includeDeleted=true" : ""}`;
      const payrollDataRequest = PAYROLL_DISABLED
        ? Promise.resolve([] as PayrollEntry[])
        : fetchApiData<PayrollEntry[]>(`/api/finance/payroll?month=${encodeURIComponent(payrollMonth)}`, "payroll data");
      const [
        revenueData,
        expenseBreakdownData,
        detailedExpensesData,
        inventoryData,
        payrollData,
        transactionsData,
      ] = await Promise.all([
        fetchApiData<RevenueEntry[]>("/api/finance/revenue", "revenue data"),
        fetchApiData<ExpenseBreakdownEntry[]>("/api/finance/expense-breakdown", "expense breakdown"),
        fetchApiData<DetailedExpense[]>("/api/finance/detailed-expenses", "detailed expenses"),
        fetchApiData<InventoryItem[]>("/api/inventory?limit=100", "inventory data"),
        payrollDataRequest,
        fetchApiData<RecentTransaction[]>(recentTransactionsPath, "recent transactions"),
      ]);

      setRevenueData(revenueData || []);
      setExpenseBreakdown(expenseBreakdownData || []);
      setDetailedExpenses(detailedExpensesData || []);
      setInventoryData(inventoryData || []);
      setPayrollData(PAYROLL_DISABLED ? [] : payrollData || []);
      const transactionRows = (transactionsData || []).filter((transaction) => !isPaymentLogLikeTransaction(transaction));
      setRecentTransactions(transactionRows);

      // Load patient images for any transactions that reference a patient
      try {
        const txs = transactionRows;
        const patientIds = new Set<string>();
        txs.forEach((t: RecentTransaction) => {
          const snap = t.appointmentSnapshot;
          const id = snap?.patientId || snap?.patient?.id || snap?.patientId || undefined;
          if (id) patientIds.add(String(id));
        });

        // Fetch missing patient images
        const idsToFetch = Array.from(patientIds).filter((id) => !patientImages[id]);
        if (idsToFetch.length > 0) {
          await Promise.all(
            idsToFetch.map(async (id) => {
              try {
                const patient = await fetchApiData<any>(`/api/patients/${encodeURIComponent(id)}`, "patient record");
                const src = resolveImageSource(
                  patient?.profilePicture || patient?.profilePictureUrl || patient?.photo || patient?.image || patient?.avatar
                );
                if (src) setPatientImages((prev) => ({ ...prev, [id]: src }));
              } catch (e) {
                // ignore individual patient fetch failures
              }
            })
          );
        }
      } catch (e) {
        // non-fatal
      }
    } catch (err) {
      console.error("Error fetching finance data:", err);
      const message = err instanceof Error && err.message.includes("401")
        ? "Your admin session expired. Please sign in again."
        : "Failed to fetch financial data. Please ensure the backend server is running on port 3001.";
      toast.error(message);
      // Ensure all data arrays are empty on error
      setRevenueData([]);
      setExpenseBreakdown([]);
      setDetailedExpenses([]);
      setInventoryData([]);
      setPayrollData([]);
      setRecentTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFinanceHistory = async (
    entityType: FinanceHistoryEntityType,
    options: { entityId?: string; context?: string } = {}
  ) => {
    if (!options.entityId && entityType !== "payroll") {
      setFinanceHistoryLogs([]);
      setIsFinanceHistoryLoading(false);
      return;
    }

    setIsFinanceHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "150");
      if (options.context) params.set("context", options.context);

      const path = options.entityId
        ? `/api/finance/history/${encodeURIComponent(entityType)}/${encodeURIComponent(options.entityId)}`
        : `/api/finance/history/${encodeURIComponent(entityType)}`;
      const query = params.toString();
      const logs = await fetchApiData<FinanceHistoryLog[]>(
        `${path}${query ? `?${query}` : ""}`,
        `${entityType} history`
      );
      setFinanceHistoryLogs(logs || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load finance history";
      const routeUnavailable = /route not found|404/i.test(message);
      setFinanceHistoryLogs([]);
      if (routeUnavailable) {
        console.warn("Finance history route is not available from the current backend.");
      } else {
        console.error("Error loading finance history:", error);
        toast.error(message);
      }
    } finally {
      setIsFinanceHistoryLoading(false);
    }
  };

  const resetFinanceHistory = () => {
    setFinanceHistoryLogs([]);
    setIsFinanceHistoryLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [canSeeDeletedPayments, financeRefreshKey]);

  useEffect(() => {
    const handleFinanceRefresh = () => setFinanceRefreshKey((key) => key + 1);
    window.addEventListener("appointments:updated", handleFinanceRefresh);
    window.addEventListener("payments:updated", handleFinanceRefresh);
    window.addEventListener("villahermosa:data-refresh", handleFinanceRefresh);

    return () => {
      window.removeEventListener("appointments:updated", handleFinanceRefresh);
      window.removeEventListener("payments:updated", handleFinanceRefresh);
      window.removeEventListener("villahermosa:data-refresh", handleFinanceRefresh);
    };
  }, []);

  const filteredDetailedExpenses = useMemo(() => {
    const periodRange = getPeriodRange(timePeriodFilter);
    return detailedExpenses.filter((expense) => {
      const status = normalizeFilterValue(expense.status);
      const method = normalizeFilterValue(expense.paymentMethod);
      const selectedMethod = normalizeFilterValue(paymentMethodFilter);

      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (paymentMethodFilter !== "all" && (status !== "paid" || method !== selectedMethod)) return false;

      const rangeStart = timePeriodFilter === "custom" ? startDate : periodRange?.start || startDate;
      const rangeEnd = timePeriodFilter === "custom" ? endDate : periodRange?.end || endDate;

      if (rangeStart && expense.date < rangeStart) return false;
      if (rangeEnd && expense.date > rangeEnd) return false;

      return true;
    });
  }, [detailedExpenses, endDate, paymentMethodFilter, startDate, statusFilter, timePeriodFilter]);

  const detailedExpenseById = useMemo(
    () => new Map(detailedExpenses.map((expense) => [String(expense.id), expense])),
    [detailedExpenses]
  );

  useEffect(() => {
    if (transactionLedgerMode !== "all" && transactionTypeFilter === "expense") {
      setTransactionTypeFilter("all");
    }
  }, [transactionLedgerMode, transactionTypeFilter]);

  const filteredRecentTransactions = useMemo(() => (
    recentTransactions
      .filter((transaction) => {
        const search = transactionSearchFilter.trim().toLowerCase();
        const linkedExpense =
          transaction.type === "expense" || transaction.source === "expense"
            ? detailedExpenseById.get(String(transaction.id || ""))
            : undefined;
        const reportingDate = getFinanceTransactionSortDate(transaction, linkedExpense);
        const patientIdentity = getFinancePatientIdentity(transaction);
        const doctorName = getFinanceDoctorName(transaction);
        const appointmentDate = getFinanceAppointmentDate(transaction);
        const appointmentType = getFinanceAppointmentType(transaction);
        const isAppointmentPayment = isFinanceAppointmentPaymentTransaction(transaction);

        if (isPaymentLogLikeTransaction(transaction)) return false;
        if (!canSeeDeletedPayments && isSoftDeletedPaymentTransaction(transaction)) return false;
        if (transactionLedgerMode !== "all" && !isAppointmentPayment) return false;
        if (transactionTypeFilter !== "all" && transaction.type !== transactionTypeFilter) return false;
        if (startDate && reportingDate < startDate) return false;
        if (endDate && reportingDate > endDate) return false;

        if (search) {
          const searchText = [
            transaction.description,
            transaction.type,
            transaction.method,
            transaction.transactionId,
            transaction.appointmentId,
            transaction.changedByName,
            transaction.amount,
            reportingDate,
            linkedExpense?.category,
            linkedExpense?.vendor,
            linkedExpense?.status,
            patientIdentity.name,
            doctorName,
            appointmentDate,
            appointmentType,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (!searchText.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aLinkedExpense = a.type === "expense" || a.source === "expense"
          ? detailedExpenseById.get(String(a.id || ""))
          : undefined;
        const bLinkedExpense = b.type === "expense" || b.source === "expense"
          ? detailedExpenseById.get(String(b.id || ""))
          : undefined;
        const dateDiff =
          getFinanceDateTimestamp(getFinanceTransactionSortDate(a, aLinkedExpense)) -
          getFinanceDateTimestamp(getFinanceTransactionSortDate(b, bLinkedExpense));

        if (dateDiff !== 0) {
          return transactionDateSortDirection === "asc" ? dateDiff : -dateDiff;
        }

        const keyDiff = String(a.id || a.transactionId || a.description).localeCompare(String(b.id || b.transactionId || b.description));
        return transactionDateSortDirection === "asc" ? keyDiff : -keyDiff;
      })
  ), [
    canSeeDeletedPayments,
    detailedExpenseById,
    endDate,
    recentTransactions,
    startDate,
    transactionDateSortDirection,
    transactionLedgerMode,
    transactionSearchFilter,
    transactionTypeFilter,
  ]);

  const transactionSummary = useMemo(() => (
    filteredRecentTransactions.reduce(
      (summary, transaction) => {
        const amount = Math.abs(Number(transaction.amount) || 0);

        if (isCountableIncomeTransaction(transaction)) {
          summary.income += amount;
        } else if (transaction.type !== "income") {
          summary.expenses += amount;
        }

        summary.net = summary.income - summary.expenses;
        return summary;
      },
      { income: 0, expenses: 0, net: 0 }
    )
  ), [filteredRecentTransactions]);

  const hasTransactionFilters =
    Boolean(transactionSearchFilter.trim()) ||
    transactionLedgerMode !== "all" ||
    transactionTypeFilter !== "all" ||
    Boolean(startDate) ||
    Boolean(endDate);

  const clearTransactionFilters = () => {
    setTransactionSearchFilter("");
    setTransactionLedgerMode("all");
    setTransactionTypeFilter("all");
    setStartDate("");
    setEndDate("");
  };

  const transactionFilterValue: TransactionFilterValue =
    transactionLedgerMode === "patients" || transactionLedgerMode === "doctors"
      ? transactionLedgerMode
      : (transactionTypeFilter as TransactionFilterValue);

  const handleTransactionFilterChange = (value: TransactionFilterValue) => {
    if (value === "patients" || value === "doctors") {
      setTransactionLedgerMode(value);
      setTransactionTypeFilter("all");
      return;
    }

    setTransactionLedgerMode("all");
    setTransactionTypeFilter(value);
  };

  const transactionAppointmentGroups = useMemo(() => {
    const groups = new Map<string, FinanceAppointmentGroup>();

    filteredRecentTransactions
      .filter(isFinanceAppointmentPaymentTransaction)
      .forEach((transaction) => {
        const appointmentId = getFinanceTransactionAppointmentId(transaction);
        const patientIdentity = getFinancePatientIdentity(transaction);
        const doctorName = getFinanceDoctorName(transaction);
        const appointmentDate = getFinanceAppointmentDate(transaction);
        const appointmentType = getFinanceAppointmentType(transaction);
        const key = appointmentId || [
          patientIdentity.id || normalizeFilterValue(patientIdentity.name),
          normalizeFilterValue(doctorName),
          appointmentDate || getFinanceTransactionSortDate(transaction),
          normalizeFilterValue(appointmentType),
        ].join("|");
        const currentGroup = groups.get(key);

        if (currentGroup) {
          currentGroup.transactions.push(transaction);
          if (!currentGroup.appointmentDate && appointmentDate) currentGroup.appointmentDate = appointmentDate;
          return;
        }

        groups.set(key, {
          key,
          appointmentId,
          patientId: patientIdentity.id,
          patientName: patientIdentity.name,
          doctorName,
          appointmentDate,
          appointmentType,
          transactions: [transaction],
        });
      });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        transactions: [...group.transactions].sort((a, b) => {
          const dateDiff =
            getFinanceDateTimestamp(getFinanceTransactionSortDate(a)) -
            getFinanceDateTimestamp(getFinanceTransactionSortDate(b));

          if (dateDiff !== 0) {
            return transactionDateSortDirection === "asc" ? dateDiff : -dateDiff;
          }

          const keyDiff = String(a.id || a.transactionId || a.description).localeCompare(String(b.id || b.transactionId || b.description));
          return transactionDateSortDirection === "asc" ? keyDiff : -keyDiff;
        }),
      }))
      .sort((a, b) => {
        const dateDiff =
          getFinanceDateTimestamp(a.appointmentDate || getFinanceTransactionSortDate(a.transactions[0])) -
          getFinanceDateTimestamp(b.appointmentDate || getFinanceTransactionSortDate(b.transactions[0]));

        if (dateDiff !== 0) {
          return transactionDateSortDirection === "asc" ? dateDiff : -dateDiff;
        }

        return `${a.patientName} ${a.doctorName}`.localeCompare(`${b.patientName} ${b.doctorName}`);
      });
  }, [filteredRecentTransactions, transactionDateSortDirection]);

  const transactionPatientGroups = useMemo(() => {
    const groups = new Map<string, FinancePatientGroup>();

    transactionAppointmentGroups.forEach((appointment) => {
      const patientName = appointment.patientName || "Unassigned Patient";
      const key = normalizeFilterValue(patientName) || "unassignedpatient";
      const currentGroup = groups.get(key);

      if (currentGroup) {
        currentGroup.appointments.push(appointment);
        return;
      }

      groups.set(key, {
        patientName,
        appointments: [appointment],
      });
    });

    return Array.from(groups.values()).sort((a, b) => a.patientName.localeCompare(b.patientName));
  }, [transactionAppointmentGroups]);

  const transactionDoctorGroups = useMemo(() => {
    const groups = new Map<string, FinanceDoctorGroup>();

    transactionAppointmentGroups.forEach((appointment) => {
      const doctorName = appointment.doctorName || "Unassigned Doctor";
      const key = getFinanceDoctorOptionValue(doctorName);
      const currentGroup = groups.get(key);

      if (currentGroup) {
        currentGroup.appointments.push(appointment);
        return;
      }

      groups.set(key, {
        doctorName,
        appointments: [appointment],
      });
    });

    return Array.from(groups.values()).sort((a, b) => a.doctorName.localeCompare(b.doctorName));
  }, [transactionAppointmentGroups]);

  const metricPeriodRange = useMemo(() => getMetricPeriodRange(metricPeriod), [metricPeriod]);
  const metricRevenue = useMemo(() => (
    recentTransactions
      .filter((transaction) => isCountableIncomeTransaction(transaction) && isDateWithinRange(getTransactionReportingDate(transaction), metricPeriodRange))
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount) || 0), 0)
  ), [metricPeriodRange, recentTransactions]);
  const metricExpenses = useMemo(() => (
    detailedExpenses
      .filter((expense) => normalizeFilterValue(expense.status) === "paid")
      .filter((expense) => isDateWithinRange(getExpenseReportingDate(expense), metricPeriodRange))
      .reduce((sum, expense) => sum + Math.abs(Number(expense.amount) || 0), 0)
  ), [detailedExpenses, metricPeriodRange]);
  const metricProfit = metricRevenue - metricExpenses;
  const metricMargin = metricRevenue > 0 ? (metricProfit / metricRevenue) * 100 : 0;

  const filteredInventoryData = useMemo(() => (
    inventoryData.filter((item) => {
      if (inventoryStockFilter === "out") return Number(item.quantity) <= 0;
      if (inventoryStockFilter === "low") return Number(item.quantity) > 0 && Number(item.quantity) < 20;
      if (inventoryStockFilter === "healthy") return Number(item.quantity) >= 20;
      return true;
    })
  ), [inventoryData, inventoryStockFilter]);

  const expenseVendorOptions = useMemo(() => {
    const vendors = new Map<string, string>();
    [...detailedExpenses.map((expense) => expense.vendor), ...inventoryData.map((item) => item.supplier)]
      .map((vendor) => String(vendor || "").trim())
      .filter(Boolean)
      .forEach((vendor) => {
        const key = normalizeFilterValue(vendor);
        if (!vendors.has(key)) {
          vendors.set(key, vendor);
        }
      });

    return Array.from(vendors.values()).sort((left, right) => left.localeCompare(right));
  }, [detailedExpenses, inventoryData]);

  const payrollMonthOptions = useMemo(() => getPayrollMonthOptions(), []);
  const payrollStats = useMemo(() => {
    const paidCount = payrollData.filter((employee) => normalizeFilterValue(employee.status) === "paid").length;
    const total = payrollData.reduce((sum, employee) => sum + (Number(employee.total) || 0), 0);
    const baseTotal = payrollData.reduce((sum, employee) => sum + (Number(employee.baseSalary) || 0), 0);
    const bonusTotal = payrollData.reduce((sum, employee) => sum + (Number(employee.bonus) || 0), 0);

    return {
      employeeCount: payrollData.length,
      paidCount,
      pendingCount: payrollData.length - paidCount,
      baseTotal,
      bonusTotal,
      total,
    };
  }, [payrollData]);

  const handleExpenseFormChange = (nextForm: ExpenseForm) => {
    setExpenseFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      (Object.keys(nextErrors) as (keyof ExpenseForm)[]).forEach((field) => {
        if (nextForm[field] !== expenseForm[field]) {
          delete nextErrors[field];
        }
      });
      return nextErrors;
    });
    setExpenseForm(nextForm);
  };

  const openExpenseModal = (mode: FinanceExpenseModalMode, expense?: DetailedExpense) => {
    setSelectedExpense(expense || null);
    setExpenseForm(expense ? createExpenseFormFromExpense(expense) : createEmptyExpense());
    setExpenseFieldErrors({});
    resetFinanceHistory();
    if (mode === "edit" && expense?.id) {
      void loadFinanceHistory("expense", { entityId: expense.id });
    }
    setExpenseModalMode(mode);
  };

  const closeExpenseModal = () => {
    setExpenseModalMode(null);
    setSelectedExpense(null);
    setExpenseForm(createEmptyExpense());
    setExpenseFieldErrors({});
    resetFinanceHistory();
  };

  const openExpensePaymentModal = (expense: DetailedExpense) => {
    setExpenseToPay(expense);
    setExpensePaymentMethod(resolveOptionValue(expense.paymentMethod, PAYMENT_METHOD_OPTIONS) || "cash");
  };

  const openExpenseDeleteDialog = (expense: DetailedExpense) => {
    setExpenseToDelete(expense);
  };

  const handleSaveExpense = async () => {
    const requiredErrors: ExpenseFieldErrors = {};
    if (!expenseForm.category) requiredErrors.category = "Choose a category.";
    if (!expenseForm.date) requiredErrors.date = "Choose a date.";
    if (!expenseForm.description.trim()) requiredErrors.description = "Enter a description.";
    if (Number(expenseForm.amount) <= 0) requiredErrors.amount = "Enter an amount greater than zero.";

    if (Object.keys(requiredErrors).length > 0) {
      setExpenseFieldErrors(requiredErrors);
      toast.error("Please complete the required expense fields");
      return;
    }

    if (expenseForm.inventoryItemId && Number(expenseForm.inventoryQuantity) <= 0) {
      setExpenseFieldErrors({ inventoryQuantity: "Enter a stock quantity greater than zero." });
      toast.error("Enter the stock quantity to add");
      return;
    }

    if (expenseForm.inventoryItemId && normalizeFilterValue(expenseForm.status) === "cancelled") {
      setExpenseFieldErrors({ status: "Linked stock expenses cannot be cancelled." });
      toast.error("Linked stock expenses must be pending or paid");
      return;
    }

    setExpenseFieldErrors({});

    setIsSavingExpense(true);
    try {
      const isEditingExpense = expenseModalMode === "edit" && selectedExpense;
      await fetchApiData<DetailedExpense>(
        isEditingExpense
          ? `/api/finance/detailed-expenses/${encodeURIComponent(selectedExpense.id)}`
          : "/api/finance/detailed-expenses",
        isEditingExpense ? "expense update" : "new expense",
        {
          method: isEditingExpense ? "PUT" : "POST",
          body: JSON.stringify({
            ...expenseForm,
            amount: Number(expenseForm.amount),
            ...(!isEditingExpense && !canManageExpenseStatus && { status: "pending" }),
          }),
        }
      );

      toast.success(isEditingExpense ? "Expense updated" : "Expense added");
      closeExpenseModal();
      await fetchData();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save expense");
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handlePayExpense = async () => {
    if (!expenseToPay) return;

    setIsSavingExpensePayment(true);
    try {
      await fetchApiData<DetailedExpense>(`/api/finance/detailed-expenses/${encodeURIComponent(expenseToPay.id)}/pay`, "expense payment", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: expensePaymentMethod,
        }),
      });

      toast.success("Expense marked as paid");
      setExpenseToPay(null);
      await fetchData();
    } catch (error) {
      console.error("Error paying expense:", error);
      toast.error(error instanceof Error ? error.message : "Failed to mark expense paid");
    } finally {
      setIsSavingExpensePayment(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;

    setIsDeletingExpense(true);
    try {
      await fetchApiData<null>(
        `/api/finance/detailed-expenses/${encodeURIComponent(expenseToDelete.id)}`,
        "expense deletion",
        { method: "DELETE" }
      );

      toast.success("Expense deleted");
      setExpenseToDelete(null);
      await fetchData();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete expense");
    } finally {
      setIsDeletingExpense(false);
    }
  };

  const handleExportReport = () => {
    downloadCsv(
      `finance-report-${dateKey(new Date())}.csv`,
      [
        ...revenueData.map((row) => ({
          Section: "Revenue",
          Date: row.month,
          Description: "Monthly totals",
          Amount: row.revenue,
          Expenses: row.expenses,
          Profit: row.profit,
        })),
        ...detailedExpenses.map((expense) => ({
          Section: "Expense",
          Date: formatFinanceDate(expense.date),
          "Created At": expense.createdAt ? formatTransactionTimestamp(expense.createdAt) : "",
          Description: expense.description,
          Amount: expense.amount,
          Expenses: expense.amount,
          Profit: "",
        })),
        ...(PAYROLL_DISABLED ? [] : payrollData.map((employee) => ({
          Section: "Payroll",
          Date: formatPayrollMonthLabel(selectedPayrollMonth),
          Description: `${employee.name} - ${employee.role}`,
          Amount: employee.total,
          Expenses: employee.total,
          Profit: "",
        }))),
      ]
    );
  };

  const handleExportPayroll = () => {
    if (PAYROLL_DISABLED) {
      toast.error("Payroll is disabled");
      return;
    }

    downloadCsv(
      `payroll-${selectedPayrollMonth}.csv`,
      payrollData.map((employee) => ({
        Month: formatPayrollMonthLabel(selectedPayrollMonth),
        Employee: employee.name,
        Role: employee.role,
        "Base Salary": employee.baseSalary,
        "Bonus / Adjustment": employee.bonus,
        Total: employee.total,
        Status: employee.status || "pending",
        "Payment Date": employee.paymentDate || "",
      }))
    );
  };

  const handleGenerateInvoices = () => {
    const invoiceRows = recentTransactions
      .filter(isCountableIncomeTransaction)
      .map((transaction) => ({
        Date: getTransactionReportingDate(transaction),
        Description: transaction.description,
        Method: transaction.method,
        Amount: transaction.amount,
      }));

    downloadCsv(`invoice-summary-${dateKey(new Date())}.csv`, invoiceRows);
  };

  const validateInventoryForm = () => {
    const errors: InventoryFieldErrors = {};
    if (!inventoryForm.item.trim()) errors.item = "Enter the item name.";
    if (Number(inventoryForm.quantity) < 0) errors.quantity = "Quantity cannot be negative.";
    if (!inventoryForm.unit) errors.unit = "Choose a unit.";
    if (Number(inventoryForm.costPerUnit) <= 0) errors.costPerUnit = "Enter a unit cost greater than zero.";
    return errors;
  };

  const handleInventoryFormChange = (nextForm: InventoryForm) => {
    setInventoryFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      (Object.keys(nextErrors) as (keyof InventoryForm)[]).forEach((field) => {
        if (nextForm[field] !== inventoryForm[field]) {
          delete nextErrors[field];
        }
      });
      return nextErrors;
    });
    setInventoryForm(nextForm);
  };

  const openInventoryModal = (mode: FinanceInventoryModalMode, item?: InventoryItem) => {
    setSelectedInventoryItem(item || null);
    setInventoryForm(item ? createInventoryFormFromItem(item) : createEmptyInventoryItem());
    setInventoryFieldErrors({});
    setInventoryChangesToReview([]);
    resetFinanceHistory();
    if (mode === "edit" && item?.id) {
      void loadFinanceHistory("inventory", { entityId: item.id });
    }
    setInventoryModalMode(mode);
  };

  const closeInventoryModal = () => {
    setInventoryModalMode(null);
    setSelectedInventoryItem(null);
    setInventoryChangesToReview([]);
    setInventoryForm(createEmptyInventoryItem());
    setInventoryFieldErrors({});
    resetFinanceHistory();
  };

  const openReorderModal = (item: InventoryItem) => {
    setInventoryItemToReorder(item);
    setReorderForm(createEmptyReorderForm());
    setReorderFieldErrors({});
  };

  const buildInventoryChanges = (current: InventoryItem, form: typeof inventoryForm): InventoryChange[] => {
    const nextQuantity = Number(form.quantity) || 0;
    const nextCostPerUnit = Number(form.costPerUnit) || 0;
    const textValue = (value?: string | number | null) => String(value ?? "").trim() || "-";
    const quantityValue = (quantity: number, unit?: string | null) => `${quantity} ${textValue(unit)}`.trim();
    const changedText = (before?: string | number | null, after?: string | number | null) => textValue(before) !== textValue(after);
    const changedNumber = (before?: number | null, after?: number | null) => Math.abs((Number(before) || 0) - (Number(after) || 0)) > 0.009;

    return [
      ...(changedText(current.item, form.item)
        ? [{ label: "Item name", before: textValue(current.item), after: textValue(form.item) }]
        : []),
      ...(changedNumber(current.quantity, nextQuantity)
        ? [{ label: "Quantity", before: quantityValue(Number(current.quantity) || 0, current.unit), after: quantityValue(nextQuantity, form.unit) }]
        : []),
      ...(changedText(current.unit, form.unit)
        ? [{ label: "Unit", before: textValue(current.unit), after: textValue(form.unit) }]
        : []),
      ...(changedNumber(current.costPerUnit, nextCostPerUnit)
        ? [{ label: "Unit cost", before: formatCurrency(current.costPerUnit), after: formatCurrency(nextCostPerUnit), important: true }]
        : []),
      ...(changedText(current.supplier, form.supplier)
        ? [{ label: "Supplier", before: textValue(current.supplier), after: textValue(form.supplier) }]
        : []),
      ...(changedText(current.lastOrdered, form.lastOrdered)
        ? [{ label: "Last ordered", before: textValue(current.lastOrdered), after: textValue(form.lastOrdered) }]
        : []),
    ];
  };

  const saveInventoryItem = async () => {
    const errors = validateInventoryForm();
    if (Object.keys(errors).length > 0) {
      setInventoryFieldErrors(errors);
      toast.error("Please complete the required inventory fields");
      return;
    }

    setInventoryFieldErrors({});
    setIsSavingInventory(true);
    try {
      const isEditingItem = inventoryModalMode === "edit" && selectedInventoryItem;
      const quantity = Number(inventoryForm.quantity) || 0;
      const costPerUnit = Number(inventoryForm.costPerUnit) || 0;
      await fetchApiData<InventoryItem>(
        isEditingItem
          ? `/api/inventory/${encodeURIComponent(selectedInventoryItem.id)}`
          : "/api/inventory",
        isEditingItem ? "inventory update" : "new inventory item",
        {
          method: isEditingItem ? "PUT" : "POST",
          body: JSON.stringify({
            ...inventoryForm,
            quantity,
            costPerUnit,
            totalValue: quantity * costPerUnit,
          }),
        }
      );

      toast.success(isEditingItem ? "Inventory item updated" : "Inventory item added");
      closeInventoryModal();
      await fetchData();
    } catch (error) {
      console.error("Error saving inventory item:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save inventory item");
    } finally {
      setIsSavingInventory(false);
    }
  };

  const handleSaveInventoryItem = async () => {
    const errors = validateInventoryForm();
    if (Object.keys(errors).length > 0) {
      setInventoryFieldErrors(errors);
      toast.error("Please complete the required inventory fields");
      return;
    }

    setInventoryFieldErrors({});
    const isEditingItem = inventoryModalMode === "edit" && selectedInventoryItem;
    if (isEditingItem) {
      const changes = buildInventoryChanges(selectedInventoryItem, inventoryForm);
      if (changes.length === 0) {
        toast.info("No inventory changes to save");
        return;
      }
      setInventoryChangesToReview(changes);
      return;
    }

    await saveInventoryItem();
  };

  const handleConfirmInventoryChanges = async () => {
    await saveInventoryItem();
  };

  const handleReorderInventoryItem = async () => {
    if (!inventoryItemToReorder || Number(reorderForm.quantityToAdd) === 0) {
      setReorderFieldErrors({ quantityToAdd: "Enter a positive or negative stock change." });
      toast.error("Please enter a stock change");
      return;
    }

    setReorderFieldErrors({});
    setIsSavingReorder(true);
    try {
      const stockChange = Number(reorderForm.quantityToAdd) || 0;
      const costPerUnit = Number(inventoryItemToReorder.costPerUnit) || 0;
      const newQuantity = Number(inventoryItemToReorder.quantity) + stockChange;

      if (newQuantity < 0) {
        setReorderFieldErrors({ quantityToAdd: "Stock change would make inventory negative." });
        toast.error("Stock cannot go below zero");
        return;
      }

      await fetchApiData<InventoryItem>(`/api/inventory/${encodeURIComponent(inventoryItemToReorder.id)}`, "stock update", {
        method: "PUT",
        body: JSON.stringify({
          quantity: newQuantity,
          totalValue: newQuantity * costPerUnit,
        }),
      });

      toast.success("Stock quantity updated");
      setInventoryItemToReorder(null);
      setReorderForm(createEmptyReorderForm());
      setReorderFieldErrors({});
      await fetchData();
    } catch (error) {
      console.error("Error adding inventory stock:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add inventory stock");
    } finally {
      setIsSavingReorder(false);
    }
  };

  const openPayrollModal = (mode: FinancePayrollModalMode, entry?: PayrollEntry) => {
    if (PAYROLL_DISABLED) {
      toast.error("Payroll is disabled");
      return;
    }

    setPayrollModalMode(mode);
    setSelectedPayrollEntry(entry || null);
    setPayrollPaymentDate(getDefaultPayrollPaymentDate(selectedPayrollMonth));
    resetFinanceHistory();
    void loadFinanceHistory("payroll", {
      entityId: entry?.id,
      context: selectedPayrollMonth,
    });
  };

  const closePayrollModal = () => {
    setPayrollModalMode(null);
    setSelectedPayrollEntry(null);
    setPayrollPaymentDate(getDefaultPayrollPaymentDate(selectedPayrollMonth));
    resetFinanceHistory();
  };

  const openPayrollBonusModal = (entry?: PayrollEntry) => {
    if (PAYROLL_DISABLED) {
      toast.error("Payroll is disabled");
      return;
    }

    setPayrollBonusForm(createPayrollBonusForm(selectedPayrollMonth, entry?.id || ""));
    setIsPayrollBonusModalOpen(true);
    if (entry?.id) {
      loadPayrollBonusDetails(entry.id);
    }
  };

  const closePayrollBonusModal = () => {
    setIsPayrollBonusModalOpen(false);
    setPayrollBonusForm(createPayrollBonusForm(selectedPayrollMonth));
  };

  const openPayrollEditModal = (entry: PayrollEntry) => {
    if (PAYROLL_DISABLED) {
      toast.error("Payroll is disabled");
      return;
    }

    setPayrollEntryToEdit(entry);
    setPayrollEditForm(createPayrollEditFormFromEntry(entry, selectedPayrollMonth));
  };

  const closePayrollEditModal = () => {
    setPayrollEntryToEdit(null);
    setPayrollEditForm({
      baseSalary: 0,
      date: getDefaultPayrollPaymentDate(selectedPayrollMonth),
      salaryNotes: "",
    });
  };

  const handlePayrollMonthChange = async (value: string) => {
    if (PAYROLL_DISABLED) {
      toast.error("Payroll is disabled");
      return;
    }

    setSelectedPayrollMonth(value);
    closePayrollModal();
    setPayrollEntryToUnpay(null);
    setIsPayrollBonusModalOpen(false);
    setPayrollEntryToEdit(null);
    setPayrollBonusForm(createPayrollBonusForm(value));
    setPayrollEditForm({
      baseSalary: 0,
      date: getDefaultPayrollPaymentDate(value),
      salaryNotes: "",
    });
    await fetchData(value);
  };

  const fetchStaffFinancialRecords = () =>
    fetchApiData<StaffFinancialRecord[]>("/api/staff/financials", "staff financial records");

  const updateStaffRecord = (staffId: string, updates: StaffRecordUpdate) =>
    fetchApiData(`/api/staff/${encodeURIComponent(staffId)}`, "staff update", {
      method: "PUT",
      body: JSON.stringify(updates),
    });

  const createStaffFinancialRecord = (record: {
    staffId: string;
    type: string;
    amount: number;
    date: string;
    notes?: string;
    repaymentSchedule?: string;
  }) =>
    fetchApiData<StaffFinancialRecord>("/api/staff/financials", "staff financial record", {
      method: "POST",
      body: JSON.stringify(record),
    });

  const updateStaffFinancialRecord = (recordId: string, updates: Partial<StaffFinancialRecord>) =>
    fetchApiData<StaffFinancialRecord>(`/api/staff/financials/${encodeURIComponent(recordId)}`, "staff financial record update", {
      method: "PUT",
      body: JSON.stringify(updates),
    });

  const deleteStaffFinancialRecord = (recordId: string) =>
    fetchApiData<null>(`/api/staff/financials/${encodeURIComponent(recordId)}`, "staff financial record deletion", {
      method: "DELETE",
    });

  const payPayrollEmployee = (entry: PayrollEntry, paymentDate: string) =>
    PAYROLL_DISABLED
      ? Promise.reject(new Error("Payroll is disabled"))
      : fetchApiData<PayrollEntry>(
      `/api/finance/payroll/${encodeURIComponent(entry.id)}/pay`,
      "payroll payment",
      {
        method: "POST",
        body: JSON.stringify({
          month: selectedPayrollMonth,
          paymentDate,
        }),
      }
    );

  const unpayPayrollEmployee = (entry: PayrollEntry) =>
    PAYROLL_DISABLED
      ? Promise.reject(new Error("Payroll is disabled"))
      : fetchApiData<PayrollEntry>(
      `/api/finance/payroll/${encodeURIComponent(entry.id)}/unpay`,
      "payroll payment reversal",
      {
        method: "POST",
        body: JSON.stringify({
          month: selectedPayrollMonth,
        }),
      }
    );

  const loadPayrollBonusDetails = async (staffId: string) => {
    if (PAYROLL_DISABLED) return;

    try {
      const records = await fetchStaffFinancialRecords();
      const bonusRecords = getPayrollBonusRecords(records || [], staffId, selectedPayrollMonth);
      const managedRecord = findManagedPayrollAdjustment(records || [], staffId, selectedPayrollMonth);
      const managedAmount = Number(managedRecord?.amount) || 0;
      const existingAdjustmentTotal = bonusRecords.reduce(
        (sum, record) => sum + (Number(record.amount) || 0),
        0
      );
      const displayNotes = String(managedRecord?.notes || bonusRecords[0]?.notes || "")
        .replace(payrollAdjustmentMarker(selectedPayrollMonth), "")
        .trim();

      setPayrollBonusForm((currentForm) => ({
        ...currentForm,
        staffId,
        amount: existingAdjustmentTotal,
        date: managedRecord?.date || bonusRecords[0]?.date || currentForm.date || getDefaultPayrollPaymentDate(selectedPayrollMonth),
        notes: displayNotes,
        existingAdjustmentTotal,
      }));
    } catch (error) {
      console.error("Error loading payroll bonus details:", error);
    }
  };

  const handlePayrollBonusStaffChange = (staffId: string) => {
    if (PAYROLL_DISABLED) {
      toast.error("Payroll is disabled");
      return;
    }

    setPayrollBonusForm(createPayrollBonusForm(selectedPayrollMonth, staffId));
    loadPayrollBonusDetails(staffId);
  };

  const handleProcessPayroll = async () => {
    if (PAYROLL_DISABLED) {
      toast.error("Payroll is disabled");
      return;
    }

    setIsSavingPayroll(true);
    try {
      const payableEntries = payrollData.filter(
        (employee) => normalizeFilterValue(employee.status) !== "paid"
      );

      if (payableEntries.length === 0) {
        toast.info("All payroll entries are already paid");
        closePayrollModal();
        return;
      }

      await Promise.all(payableEntries.map((employee) => payPayrollEmployee(employee, payrollPaymentDate)));
      toast.success(`Payroll paid for ${formatPayrollMonthLabel(selectedPayrollMonth)}`);
      closePayrollModal();
      await fetchData(selectedPayrollMonth);
    } catch (error) {
      console.error("Error processing payroll:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process payroll");
    } finally {
      setIsSavingPayroll(false);
    }
  };

  const handleAddPayrollBonus = async () => {
    if (PAYROLL_DISABLED) {
      toast.error("Payroll is disabled");
      return;
    }

    if (!payrollBonusForm.staffId) {
      toast.error("Please select a staff member");
      return;
    }

    const selectedStaff = payrollData.find((employee) => employee.id === payrollBonusForm.staffId);
    const desiredAdjustmentTotal = Number(payrollBonusForm.amount) || 0;
    const existingAdjustmentTotal = Number(payrollBonusForm.existingAdjustmentTotal) || 0;

    if (Math.abs(desiredAdjustmentTotal) <= 0.009 && Math.abs(existingAdjustmentTotal) <= 0.009) {
      toast.error("Enter a bonus or reduction amount");
      return;
    }

    const bonusDate = payrollBonusForm.date || getDefaultPayrollPaymentDate(selectedPayrollMonth);
    if (!isPayrollMonthDate(bonusDate, selectedPayrollMonth)) {
      toast.error(`Date must be within ${formatPayrollMonthLabel(selectedPayrollMonth)}`);
      return;
    }

    setIsSavingPayroll(true);
    try {
      const latestRecords = await fetchStaffFinancialRecords();
      const latestManagedRecord = findManagedPayrollAdjustment(
        latestRecords || [],
        payrollBonusForm.staffId,
        selectedPayrollMonth
      );
      const latestBonusRecords = getPayrollBonusRecords(
        latestRecords || [],
        payrollBonusForm.staffId,
        selectedPayrollMonth
      );
      const latestManagedAmount = Number(latestManagedRecord?.amount) || 0;
      const latestExistingTotal = latestBonusRecords.reduce(
        (sum, record) => sum + (Number(record.amount) || 0),
        0
      );
      const latestUnmanagedTotal = latestExistingTotal - latestManagedAmount;
      const managedRecordId = latestManagedRecord?.id || "";
      const managedAdjustmentDelta = desiredAdjustmentTotal - latestUnmanagedTotal;

      if (Math.abs(managedAdjustmentDelta) > 0.009) {
        const notes = payrollAdjustmentNotes(selectedPayrollMonth, payrollBonusForm.notes);
        if (managedRecordId) {
          await updateStaffFinancialRecord(managedRecordId, {
            amount: managedAdjustmentDelta,
            date: bonusDate,
            notes,
          });
        } else {
          await createStaffFinancialRecord({
            staffId: payrollBonusForm.staffId,
            type: "bonus",
            amount: managedAdjustmentDelta,
            date: bonusDate,
            notes,
            repaymentSchedule: "",
          });
        }
      } else if (managedRecordId) {
        await deleteStaffFinancialRecord(managedRecordId);
      }

      toast.success(`${selectedStaff?.name || "Staff"} bonus updated`);
      closePayrollBonusModal();
      await fetchData(selectedPayrollMonth);
    } catch (error) {
      console.error("Error saving payroll bonus:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save payroll bonus");
    } finally {
      setIsSavingPayroll(false);
    }
  };

  const handleSavePayrollEdit = async () => {
    if (PAYROLL_DISABLED) {
      toast.error("Payroll is disabled");
      return;
    }

    if (!payrollEntryToEdit) return;

    if (Number(payrollEditForm.baseSalary) < 0) {
      toast.error("Base salary cannot be negative");
      return;
    }

    const editDate = payrollEditForm.date || getDefaultPayrollPaymentDate(selectedPayrollMonth);
    if (!isPayrollMonthDate(editDate, selectedPayrollMonth)) {
      toast.error(`Effective date must be within ${formatPayrollMonthLabel(selectedPayrollMonth)}`);
      return;
    }

    setIsSavingPayroll(true);
    try {
      const nextBaseSalary = Number(payrollEditForm.baseSalary) || 0;
      const records = await fetchStaffFinancialRecords();
      const salaryRecord = findPayrollSalaryRecord(records || [], payrollEntryToEdit.id, selectedPayrollMonth);

      await updateStaffRecord(payrollEntryToEdit.id, { baseSalary: nextBaseSalary });

      if (salaryRecord) {
        await updateStaffFinancialRecord(salaryRecord.id, {
          amount: nextBaseSalary,
          date: editDate,
          notes: payrollEditForm.salaryNotes || salaryRecord.notes || `${formatPayrollMonthLabel(selectedPayrollMonth)} salary`,
        });
      } else if (nextBaseSalary > 0) {
        await createStaffFinancialRecord({
          staffId: payrollEntryToEdit.id,
          type: "salary",
          amount: nextBaseSalary,
          date: editDate,
          notes: payrollEditForm.salaryNotes || `${formatPayrollMonthLabel(selectedPayrollMonth)} salary`,
          repaymentSchedule: "",
        });
      }

      const salaryChanged = Math.abs(
        nextBaseSalary - (Number(payrollEntryToEdit.staffBaseSalary ?? payrollEntryToEdit.baseSalary) || 0)
      ) > 0.009;

      if (!salaryChanged && !payrollEditForm.salaryNotes) {
        toast.info("No payroll changes to save");
      } else {
        toast.success(`${payrollEntryToEdit.name} salary updated`);
      }
      closePayrollEditModal();
      await fetchData(selectedPayrollMonth);
    } catch (error) {
      console.error("Error configuring payroll:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save payroll changes");
    } finally {
      setIsSavingPayroll(false);
    }
  };

  const handlePayPayrollEntry = async () => {
    if (PAYROLL_DISABLED) {
      toast.error("Payroll is disabled");
      return;
    }

    if (!selectedPayrollEntry) return;

    setIsSavingPayroll(true);
    try {
      await payPayrollEmployee(selectedPayrollEntry, payrollPaymentDate);
      toast.success(`${selectedPayrollEntry.name} marked as paid`);
      closePayrollModal();
      await fetchData(selectedPayrollMonth);
    } catch (error) {
      console.error("Error paying payroll entry:", error);
      toast.error(error instanceof Error ? error.message : "Failed to pay payroll entry");
    } finally {
      setIsSavingPayroll(false);
    }
  };

  const handleReversePayrollPayment = async () => {
    if (PAYROLL_DISABLED) {
      toast.error("Payroll is disabled");
      return;
    }

    if (!payrollEntryToUnpay) return;

    setIsSavingPayroll(true);
    try {
      await unpayPayrollEmployee(payrollEntryToUnpay);
      toast.success(`${payrollEntryToUnpay.name} payment cancelled`);
      setPayrollEntryToUnpay(null);
      await fetchData(selectedPayrollMonth);
    } catch (error) {
      console.error("Error reversing payroll payment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reverse payroll payment");
    } finally {
      setIsSavingPayroll(false);
    }
  };

  const getTransactionAppointmentId = (transaction: RecentTransaction) =>
    transaction.appointmentId ||
    getAppointmentIdFromSnapshot(transaction.appointmentSnapshot) ||
    getAppointmentIdFromDescription(transaction.description);

  const isEditablePaymentTransaction = (transaction: RecentTransaction) =>
    !isSoftDeletedPaymentTransaction(transaction) && Boolean(getEditablePaymentId(transaction));

  const isPaymentTransactionRow = (transaction: RecentTransaction) =>
    transaction.type === "income" &&
    Number(transaction.amount || 0) > 0 &&
    !isPaymentLogLikeTransaction(transaction) &&
    (
      transaction.source === "payment" ||
      Boolean(getTransactionAppointmentId(transaction)) ||
      /payment/i.test(`${transaction.description || ""} ${transaction.method || ""}`)
    );

  const getEditablePaymentId = (transaction: RecentTransaction) => {
    if (isPaymentLogLikeTransaction(transaction)) return "";
    if (isSoftDeletedPaymentTransaction(transaction)) return "";

    const explicitPaymentId = transaction.paymentId || transaction.paymentRecordId;
    if (explicitPaymentId) return String(explicitPaymentId).trim();

    if (transaction.source === "payment" && transaction.id) {
      return String(transaction.id).trim();
    }

    return "";
  };

  const getRestorablePaymentId = (transaction: RecentTransaction) => {
    if (isPaymentLogLikeTransaction(transaction)) return "";

    const explicitPaymentId = transaction.paymentId || transaction.paymentRecordId;
    if (explicitPaymentId) return String(explicitPaymentId).trim();

    const id = String(transaction.id || "").trim();
    if (id.startsWith("pay_") || transaction.source === "payment") return id;

    return "";
  };

  const getPaymentEditUnavailableMessage = (transaction: RecentTransaction) => {
    if (isActualDeletedPaymentTransaction(transaction)) {
      return "This payment has been deleted.";
    }

    if (isSoftDeletedPaymentTransaction(transaction)) {
      return "This payment belongs to a deleted appointment.";
    }

    if (isPaymentLogLikeTransaction(transaction)) {
      return "Could not connect this payment log to an editable payment record.";
    }

    if (transaction.source === "finance-record") {
      return "This is a finance record without a linked payment record.";
    }

    return "Could not find the payment record to edit.";
  };

  const handleEditPaymentTransaction = (transaction: RecentTransaction) => {
    const paymentId = getEditablePaymentId(transaction);
    if (!paymentId) {
      toast.error(getPaymentEditUnavailableMessage(transaction));
      return;
    }

    const snapshot = transaction.appointmentSnapshot as any;
    const paymentPatientId =
      transaction.patientId ||
      snapshot?.patientId ||
      snapshot?.patient?.id ||
      null;

    openEditPaymentModal(paymentId, transaction as any, paymentPatientId);
  };

  const handleRequestDeletePaymentTransaction = (transaction: RecentTransaction) => {
    const paymentId = getEditablePaymentId(transaction);

    if (!paymentId) {
      toast.error(getPaymentEditUnavailableMessage(transaction));
      return;
    }

    setPaymentToDelete(transaction);
  };

  const handleDeletePaymentTransaction = async () => {
    if (!paymentToDelete) return;

    const paymentId = getEditablePaymentId(paymentToDelete);
    if (!paymentId) {
      toast.error(getPaymentEditUnavailableMessage(paymentToDelete));
      setPaymentToDelete(null);
      return;
    }

    setIsDeletingPayment(true);
    try {
      await fetchApiData<null>(
        `/api/payments/${encodeURIComponent(paymentId)}`,
        "payment deletion",
        { method: "DELETE" }
      );

      toast.success("Payment deleted");
      setPaymentToDelete(null);
      await fetchData();
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete payment");
    } finally {
      setIsDeletingPayment(false);
    }
  };

  const handleRestorePaymentTransaction = async (transaction: RecentTransaction) => {
    if (!canManageExpenseStatus) {
      toast.error("Only admins can restore deleted payments");
      return;
    }

    const paymentId = getRestorablePaymentId(transaction);
    if (!paymentId) {
      toast.error("Could not find the payment record to restore.");
      return;
    }

    try {
      await fetchApiData(
        `/api/payments/${encodeURIComponent(paymentId)}/restore`,
        "payment restoration",
        { method: "POST" }
      );

      toast.success("Payment restored");
      await fetchData();
    } catch (error) {
      console.error("Error restoring payment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to restore payment");
    }
  };

  const findExpenseForTransaction = (
    transaction: RecentTransaction,
    expenses: DetailedExpense[] = detailedExpenses
  ) => {
    if (transaction.type !== "expense") return null;

    const transactionExpenseId =
      transaction.source === "expense"
        ? String(transaction.id || transaction.transactionId || "").trim()
        : "";
    const directMatch = transactionExpenseId
      ? expenses.find((expense) => String(expense.id) === transactionExpenseId)
      : null;

    if (directMatch) return directMatch;

    const transactionAmount = Math.abs(Number(transaction.amount) || 0);
    const transactionDescription = normalizeFilterValue(transaction.description);
    const transactionMethod = normalizeFilterValue(transaction.method);

    return (
      expenses.find((expense) => {
        const method = normalizeFilterValue(expense.paymentMethod);
        return (
          expense.date === transaction.date &&
          normalizeFilterValue(expense.description) === transactionDescription &&
          Math.abs((Number(expense.amount) || 0) - transactionAmount) < 0.01 &&
          (!transactionMethod || method === transactionMethod)
        );
      }) || null
    );
  };

  const handleViewTransaction = async (transaction: RecentTransaction) => {
    if (transaction.type === "expense") {
      let expense = findExpenseForTransaction(transaction);

      if (!expense && transaction.source === "expense") {
        setLoadingAppointmentId(transaction.id);
        try {
          const refreshedExpenses = await fetchApiData<DetailedExpense[]>("/api/finance/detailed-expenses", "detailed expenses");
          setDetailedExpenses(refreshedExpenses || []);
          expense = findExpenseForTransaction(transaction, refreshedExpenses || []);
        } catch (error) {
          console.error("Error loading expense details:", error);
          toast.error(error instanceof Error ? error.message : "Failed to load expense details");
          setLoadingAppointmentId(null);
          return;
        } finally {
          setLoadingAppointmentId(null);
        }
      }

      if (expense) {
        openExpenseModal("edit", expense);
        return;
      }

      if (!getTransactionAppointmentId(transaction) && !transaction.appointmentSnapshot) {
        toast.error("No detailed expense is linked to this transaction");
        return;
      }
    }

    await handleViewAppointmentSnapshot(transaction);
  };

  const handleOpenAppointment = async (appointmentId: string) => {
    if (!appointmentId) {
      toast.error("No appointment is linked to this snapshot");
      return;
    }

    setLoadingAppointmentId(appointmentId);
    try {
      setIsAppointmentHistoryOpen(false);
      await openEditModalById(appointmentId);
    } catch (error) {
      console.error("Failed to open appointment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to open appointment");
    } finally {
      setLoadingAppointmentId(null);
    }
  };

  const viewCurrentAppointment = async (appointmentId: string) => {
    if (!appointmentId) return;
    setLoadingAppointmentId(appointmentId);
    try {
      const live = await fetchApiData<any>(`/api/appointments/${encodeURIComponent(appointmentId)}`, "current appointment");
      setAppointmentSnapshot(live);
      setAppointmentPaymentSnapshot(null);
      setAppointmentSnapshotLogDate(live?.updatedAt || live?.createdAt || "");
      setAppointmentSnapshotIsHistorical(false);
      setIsAppointmentHistoryOpen(true);
    } catch (err) {
      console.error("Failed to load current appointment:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load appointment");
    } finally {
      setLoadingAppointmentId(null);
    }
  };

  const handleViewAppointmentSnapshot = async (transaction: RecentTransaction) => {
    let transactionToView = transaction;
    let appointmentId = getTransactionAppointmentId(transactionToView);
    const loadingKey = appointmentId || transaction.id;

    setLoadingAppointmentId(loadingKey);
    try {
      if (!appointmentId && !transactionToView.appointmentSnapshot) {
        const recentTransactionsPath = `/api/finance/recent-transactions?limit=500${canSeeDeletedPayments ? "&includeDeleted=true" : ""}`;
        const refreshedTransactions = await fetchApiData<RecentTransaction[]>(recentTransactionsPath, "recent transactions");
        const refreshedRows = (refreshedTransactions || []).filter((item) => !isPaymentLogLikeTransaction(item));
        setRecentTransactions(refreshedRows);

        transactionToView =
          refreshedRows.find((item) => String(item.id) === String(transaction.id)) ||
          transactionToView;
        appointmentId = getTransactionAppointmentId(transactionToView);
      }

      if (!appointmentId && !transactionToView.appointmentSnapshot) {
        toast.error("No appointment is linked to this transaction");
        return;
      }

      // Payment transaction views should show the live appointment details and
      // keep only the selected payment amount/date/method fixed to the row.
      let snapshot = transactionToView.appointmentSnapshot || null;
      const resolvedAppointmentId = appointmentId || getAppointmentIdFromSnapshot(snapshot);
      const isPaymentSnapshot = isPaymentTransactionRow(transactionToView);
      // Determine whether this snapshot should be treated as historical (older log).
      // Priority: explicit _isHistorical flag (from fetchSnapshotFromLogs) > logDate alone > default false
      let isHistorical = false;
      if (snapshot && Object.prototype.hasOwnProperty.call(snapshot, "_isHistorical")) {
        // Snapshot has explicit flag from fetchSnapshotFromLogs; trust it (handles latest log correctly)
        isHistorical = Boolean(snapshot._isHistorical);
      } else if (transactionToView.logDate && !snapshot) {
        // No snapshot yet, but we have a logDate; assume it will be historical until proven otherwise
        isHistorical = true;
      }

      if (isPaymentSnapshot && resolvedAppointmentId) {
        try {
          const liveSnapshot = await fetchApiData<any>(
            `/api/appointments/${encodeURIComponent(resolvedAppointmentId)}?t=${Date.now()}`,
            "current appointment"
          );
          if (liveSnapshot) {
            snapshot = liveSnapshot;
            isHistorical = false;
          }
        } catch (error) {
          console.warn("Failed to load current appointment for payment transaction:", error);
        }
      }

      // If no snapshot and we have a logDate, try reconstructing from logs
      if (!snapshot && !isPaymentSnapshot && resolvedAppointmentId && transactionToView.logDate) {
        try {
          const fromLogs = await fetchSnapshotFromLogs(resolvedAppointmentId, transactionToView.logDate);
          if (fromLogs) {
            snapshot = fromLogs;
            isHistorical = Boolean(fromLogs._isHistorical);
          }
        } catch (e) {
          console.warn("Failed to build snapshot from logs:", e);
        }
      }

      // Fallback: fetch current appointment
      if (!snapshot && resolvedAppointmentId) {
        snapshot = await fetchApiData<any>(`/api/appointments/${encodeURIComponent(resolvedAppointmentId)}`, "appointment snapshot");
      }

      if (!snapshot) {
        throw new Error("No appointment snapshot is available for this transaction");
      }

      if (resolvedAppointmentId && !getAppointmentIdFromSnapshot(snapshot)) {
        snapshot = { ...snapshot, id: resolvedAppointmentId };
      }

      // Enrich the snapshot with transaction metadata so AppointmentHistoryView
      // can reliably detect payment logs (SEED-PAY-xxxx) and display paid-in-snapshot values.
      const paymentTxnId = transactionToView.transactionId || transactionToView.id || snapshot?.transactionId || snapshot?._paymentTransactionId || snapshot?._transactionId;

      const resolvedPreviousBalance = transactionToView.previousBalance ?? snapshot?.previousBalance ?? snapshot?.balance ?? undefined;
      const resolvedNewBalance = transactionToView.newBalance ?? snapshot?.newBalance ?? undefined;
      const resolvedPaymentAmount = Number(transactionToView.amount ?? transactionToView.paymentAmount ?? snapshot?.paymentAmount ?? snapshot?.amount ?? 0) || undefined;
      const resolvedPaymentMethod = transactionToView.method || snapshot?.method || snapshot?.paymentMethod;
      const resolvedTransactionId = transactionToView.transactionId || transactionToView.id || snapshot?.transactionId || paymentTxnId;
      const resolvedPaymentDate = transactionToView.paymentDate || transactionToView.date || snapshot?.paymentDate;

      const selectedPaymentForDialog = isPaymentSnapshot
        ? {
            ...transactionToView,
            id: transactionToView.paymentId || transactionToView.paymentRecordId || transactionToView.id,
            paymentId: transactionToView.paymentId || transactionToView.paymentRecordId || transactionToView.id,
            paymentRecordId: transactionToView.paymentRecordId || transactionToView.paymentId || transactionToView.id,
            transactionId: resolvedTransactionId,
            amount: resolvedPaymentAmount || 0,
            paymentAmount: resolvedPaymentAmount || 0,
            date: resolvedPaymentDate,
            paymentDate: resolvedPaymentDate,
            method: resolvedPaymentMethod,
            paymentMethod: resolvedPaymentMethod,
            changedAt: transactionToView.logDate || transactionToView.date,
          }
        : null;
      const enrichedSnapshot = {
        ...snapshot,
        transactionId: resolvedTransactionId,
        _paymentTransactionId: paymentTxnId || snapshot?._paymentTransactionId || snapshot?._transactionId,
        _transactionId: snapshot?._transactionId || snapshot?.transactionId || paymentTxnId,
        previousBalance: resolvedPreviousBalance,
        newBalance: resolvedNewBalance,
        paymentAmount: resolvedPaymentAmount ?? snapshot?.paymentAmount ?? snapshot?.amount,
        amount: resolvedPaymentAmount ?? snapshot?.amount,
        paymentDate: resolvedPaymentDate,
        paymentMethod: resolvedPaymentMethod,
        changedBy: transactionToView.changedBy ?? snapshot?.changedBy,
        changedByName: transactionToView.changedByName ?? snapshot?.changedByName,
        // preserve any explicit _isHistorical flag from fetched snapshot; otherwise
        // derive from the isHistorical value we computed earlier.
        _isHistorical: isPaymentSnapshot ? false : Boolean(snapshot?._isHistorical) || Boolean(isHistorical),
        logType: isPaymentSnapshot ? snapshot?.logType : snapshot?.logType || (transactionToView.source ? String(transactionToView.source) : undefined) || (isHistorical ? "payment" : snapshot?.logType),
        changeType: isPaymentSnapshot ? snapshot?.changeType : snapshot?.changeType || (isHistorical ? "payment" : snapshot?.changeType),
      };

      setAppointmentSnapshot(enrichedSnapshot);
      setAppointmentPaymentSnapshot(selectedPaymentForDialog);
      setAppointmentSnapshotLogDate(
        isPaymentSnapshot
          ? enrichedSnapshot?.updatedAt || enrichedSnapshot?.createdAt || transactionToView.logDate || transactionToView.date || ""
          : transactionToView.logDate || transactionToView.date || enrichedSnapshot?.changedAt || enrichedSnapshot?.updatedAt || ""
      );
      setAppointmentSnapshotIsHistorical(isPaymentSnapshot ? false : Boolean(enrichedSnapshot._isHistorical));
      setIsAppointmentHistoryOpen(true);
    } catch (error) {
      console.error("Error loading appointment snapshot:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load appointment snapshot");
    } finally {
      setLoadingAppointmentId(null);
    }
  };

  const renderFinanceAppointmentGroup = (group: FinanceAppointmentGroup) => {
    const firstTransaction = group.transactions[0];
    const groupDateSource = group.appointmentDate || (firstTransaction ? getFinanceTransactionSortDate(firstTransaction) : "");
    const dateParts = getFinanceTimelineDateParts(groupDateSource);

    return (
      <div key={group.key} className="relative">
        <span className="absolute -left-[2rem] top-11 h-4 w-4 rounded-full border-4 border-white bg-violet-600 shadow-md shadow-violet-200 sm:-left-[3rem]" />
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-md shadow-slate-200/60 transition-colors hover:border-violet-200 sm:p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center gap-4 sm:w-40 sm:border-r sm:border-slate-200 sm:pr-6">
                <div className="text-center sm:w-24">
                  <div className="text-lg font-black leading-none text-violet-600">{dateParts.month}</div>
                  <div className="mt-1 text-5xl font-black leading-none text-slate-950">{dateParts.day}</div>
                  <div className="mt-2 text-lg font-bold leading-none text-slate-500">{dateParts.year}</div>
                </div>
              </div>
              <div className="min-w-0">
                <h4 className="truncate text-lg font-black text-slate-950">{group.appointmentType || "Appointment"}</h4>
                <p className="mt-1 truncate text-base font-medium text-slate-500">{group.patientName}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-600" />
                    Patient: {group.patientName}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-slate-600" />
                    Doctor: {group.doctorName}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-600" />
                    Appointment: {formatFinanceDate(group.appointmentDate)}
                  </span>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="w-fit rounded-md border-violet-100 bg-violet-50 px-3 py-1 text-sm font-bold text-violet-700">
              {group.transactions.length} payment{group.transactions.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Payments</div>
            <div className="space-y-3">
              {group.transactions.map((payment) => {
                const appointmentId = getTransactionAppointmentId(payment);
                const transactionLoadingKey = appointmentId || payment.id;
                const isLoadingThisAppointment = loadingAppointmentId === transactionLoadingKey;
                const paymentDate = getFinanceTransactionSortDate(payment);
                const canEditPayment = isEditablePaymentTransaction(payment);
                const paymentStatusDisplay = getFinancePaymentStatusDisplay(payment);
                const isDeletedPayment = isSoftDeletedPaymentTransaction(payment);
                const isActualDeletedPayment = isActualDeletedPaymentTransaction(payment);
                const restorablePaymentId = getRestorablePaymentId(payment);

                return (
                  <div key={payment.id || payment.transactionId} className={`flex flex-col gap-3 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between ${isDeletedPayment ? deletedPaymentRowClass : "bg-slate-50/70"}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-slate-600">
                        <span>Payment Date: {formatFinanceDate(paymentDate)}</span>
                        <span>Method: {payment.method || "N/A"}</span>
                        <span>Ref No.: {payment.transactionId || payment.id || "N/A"}</span>
                      </div>
                      {payment.changedByName ? (
                        <div className="mt-1 text-xs font-medium text-slate-400">Saved by {payment.changedByName}</div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <div className={`text-xl font-black ${isDeletedPayment ? "text-gray-600" : "text-emerald-600"}`}>{formatCurrency(Math.abs(payment.amount))}</div>
                        <PaymentTransactionStatusBadge
                          display={paymentStatusDisplay}
                          className="mt-1 px-2.5 py-0.5 text-xs"
                          showIcon={false}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-lg border-slate-200 bg-white text-slate-700 shadow-sm hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                        disabled={isLoadingThisAppointment}
                        title={appointmentId || payment.appointmentSnapshot ? "View appointment snapshot" : "No details linked"}
                        onClick={() => handleViewTransaction(payment)}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View transaction details</span>
                      </Button>
                      {!isDeletedPayment ? (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className={`h-10 w-10 rounded-lg border-slate-200 bg-white text-slate-700 shadow-sm hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 ${canEditPayment ? "" : "opacity-60"}`}
                            title={canEditPayment ? "Edit payment" : getPaymentEditUnavailableMessage(payment)}
                            onClick={() => handleEditPaymentTransaction(payment)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit Payment</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className={`h-10 w-10 rounded-lg border-slate-200 bg-white text-red-600 shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-700 ${canEditPayment ? "" : "opacity-60"}`}
                            title={canEditPayment ? "Delete payment" : getPaymentEditUnavailableMessage(payment)}
                            onClick={() => handleRequestDeletePaymentTransaction(payment)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete Payment</span>
                          </Button>
                        </>
                      ) : canManageExpenseStatus && isActualDeletedPayment && restorablePaymentId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 rounded-lg border-emerald-200 bg-white px-3 text-xs font-black uppercase text-emerald-700 shadow-sm hover:bg-emerald-50"
                          title="Restore payment"
                          onClick={() => handleRestorePaymentTransaction(payment)}
                        >
                          <RotateCcw className="mr-1.5 h-4 w-4" />
                          Restore
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div data-tour-id="finance-page" className="space-y-6 p-4 sm:p-6">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <Button variant="ghost" size="icon" className="mt-1 h-11 w-11 shrink-0 rounded-2xl text-slate-900 md:hidden" aria-label="Finance menu">
              <Menu className="h-7 w-7" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-2xl md:font-semibold">Financial Overview</h1>
              <p className="mt-1 text-lg font-medium leading-snug text-slate-500 md:text-base">Track revenue, expenses, and clinic profitability</p>
            </div>
          </div>
          <Button variant="outline" size="icon" className="h-14 w-14 shrink-0 rounded-2xl border-gray-100 bg-white text-violet-600 shadow-md shadow-gray-200/50 md:hidden" aria-label="Finance trend overview">
            <TrendingUp className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex h-14 min-w-0 flex-1 basis-[170px] rounded-[1.35rem] border border-gray-100 bg-white p-1 shadow-sm sm:flex-none md:h-auto md:min-w-0 md:rounded-xl md:border-gray-200">
            {(["day", "week", "month"] as const).map((period) => (
              <Button
                key={period}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setMetricPeriod(period)}
                className={`h-full flex-1 rounded-2xl px-4 text-base font-black capitalize md:h-8 md:rounded-lg md:px-3 md:text-xs md:font-bold md:uppercase ${
                  metricPeriod === period
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-200 hover:bg-violet-700 hover:text-white"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {period}
              </Button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button variant="outline" onClick={handleExportReport} className="h-14 rounded-2xl border-gray-100 bg-white px-4 font-black text-slate-900 shadow-md shadow-gray-200/40 md:h-10 md:rounded-xl md:px-4">
              <Download className="mr-2 h-5 w-5 md:h-4 md:w-4" />
              Export
            </Button>
            <Button variant="brand" onClick={handleGenerateInvoices} className="h-14 rounded-2xl bg-violet-600 px-4 font-black text-white shadow-lg shadow-violet-200 hover:bg-violet-700 md:h-10 md:rounded-xl md:px-4">
              <FileText className="mr-2 h-5 w-5 md:h-4 md:w-4" />
              Invoices
            </Button>
          </div>
        </div>
      </div>

      {/* Key Financial Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <Card className="rounded-3xl border-gray-100 bg-white shadow-md shadow-gray-200/40">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2 md:p-6 md:pb-2">
            <CardTitle className="text-base font-bold text-slate-500 md:text-sm">{metricPeriodRange.title} Revenue</CardTitle>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <DollarSign className="h-6 w-6" />
            </span>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <div className="text-4xl font-black tracking-tight text-slate-950 md:text-2xl md:font-bold">{formatCurrency(metricRevenue)}</div>
            <div className="mt-2 text-lg font-medium text-slate-500 md:text-xs">{metricPeriodRange.label}</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-gray-100 bg-white shadow-md shadow-gray-200/40">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2 md:p-6 md:pb-2">
            <CardTitle className="text-base font-bold text-slate-500 md:text-sm">{metricPeriodRange.title} Expenses</CardTitle>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <TrendingDown className="h-6 w-6" />
            </span>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <div className="text-4xl font-black tracking-tight text-slate-950 md:text-2xl md:font-bold">{formatCurrency(metricExpenses)}</div>
            <div className="mt-2 text-lg font-medium text-slate-500 md:text-xs">{metricPeriodRange.label}</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-gray-100 bg-white shadow-md shadow-gray-200/40">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2 md:p-6 md:pb-2">
            <CardTitle className="text-base font-bold text-slate-500 md:text-sm">{metricPeriodRange.title} Net Profit</CardTitle>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <TrendingUp className="h-6 w-6" />
            </span>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <div className="text-4xl font-black tracking-tight text-slate-950 md:text-2xl md:font-bold">{formatCurrency(metricProfit)}</div>
            <div className="mt-2 text-lg font-medium text-slate-500 md:text-xs">{metricPeriodRange.label}</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-gray-100 bg-white shadow-md shadow-gray-200/40">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2 md:p-6 md:pb-2">
            <CardTitle className="text-base font-bold text-slate-500 md:text-sm">Profit Margin</CardTitle>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <Package className="h-6 w-6" />
            </span>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <div className="text-4xl font-black tracking-tight text-slate-950 md:text-2xl md:font-bold">
              {metricMargin.toFixed(1)}%
            </div>
            <div className="mt-2 text-lg font-medium text-slate-500 md:text-xs">{metricPeriodRange.label}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6" onValueChange={() => fetchData()}>
        <TabsList className="grid h-auto w-full grid-cols-4 gap-2 overflow-x-auto rounded-none border-b border-gray-100 bg-transparent p-0">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-4 pt-2 text-base font-black text-slate-500 shadow-none data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:text-violet-600 data-[state=active]:shadow-none md:rounded-lg md:border-b-0 md:px-3 md:py-2 md:text-sm md:data-[state=active]:bg-violet-600 md:data-[state=active]:text-white">Overview</TabsTrigger>
          <TabsTrigger value="expenses" className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-4 pt-2 text-base font-black text-slate-500 shadow-none data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:text-violet-600 data-[state=active]:shadow-none md:rounded-lg md:border-b-0 md:px-3 md:py-2 md:text-sm md:data-[state=active]:bg-violet-600 md:data-[state=active]:text-white">Expenses</TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-4 pt-2 text-base font-black text-slate-500 shadow-none data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:text-violet-600 data-[state=active]:shadow-none md:rounded-lg md:border-b-0 md:px-3 md:py-2 md:text-sm md:data-[state=active]:bg-violet-600 md:data-[state=active]:text-white">Inventory</TabsTrigger>
          {!PAYROLL_DISABLED && (
            <TabsTrigger value="payroll" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Payroll</TabsTrigger>
          )}
          <TabsTrigger value="transactions" className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-4 pt-2 text-base font-black text-slate-500 shadow-none data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:text-violet-600 data-[state=active]:shadow-none md:rounded-lg md:border-b-0 md:px-3 md:py-2 md:text-sm md:data-[state=active]:bg-violet-600 md:data-[state=active]:text-white">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Revenue Chart */}
            <Card className="rounded-3xl border-gray-100 bg-white shadow-md shadow-gray-200/40 lg:col-span-2">
              <CardHeader className="gap-4 p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-2xl font-black tracking-tight text-slate-950 md:text-xl">Revenue vs Expenses</CardTitle>
                  <Select defaultValue="6-months">
                    <SelectTrigger className="h-12 w-[132px] rounded-2xl border-gray-100 bg-white text-base font-bold shadow-sm md:h-10 md:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6-months">6 Months</SelectItem>
                      <SelectItem value="12-months">12 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-5 text-base font-medium text-slate-500 md:text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full bg-red-500" />
                    Expenses
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full bg-emerald-600" />
                    Revenue
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="inline-block">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-2"></div>
                      Loading revenue data...
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), ""]} />
                      <Area type="monotone" dataKey="revenue" stackId="1" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} />
                      <Area type="monotone" dataKey="expenses" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.72} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Expense Breakdown */}
            <Card className="rounded-3xl border-gray-100 bg-white shadow-md shadow-gray-200/40">
              <CardHeader className="p-5 md:p-6">
                <CardTitle className="text-2xl font-black tracking-tight text-slate-950 md:text-xl">Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 md:p-6 md:pt-0">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="inline-block">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-2"></div>
                      Loading expenses breakdown...
                    </div>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      {expenseBreakdown.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No expense breakdown data available.</div>
                      ) : (
                        <PieChart>
                          <Pie
                            data={expenseBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="amount"
                          >
                            {expenseBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Amount"]} />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-3">
                      {expenseBreakdown.length === 0 ? null : ( // Hide legend if no data
                        expenseBreakdown.map((expense) => (
                          <div key={expense.category} className="flex items-center justify-between text-base">
                            <div className="flex items-center space-x-3">
                              <div className="h-4 w-4 rounded-full" style={{ backgroundColor: expense.color }} />
                              <span className="font-medium text-slate-900">{expense.category}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-black text-slate-950">{formatCurrency(expense.amount)}</div>
                              <div className="text-sm text-muted-foreground">{expense.percentage}%</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="rounded-3xl border border-violet-100 bg-violet-50/70 p-5 shadow-md shadow-violet-100/50">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xl font-black text-violet-600">
                i
              </div>
              <div>
                <h3 className="text-lg font-black text-violet-600">Insights</h3>
                <p className="mt-1 text-base font-medium text-slate-900">
                  {metricExpenses > metricRevenue ? "Expenses are the main driver of costs this period." : "Revenue is covering expenses for this period."}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CardTitle>Expenses</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Money spent by the clinic. Link a stock item when a bill should also add quantity to Inventory.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <Select value={timePeriodFilter} onValueChange={setTimePeriodFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Time Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="yesterday">Yesterday</SelectItem>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="last_week">Last Week</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center space-x-2">
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {EXPENSE_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Paid With" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      {PAYMENT_METHOD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => fetchData()} title="Refresh finance data">
                    <Filter className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => openExpenseModal("create")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Manual Expense
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="inline-block">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-2"></div>
                    Loading expenses...
                  </div>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Paid With</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDetailedExpenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No detailed expenses found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredDetailedExpenses.map((expense) => {
                          const expenseStatus = normalizeFilterValue(expense.status);
                          return (
                            <TableRow key={expense.id}>
                              <TableCell>{formatFinanceDate(expense.date)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {expense.createdAt ? formatTransactionTimestamp(expense.createdAt) : "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{formatOptionLabel(expense.category, EXPENSE_CATEGORY_OPTIONS)}</Badge>
                              </TableCell>
                              <TableCell className="font-medium max-w-xs truncate">{expense.description}</TableCell>
                              <TableCell>{expense.vendor || "-"}</TableCell>
                              <TableCell className="font-medium">{formatCurrency(expense.amount)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {expenseStatus === "paid"
                                  ? formatOptionLabel(expense.paymentMethod, PAYMENT_METHOD_OPTIONS)
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  expenseStatus === "paid"
                                    ? "bg-green-100 text-green-800"
                                    : expenseStatus === "cancelled"
                                      ? "bg-gray-100 text-gray-700"
                                      : "bg-yellow-100 text-yellow-800"
                                }>
                                  {formatOptionLabel(expense.status, EXPENSE_STATUS_OPTIONS)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  <Button variant="outline" size="sm" onClick={() => openExpenseModal("edit", expense)}>
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edit
                                  </Button>
                                  {expenseStatus === "pending" && (
                                    <Button size="sm" onClick={() => openExpensePaymentModal(expense)}>
                                      Pay
                                    </Button>
                                  )}
                                  {canManageExpenseStatus && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                      onClick={() => openExpenseDeleteDialog(expense)}
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CardTitle>Inventory</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Stock on hand. Adjust Stock only changes quantity; record bills in Expenses and link them to stock when needed.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <Select value={inventoryStockFilter} onValueChange={setInventoryStockFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Items</SelectItem>
                      <SelectItem value="low">Low Stock</SelectItem>
                      <SelectItem value="out">Out of Stock</SelectItem>
                      <SelectItem value="healthy">Healthy Stock</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => openInventoryModal("create")}>
                    <PackagePlus className="h-4 w-4 mr-2" />
                    New Stock Item
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="inline-block">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-2"></div>
                    Loading inventory...
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Cost</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Last Ordered</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventoryData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {inventoryData.length === 0 ? "No inventory items found. Create a stock item to start tracking supplies." : "No inventory items match this filter."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInventoryData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item}</TableCell>
                          <TableCell>
                            <Badge variant={item.quantity < 20 ? "destructive" : "secondary"}>
                              {item.quantity} {item.unit}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(item.costPerUnit)}</TableCell>
                          <TableCell>{item.supplier}</TableCell>
                          <TableCell>{formatFinanceDate(item.lastOrdered)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => openReorderModal(item)}>
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Adjust Stock
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openInventoryModal("edit", item)}>
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {!PAYROLL_DISABLED && (
        <TabsContent value="payroll" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Employee Payroll</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatPayrollMonthLabel(selectedPayrollMonth)} salary run
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={selectedPayrollMonth} onValueChange={handlePayrollMonthChange}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {payrollMonthOptions.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleExportPayroll} disabled={payrollData.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" onClick={() => openPayrollBonusModal()} disabled={payrollData.length === 0}>
                    <Gift className="h-4 w-4 mr-2" />
                    Add Bonus
                  </Button>
                  <Button onClick={() => openPayrollModal("process")} disabled={payrollData.length === 0}>
                    <Wallet className="h-4 w-4 mr-2" />
                    Process Payroll
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="inline-block">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-2"></div>
                    Loading payroll data...
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-md border bg-gray-50 p-4">
                      <div className="text-xs text-muted-foreground">Employees</div>
                      <div className="mt-1 text-2xl font-bold">{payrollStats.employeeCount}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{payrollStats.paidCount} paid</div>
                    </div>
                    <div className="rounded-md border bg-gray-50 p-4">
                      <div className="text-xs text-muted-foreground">Pending Payroll</div>
                      <div className="mt-1 text-2xl font-bold">{payrollStats.pendingCount}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Ready for payment</div>
                    </div>
                    <div className="rounded-md border bg-gray-50 p-4">
                      <div className="text-xs text-muted-foreground">Base Salaries</div>
                      <div className="mt-1 text-2xl font-bold">{formatCurrency(payrollStats.baseTotal)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Before bonuses</div>
                    </div>
                    <div className="rounded-md border bg-gray-50 p-4">
                      <div className="text-xs text-muted-foreground">Net Bonus / Adj.</div>
                      <div className={`mt-1 text-2xl font-bold ${payrollStats.bonusTotal < 0 ? "text-red-700" : "text-green-700"}`}>
                        {formatCurrency(payrollStats.bonusTotal)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Current month only</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Base Salary</TableHead>
                          <TableHead>Bonus / Adj.</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No payroll data available.
                            </TableCell>
                          </TableRow>
                        ) : (
                          payrollData.map((employee) => {
                            const payrollStatus = normalizeFilterValue(employee.status);
                            const isPaid = payrollStatus === "paid";
                            const canReversePayment = isPaid && Boolean(employee.salaryRecordId);
                            return (
                              <TableRow key={employee.id}>
                                <TableCell className="font-medium">{employee.name}</TableCell>
                                <TableCell>{employee.role}</TableCell>
                                <TableCell>{formatCurrency(employee.baseSalary)}</TableCell>
                                <TableCell className={employee.bonus < 0 ? "font-medium text-red-700" : employee.bonus > 0 ? "font-medium text-green-700" : ""}>
                                  {formatCurrency(employee.bonus)}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatCurrency(employee.total)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <Badge className={
                                      isPaid
                                        ? "bg-green-100 text-green-800"
                                        : payrollStatus === "approved"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-yellow-100 text-yellow-800"
                                    }>
                                      {employee.status || "pending"}
                                    </Badge>
                                    {isPaid && employee.paymentDate ? (
                                      <span className="text-xs text-muted-foreground">{employee.paymentDate}</span>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    {!isPaid ? (
                                      <Button size="sm" onClick={() => openPayrollModal("pay", employee)}>
                                        <CreditCard className="h-3 w-3 mr-1" />
                                        Pay
                                      </Button>
                                    ) : (
                                      <>
                                        <span className="inline-flex h-9 items-center gap-1 rounded-md border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-700">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Paid
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={!canReversePayment}
                                          title={canReversePayment ? "Cancel this payroll payment" : "No salary payment record to reverse"}
                                          onClick={() => setPayrollEntryToUnpay(employee)}
                                        >
                                          <RotateCcw className="h-3 w-3 mr-1" />
                                          Unpay
                                        </Button>
                                      </>
                                    )}
                                    <Button variant="outline" size="sm" onClick={() => openPayrollBonusModal(employee)}>
                                      <Gift className="h-3 w-3 mr-1" />
                                      Bonus
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => openPayrollEditModal(employee)}>
                                      <Edit className="h-3 w-3 mr-1" />
                                      Edit
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">Total Monthly Payroll</h3>
                        <p className="text-sm text-muted-foreground">{formatPayrollMonthLabel(selectedPayrollMonth)}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{formatCurrency(payrollStats.total)}</div>
                        <p className="text-sm text-muted-foreground">
                          {payrollStats.paidCount} of {payrollStats.employeeCount} employees paid
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        <TabsContent value="transactions" className="space-y-6">
          <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-6 p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    Recent Transactions
                  </CardTitle>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    View and manage finance activity
                  </p>
                </div>
                <div className="text-sm font-medium text-slate-400 lg:pt-2">
                  Total Transactions: <span className="font-bold text-slate-600">{filteredRecentTransactions.length}</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-md shadow-slate-200/60">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1.4fr)_minmax(12rem,1fr)_minmax(10rem,0.9fr)_minmax(10rem,0.9fr)_auto_auto]">
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={transactionSearchFilter}
                      onChange={(event) => setTransactionSearchFilter(event.target.value)}
                      placeholder="Search transactions..."
                      className="h-12 rounded-lg border-slate-200 bg-white pl-11 text-sm font-medium shadow-none placeholder:text-slate-400"
                    />
                  </div>
                  <Select value={transactionFilterValue} onValueChange={(value) => handleTransactionFilterChange(value as TransactionFilterValue)}>
                    <SelectTrigger className="h-12 w-full rounded-lg border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-none">
                      <SelectValue placeholder="All Transactions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Transactions</SelectItem>
                      <SelectItem value="income">Income Only</SelectItem>
                      <SelectItem value="expense">Expenses Only</SelectItem>
                      <SelectItem value="patients">Patients</SelectItem>
                      <SelectItem value="doctors">Doctors</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative min-w-0">
                    <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-12 rounded-lg border-slate-200 bg-white pl-10 text-sm font-semibold text-slate-700 shadow-none"
                      aria-label="Start date"
                    />
                  </div>
                  <div className="relative min-w-0">
                    <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-12 rounded-lg border-slate-200 bg-white pl-10 text-sm font-semibold text-slate-700 shadow-none"
                      aria-label="End date"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-lg border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                    onClick={() => setTransactionDateSortDirection((direction) => direction === "desc" ? "asc" : "desc")}
                    title="Sort by payment date"
                  >
                    {transactionDateSortDirection === "desc" ? (
                      <ChevronDown className="mr-2 h-4 w-4 text-violet-600" />
                    ) : (
                      <ChevronUp className="mr-2 h-4 w-4 text-violet-600" />
                    )}
                    {transactionDateSortDirection === "desc" ? "Newest Paid" : "Oldest Paid"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-lg border-violet-300 px-4 text-sm font-bold text-violet-600 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
                    onClick={clearTransactionFilters}
                    disabled={!hasTransactionFilters}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-8 p-5 pt-0 sm:p-7 sm:pt-0">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="flex min-h-[7rem] items-center justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-md shadow-slate-200/50">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Wallet className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-500">Total Income</p>
                      <p className="mt-1 truncate text-2xl font-black text-emerald-600">
                        {formatCurrency(transactionSummary.income)}
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" />
                </div>
                <div className="flex min-h-[7rem] items-center justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-md shadow-slate-200/50">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                      <AlertTriangle className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-500">Total Expenses</p>
                      <p className="mt-1 truncate text-2xl font-black text-red-600">
                        {formatCurrency(transactionSummary.expenses)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-7 w-7 shrink-0 text-slate-700" />
                </div>
                <div className="flex min-h-[7rem] items-center justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-md shadow-slate-200/50">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                      <FileText className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-500">Net Total</p>
                      <p className={`mt-1 truncate text-2xl font-black ${transactionSummary.net >= 0 ? "text-slate-950" : "text-red-600"}`}>
                        {formatCurrency(transactionSummary.net)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-7 w-7 shrink-0 text-slate-700" />
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-violet-600 bg-white text-violet-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-950">
                      {transactionLedgerMode === "patients"
                        ? "Patient Appointment Ledger"
                        : transactionLedgerMode === "doctors"
                          ? "Doctor Appointment Ledger"
                          : "Transaction Timeline"}
                    </h3>
                    <p className="text-sm font-medium text-slate-500">
                      {isLoading
                        ? "Loading transactions"
                        : transactionLedgerMode === "patients"
                          ? `${transactionPatientGroups.length} patient${transactionPatientGroups.length === 1 ? "" : "s"} found`
                          : transactionLedgerMode === "doctors"
                            ? `${transactionDoctorGroups.length} doctor${transactionDoctorGroups.length === 1 ? "" : "s"} found`
                            : `${filteredRecentTransactions.length} transaction${filteredRecentTransactions.length === 1 ? "" : "s"} found`}
                    </p>
                  </div>
                </div>

                {isLoading ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 py-12 text-center text-sm font-bold text-slate-500">
                    <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-b-violet-600" />
                    Loading transactions...
                  </div>
                ) : filteredRecentTransactions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 py-12 text-center text-sm font-medium text-slate-500">
                    No recent transactions found.
                  </div>
                ) : transactionLedgerMode === "patients" ? (
                  transactionPatientGroups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 py-12 text-center text-sm font-medium text-slate-500">
                      No appointment payments found for patients.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {transactionPatientGroups.map((patientGroup) => (
                        <div key={patientGroup.patientName} className="space-y-4">
                          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-5 py-4">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <h4 className="text-lg font-black text-slate-950">{patientGroup.patientName}</h4>
                              <div className="text-sm font-bold text-slate-500">
                                {patientGroup.appointments.length} appointment{patientGroup.appointments.length === 1 ? "" : "s"}
                              </div>
                            </div>
                          </div>
                          <div className="relative space-y-5 pl-8 sm:pl-12">
                            <div className="absolute bottom-8 left-[15px] top-0 border-l border-dashed border-slate-200 sm:left-[15px]" />
                            {patientGroup.appointments.map(renderFinanceAppointmentGroup)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : transactionLedgerMode === "doctors" ? (
                  transactionDoctorGroups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 py-12 text-center text-sm font-medium text-slate-500">
                      No appointment payments found for doctors.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {transactionDoctorGroups.map((doctorGroup) => (
                        <div key={doctorGroup.doctorName} className="space-y-4">
                          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-5 py-4">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <h4 className="text-lg font-black text-slate-950">{doctorGroup.doctorName}</h4>
                              <div className="text-sm font-bold text-slate-500">
                                {doctorGroup.appointments.length} appointment{doctorGroup.appointments.length === 1 ? "" : "s"}
                              </div>
                            </div>
                          </div>
                          <div className="relative space-y-5 pl-8 sm:pl-12">
                            <div className="absolute bottom-8 left-[15px] top-0 border-l border-dashed border-slate-200 sm:left-[15px]" />
                            {doctorGroup.appointments.map(renderFinanceAppointmentGroup)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="relative space-y-5 pl-8 sm:pl-12">
                    <div className="absolute bottom-8 left-[15px] top-0 border-l border-dashed border-slate-200 sm:left-[15px]" />
                    {filteredRecentTransactions.map((transaction) => {
                      const appointmentId = getTransactionAppointmentId(transaction);
                      const transactionLoadingKey = appointmentId || transaction.id;
                      const isLoadingThisAppointment = loadingAppointmentId === transactionLoadingKey;
                      const expenseForTransaction = findExpenseForTransaction(transaction);
                      const transactionReportingDate =
                        transaction.type === "expense" && expenseForTransaction
                          ? getExpenseReportingDate(expenseForTransaction)
                          : getTransactionReportingDate(transaction);
                      const transactionDateLabel = formatFinanceDate(transactionReportingDate);
                      const transactionDateParts = getFinanceTimelineDateParts(transactionReportingDate || transaction.date);
                      const canViewExpense =
                        transaction.type === "expense" &&
                        (Boolean(expenseForTransaction) || transaction.source === "expense");
                      const canViewAppointmentSnapshot = Boolean(appointmentId || transaction.appointmentSnapshot);
                      const canEditPayment = isEditablePaymentTransaction(transaction);
                      const shouldShowPaymentEdit = isPaymentTransactionRow(transaction);
                      const paymentStatusDisplay = shouldShowPaymentEdit ? getFinancePaymentStatusDisplay(transaction) : null;
                      const isDeletedPayment = isSoftDeletedPaymentTransaction(transaction);
                      const isActualDeletedPayment = isActualDeletedPaymentTransaction(transaction);
                      const restorablePaymentId = getRestorablePaymentId(transaction);
                      const savedAtLabel = hasTimeComponent(transaction.logDate)
                        ? formatTransactionTimestamp(transaction.logDate)
                        : "";
                      const statusLabel = transaction.type === "income"
                        ? paymentStatusDisplay?.label || "Paid"
                        : formatOptionLabel(expenseForTransaction?.status || transaction.type, EXPENSE_STATUS_OPTIONS);
                      const timelineStatusDisplay = paymentStatusDisplay || {
                        label: statusLabel,
                        status: transaction.type === "income" ? "paid" : transaction.type,
                        className: transaction.type === "income"
                          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                          : "border-red-100 bg-red-50 text-red-700",
                      };
                      const amountPrefix = transaction.type === "income" ? "+" : "-";

                      // Resolve avatar src: prefer explicit changedByAvatar, then look for admin/user who made the change.
                      const snap = transaction.appointmentSnapshot as any;
                      const snapPatientId = snap?.patientId || snap?.patient?.id || snap?.patientId;
                      const avatarSrc =
                        transaction.changedByAvatar ||
                        (transaction.changedByName ? getAvatarFromSnapshot(snap, transaction.changedByName) : undefined) ||
                        (!transaction.changedByName ? (
                          getAnyImageFromSnapshot(snap) ||
                          (snapPatientId ? patientImages[String(snapPatientId)] : undefined)
                        ) : undefined);

                      return (
                        <div key={transaction.id} className="relative">
                          <span className={`absolute -left-[2rem] top-11 h-4 w-4 rounded-full border-4 border-white shadow-md sm:-left-[3rem] ${isDeletedPayment ? "bg-gray-400 shadow-gray-100" : transaction.type === "income" ? "bg-violet-600 shadow-violet-200" : "bg-red-500 shadow-red-100"}`} />
                          <div className={`rounded-lg border border-slate-200 p-4 shadow-md shadow-slate-200/60 transition-colors hover:border-violet-200 sm:p-5 ${isDeletedPayment ? deletedPaymentRowClass : "bg-white"}`}>
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="flex shrink-0 items-center gap-4 sm:w-40 sm:border-r sm:border-slate-200 sm:pr-6">
                                  <div className="text-center sm:w-24">
                                    <div className={`text-lg font-black leading-none ${transaction.type === "income" ? "text-violet-600" : "text-red-600"}`}>
                                      {transactionDateParts.month}
                                    </div>
                                    <div className="mt-1 text-5xl font-black leading-none text-slate-950">{transactionDateParts.day}</div>
                                    <div className="mt-2 text-lg font-bold leading-none text-slate-500">{transactionDateParts.year}</div>
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <h4 className={`truncate text-lg font-black ${isDeletedPayment ? "text-gray-700" : "text-slate-950"}`}>{transaction.description}</h4>
                                  <p className="mt-1 truncate text-base font-medium text-slate-500">
                                    {transaction.type === "income" ? "Income transaction" : "Expense transaction"}
                                  </p>
                                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-500">
                                    <span className="inline-flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-slate-600" />
                                      {transaction.type === "expense" ? "Expense Date" : "Payment Date"}: {transactionDateLabel}
                                    </span>
                                    <span className="inline-flex items-center gap-2">
                                      <CreditCard className="h-4 w-4 text-slate-600" />
                                      Payment Method: {transaction.method || "N/A"}
                                    </span>
                                    <span className="inline-flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-slate-600" />
                                      Ref No.: {transaction.transactionId || transaction.id || "N/A"}
                                    </span>
                                  </div>
                                  {savedAtLabel ? (
                                    <div className="mt-3 flex items-center gap-2">
                                      <Avatar className="h-8 w-8 overflow-hidden rounded-md border border-slate-200">
                                        <AvatarImage src={avatarSrc} alt={transaction.changedByName || "User"} className="object-cover" />
                                        <AvatarFallback className="rounded-md bg-violet-100 text-[10px] font-black text-violet-700">
                                          {transaction.changedByName ? transaction.changedByName.split(" ").map((name) => name[0]).join("").toUpperCase() : <User className="h-3 w-3" />}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="text-xs font-medium text-slate-500">
                                        <span className="font-bold text-slate-700">{transaction.changedByName || "System"}</span>
                                        <span> saved {savedAtLabel}</span>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
                                <div className="sm:text-right">
                                  <div className={`text-2xl font-black ${isDeletedPayment ? "text-gray-600" : transaction.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                                    {amountPrefix}{formatCurrency(Math.abs(transaction.amount))}
                                  </div>
                                  <div className="mt-2">
                                    <PaymentTransactionStatusBadge
                                      display={timelineStatusDisplay}
                                      showIcon={Boolean(paymentStatusDisplay || transaction.type === "income")}
                                    />
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-12 w-12 rounded-lg border-slate-200 bg-white text-slate-700 shadow-md shadow-slate-200/60 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                                    disabled={isLoadingThisAppointment}
                                    title={
                                      canViewExpense
                                        ? "View expense details"
                                        : canViewAppointmentSnapshot
                                          ? "View appointment snapshot"
                                          : "No details linked"
                                    }
                                    onClick={() => handleViewTransaction(transaction)}
                                  >
                                    <Eye className="h-5 w-5" />
                                    <span className="sr-only">View transaction details</span>
                                  </Button>
                                  {shouldShowPaymentEdit && !isDeletedPayment && (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className={`h-12 w-12 rounded-lg border-slate-200 bg-white text-slate-700 shadow-md shadow-slate-200/60 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 ${canEditPayment ? "" : "opacity-60"}`}
                                      title={canEditPayment ? "Edit payment" : getPaymentEditUnavailableMessage(transaction)}
                                      onClick={() => handleEditPaymentTransaction(transaction)}
                                    >
                                      <Edit className="h-5 w-5" />
                                      <span className="sr-only">Edit Payment</span>
                                    </Button>
                                  )}
                                  {shouldShowPaymentEdit && !isDeletedPayment && (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className={`h-12 w-12 rounded-lg border-slate-200 bg-white text-red-600 shadow-md shadow-slate-200/60 hover:border-red-200 hover:bg-red-50 hover:text-red-700 ${canEditPayment ? "" : "opacity-60"}`}
                                      title={canEditPayment ? "Delete payment" : getPaymentEditUnavailableMessage(transaction)}
                                      onClick={() => handleRequestDeletePaymentTransaction(transaction)}
                                    >
                                      <Trash2 className="h-5 w-5" />
                                      <span className="sr-only">Delete Payment</span>
                                    </Button>
                                  )}
                                  {shouldShowPaymentEdit && isActualDeletedPayment && canManageExpenseStatus && restorablePaymentId && (
                                    <Button
                                      variant="outline"
                                      className="h-12 rounded-lg border-emerald-200 bg-white px-4 text-sm font-black uppercase text-emerald-700 shadow-md shadow-slate-200/60 hover:bg-emerald-50"
                                      title="Restore payment"
                                      onClick={() => handleRestorePaymentTransaction(transaction)}
                                    >
                                      <RotateCcw className="mr-2 h-5 w-5" />
                                      Restore
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-400">
                <ShieldCheck className="h-5 w-5 text-violet-600" />
                All transactions are secure and encrypted.
              </div>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>

      <FinanceExpenseModal
        open={Boolean(expenseModalMode)}
        mode={expenseModalMode || "create"}
        form={expenseForm}
        isSaving={isSavingExpense}
        inventoryItems={inventoryData}
        vendorOptions={expenseVendorOptions}
        canManageStatus={canManageExpenseStatus}
        fieldErrors={expenseFieldErrors}
        historyLogs={financeHistoryLogs}
        isHistoryLoading={isFinanceHistoryLoading}
        originalInventoryItemId={selectedExpense?.inventoryItemId}
        originalInventoryQuantity={selectedExpense?.inventoryQuantity}
        onOpenChange={(open) => !open && closeExpenseModal()}
        onFormChange={handleExpenseFormChange}
        onSave={handleSaveExpense}
      />
      <FinanceExpensePaymentModal
        expense={expenseToPay}
        paymentMethod={expensePaymentMethod}
        isSaving={isSavingExpensePayment}
        formatCurrency={formatCurrency}
        onOpenChange={(open) => !open && setExpenseToPay(null)}
        onPaymentMethodChange={setExpensePaymentMethod}
        onConfirm={handlePayExpense}
      />
      <ConfirmDialog
        open={Boolean(expenseToDelete)}
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
        title="Delete Expense"
        message={
          expenseToDelete?.inventoryItemId
            ? "This will remove the expense and reverse its linked stock quantity. The audit history will stay available."
            : "This will remove the expense from finance reports. The audit history will stay available."
        }
        confirmLabel="Delete"
        loading={isDeletingExpense}
        onConfirm={handleDeleteExpense}
      />
      <ConfirmDialog
        open={Boolean(paymentToDelete)}
        onOpenChange={(open) => !open && setPaymentToDelete(null)}
        title="Delete Payment"
        message="This will soft-delete the payment and update the appointment balance."
        confirmLabel="Delete"
        loading={isDeletingPayment}
        onConfirm={handleDeletePaymentTransaction}
      />
      <FinanceInventoryModal
        open={Boolean(inventoryModalMode)}
        mode={inventoryModalMode || "create"}
        form={inventoryForm}
        isSaving={isSavingInventory}
        historyLogs={financeHistoryLogs}
        isHistoryLoading={isFinanceHistoryLoading}
        inventoryItems={inventoryData}
        currentItemId={selectedInventoryItem?.id}
        fieldErrors={inventoryFieldErrors}
        onOpenChange={(open) => !open && closeInventoryModal()}
        onFormChange={handleInventoryFormChange}
        onSave={handleSaveInventoryItem}
      />
      <FinanceInventoryChangeReviewModal
        open={inventoryChangesToReview.length > 0}
        itemName={selectedInventoryItem?.item || ""}
        changes={inventoryChangesToReview}
        isSaving={isSavingInventory}
        onOpenChange={(open) => !open && setInventoryChangesToReview([])}
        onConfirm={handleConfirmInventoryChanges}
      />
      <FinanceInventoryReorderModal
        item={inventoryItemToReorder}
        form={reorderForm}
        isSaving={isSavingReorder}
        formatCurrency={formatCurrency}
        fieldErrors={reorderFieldErrors}
        onOpenChange={(open) => {
          if (!open) {
            setInventoryItemToReorder(null);
            setReorderFieldErrors({});
          }
        }}
        onFormChange={(nextForm) => {
          setReorderFieldErrors((currentErrors) => (
            nextForm.quantityToAdd !== reorderForm.quantityToAdd ? {} : currentErrors
          ));
          setReorderForm(nextForm);
        }}
        onSave={handleReorderInventoryItem}
      />
      {!PAYROLL_DISABLED && (
        <>
          <FinancePayrollBonusModal
            open={isPayrollBonusModalOpen}
            form={payrollBonusForm}
            payrollData={payrollData}
            selectedPayrollMonth={selectedPayrollMonth}
            isSaving={isSavingPayroll}
            formatCurrency={formatCurrency}
            onOpenChange={(open) => !open && closePayrollBonusModal()}
            onFormChange={setPayrollBonusForm}
            onStaffChange={handlePayrollBonusStaffChange}
            onSave={handleAddPayrollBonus}
          />
          <FinancePayrollEditModal
            open={Boolean(payrollEntryToEdit)}
            entry={payrollEntryToEdit}
            form={payrollEditForm}
            selectedPayrollMonth={selectedPayrollMonth}
            isSaving={isSavingPayroll}
            formatCurrency={formatCurrency}
            onOpenChange={(open) => !open && closePayrollEditModal()}
            onFormChange={setPayrollEditForm}
            onSave={handleSavePayrollEdit}
          />
          <FinancePayrollModal
            open={Boolean(payrollModalMode)}
            mode={payrollModalMode || "process"}
            entry={selectedPayrollEntry}
            payrollData={payrollData}
            selectedPayrollMonth={selectedPayrollMonth}
            paymentDate={payrollPaymentDate}
            isSaving={isSavingPayroll}
            historyLogs={financeHistoryLogs}
            isHistoryLoading={isFinanceHistoryLoading}
            formatCurrency={formatCurrency}
            onOpenChange={(open) => !open && closePayrollModal()}
            onPaymentDateChange={setPayrollPaymentDate}
            onProcess={handleProcessPayroll}
            onPay={handlePayPayrollEntry}
          />
          <Dialog open={Boolean(payrollEntryToUnpay)} onOpenChange={(open) => !open && setPayrollEntryToUnpay(null)}>
            <DialogContent className="p-0 sm:max-w-md">
              <div className="border-b bg-gray-50 px-6 py-5">
                <DialogHeader>
                  <DialogTitle>Cancel Payroll Payment</DialogTitle>
                  <DialogDescription>
                    Move this payroll entry back to pending for {formatPayrollMonthLabel(selectedPayrollMonth)}.
                  </DialogDescription>
                </DialogHeader>
              </div>

              {payrollEntryToUnpay ? (
                <div className="space-y-4 px-6 py-5">
                  <div className="rounded-md border bg-white p-4">
                    <div className="font-medium text-gray-900">{payrollEntryToUnpay.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{payrollEntryToUnpay.role}</div>
                    <div className="mt-3 text-2xl font-bold">{formatCurrency(payrollEntryToUnpay.total)}</div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This keeps the salary record and history, but changes the payment status back to pending so it can be paid again later.
                  </p>
                </div>
              ) : null}

              <DialogFooter className="border-t px-6 py-4">
                <Button variant="outline" onClick={() => setPayrollEntryToUnpay(null)} disabled={isSavingPayroll}>
                  Keep Paid
                </Button>
                <Button variant="destructive" onClick={handleReversePayrollPayment} disabled={isSavingPayroll || !payrollEntryToUnpay}>
                  {isSavingPayroll ? "Cancelling..." : "Cancel Payment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
      <AppointmentHistoryView
        open={isAppointmentHistoryOpen}
        onOpenChange={(open) => {
          setIsAppointmentHistoryOpen(open);
          if (!open) {
            setAppointmentSnapshot(null);
            setAppointmentPaymentSnapshot(null);
            setAppointmentSnapshotLogDate("");
            setAppointmentSnapshotIsHistorical(false);
          }
        }}
        appointmentSnapshot={appointmentSnapshot}
        logDate={appointmentSnapshotLogDate}
        onViewCurrent={viewCurrentAppointment}
        onOpenAppointment={handleOpenAppointment}
        isAppointmentOpen={isSnapshotAppointmentOpen}
        isHistorical={appointmentSnapshotIsHistorical}
        openedFromBookingModal={false}
        selectedPaymentSnapshot={appointmentPaymentSnapshot}
        useCurrentAppointmentDetails
      />
    </div>
  );
}
