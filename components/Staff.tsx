"use client";

import { apiUrl } from "@/lib/api";

import { toast } from "sonner";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import type { Appointment } from "../hooks/useAppointments";
import type { Attendance, Staff, StaffFinancialRecord, StaffFinancialRecordForm } from "@/lib/staff-types";
import { formatWordyDate } from "@/lib/utils";
import AddStaffModalWrapper from "./AddStaffModalWrapper";
import AppointmentHistoryView from "./AppointmentHistoryView";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { getStaffInitials, staffPasswordManagerIgnoreProps } from "./sharedAddStaffLogic";
import { StaffAttendanceModal } from "./StaffAttendanceModal";
import { StaffDeleteModal } from "./StaffDeleteModal";
import { StaffFinancialDeleteModal } from "./StaffFinancialDeleteModal";
import { StaffFinancialRecordModal } from "./StaffFinancialRecordModal";
import { StaffScheduleModal } from "./StaffScheduleModal";
import {
  STAFF_FINANCIAL_STATUS_OPTIONS,
  STAFF_FINANCIAL_TYPE_OPTIONS,
  createEmptyStaffFinancialRecordForm,
  getFinancialTypeLabel,
  normalizeStaffValue,
  prettifyStaffValue,
} from "./staffModalOptions";
import {
  Users,
  UserPlus,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  Download,
  Edit,
  Trash2,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Eye,
  CalendarDays,
} from "lucide-react";

const monthKey = (date = new Date()) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
};

const dateKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const normalizeFilterValue = normalizeStaffValue;

type StaffFinancialFieldErrors = Partial<Record<keyof StaffFinancialRecordForm, string>>;

const formatCurrency = (amount?: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

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

const buildStaffFilterOptions = (items: Staff[], getValue: (staff: Staff) => string | undefined) => {
  const options = new Map<string, string>();
  items.forEach((staff) => {
    const label = String(getValue(staff) || "").trim();
    const value = normalizeFilterValue(label);
    if (label && value && !options.has(value)) {
      options.set(value, label);
    }
  });

  return Array.from(options.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
};

const mergeFinancialFilterOptions = (
  records: StaffFinancialRecord[],
  baseOptions: readonly { value: string; label: string }[],
  getValue: (record: StaffFinancialRecord) => string | undefined
) => {
  const options = new Map(baseOptions.map((option) => [normalizeFilterValue(option.value), option.label]));
  records.forEach((record) => {
    const rawValue = String(getValue(record) || "").trim();
    const value = normalizeFilterValue(rawValue);
    if (rawValue && value && !options.has(value)) {
      options.set(value, prettifyStaffValue(rawValue));
    }
  });

  return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
};


export function StaffView() {
  const [isAddStaffDialogOpen, setIsAddStaffDialogOpen] = useState(false);
  const [isAddFinancialDialogOpen, setIsAddFinancialDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [financialPeriod, setFinancialPeriod] = useState("all");
  const [financialTypeFilter, setFinancialTypeFilter] = useState("all");
  const [financialStatusFilter, setFinancialStatusFilter] = useState("all");
  const [attendanceMonth, setAttendanceMonth] = useState(monthKey());
  
  const [newFinancialRecord, setNewFinancialRecord] = useState<StaffFinancialRecordForm>(
    createEmptyStaffFinancialRecordForm
  );
  const [newFinancialFieldErrors, setNewFinancialFieldErrors] = useState<StaffFinancialFieldErrors>({});

  const [staffData, setStaffData] = useState<Staff[]>([]);
  const [financialRecords, setFinancialRecords] = useState<StaffFinancialRecord[]>([]);
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("staff");
  const [isFinancialLoading, setIsFinancialLoading] = useState(false);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [hasLoadedFinancials, setHasLoadedFinancials] = useState(false);
  const [hasLoadedAttendance, setHasLoadedAttendance] = useState(false);
  const [isEditStaffDialogOpen, setIsEditStaffDialogOpen] = useState(false);
  const [isStaffDetailsDialogOpen, setIsStaffDetailsDialogOpen] = useState(false);
  const [isDeleteStaffDialogOpen, setIsDeleteStaffDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState<Attendance>({
    staffId: "",
    staffName: "",
    hoursWorked: 0,
    daysPresent: 0,
    daysAbsent: 0,
    overtimeHours: 0,
  });
  const [isEditFinancialDialogOpen, setIsEditFinancialDialogOpen] = useState(false);
  const [isDeleteFinancialDialogOpen, setIsDeleteFinancialDialogOpen] = useState(false);
  const [editingFinancialRecord, setEditingFinancialRecord] = useState<StaffFinancialRecord | null>(null);
  const [financialRecordToDelete, setFinancialRecordToDelete] = useState<StaffFinancialRecord | null>(null);
  const [editFinancialForm, setEditFinancialForm] = useState<StaffFinancialRecordForm>(
    createEmptyStaffFinancialRecordForm
  );
  const [editFinancialFieldErrors, setEditFinancialFieldErrors] = useState<StaffFinancialFieldErrors>({});
  const [financialActionLoading, setFinancialActionLoading] = useState<string | null>(null);
  const [isSavingNewFinancialRecord, setIsSavingNewFinancialRecord] = useState(false);
  const [isSavingFinancialRecord, setIsSavingFinancialRecord] = useState(false);
  const [isDeletingFinancialRecord, setIsDeletingFinancialRecord] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleStaff, setScheduleStaff] = useState<Staff | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date());
  const [staffAppointments, setStaffAppointments] = useState<Appointment[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // Appointment snapshot / history handling for staff schedule
  const {
    isAppointmentHistoryOpen,
    setIsAppointmentHistoryOpen,
    appointmentSnapshot,
    appointmentSnapshotId,
    appointmentSnapshotLogDate,
    appointmentSnapshotIsHistorical,
    handleViewCurrentSnapshot,
    handleViewAppointment,
    resetAppointmentSnapshot,
  } = useNotificationAppointmentSnapshot(staffAppointments);

  const {
    openEditModalById,
    isEditModalOpen,
    selectedAppointment,
  } = useAppointmentModal();

  const isSnapshotAppointmentOpen = Boolean(
    isEditModalOpen &&
    appointmentSnapshotId &&
    selectedAppointment?.id &&
    String(selectedAppointment.id) === String(appointmentSnapshotId)
  );

  const fetchStaffData = useCallback(async () => {
    setIsLoading(true);
    try {
      const staffResponse = await fetch(apiUrl("/api/staff?limit=100"), { credentials: "include" });

      if (!staffResponse.ok) throw new Error(`HTTP error! status: ${staffResponse.status} for staff data`);
      const staffData = (await staffResponse.json()).data || [];
      setStaffData(staffData);
    } catch (err) {
      console.error("Error fetching staff data:", err);
      toast.error("Failed to fetch staff data. Please sign in again or check the backend server.");
      setStaffData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFinancialRecords = useCallback(async () => {
    setIsFinancialLoading(true);
    try {
      const response = await fetch(apiUrl("/api/staff/financials"), { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for financial records`);
      const financialRecordsData = (await response.json()).data || [];
      setFinancialRecords(financialRecordsData);
      setHasLoadedFinancials(true);
    } catch (err) {
      console.error("Error fetching staff financial records:", err);
      toast.error("Failed to fetch financial records.");
      setFinancialRecords([]);
    } finally {
      setIsFinancialLoading(false);
    }
  }, []);

  const fetchAttendanceData = useCallback(async () => {
    setIsAttendanceLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/staff/attendance?month=${encodeURIComponent(attendanceMonth)}`), { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for attendance data`);
      const attendanceData = (await response.json()).data || [];
      setAttendanceData(attendanceData);
      setHasLoadedAttendance(true);
    } catch (err) {
      console.error("Error fetching attendance data:", err);
      toast.error("Failed to fetch attendance data.");
      setAttendanceData([]);
    } finally {
      setIsAttendanceLoading(false);
    }
  }, [attendanceMonth]);

  const refreshLoadedStaffData = useCallback(() => {
    fetchStaffData();
    if (hasLoadedFinancials) fetchFinancialRecords();
    if (hasLoadedAttendance) fetchAttendanceData();
  }, [fetchAttendanceData, fetchFinancialRecords, fetchStaffData, hasLoadedAttendance, hasLoadedFinancials]);

  useEffect(() => {
    fetchStaffData();
    fetchFinancialRecords();
  }, [fetchFinancialRecords, fetchStaffData]);

  useEffect(() => {
    if (activeTab === "attendance") fetchAttendanceData();
  }, [activeTab, fetchAttendanceData]);

  const getStaffIdentifier = (staff: Staff) => String(staff.id || staff.email || staff.name);

  const openStaffDetails = (staff: Staff) => {
    setSelectedStaff(staff);
    setIsStaffDetailsDialogOpen(true);
  };

  const openEditStaffDialog = (staff: Staff) => {
    setSelectedStaff(staff);
    setIsEditStaffDialogOpen(true);
  };

  const openDeleteStaffDialog = (staff: Staff) => {
    setSelectedStaff(staff);
    setIsDeleteStaffDialogOpen(true);
  };

  const handleDeleteStaff = async () => {
    if (!selectedStaff?.id) return;
    setIsDeletingStaff(true);
    try {
      const response = await fetch(apiUrl(`/api/staff/${selectedStaff.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete staff member");
      toast.success("Staff member removed");
      setIsDeleteStaffDialogOpen(false);
      refreshLoadedStaffData();
    } catch (error) {
      console.error("Error deleting staff member:", error);
      toast.error("Failed to delete staff member");
    } finally {
      setIsDeletingStaff(false);
    }
  };

  const openAttendanceModal = (record: Attendance) => {
    setAttendanceForm(record);
    setIsAttendanceDialogOpen(true);
  };

  const handleAttendanceSave = async () => {
    if (!attendanceForm.staffId) return;
    setIsSavingAttendance(true);
    try {
      const payload = {
        ...attendanceForm,
        date: attendanceMonth,
        status: "tracked",
        hoursWorked: Number(attendanceForm.hoursWorked) || 0,
        overtimeHours: Number(attendanceForm.overtimeHours) || 0,
        daysPresent: Math.max(0, Math.trunc(Number(attendanceForm.daysPresent) || 0)),
        daysAbsent: Math.max(0, Math.trunc(Number(attendanceForm.daysAbsent) || 0)),
      };
      const response = await fetch(apiUrl(`/api/staff/attendance/${encodeURIComponent(attendanceForm.staffId)}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to save attendance");
      }
      const savedAttendance = result.data || payload;
      setAttendanceData((prev) => {
        const index = prev.findIndex((item) => item.staffId === savedAttendance.staffId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = savedAttendance;
          return updated;
        }
        return [...prev, savedAttendance];
      });
      toast.success("Attendance updated");
      setIsAttendanceDialogOpen(false);
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance");
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const derivedAttendanceRecords = staffData.map((staff) => {
    const identifier = getStaffIdentifier(staff);
    const existing = attendanceData.find((record) => record.staffId === identifier);
    if (existing) {
      return {
        ...existing,
        date: existing.date || attendanceMonth,
        status: existing.status || "tracked",
      };
    }
    return {
      staffId: identifier,
      staffName: staff.name,
      date: attendanceMonth,
      status: "tracked",
      hoursWorked: 0,
      daysPresent: 0,
      daysAbsent: 0,
      overtimeHours: 0,
    };
  });

  const orphanAttendanceRecords = attendanceData.filter(
    (record) => !derivedAttendanceRecords.some((entry) => entry.staffId === record.staffId)
  );

  const attendanceTableRows = [...derivedAttendanceRecords, ...orphanAttendanceRecords];

  const validateFinancialRecordForm = (form: StaffFinancialRecordForm, requireAmount = true) => {
    const errors: StaffFinancialFieldErrors = {};
    if (!form.staffId) errors.staffId = "Select a staff member.";
    if (!form.type) errors.type = "Select a transaction type.";
    if (requireAmount && Number(form.amount) <= 0) errors.amount = "Enter an amount greater than zero.";
    if (!form.date) errors.date = "Choose a date.";
    return errors;
  };

  const updateNewFinancialRecord = (nextForm: StaffFinancialRecordForm) => {
    setNewFinancialFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      (Object.keys(nextErrors) as (keyof StaffFinancialRecordForm)[]).forEach((field) => {
        if (nextForm[field] !== newFinancialRecord[field]) {
          delete nextErrors[field];
        }
      });
      return nextErrors;
    });
    setNewFinancialRecord(nextForm);
  };

  const updateEditFinancialRecord = (nextForm: StaffFinancialRecordForm) => {
    setEditFinancialFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      (Object.keys(nextErrors) as (keyof StaffFinancialRecordForm)[]).forEach((field) => {
        if (nextForm[field] !== editFinancialForm[field]) {
          delete nextErrors[field];
        }
      });
      return nextErrors;
    });
    setEditFinancialForm(nextForm);
  };

  const handleAddFinancialRecord = async () => {
    const errors = validateFinancialRecordForm(newFinancialRecord);
    if (Object.keys(errors).length > 0) {
      setNewFinancialFieldErrors(errors);
      toast.error("Staff member, type, amount, and date are required");
      return;
    }
    setNewFinancialFieldErrors({});
    setIsSavingNewFinancialRecord(true);
    try {
      const response = await fetch(apiUrl("/api/staff/financials"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...newFinancialRecord,
          amount: Number(newFinancialRecord.amount) || 0,
        }),
      });
      if (response.ok) {
        toast.success("Financial record added successfully!");
        setIsAddFinancialDialogOpen(false);
        setNewFinancialRecord(createEmptyStaffFinancialRecordForm());
        setNewFinancialFieldErrors({});
        fetchFinancialRecords();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || "Failed to add financial record.");
      }
    } catch (error) {
      console.error("Error adding financial record:", error);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSavingNewFinancialRecord(false);
    }
  };

  const openEditFinancialRecord = (record: StaffFinancialRecord) => {
    setEditingFinancialRecord(record);
    setEditFinancialForm({
      staffId: record.staffId,
      type: record.type,
      amount: Number(record.amount) || 0,
      date: record.date || "",
      status: record.status || "pending",
      notes: record.notes || "",
      repaymentSchedule: record.repaymentSchedule || "",
    });
    setEditFinancialFieldErrors({});
    setIsEditFinancialDialogOpen(true);
  };

  const handleFinancialEditDialogChange = (open: boolean) => {
    setIsEditFinancialDialogOpen(open);
    if (!open) {
      setEditingFinancialRecord(null);
      setEditFinancialForm(createEmptyStaffFinancialRecordForm());
      setEditFinancialFieldErrors({});
    }
  };

  const handleDeleteFinancialDialogChange = (open: boolean) => {
    setIsDeleteFinancialDialogOpen(open);
    if (!open) {
      setFinancialRecordToDelete(null);
    }
  };

  const handleApproveFinancialRecord = async (recordId: string) => {
    try {
      setFinancialActionLoading(recordId);
      const response = await fetch(apiUrl(`/api/staff/financials/${recordId}/approve`), {
        method: "PUT",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to approve financial record");
      }
      toast.success("Financial record approved");
      fetchFinancialRecords();
    } catch (error) {
      console.error("Error approving financial record:", error);
      toast.error("Failed to approve financial record");
    } finally {
      setFinancialActionLoading(null);
    }
  };

  const handleUpdateFinancialRecord = async () => {
    if (!editingFinancialRecord) return;
    const errors = validateFinancialRecordForm(editFinancialForm, false);
    if (Object.keys(errors).length > 0) {
      setEditFinancialFieldErrors(errors);
      toast.error("Please complete all required fields");
      return;
    }
    setEditFinancialFieldErrors({});
    setIsSavingFinancialRecord(true);
    try {
      const response = await fetch(apiUrl(`/api/staff/financials/${editingFinancialRecord.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...editFinancialForm,
          amount: Number(editFinancialForm.amount),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to update financial record");
      }
      toast.success("Financial record updated");
      handleFinancialEditDialogChange(false);
      fetchFinancialRecords();
    } catch (error) {
      console.error("Error updating financial record:", error);
      toast.error("Failed to update financial record");
    } finally {
      setIsSavingFinancialRecord(false);
    }
  };

  const openDeleteFinancialRecord = (record: StaffFinancialRecord) => {
    setFinancialRecordToDelete(record);
    setIsDeleteFinancialDialogOpen(true);
  };

  const openScheduleDialog = async (staff: Staff) => {
    setScheduleStaff(staff);
    setScheduleDate(new Date());
    setIsScheduleDialogOpen(true);
    await fetchStaffAppointments(staff.name, new Date());
  };

  const fetchStaffAppointments = async (doctorName: string, date: Date) => {
    setIsLoadingSchedule(true);
    try {
      // Get the start and end of the month for the selected date
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const startDate = dateKey(startOfMonth);
      const endDate = dateKey(endOfMonth);

      const response = await fetch(
        apiUrl(`/api/appointments?doctor=${encodeURIComponent(doctorName)}&startDate=${startDate}&endDate=${endDate}`),
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("Failed to fetch appointments");

      const data = await response.json();
      setStaffAppointments(data.data || []);
    } catch (error) {
      console.error("Error fetching staff appointments:", error);
      setStaffAppointments([]);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  const openScheduleAppointment = (appointment: Appointment) => {
    // Open the appointment history view instead of the booking/edit modal
    handleViewAppointment(appointment);
  };

  const handleEditAppointment = async (appointmentId: string) => {
    try {
      await openEditModalById(appointmentId);
    } catch (error) {
      console.error("Error opening appointment for edit:", error);
      toast.error("Appointment not found or could not be loaded");
    }
  };

  const handleOpenSnapshotAppointment = async (appointmentId: string) => {
    // Close the history view and open the edit modal for the appointment
    setIsAppointmentHistoryOpen(false);
    resetAppointmentSnapshot();
    await handleEditAppointment(appointmentId);
  };

  const handleDeleteFinancialRecord = async () => {
    if (!financialRecordToDelete) return;
    setIsDeletingFinancialRecord(true);
    try {
      const response = await fetch(apiUrl(`/api/staff/financials/${financialRecordToDelete.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to delete financial record");
      }
      toast.success("Financial record removed");
      handleDeleteFinancialDialogChange(false);
      fetchFinancialRecords();
    } catch (error) {
      console.error("Error deleting financial record:", error);
      toast.error("Failed to delete financial record");
    } finally {
      setIsDeletingFinancialRecord(false);
    }
  };

  const filteredStaffData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return staffData.filter((staff) => {
      const searchable = [
        staff.name,
        staff.role,
        staff.department,
        staff.email,
        staff.phone,
        staff.specialization,
        staff.licenseNumber,
      ].join(" ").toLowerCase();

      const role = normalizeFilterValue(staff.role);
      const department = normalizeFilterValue(staff.department);
      const employmentType = normalizeFilterValue(staff.employmentType);
      const status = normalizeFilterValue(staff.status);

      return (
        (!query || searchable.includes(query)) &&
        (departmentFilter === "all" || department === normalizeFilterValue(departmentFilter)) &&
        (roleFilter === "all" || role.includes(normalizeFilterValue(roleFilter))) &&
        (employmentTypeFilter === "all" || employmentType === normalizeFilterValue(employmentTypeFilter)) &&
        (statusFilter === "all" || status === normalizeFilterValue(statusFilter))
      );
    });
  }, [departmentFilter, employmentTypeFilter, roleFilter, searchQuery, staffData, statusFilter]);

  const departmentOptions = useMemo(
    () => buildStaffFilterOptions(staffData, (staff) => staff.department),
    [staffData]
  );
  const roleOptions = useMemo(
    () => buildStaffFilterOptions(staffData, (staff) => staff.role),
    [staffData]
  );
  const employmentTypeOptions = useMemo(
    () => buildStaffFilterOptions(staffData, (staff) => staff.employmentType),
    [staffData]
  );
  const staffStatusOptions = useMemo(
    () => buildStaffFilterOptions(staffData, (staff) => staff.status),
    [staffData]
  );
  const financialTypeOptions = useMemo(
    () => mergeFinancialFilterOptions(financialRecords, STAFF_FINANCIAL_TYPE_OPTIONS, (record) => record.type),
    [financialRecords]
  );
  const financialStatusOptions = useMemo(
    () => mergeFinancialFilterOptions(financialRecords, STAFF_FINANCIAL_STATUS_OPTIONS, (record) => record.status),
    [financialRecords]
  );

  const financialDateRange = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    if (financialPeriod === "today") return { start: dateKey(today), end: dateKey(today) };
    if (financialPeriod === "this_week") return { start: dateKey(startOfWeek), end: dateKey(today) };
    if (financialPeriod === "this_month") return { start: dateKey(startOfThisMonth), end: dateKey(today) };
    if (financialPeriod === "last_month") return { start: dateKey(startOfLastMonth), end: dateKey(endOfLastMonth) };
    return { start: "", end: "" };
  }, [financialPeriod]);

  const filteredFinancialRecords = useMemo(() => {
    const effectiveStart = startDate || financialDateRange.start;
    const effectiveEnd = endDate || financialDateRange.end;

    return financialRecords.filter((record) => {
      return (
        (!effectiveStart || record.date >= effectiveStart) &&
        (!effectiveEnd || record.date <= effectiveEnd) &&
        (financialTypeFilter === "all" || normalizeFilterValue(record.type) === normalizeFilterValue(financialTypeFilter)) &&
        (financialStatusFilter === "all" || normalizeFilterValue(record.status) === normalizeFilterValue(financialStatusFilter))
      );
    });
  }, [endDate, financialDateRange, financialRecords, financialStatusFilter, financialTypeFilter, startDate]);

  const resetStaffFilters = () => {
    setSearchQuery("");
    setDepartmentFilter("all");
    setRoleFilter("all");
    setEmploymentTypeFilter("all");
    setStatusFilter("all");
  };

  const resetFinancialFilters = () => {
    setFinancialPeriod("all");
    setStartDate("");
    setEndDate("");
    setFinancialTypeFilter("all");
    setFinancialStatusFilter("all");
  };

  const handleExportStaff = () => {
    downloadCsv(
      `staff-directory-${dateKey(new Date())}.csv`,
      filteredStaffData.map((staff) => ({
        Name: staff.name,
        Role: staff.role,
        Department: staff.department || "",
        Email: staff.email || "",
        Phone: staff.phone || "",
        "Hire Date": staff.hireDate || "",
        "Monthly Salary": Number(staff.baseSalary) || 0,
        Status: staff.status || "",
        "Employment Type": staff.employmentType || "",
        Specialization: staff.specialization || "",
        "License Number": staff.licenseNumber || "",
      }))
    );
  };

  const handleExportAttendance = () => {
    downloadCsv(
      `staff-attendance-${attendanceMonth}.csv`,
      attendanceTableRows.map((attendance) => ({
        Month: attendance.date || attendanceMonth,
        "Staff Member": attendance.staffName,
        "Hours Worked": attendance.hoursWorked,
        "Days Present": attendance.daysPresent,
        "Days Absent": attendance.daysAbsent,
        "Overtime Hours": attendance.overtimeHours,
      }))
    );
  };

  // NOTE: Calculate total monthly payroll
  const totalMonthlyPayroll = staffData.reduce((sum, staff) => sum + (Number(staff.baseSalary) || 0), 0);
  const activeStaffCount = staffData.filter(staff => normalizeFilterValue(staff.status) === "active").length;
    return (
    <div data-tour-id="staff-page" className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Staff Management</h1>
          <p className="text-muted-foreground">Manage employees, salaries, and cash advances</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleExportStaff} disabled={filteredStaffData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsAddStaffDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Staff Member
          </Button>
          <AddStaffModalWrapper
            open={isAddStaffDialogOpen}
            onOpenChange={setIsAddStaffDialogOpen}
            onStaffAdded={refreshLoadedStaffData}
          />
        </div>
      </div>

      {/* Key Staff Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStaffCount}</div>
            <p className="text-xs text-muted-foreground">
              Active employees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMonthlyPayroll)}</div>
            <p className="text-xs text-muted-foreground">
              Total salary expenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Advances</CardTitle>
            <CreditCard className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {financialRecords.filter(r => normalizeFilterValue(r.status) === "pending").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Salary</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(activeStaffCount > 0 ? Math.round(totalMonthlyPayroll / activeStaffCount) : 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per employee
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={activeTab}
        className="space-y-6"
        onValueChange={(value) => {
          setActiveTab(value);
          if (value === "financial" && !hasLoadedFinancials) fetchFinancialRecords();
          if (value === "attendance" && !hasLoadedAttendance) setIsAttendanceLoading(true);
        }}
      >
        <TabsList>
          <TabsTrigger value="staff" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Staff Directory</TabsTrigger>
          <TabsTrigger value="financial" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Financial Records</TabsTrigger>
          <TabsTrigger value="attendance" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Attendance & Hours</TabsTrigger>
        </TabsList>

        {/* Staff Directory Tab */}
        <TabsContent value="staff" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Employee Directory</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search staff..."
                      {...staffPasswordManagerIgnoreProps}
                      className="pl-9 w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departmentOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {roleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={employmentTypeFilter} onValueChange={setEmploymentTypeFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Employment Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {employmentTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {staffStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={resetStaffFilters} title="Reset filters">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="inline-block">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Loading staff...
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Hire Date</TableHead>
                      <TableHead>Monthly Salary</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaffData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No staff members found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStaffData.map((staff) => (
                        <TableRow key={getStaffIdentifier(staff)}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border bg-white">
                                {staff.profilePicture ? (
                                  <AvatarImage src={staff.profilePicture} alt={staff.name} className="object-cover" />
                                ) : null}
                                <AvatarFallback className="bg-blue-100 text-xs font-bold text-blue-700">
                                  {getStaffInitials(staff.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div>{staff.name}</div>
                                <div className="text-xs text-muted-foreground">{staff.specialization}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{staff.role}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{staff.department}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Mail className="h-3 w-3 mr-1" />
                                {staff.email}
                              </div>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Phone className="h-3 w-3 mr-1" />
                                {staff.phone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm">
                              <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                              {staff.hireDate}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(staff.baseSalary)}</TableCell>
                          <TableCell>
                            <Badge className={
                              staff.status === "active" ? "bg-green-100 text-green-800" :
                              staff.status === "inactive" ? "bg-gray-100 text-gray-800" :
                              "bg-yellow-100 text-yellow-800"
                            }>
                              {staff.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {/* <Button variant="outline" size="sm" onClick={() => openStaffDetails(staff)} title="View Details">
                                <Eye className="h-3 w-3" />
                              </Button> */}
                              <Button variant="outline" size="sm" onClick={() => openScheduleDialog(staff)} title="View Schedule">
                                <CalendarDays className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openEditStaffDialog(staff)} title="Edit">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openDeleteStaffDialog(staff)} title="Delete">
                                <Trash2 className="h-3 w-3" />
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

        {/* Financial Records Tab - Cash Advances & Salary Adjustments */}
        <TabsContent value="financial" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Financial Transactions & Adjustments</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {/* NOTE: Date range filter for financial transactions */}
                  <Select value={financialPeriod} onValueChange={setFinancialPeriod}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Time Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center space-x-2">
                    <Input type="date" {...staffPasswordManagerIgnoreProps} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <Input type="date" {...staffPasswordManagerIgnoreProps} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <Select value={financialTypeFilter} onValueChange={setFinancialTypeFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {financialTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={financialStatusFilter} onValueChange={setFinancialStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {financialStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={resetFinancialFilters} title="Reset filters">
                    <Filter className="h-4 w-4" />
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsAddFinancialDialogOpen(true)}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Add Transaction
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isFinancialLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="inline-block">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Loading financial records...
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Repayment Schedule</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFinancialRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No financial records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFinancialRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.staffName}</TableCell>
                          <TableCell>
                            <Badge variant={
                              normalizeFilterValue(record.type) === "cashadvance" ? "default" :
                              normalizeFilterValue(record.type) === "bonus" ? "secondary" :
                              "outline"
                            }>
                              {getFinancialTypeLabel(record.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(record.amount)}</TableCell>
                          <TableCell>{formatWordyDate(record.date, { fallback: record.date || "-" })}</TableCell>
                          <TableCell>{record.repaymentSchedule}</TableCell>
                          <TableCell className="max-w-xs truncate">{record.notes}</TableCell>
                          <TableCell>
                            <Badge className={
                              normalizeFilterValue(record.status) === "paid" ? "bg-green-100 text-green-800" :
                              normalizeFilterValue(record.status) === "approved" ? "bg-blue-100 text-blue-800" :
                              "bg-yellow-100 text-yellow-800"
                            }>
                              {prettifyStaffValue(record.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {normalizeFilterValue(record.status) === "pending" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleApproveFinancialRecord(record.id)}
                                  disabled={financialActionLoading === record.id}
                                >
                                  {financialActionLoading === record.id ? "Approving..." : "Approve"}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditFinancialRecord(record)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeleteFinancialRecord(record)}
                              >
                                <Trash2 className="h-3 w-3" />
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

        {/* Attendance & Hours Tab */}
        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Attendance & Time Tracking</CardTitle>
                <div className="flex space-x-2">
                  <Input
                    type="month"
                    {...staffPasswordManagerIgnoreProps}
                    value={attendanceMonth}
                    onChange={(e) => setAttendanceMonth(e.target.value || monthKey())}
                    className="w-[160px]"
                  />
                  <Button variant="outline" onClick={handleExportAttendance} disabled={attendanceTableRows.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isAttendanceLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="inline-block">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Loading attendance data...
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Hours Worked</TableHead>
                      <TableHead>Days Present</TableHead>
                      <TableHead>Days Absent</TableHead>
                      <TableHead>Overtime Hours</TableHead>
                      <TableHead>Attendance Rate</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceTableRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No attendance data available.
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendanceTableRows.map((attendance) => {
                        const totalDays = attendance.daysPresent + attendance.daysAbsent;
                        const attendanceRateValue = totalDays > 0 ? (attendance.daysPresent / totalDays) * 100 : 0;
                        const attendanceRate = attendanceRateValue.toFixed(1);
                        
                        return (
                          <TableRow key={attendance.staffId}>
                            <TableCell className="font-medium">{attendance.staffName}</TableCell>
                            <TableCell>{attendance.hoursWorked} hrs</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{attendance.daysPresent} days</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={attendance.daysAbsent > 0 ? "destructive" : "secondary"}>
                                {attendance.daysAbsent} days
                              </Badge>
                            </TableCell>
                            <TableCell>{attendance.overtimeHours} hrs</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-green-600 h-2 rounded-full" 
                                    style={{ width: `${attendanceRateValue}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">{attendanceRate}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => openAttendanceModal(attendance)}>Manage</Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddStaffModalWrapper
        open={isStaffDetailsDialogOpen}
        onOpenChange={setIsStaffDetailsDialogOpen}
        staffMode="view"
        staff={selectedStaff}
      />

      <AddStaffModalWrapper
        open={isEditStaffDialogOpen}
        onOpenChange={setIsEditStaffDialogOpen}
        staffMode="edit"
        staff={selectedStaff}
        onStaffSaved={refreshLoadedStaffData}
      />

      <StaffDeleteModal
        open={isDeleteStaffDialogOpen}
        staff={selectedStaff}
        isDeleting={isDeletingStaff}
        onOpenChange={setIsDeleteStaffDialogOpen}
        onDelete={handleDeleteStaff}
      />

      <StaffFinancialRecordModal
        open={isAddFinancialDialogOpen}
        mode="create"
        form={newFinancialRecord}
        staffMembers={staffData}
        isSaving={isSavingNewFinancialRecord}
        formatCurrency={formatCurrency}
        fieldErrors={newFinancialFieldErrors}
        onOpenChange={(open) => {
          setIsAddFinancialDialogOpen(open);
          if (!open) {
            setNewFinancialRecord(createEmptyStaffFinancialRecordForm());
            setNewFinancialFieldErrors({});
          }
        }}
        onFormChange={updateNewFinancialRecord}
        onSave={handleAddFinancialRecord}
      />

      <StaffFinancialRecordModal
        open={isEditFinancialDialogOpen}
        mode="edit"
        form={editFinancialForm}
        staffMembers={staffData}
        isSaving={isSavingFinancialRecord}
        formatCurrency={formatCurrency}
        fieldErrors={editFinancialFieldErrors}
        onOpenChange={handleFinancialEditDialogChange}
        onFormChange={updateEditFinancialRecord}
        onSave={handleUpdateFinancialRecord}
      />

      <StaffFinancialDeleteModal
        open={isDeleteFinancialDialogOpen}
        record={financialRecordToDelete}
        isDeleting={isDeletingFinancialRecord}
        formatCurrency={formatCurrency}
        onOpenChange={handleDeleteFinancialDialogChange}
        onDelete={handleDeleteFinancialRecord}
      />

      <StaffAttendanceModal
        open={isAttendanceDialogOpen}
        attendance={attendanceForm}
        month={attendanceMonth}
        isSaving={isSavingAttendance}
        onOpenChange={setIsAttendanceDialogOpen}
        onAttendanceChange={setAttendanceForm}
        onSave={handleAttendanceSave}
      />

      <StaffScheduleModal
        open={isScheduleDialogOpen}
        staff={scheduleStaff}
        scheduleDate={scheduleDate}
        appointments={staffAppointments}
        isLoading={isLoadingSchedule}
        onOpenChange={setIsScheduleDialogOpen}
        onOpenAppointment={openScheduleAppointment}
      />

      <AppointmentHistoryView
        open={isAppointmentHistoryOpen}
        onOpenChange={(open) => {
          setIsAppointmentHistoryOpen(open);
          if (!open) resetAppointmentSnapshot();
        }}
        appointmentSnapshot={appointmentSnapshot}
        logDate={appointmentSnapshotLogDate}
        onViewCurrent={handleViewCurrentSnapshot}
        onOpenAppointment={handleOpenSnapshotAppointment}
        isAppointmentOpen={isSnapshotAppointmentOpen}
        isHistorical={appointmentSnapshotIsHistorical}
      />

    </div>
  );
}
