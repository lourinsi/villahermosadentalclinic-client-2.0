"use client";

import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import AppointmentHistoryView from "./AppointmentHistoryView";
import { fetchSnapshotFromLogs } from "@/lib/appointmentSnapshots";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";

import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
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
  Plus,
  Receipt,
  Filter,
  User
} from "lucide-react";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
};

const todayDate = () => new Date().toISOString().slice(0, 10);

const createEmptyExpense = () => ({
  category: "",
  description: "",
  amount: 0,
  vendor: "",
  date: todayDate(),
  paymentMethod: "",
  notes: "",
});

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
  status: string;
  recurring: boolean;
  notes?: string;
}

export interface RecurringExpense {
  category: string;
  description: string;
  amount: number;
  frequency: string;
  nextDue: string;
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
  bonus: number;
  total: number;
  status: string;
}

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
  const { openEditModalById, isEditModalOpen, selectedAppointment } = useAppointmentModal();
  const [isAddExpenseDialogOpen, setIsAddExpenseDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState(createEmptyExpense);
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
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [payrollData, setPayrollData] = useState<PayrollEntry[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [patientImages, setPatientImages] = useState<Record<string, string | undefined>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [
        revenueData,
        expenseBreakdownData,
        detailedExpensesData,
        recurringExpensesData,
        inventoryData,
        payrollData,
        transactionsData,
      ] = await Promise.all([
        fetchApiData<RevenueEntry[]>("/api/finance/revenue", "revenue data"),
        fetchApiData<ExpenseBreakdownEntry[]>("/api/finance/expense-breakdown", "expense breakdown"),
        fetchApiData<DetailedExpense[]>("/api/finance/detailed-expenses", "detailed expenses"),
        fetchApiData<RecurringExpense[]>("/api/finance/recurring-expenses", "recurring expenses"),
        fetchApiData<InventoryItem[]>("/api/inventory?limit=100", "inventory data"),
        fetchApiData<PayrollEntry[]>("/api/finance/payroll", "payroll data"),
        fetchApiData<RecentTransaction[]>("/api/finance/recent-transactions", "recent transactions"),
      ]);

      setRevenueData(revenueData || []);
      setExpenseBreakdown(expenseBreakdownData || []);
      setDetailedExpenses(detailedExpensesData || []);
      setRecurringExpenses(recurringExpensesData || []);
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
      setRecurringExpenses([]);
      setInventoryData([]);
      setPayrollData([]);
      setRecentTransactions([]);
    } finally {
      setIsLoading(false);
    }
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
      if (paymentMethodFilter !== "all" && method !== selectedMethod) return false;

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

  const handleAddExpense = async () => {
    if (!newExpense.category || !newExpense.description || !newExpense.date || Number(newExpense.amount) <= 0) {
      toast.error("Please complete the required expense fields");
      return;
    }

    setIsSavingExpense(true);
    try {
      await fetchApiData<DetailedExpense>("/api/finance/detailed-expenses", "new expense", {
        method: "POST",
        body: JSON.stringify({
          ...newExpense,
          amount: Number(newExpense.amount),
        }),
      });

      toast.success("Expense added");
      setNewExpense(createEmptyExpense());
      setIsAddExpenseDialogOpen(false);
      await fetchData();
    } catch (error) {
      console.error("Error adding expense:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add expense");
    } finally {
      setIsSavingExpense(false);
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
          Description: expense.description,
          Amount: expense.amount,
          Expenses: expense.amount,
          Profit: "",
        })),
        ...payrollData.map((employee) => ({
          Section: "Payroll",
          Date: currentMonth.month,
          Description: `${employee.name} - ${employee.role}`,
          Amount: employee.total,
          Expenses: employee.total,
          Profit: "",
        })),
      ]
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

  const getTransactionAppointmentId = (transaction: RecentTransaction) =>
    transaction.appointmentId ||
    getAppointmentIdFromSnapshot(transaction.appointmentSnapshot) ||
    getAppointmentIdFromDescription(transaction.description);

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
          <TabsTrigger value="expenses" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Expense Tracking</TabsTrigger>
          <TabsTrigger value="inventory" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Inventory & Costs</TabsTrigger>
          <TabsTrigger value="payroll" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Payroll Management</TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Recent Transactions</TabsTrigger>
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

        {/* NEW: Expense Tracking Tab */}
        <TabsContent value="expenses" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Expense Management</CardTitle>
                <div className="flex flex-wrap gap-2">
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
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Payment Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="ach">ACH Transfer</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => fetchData()} title="Refresh finance data">
                    <Filter className="h-4 w-4" />
                  </Button>
                  <Dialog
                    open={isAddExpenseDialogOpen}
                    onOpenChange={(open) => {
                      setIsAddExpenseDialogOpen(open);
                      if (open && !newExpense.date) setNewExpense((prev) => ({ ...prev, date: todayDate() }));
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Expense
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Expense</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="expenseCategory">Category</Label>
                          <Select value={newExpense.category} onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}>
                            <SelectTrigger id="expenseCategory">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equipment">Equipment</SelectItem>
                              <SelectItem value="supplies">Supplies</SelectItem>
                              <SelectItem value="utilities">Utilities</SelectItem>
                              <SelectItem value="insurance">Insurance</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Input id="description" placeholder="e.g., Dental supplies order" value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="expenseAmount">Amount (PHP)</Label>
                          <Input id="expenseAmount" type="number" placeholder="500.00" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vendor">Vendor/Supplier</Label>
                          <Input id="vendor" placeholder="e.g., DentMed Supply" value={newExpense.vendor} onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="expenseDate">Date</Label>
                          <Input id="expenseDate" type="date" value={newExpense.date} onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="paymentMethod">Payment Method</Label>
                          <Select value={newExpense.paymentMethod} onValueChange={(value) => setNewExpense({ ...newExpense, paymentMethod: value })}>
                            <SelectTrigger id="paymentMethod">
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="credit_card">Credit Card</SelectItem>
                              <SelectItem value="ach">ACH Transfer</SelectItem>
                              <SelectItem value="check">Check</SelectItem>
                              <SelectItem value="cash">Cash</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="expenseNotes">Notes (Optional)</Label>
                          <Textarea id="expenseNotes" placeholder="Additional details..." value={newExpense.notes} onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddExpenseDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddExpense} disabled={isSavingExpense}>
                          {isSavingExpense ? "Adding..." : "Add Expense"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Recurring</TableHead>
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
                        filteredDetailedExpenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell>{expense.date}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{expense.category}</Badge>
                            </TableCell>
                            <TableCell className="font-medium max-w-xs truncate">{expense.description}</TableCell>
                            <TableCell>{expense.vendor}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(expense.amount)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{expense.paymentMethod}</TableCell>
                            <TableCell>
                              <Badge className={expense.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                {expense.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {expense.recurring && (
                                <Badge variant="outline">Recurring</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="outline" size="sm">View</Button>
                                {expense.status === 'pending' && (
                                  <Button size="sm">Pay</Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  
                  {/* Recurring Expenses Summary */}
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-medium mb-4 flex items-center">
                      <Receipt className="h-4 w-4 mr-2" />
                      Recurring Expenses Overview
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recurringExpenses.length === 0 ? (
                        <div className="col-span-full text-center py-4 text-muted-foreground">
                          No recurring expenses found.
                        </div>
                      ) : (
                        recurringExpenses.map((expense, index) => (
                          <div key={`recurring-${expense.description}-${index}`} className="bg-white p-3 rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="secondary" className="text-xs">{expense.category}</Badge>
                              <span className="text-xs text-muted-foreground">{expense.frequency}</span>
                            </div>
                            <div className="font-medium text-sm mb-1">{expense.description}</div>
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold">{formatCurrency(expense.amount)}</span>
                              <span className="text-xs text-muted-foreground">Due: {expense.nextDue}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <span className="font-medium">Total Monthly Recurring Expenses</span>
                      <span className="text-xl font-bold">
                        {formatCurrency(recurringExpenses.reduce((sum, e) => sum + e.amount, 0))}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Inventory Management</CardTitle>
                <div className="flex space-x-2">
                  <Select>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Items</SelectItem>
                      <SelectItem value="anesthetics">Anesthetics</SelectItem>
                      <SelectItem value="materials">Materials</SelectItem>
                      <SelectItem value="supplies">Supplies</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button>Add Item</Button>
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
                      <TableHead>Cost/Unit</TableHead>
                      <TableHead>Total Value</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Last Ordered</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No inventory items found. Click &apos;Add Item&apos; to add one!
                        </TableCell>
                      </TableRow>
                    ) : (
                      inventoryData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item}</TableCell>
                          <TableCell>
                            <Badge variant={item.quantity < 20 ? "destructive" : "secondary"}>
                              {item.quantity} {item.unit}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(item.costPerUnit)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(item.totalValue)}</TableCell>
                          <TableCell>{item.supplier}</TableCell>
                          <TableCell>{item.lastOrdered}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm">Reorder</Button>
                              <Button variant="outline" size="sm">Edit</Button>
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
              <div className="flex items-center justify-between">
                <CardTitle>Employee Payroll</CardTitle>
                <div className="flex space-x-2">
                  <Select>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="january">January 2024</SelectItem>
                      <SelectItem value="february">February 2024</SelectItem>
                      <SelectItem value="march">March 2024</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button>Process Payroll</Button>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Base Salary</TableHead>
                        <TableHead>Bonus</TableHead>
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
                        payrollData.map((employee) => (
                          <TableRow key={employee.id}>
                            <TableCell className="font-medium">{employee.name}</TableCell>
                            <TableCell>{employee.role}</TableCell>
                            <TableCell>{formatCurrency(employee.baseSalary)}</TableCell>
                            <TableCell>{formatCurrency(employee.bonus)}</TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(employee.total)}
                            </TableCell>
                            <TableCell>
                              <Badge className={employee.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                {employee.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="outline" size="sm">View Details</Button>
                                {employee.status === 'pending' && (
                                  <Button size="sm" className="bg-primary hover:bg-primary/90">Pay Now</Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">Total Monthly Payroll</h3>
                        <p className="text-sm text-muted-foreground">January 2024</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{formatCurrency(payrollData.reduce((sum, emp) => sum + emp.total, 0))}</div>
                        <p className="text-sm text-muted-foreground">
                          {payrollData.filter(emp => emp.status === 'paid').length} of {payrollData.length} employees paid
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
                              title={appointmentId || transaction.appointmentSnapshot ? "View appointment snapshot" : "No appointment linked"}
                              onClick={() => handleViewAppointmentSnapshot(transaction)}
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
