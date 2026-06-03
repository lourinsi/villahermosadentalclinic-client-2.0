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
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Appointment } from "../hooks/useAppointments";
import AddStaffModalWrapper from "./AddStaffModalWrapper";
import AppointmentHistoryView from "./AppointmentHistoryView";
import { CalendarView } from "./CalendarView";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { getStaffInitials, staffPasswordManagerIgnoreProps } from "./sharedAddStaffLogic";
import { getDefaultAppointmentStatusColors } from "@/lib/status-colors";
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
  ChevronLeft,
  ChevronRight,
  Clock
}from "lucide-react";

export interface Staff {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  hireDate: string;
  baseSalary: number;
  status: string;
  employmentType: string;
  specialization: string;
  licenseNumber: string;
  profilePicture?: string;
}

export interface StaffFinancialRecord {
  id: string;
  staffId: string;
  staffName: string;
  type: string;
  amount: number;
  date: string;
  status: string;
  notes: string;
  repaymentSchedule: string;
}

export interface Attendance {
  id?: string;
  staffId: string;
  staffName: string;
  date?: string;
  status?: string;
  hoursWorked: number;
  daysPresent: number;
  daysAbsent: number;
  overtimeHours: number;
}

const emptyFinancialForm = {
  staffId: "",
  type: "",
  amount: 0,
  date: "",
  repaymentSchedule: "",
  notes: "",
};

const monthKey = (date = new Date()) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
};

const dateKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const normalizeFilterValue = (value?: string) =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

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
  
  const [newFinancialRecord, setNewFinancialRecord] = useState(emptyFinancialForm);

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
  const [editFinancialForm, setEditFinancialForm] = useState({
    staffId: "",
    type: "",
    amount: 0,
    date: "",
    status: "pending",
    notes: "",
    repaymentSchedule: "",
  });
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
  const [scheduleAppointment, setScheduleAppointment] = useState<Appointment | null>(null);
  const [isScheduleAppointmentOpen, setIsScheduleAppointmentOpen] = useState(false);

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
  }, [fetchStaffData]);

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

  const handleAddFinancialRecord = async () => {
    if (!newFinancialRecord.staffId || !newFinancialRecord.type || !newFinancialRecord.date || Number(newFinancialRecord.amount) <= 0) {
      toast.error("Staff member, type, amount, and date are required");
      return;
    }
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
        setNewFinancialRecord(emptyFinancialForm);
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
      amount: record.amount,
      date: record.date,
      status: record.status,
      notes: record.notes,
      repaymentSchedule: record.repaymentSchedule,
    });
    setIsEditFinancialDialogOpen(true);
  };

  const handleFinancialEditDialogChange = (open: boolean) => {
    setIsEditFinancialDialogOpen(open);
    if (!open) {
      setEditingFinancialRecord(null);
      setEditFinancialForm({
        staffId: "",
        type: "",
        amount: 0,
        date: "",
        status: "pending",
        notes: "",
        repaymentSchedule: "",
      });
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
    if (!editFinancialForm.staffId || !editFinancialForm.type || !editFinancialForm.date) {
      toast.error("Please complete all required fields");
      return;
    }
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

  const handleScheduleMonthChange = (newDate: Date) => {
    setScheduleDate(newDate);
    if (scheduleStaff) {
      fetchStaffAppointments(scheduleStaff.name, newDate);
    }
  };

  const getAppointmentsForDate = (date: Date) => {
    // Use local date formatting to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return staffAppointments.filter(apt => apt.date === dateStr);
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const sortedStaffAppointments = useMemo(
    () =>
      [...staffAppointments].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.time || "").localeCompare(b.time || "");
      }),
    [staffAppointments]
  );

  const upcomingStaffAppointments = useMemo(() => {
    const now = new Date();
    const today = dateKey(now);
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    return sortedStaffAppointments.filter((appointment) => {
      const status = normalizeFilterValue(appointment.status);
      if (status === "cancelled" || status === "completed") return false;
      if (appointment.date > today) return true;
      if (appointment.date < today) return false;
      return String(appointment.time || "00:00").slice(0, 5) >= currentTime;
    });
  }, [sortedStaffAppointments]);

  const getAppointmentStatusClass = (status?: string) => {
    const colors = getDefaultAppointmentStatusColors(normalizeFilterValue(status));
    return `${colors.bgColor} ${colors.textColor}`;
  };

  const openScheduleAppointment = (appointment: Appointment) => {
    // Open the appointment history view instead of the booking/edit modal
    handleViewAppointment(appointment);
  };

  const handleScheduleAppointmentOpenChange = (open: boolean) => {
    setIsScheduleAppointmentOpen(open);
    if (!open) setScheduleAppointment(null);
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

  const refreshScheduleAppointments = () => {
    if (scheduleStaff) {
      fetchStaffAppointments(scheduleStaff.name, scheduleDate);
    }
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
                      <SelectItem value="dentistry">Dentistry</SelectItem>
                      <SelectItem value="hygiene">Hygiene</SelectItem>
                      <SelectItem value="assistance">Assistance</SelectItem>
                      <SelectItem value="administration">Administration</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="dentist">Dentist</SelectItem>
                      <SelectItem value="hygienist">Hygienist</SelectItem>
                      <SelectItem value="assistant">Assistant</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="receptionist">Receptionist</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={employmentTypeFilter} onValueChange={setEmploymentTypeFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Employment Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="fulltime">Full-time</SelectItem>
                      <SelectItem value="parttime">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="onleave">On Leave</SelectItem>
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
                        <TableRow key={staff.id}>
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
                              <Button variant="outline" size="sm" onClick={() => openStaffDetails(staff)} title="View Details">
                                <Eye className="h-3 w-3" />
                              </Button>
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
                      <SelectItem value="cash_advance">Cash Advance</SelectItem>
                      <SelectItem value="bonus">Bonus</SelectItem>
                      <SelectItem value="salary_adjustment">Salary Adjustment</SelectItem>
                      <SelectItem value="deduction">Deduction</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={financialStatusFilter} onValueChange={setFinancialStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={resetFinancialFilters} title="Reset filters">
                    <Filter className="h-4 w-4" />
                  </Button>
                  <Dialog open={isAddFinancialDialogOpen} onOpenChange={(open) => {
                    setIsAddFinancialDialogOpen(open);
                    if (!open) setNewFinancialRecord(emptyFinancialForm);
                  }}>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <DollarSign className="h-4 w-4 mr-2" />
                        Add Transaction
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Financial Transaction</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="staff">Staff Member</Label>
                          <Select value={newFinancialRecord.staffId} onValueChange={(value) => setNewFinancialRecord({ ...newFinancialRecord, staffId: value })}>
                            <SelectTrigger id="staff">
                              <SelectValue placeholder="Select staff member" />
                            </SelectTrigger>
                            <SelectContent>
                              {staffData.map((staff) => (
                                <SelectItem key={staff.id} value={staff.id.toString()}>
                                  {staff.name} - {staff.role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="transactionType">Transaction Type</Label>
                          <Select value={newFinancialRecord.type} onValueChange={(value) => setNewFinancialRecord({ ...newFinancialRecord, type: value })}>
                            <SelectTrigger id="transactionType">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash_advance">Cash Advance</SelectItem>
                              <SelectItem value="bonus">Bonus</SelectItem>
                              <SelectItem value="salary_adjustment">Salary Adjustment</SelectItem>
                              <SelectItem value="deduction">Deduction</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="staff-financial-amount">Amount (PHP)</Label>
                          <Input id="staff-financial-amount" type="number" placeholder="500" {...staffPasswordManagerIgnoreProps} value={newFinancialRecord.amount} onChange={(e) => setNewFinancialRecord({ ...newFinancialRecord, amount: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="staff-financial-date">Date</Label>
                          <Input id="staff-financial-date" type="date" {...staffPasswordManagerIgnoreProps} value={newFinancialRecord.date} onChange={(e) => setNewFinancialRecord({ ...newFinancialRecord, date: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="staff-financial-repayment">Repayment Schedule (if applicable)</Label>
                          <Input id="staff-financial-repayment" placeholder="e.g., 2 months" {...staffPasswordManagerIgnoreProps} value={newFinancialRecord.repaymentSchedule} onChange={(e) => setNewFinancialRecord({ ...newFinancialRecord, repaymentSchedule: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="staff-financial-notes">Notes</Label>
                          <Textarea id="staff-financial-notes" placeholder="Enter details..." {...staffPasswordManagerIgnoreProps} value={newFinancialRecord.notes} onChange={(e) => setNewFinancialRecord({ ...newFinancialRecord, notes: e.target.value })} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddFinancialDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddFinancialRecord} disabled={isSavingNewFinancialRecord} className="bg-blue-600 hover:bg-blue-700">
                          {isSavingNewFinancialRecord ? "Adding..." : "Add Transaction"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
                              record.type === "cash_advance" ? "default" :
                              record.type === "bonus" ? "secondary" :
                              "outline"
                            }>
                              {record.type.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(record.amount)}</TableCell>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>{record.repaymentSchedule}</TableCell>
                          <TableCell className="max-w-xs truncate">{record.notes}</TableCell>
                          <TableCell>
                            <Badge className={
                              record.status === "paid" ? "bg-green-100 text-green-800" :
                              record.status === "approved" ? "bg-blue-100 text-blue-800" :
                              "bg-yellow-100 text-yellow-800"
                            }>
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {record.status === "pending" && (
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

      <Dialog open={isDeleteStaffDialogOpen} onOpenChange={setIsDeleteStaffDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Staff Member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedStaff ? `Are you sure you want to remove ${selectedStaff.name}?` : "Are you sure you want to remove this staff member?"}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteStaffDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteStaff} disabled={isDeletingStaff}>
              {isDeletingStaff ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditFinancialDialogOpen} onOpenChange={handleFinancialEditDialogChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Financial Record</DialogTitle>
          </DialogHeader>
          {editingFinancialRecord ? (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-financial-staff">Staff Member</Label>
                <Select
                  value={editFinancialForm.staffId}
                  onValueChange={(value) => setEditFinancialForm({ ...editFinancialForm, staffId: value })}
                >
                  <SelectTrigger id="edit-financial-staff">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffData.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id.toString()}>
                        {staff.name} - {staff.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-financial-type">Transaction Type</Label>
                <Select
                  value={editFinancialForm.type}
                  onValueChange={(value) => setEditFinancialForm({ ...editFinancialForm, type: value })}
                >
                  <SelectTrigger id="edit-financial-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash_advance">Cash Advance</SelectItem>
                    <SelectItem value="bonus">Bonus</SelectItem>
                    <SelectItem value="salary_adjustment">Salary Adjustment</SelectItem>
                    <SelectItem value="deduction">Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-financial-status">Status</Label>
                <Select
                  value={editFinancialForm.status}
                  onValueChange={(value) => setEditFinancialForm({ ...editFinancialForm, status: value })}
                >
                  <SelectTrigger id="edit-financial-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-financial-amount">Amount</Label>
                <Input
                  id="edit-financial-amount"
                  type="number"
                  {...staffPasswordManagerIgnoreProps}
                  value={editFinancialForm.amount}
                  onChange={(e) => setEditFinancialForm({ ...editFinancialForm, amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-financial-date">Date</Label>
                <Input
                  id="edit-financial-date"
                  type="date"
                  {...staffPasswordManagerIgnoreProps}
                  value={editFinancialForm.date}
                  onChange={(e) => setEditFinancialForm({ ...editFinancialForm, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-financial-repayment">Repayment Schedule</Label>
                <Input
                  id="edit-financial-repayment"
                  placeholder="e.g., 2 months"
                  {...staffPasswordManagerIgnoreProps}
                  value={editFinancialForm.repaymentSchedule}
                  onChange={(e) => setEditFinancialForm({ ...editFinancialForm, repaymentSchedule: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-financial-notes">Notes</Label>
                <Textarea
                  id="edit-financial-notes"
                  {...staffPasswordManagerIgnoreProps}
                  value={editFinancialForm.notes}
                  onChange={(e) => setEditFinancialForm({ ...editFinancialForm, notes: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No financial record selected.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => handleFinancialEditDialogChange(false)}>Cancel</Button>
            <Button onClick={handleUpdateFinancialRecord} disabled={isSavingFinancialRecord || !editingFinancialRecord} className="bg-blue-600 hover:bg-blue-700">
              {isSavingFinancialRecord ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteFinancialDialogOpen} onOpenChange={handleDeleteFinancialDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Financial Record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {financialRecordToDelete ? `Remove ${financialRecordToDelete.staffName}'s ${financialRecordToDelete.type.replace(/_/g, " ")} record?` : "Remove this financial record?"}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDeleteFinancialDialogChange(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteFinancialRecord} disabled={isDeletingFinancialRecord}>
              {isDeletingFinancialRecord ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAttendanceDialogOpen} onOpenChange={setIsAttendanceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Attendance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-xs text-muted-foreground">Staff Member</p>
              <p className="font-medium">{attendanceForm.staffName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="attendance-hours">Hours Worked</Label>
                <Input
                  id="attendance-hours"
                  type="number"
                  {...staffPasswordManagerIgnoreProps}
                  value={attendanceForm.hoursWorked}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, hoursWorked: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendance-overtime">Overtime Hours</Label>
                <Input
                  id="attendance-overtime"
                  type="number"
                  {...staffPasswordManagerIgnoreProps}
                  value={attendanceForm.overtimeHours}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, overtimeHours: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendance-present">Days Present</Label>
                <Input
                  id="attendance-present"
                  type="number"
                  {...staffPasswordManagerIgnoreProps}
                  value={attendanceForm.daysPresent}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, daysPresent: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendance-absent">Days Absent</Label>
                <Input
                  id="attendance-absent"
                  type="number"
                  {...staffPasswordManagerIgnoreProps}
                  value={attendanceForm.daysAbsent}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, daysAbsent: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAttendanceDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAttendanceSave} disabled={isSavingAttendance} className="bg-blue-600 hover:bg-blue-700">
              {isSavingAttendance ? "Saving..." : "Save Attendance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="flex max-h-[96dvh] w-[min(1180px,calc(100vw-0.75rem))] max-w-[calc(100vw-0.75rem)] flex-col overflow-hidden bg-gray-50 p-0 sm:max-h-[92vh] sm:max-w-[1180px]">
          <DialogHeader className="shrink-0 border-b bg-white p-4 sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <Avatar className="h-12 w-12 border-2 border-white shadow-sm sm:h-16 sm:w-16">
                  {scheduleStaff?.profilePicture ? (
                    <AvatarImage src={scheduleStaff.profilePicture} alt={scheduleStaff.name} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-blue-100 text-lg font-bold text-blue-700">
                    {getStaffInitials(scheduleStaff?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <DialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 sm:text-xl">
                    <CalendarDays className="h-5 w-5 shrink-0 text-blue-600" />
                    <span className="truncate">{scheduleStaff?.name}&apos;s Schedule</span>
                  </DialogTitle>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {scheduleStaff?.role ? <Badge variant="secondary">{scheduleStaff.role}</Badge> : null}
                    {scheduleStaff?.specialization ? <span>{scheduleStaff.specialization}</span> : null}
                    {scheduleStaff?.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {scheduleStaff.email}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="self-start rounded-lg border bg-blue-50 px-4 py-3 text-sm md:self-auto">
                <p className="font-semibold text-blue-900">{staffAppointments.length} appointments</p>
                <p className="text-blue-700">
                  {scheduleDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
            <div className="space-y-4 sm:space-y-6">
              <div className="rounded-xl bg-white p-2 shadow-sm sm:p-3 lg:p-4">
                <CalendarView
                  portal="doctor"
                  defaultDoctorFilter={scheduleStaff?.name ?? "all"}
                  appointmentsOverride={staffAppointments}
                  isLoadingOverride={isLoadingSchedule}
                  onOpenAppointment={openScheduleAppointment}
                />
              </div>

              <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-gray-900">
                  <Calendar className="h-4 w-4" />
                  Upcoming appointments ({upcomingStaffAppointments.length})
                </h4>
                {upcomingStaffAppointments.length === 0 ? (
                  <p className="rounded-2xl border bg-white py-10 text-center text-sm text-muted-foreground">
                    No upcoming appointments scheduled
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                    {upcomingStaffAppointments.map((apt, idx) => (
                      <button
                        key={apt.id || `${apt.date}-${apt.time}-${idx}`}
                        type="button"
                        onClick={() => openScheduleAppointment(apt)}
                        className="flex w-full items-center justify-between gap-4 rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="min-w-[54px] text-center">
                            <div className="text-lg font-bold text-blue-600">{new Date(apt.date + 'T00:00:00').getDate()}</div>
                            <div className="text-xs text-muted-foreground">{new Date(apt.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</div>
                          </div>
                          <div>
                            <p className="font-medium">{apt.patientName}</p>
                            <p className="text-sm text-muted-foreground">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {formatTime(apt.time)}
                              {apt.duration && ` - ${apt.duration} min`}
                            </p>
                          </div>
                        </div>
                        <Badge className={getAppointmentStatusClass(apt.status)}>{apt.status}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t bg-white p-3 sm:p-4">
            <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
