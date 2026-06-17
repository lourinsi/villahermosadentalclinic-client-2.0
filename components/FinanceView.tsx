"use client";

import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import AppointmentHistoryView from "./AppointmentHistoryView";
import { fetchSnapshotFromLogs } from "@/lib/appointmentSnapshots";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useAuth } from "@/hooks/useAuth";

import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
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
  CheckCircle2
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
  const parsed = new Date(isDateOnly ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;

  return isDateOnly
    ? parsed.toLocaleDateString("en-PH")
    : parsed.toLocaleString("en-PH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
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
  appointmentSnapshot?: any;
  paymentAmount?: number;
  previousBalance?: number;
  newBalance?: number;
  changedBy?: string;
  logDate?: string;
  changedByName?: string;
  changedByAvatar?: string;
  source?: string;
}

export function FinanceView() {
  const { user } = useAuth();
  const { openEditModalById, isEditModalOpen, selectedAppointment } = useAppointmentModal();
  const canManageExpenseStatus = normalizeFilterValue(user?.role) === "admin";
  const [expenseModalMode, setExpenseModalMode] = useState<FinanceExpenseModalMode | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<DetailedExpense | null>(null);
  const [expenseForm, setExpenseForm] = useState(createEmptyExpense);
  const [expenseToPay, setExpenseToPay] = useState<DetailedExpense | null>(null);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState("cash");
  const [inventoryModalMode, setInventoryModalMode] = useState<FinanceInventoryModalMode | null>(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [inventoryForm, setInventoryForm] = useState(createEmptyInventoryItem);
  const [inventoryChangesToReview, setInventoryChangesToReview] = useState<InventoryChange[]>([]);
  const [inventoryItemToReorder, setInventoryItemToReorder] = useState<InventoryItem | null>(null);
  const [reorderForm, setReorderForm] = useState(createEmptyReorderForm);
  const [inventoryStockFilter, setInventoryStockFilter] = useState("all");
  const [selectedPayrollMonth, setSelectedPayrollMonth] = useState(currentPayrollMonthKey);
  const [payrollModalMode, setPayrollModalMode] = useState<FinancePayrollModalMode | null>(null);
  const [selectedPayrollEntry, setSelectedPayrollEntry] = useState<PayrollEntry | null>(null);
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isSavingExpensePayment, setIsSavingExpensePayment] = useState(false);
  const [isSavingInventory, setIsSavingInventory] = useState(false);
  const [isSavingReorder, setIsSavingReorder] = useState(false);
  const [isSavingPayroll, setIsSavingPayroll] = useState(false);
  const [isAppointmentHistoryOpen, setIsAppointmentHistoryOpen] = useState(false);
  const [appointmentSnapshot, setAppointmentSnapshot] = useState<any | null>(null);
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
        fetchApiData<PayrollEntry[]>(`/api/finance/payroll?month=${encodeURIComponent(payrollMonth)}`, "payroll data"),
        fetchApiData<RecentTransaction[]>("/api/finance/recent-transactions", "recent transactions"),
      ]);

      setRevenueData(revenueData || []);
      setExpenseBreakdown(expenseBreakdownData || []);
      setDetailedExpenses(detailedExpensesData || []);
      setInventoryData(inventoryData || []);
      setPayrollData(payrollData || []);
      setRecentTransactions(transactionsData || []);

      // Load patient images for any transactions that reference a patient
      try {
        const txs = transactionsData || [];
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
  }, []); // Empty dependency array means this effect runs once on mount

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

  const filteredRecentTransactions = useMemo(() => (
    recentTransactions.filter((transaction) => {
      if (transactionTypeFilter !== "all" && transaction.type !== transactionTypeFilter) return false;
      if (startDate && transaction.date < startDate) return false;
      if (endDate && transaction.date > endDate) return false;
      return true;
    })
  ), [endDate, recentTransactions, startDate, transactionTypeFilter]);

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

  const openExpenseModal = (mode: FinanceExpenseModalMode, expense?: DetailedExpense) => {
    setSelectedExpense(expense || null);
    setExpenseForm(expense ? createExpenseFormFromExpense(expense) : createEmptyExpense());
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
    resetFinanceHistory();
  };

  const openExpensePaymentModal = (expense: DetailedExpense) => {
    setExpenseToPay(expense);
    setExpensePaymentMethod(resolveOptionValue(expense.paymentMethod, PAYMENT_METHOD_OPTIONS) || "cash");
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.category || !expenseForm.description || !expenseForm.date || Number(expenseForm.amount) <= 0) {
      toast.error("Please complete the required expense fields");
      return;
    }

    if (expenseForm.inventoryItemId && Number(expenseForm.inventoryQuantity) <= 0) {
      toast.error("Enter the stock quantity to add");
      return;
    }

    if (expenseForm.inventoryItemId && normalizeFilterValue(expenseForm.status) === "cancelled") {
      toast.error("Linked stock expenses must be pending or paid");
      return;
    }

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
          Date: expense.date,
          "Created At": expense.createdAt || "",
          Description: expense.description,
          Amount: expense.amount,
          Expenses: expense.amount,
          Profit: "",
        })),
        ...payrollData.map((employee) => ({
          Section: "Payroll",
          Date: formatPayrollMonthLabel(selectedPayrollMonth),
          Description: `${employee.name} - ${employee.role}`,
          Amount: employee.total,
          Expenses: employee.total,
          Profit: "",
        })),
      ]
    );
  };

  const handleExportPayroll = () => {
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
      .filter((transaction) => transaction.type === "income")
      .map((transaction) => ({
        Date: transaction.date,
        Description: transaction.description,
        Method: transaction.method,
        Amount: transaction.amount,
      }));

    downloadCsv(`invoice-summary-${dateKey(new Date())}.csv`, invoiceRows);
  };

  const openInventoryModal = (mode: FinanceInventoryModalMode, item?: InventoryItem) => {
    setSelectedInventoryItem(item || null);
    setInventoryForm(item ? createInventoryFormFromItem(item) : createEmptyInventoryItem());
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
    resetFinanceHistory();
  };

  const openReorderModal = (item: InventoryItem) => {
    setInventoryItemToReorder(item);
    setReorderForm(createEmptyReorderForm());
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
    if (!inventoryForm.item || Number(inventoryForm.quantity) < 0 || !inventoryForm.unit || Number(inventoryForm.costPerUnit) <= 0) {
      toast.error("Please complete the required inventory fields");
      return;
    }

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
    if (!inventoryForm.item || Number(inventoryForm.quantity) < 0 || !inventoryForm.unit || Number(inventoryForm.costPerUnit) <= 0) {
      toast.error("Please complete the required inventory fields");
      return;
    }

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
      toast.error("Please enter a stock change");
      return;
    }

    setIsSavingReorder(true);
    try {
      const stockChange = Number(reorderForm.quantityToAdd) || 0;
      const costPerUnit = Number(inventoryItemToReorder.costPerUnit) || 0;
      const newQuantity = Number(inventoryItemToReorder.quantity) + stockChange;

      if (newQuantity < 0) {
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
      await fetchData();
    } catch (error) {
      console.error("Error adding inventory stock:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add inventory stock");
    } finally {
      setIsSavingReorder(false);
    }
  };

  const openPayrollModal = (mode: FinancePayrollModalMode, entry?: PayrollEntry) => {
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
    setSelectedPayrollMonth(value);
    closePayrollModal();
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
    fetchApiData<PayrollEntry>(
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

  const loadPayrollBonusDetails = async (staffId: string) => {
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
    setPayrollBonusForm(createPayrollBonusForm(selectedPayrollMonth, staffId));
    loadPayrollBonusDetails(staffId);
  };

  const handleProcessPayroll = async () => {
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

  const getTransactionAppointmentId = (transaction: RecentTransaction) =>
    transaction.appointmentId ||
    getAppointmentIdFromSnapshot(transaction.appointmentSnapshot) ||
    getAppointmentIdFromDescription(transaction.description);

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
        const refreshedTransactions = await fetchApiData<RecentTransaction[]>("/api/finance/recent-transactions", "recent transactions");
        setRecentTransactions(refreshedTransactions || []);

        transactionToView =
          (refreshedTransactions || []).find((item) => String(item.id) === String(transaction.id)) ||
          transactionToView;
        appointmentId = getTransactionAppointmentId(transactionToView);
      }

      if (!appointmentId && !transactionToView.appointmentSnapshot) {
        toast.error("No appointment is linked to this transaction");
        return;
      }

      // Prefer any snapshot attached to the transaction
      let snapshot = transactionToView.appointmentSnapshot || null;
      const resolvedAppointmentId = appointmentId || getAppointmentIdFromSnapshot(snapshot);
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

      // If no snapshot and we have a logDate, try reconstructing from logs
      if (!snapshot && resolvedAppointmentId && transactionToView.logDate) {
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

      const enrichedSnapshot = {
        ...snapshot,
        transactionId: resolvedTransactionId,
        _paymentTransactionId: paymentTxnId || snapshot?._paymentTransactionId || snapshot?._transactionId,
        _transactionId: snapshot?._transactionId || snapshot?.transactionId || paymentTxnId,
        previousBalance: resolvedPreviousBalance,
        newBalance: resolvedNewBalance,
        paymentAmount: resolvedPaymentAmount ?? snapshot?.paymentAmount ?? snapshot?.amount,
        amount: resolvedPaymentAmount ?? snapshot?.amount,
        paymentMethod: resolvedPaymentMethod,
        changedBy: transactionToView.changedBy ?? snapshot?.changedBy,
        changedByName: transactionToView.changedByName ?? snapshot?.changedByName,
        // preserve any explicit _isHistorical flag from fetched snapshot; otherwise
        // derive from the isHistorical value we computed earlier.
        _isHistorical: Boolean(snapshot?._isHistorical) || Boolean(isHistorical),
        // mark log/change type when coming from a transaction log
        logType: snapshot?.logType || (transactionToView.source ? String(transactionToView.source) : undefined) || (isHistorical ? "payment" : snapshot?.logType),
        changeType: snapshot?.changeType || (isHistorical ? "payment" : snapshot?.changeType),
      };

      setAppointmentSnapshot(enrichedSnapshot);
      setAppointmentSnapshotLogDate(transactionToView.logDate || transactionToView.date || enrichedSnapshot?.changedAt || enrichedSnapshot?.updatedAt || "");
      setAppointmentSnapshotIsHistorical(Boolean(enrichedSnapshot._isHistorical));
      setIsAppointmentHistoryOpen(true);
    } catch (error) {
      console.error("Error loading appointment snapshot:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load appointment snapshot");
    } finally {
      setLoadingAppointmentId(null);
    }
  };

  // Handle case where revenueData might be empty after fetching
  const currentMonth = revenueData.length > 0 ? revenueData[revenueData.length - 1] : { month: "N/A", revenue: 0, expenses: 0, profit: 0 };
  const previousMonth = revenueData.length > 1 ? revenueData[revenueData.length - 2] : { month: "N/A", revenue: 0, expenses: 0, profit: 0 };

  const revenueChange = previousMonth.revenue > 0 ? ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue * 100).toFixed(1) : "0.0";
  const profitChange = previousMonth.profit > 0 ? ((currentMonth.profit - previousMonth.profit) / previousMonth.profit * 100).toFixed(1) : "0.0";

  return (
    <div data-tour-id="finance-page" className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Financial Overview</h1>
          <p className="text-muted-foreground">Track revenue, expenses, and clinic profitability</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button variant="brand" onClick={handleGenerateInvoices}>
            <FileText className="h-4 w-4 mr-2" />
            Generate Invoices
          </Button>
        </div>
      </div>

      {/* Key Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentMonth.revenue)}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              {Number(revenueChange) > 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-600" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-600" />
              )}
              <span className={Number(revenueChange) > 0 ? "text-green-600" : "text-red-600"}>
                {revenueChange}%
              </span>
              <span>from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentMonth.expenses)}</div>
            <div className="text-xs text-muted-foreground">
              <span className="text-green-600">-2.3%</span> from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentMonth.profit)}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <ArrowUpRight className="h-3 w-3 text-green-600" />
              <span className="text-green-600">{profitChange}%</span>
              <span>from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Margin</CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMonth.revenue > 0 ? ((currentMonth.profit / currentMonth.revenue) * 100).toFixed(1) : "0.0"}%
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="text-green-600">+1.2%</span> from last month
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6" onValueChange={() => fetchData()}>
        <TabsList>
          <TabsTrigger value="overview" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Financial Overview</TabsTrigger>
          <TabsTrigger value="expenses" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Expenses</TabsTrigger>
          <TabsTrigger value="inventory" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Inventory</TabsTrigger>
          <TabsTrigger value="payroll" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Payroll</TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue vs Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="inline-block">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-2"></div>
                      Loading revenue data...
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), ""]} />
                      <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.8} />
                      <Area type="monotone" dataKey="expenses" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.8} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Expense Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="inline-block">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-2"></div>
                      Loading expenses breakdown...
                    </div>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
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
                    <div className="space-y-2 mt-4">
                      {expenseBreakdown.length === 0 ? null : ( // Hide legend if no data
                        expenseBreakdown.map((expense) => (
                          <div key={expense.category} className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: expense.color }} />
                              <span>{expense.category}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">{formatCurrency(expense.amount)}</div>
                              <div className="text-xs text-muted-foreground">{expense.percentage}%</div>
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
                              <TableCell>{expense.date}</TableCell>
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
                          <TableCell>{item.lastOrdered}</TableCell>
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
                                      <span className="inline-flex h-9 items-center gap-1 rounded-md border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-700">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Paid
                                      </span>
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

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Transactions</CardTitle>
                <div className="flex space-x-2">
                  <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Transactions</SelectItem>
                      <SelectItem value="income">Income Only</SelectItem>
                      <SelectItem value="expense">Expenses Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="inline-block">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-2"></div>
                    Loading transactions...
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRecentTransactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No recent transactions found.
                    </div>
                  ) : (
                    filteredRecentTransactions.map((transaction) => {
                      const appointmentId = getTransactionAppointmentId(transaction);
                      const transactionLoadingKey = appointmentId || transaction.id;
                      const isLoadingThisAppointment = loadingAppointmentId === transactionLoadingKey;
                      const expenseForTransaction = findExpenseForTransaction(transaction);
                      const canViewExpense =
                        transaction.type === "expense" &&
                        (Boolean(expenseForTransaction) || transaction.source === "expense");
                      const canViewAppointmentSnapshot = Boolean(appointmentId || transaction.appointmentSnapshot);
                      const savedAtLabel = hasTimeComponent(transaction.logDate)
                        ? formatTransactionTimestamp(transaction.logDate)
                        : "";

                      // Resolve avatar src: prefer explicit changedByAvatar, then look for admin/user who made the change
                      // Only fall back to patient image if no changedByName (meaning it's a patient-initiated action)
                      const snap = transaction.appointmentSnapshot as any;
                      const snapPatientId = snap?.patientId || snap?.patient?.id || snap?.patientId;
                      const avatarSrc =
                        transaction.changedByAvatar ||
                        (transaction.changedByName ? getAvatarFromSnapshot(snap, transaction.changedByName) : undefined) ||
                        // Only show patient image if no changedByName (patient action) or no snapshot
                        (!transaction.changedByName ? (
                          getAnyImageFromSnapshot(snap) ||
                          (snapPatientId ? patientImages[String(snapPatientId)] : undefined)
                        ) : undefined);

                      return (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex min-w-0 flex-1 items-center space-x-4">
                            <div
                              className={`w-10 h-10 rounded-full flex flex-shrink-0 items-center justify-center ${
                                transaction.type === "income"
                                  ? "bg-green-100"
                                  : "bg-red-100"
                              }`}
                            >
                              {transaction.type === "income" ? (
                                <ArrowUpRight className="h-5 w-5 text-green-600" />
                              ) : (
                                <ArrowDownRight className="h-5 w-5 text-red-600" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate text-gray-900">{transaction.description}</div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <span>{transaction.date}</span>
                                <span>•</span>
                                <span>{transaction.method}</span>
                              </div>
                              {savedAtLabel ? (
                                <div className="mt-2 flex items-center gap-2">
                                  <Avatar className="h-8 w-8 border rounded-md overflow-hidden">
                                    <AvatarImage src={avatarSrc} alt={transaction.changedByName} className="object-cover" />
                                    <AvatarFallback className="bg-violet-100 text-[10px] text-violet-700 rounded-md">
                                      {transaction.changedByName ? transaction.changedByName.split(' ').map(n => n[0]).join('').toUpperCase() : <User className="h-3 w-3" />}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium text-gray-700">{transaction.changedByName || "System"}</span>
                                    <span className="mx-1">•</span>
                                    <span>Saved {savedAtLabel}</span>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-4">
                            <div
                              className={`text-right text-lg font-bold ${
                                transaction.type === "income"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {transaction.type === "income" ? "+" : "-"}
                              {formatCurrency(Math.abs(transaction.amount))}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-violet-600"
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
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
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
        historyLogs={financeHistoryLogs}
        isHistoryLoading={isFinanceHistoryLoading}
        originalInventoryItemId={selectedExpense?.inventoryItemId}
        originalInventoryQuantity={selectedExpense?.inventoryQuantity}
        onOpenChange={(open) => !open && closeExpenseModal()}
        onFormChange={setExpenseForm}
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
      <FinanceInventoryModal
        open={Boolean(inventoryModalMode)}
        mode={inventoryModalMode || "create"}
        form={inventoryForm}
        isSaving={isSavingInventory}
        historyLogs={financeHistoryLogs}
        isHistoryLoading={isFinanceHistoryLoading}
        inventoryItems={inventoryData}
        currentItemId={selectedInventoryItem?.id}
        onOpenChange={(open) => !open && closeInventoryModal()}
        onFormChange={setInventoryForm}
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
        onOpenChange={(open) => !open && setInventoryItemToReorder(null)}
        onFormChange={setReorderForm}
        onSave={handleReorderInventoryItem}
      />
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
      <AppointmentHistoryView
        open={isAppointmentHistoryOpen}
        onOpenChange={(open) => {
          setIsAppointmentHistoryOpen(open);
          if (!open) {
            setAppointmentSnapshot(null);
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
      />
    </div>
  );
}
