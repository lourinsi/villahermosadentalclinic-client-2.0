"use client";

import { apiUrl } from "@/lib/api";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useAppointmentStatuses } from "@/hooks/useAppointmentStatuses";
import { usePaymentStatuses } from "@/hooks/usePaymentStatuses";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import PatientAvatar from "./PatientAvatar";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  AlertCircle, 
  DollarSign, 
  ClipboardList,
  Search,
  Calendar as CalendarIcon,
  History,
  Plus,
  Filter,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  MoreVertical,
  CalendarCheck2,
  CalendarX2,
  Mail,
  Phone
} from "lucide-react";
import { Appointment } from "../hooks/useAppointments";
import { getAppointmentTypeName } from "../lib/appointment-types";
import { formatAppointmentStatusLabel, isCartAppointmentStatus, normalizeAppointmentStatus } from "@/lib/appointment-status";
import { formatTimeTo12h } from "@/lib/time-slots";
import { formatWordyDate, parseBackendDateToLocal } from "../lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Input } from "./ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "./ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter as Footer,
} from "./ui/alert-dialog";
import ApproveRejectDialog from "./ApproveRejectDialog";
import AppointmentHistoryView from "./AppointmentHistoryView";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { getAuthHeaders } from "@/lib/auth-headers";
import {
  DEFAULT_APPOINTMENT_STATUS_OPTIONS,
  getAppointmentStatusOptionWithColors,
  getPaymentStatusOptionWithColors,
  normalizePaymentStatus,
} from "@/lib/status-colors";
import { getAppointmentPatientDisplayName } from "@/lib/patient-identity";

interface RequestsViewProps {
  doctorFilter?: string;
}

const REQUESTS_PER_PAGE = 10;
const HISTORY_PER_PAGE = 10;

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

const getPatientImage = (appointment: any, patientRecord?: any) => {
  if (!appointment) return undefined;
  return (
    appointment.patientProfile ||
    appointment.patientProfilePicture ||
    appointment.patientPhoto ||
    appointment.patientImage ||
    appointment.patientAvatar ||
    appointment.profilePicture ||
    appointment.patient?.profilePicture ||
    appointment.patient?.profilePictureUrl ||
    appointment.patient?.photo ||
    appointment.patient?.photoUrl ||
    appointment.patient?.avatar ||
    // Fallback to fetched patient record
    patientRecord?.profilePicture ||
    patientRecord?.profilePictureUrl ||
    patientRecord?.photo ||
    patientRecord?.avatar
  );
};

export function RequestsView({ doctorFilter }: RequestsViewProps = {}) {
  const { effectiveRole } = useAdminViewMode();
  const {
    appointments,
    updateAppointment,
    openEditModal,
    openEditModalById,
    refreshTrigger,
    isEditModalOpen,
    selectedAppointment,
  } = useAppointmentModal();
  const { statuses: APPOINTMENT_STATUSES } = useAppointmentStatuses();
  const { statuses: PAYMENT_STATUSES } = usePaymentStatuses();
  const canManagePaymentStatuses = effectiveRole === "admin";
  const [requests, setRequests] = useState<Appointment[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(true);
  const [requestCurrentPage, setRequestCurrentPage] = useState(1);
  const [requestTotalPages, setRequestTotalPages] = useState(1);
  const [requestTotal, setRequestTotal] = useState(0);
  const [requestRefreshKey, setRequestRefreshKey] = useState(0);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("requests");
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const { refreshAppointments, openCreateModal } = useAppointmentModal();
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
  } = useNotificationAppointmentSnapshot([...appointments, ...requests, ...history]);
  const handleOpenSnapshotAppointment = async (appointmentId: string) => {
    const appointment = [...appointments, ...requests, ...history].find((item: Appointment) => String(item.id) === String(appointmentId));
    setIsAppointmentHistoryOpen(false);
    resetAppointmentSnapshot();
    if (appointment) {
      openEditModal(appointment);
      return;
    }

    try {
      await openEditModalById(appointmentId);
    } catch {
      toast.error("Appointment not found or could not be loaded");
    }
  };
  const isSnapshotAppointmentOpen = Boolean(
    isEditModalOpen &&
    appointmentSnapshotId &&
    selectedAppointment?.id &&
    String(selectedAppointment.id) === String(appointmentSnapshotId)
  );
  
  // Function to update notifications when appointment data changes
  const updateNotificationsForAppointment = async (appointmentId: string, changes: { status?: string; paymentStatus?: string }) => {
    try {
      // Find the appointment to get patient info
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (!appointment) return;

      // Update all notifications related to this appointment
      await fetch(apiUrl(`/api/notifications/update-by-appointment`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          updates: changes,
        }),
      });
    } catch (error) {
      console.error("Error updating notifications for appointment:", error);
      // Don't show toast - this is a background sync
    }
  };
  
  // Log available statuses when RequestsView loads
  useEffect(() => {
    if (APPOINTMENT_STATUSES && APPOINTMENT_STATUSES.length > 0) {
      console.log('[RequestsView] Available appointment statuses:', APPOINTMENT_STATUSES.map(s => s.value));
    }
  }, [APPOINTMENT_STATUSES]);

  // Normalize status strings to canonical backend keys for reliable comparisons
  const canonicalStatus = (s?: string) => {
    return normalizeAppointmentStatus(s);
  };

  const canonicalPaymentStatus = (s?: string) => {
    return normalizePaymentStatus(s);
  };

  const isPatientCartStatus = (status?: string) => {
    return isCartAppointmentStatus(status);
  };

  const isPaymentIncomplete = (paymentStatus?: string) => {
    const normalized = canonicalPaymentStatus(paymentStatus);
    return normalized !== "paid" && normalized !== "over-paid";
  };

  const canPromptPayment = (appointment: Appointment) => {
    const normalizedStatus = canonicalStatus(appointment.status);
    return (
      isPaymentIncomplete(appointment.paymentStatus) &&
      normalizedStatus !== "cancelled" &&
      normalizedStatus !== "deleted"
    );
  };

  const canSeeDeletedAppointments = effectiveRole === "admin";
  const appointmentStatusOptionsWithDeleted = (() => {
    const statuses = APPOINTMENT_STATUSES || [];
    const hasDeletedStatus = statuses.some((status: any) => canonicalStatus(status.value) === "deleted");
    const deletedStatusOption = DEFAULT_APPOINTMENT_STATUS_OPTIONS.find((status) => status.value === "deleted");

    if (!canSeeDeletedAppointments || hasDeletedStatus || !deletedStatusOption) {
      return statuses;
    }

    return [...statuses, deletedStatusOption];
  })();
  const staffVisibleStatusOptions = appointmentStatusOptionsWithDeleted.filter((status: any) => {
    const normalizedStatus = canonicalStatus(status.value);
    if (isPatientCartStatus(status.value)) return false;
    if (normalizedStatus === "deleted" && !canSeeDeletedAppointments) return false;
    return true;
  });

  const isActionableStatus = (status?: string) => {
    const k = canonicalStatus(status);
    return k === "reserved" || k === "to-pay" || k === "half-paid" || k === "tbd";
  };

  // History shows completed appointments (not pending payments)
  const isHistoryStatus = (status?: string) => {
    const k = canonicalStatus(status);
    return k === "scheduled" || k === "completed" || k === "cancelled" || (canSeeDeletedAppointments && k === "deleted");
  };

  // Appointment requests include these statuses (action required)
  const isPendingRequestStatus = (status?: string) => {
    const k = canonicalStatus(status);
    // TBD also appears in requests because it needs action (marking completed/cancelled)
    return isActionableStatus(k);
  };

  // Request filters state
  const [pendingSearchTerm, setPendingSearchTerm] = useState("");
  const [pendingStatusFilter, setPendingStatusFilter] = useState("all");
  const [pendingDoctorFilter, setPendingDoctorFilter] = useState("all");
  const [pendingDateFilter, setPendingDateFilter] = useState("");
  const [pendingSortColumn, setPendingSortColumn] = useState<string | null>(null);
  const [pendingSortDirection, setPendingSortDirection] = useState<"asc" | "desc">("asc");

  // History filters state
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [historyDoctorFilter, setHistoryDoctorFilter] = useState("all");
  const [historySortColumn, setHistorySortColumn] = useState<string | null>(null);
  const [historySortDirection, setHistorySortDirection] = useState<"asc" | "desc">("asc");
  
  // Confirmation dialog state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{appointment: Appointment, newStatus: Appointment['status']} | null>(null);
  
  // Approve confirmation dialog state
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [pendingApproveAppointment, setPendingApproveAppointment] = useState<Appointment | null>(null);
  
  // Reject confirmation dialog state
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [pendingRejectAppointment, setPendingRejectAppointment] = useState<Appointment | null>(null);

  const getInitials = (name: string) => {
    if (!name) return "P";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const getCurrentPatientName = (appointment: Appointment) =>
    getAppointmentPatientDisplayName(appointment);

  const sortAppointmentsForColumn = (
    items: Appointment[],
    column: string | null,
    direction: "asc" | "desc",
    fallbackColumn: string = "date"
  ) => {
    const sortColumn = column || fallbackColumn;

    return [...items].sort((a: Appointment, b: Appointment) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortColumn) {
        case "date":
          aVal = new Date(`${a.date}T${a.time}`).getTime();
          bVal = new Date(`${b.date}T${b.time}`).getTime();
          break;
        case "patient":
          aVal = getCurrentPatientName(a).toLowerCase();
          bVal = getCurrentPatientName(b).toLowerCase();
          break;
        case "service":
          aVal = getAppointmentTypeName(a.type, a.customType).toLowerCase();
          bVal = getAppointmentTypeName(b.type, b.customType).toLowerCase();
          break;
        case "doctor":
          aVal = a.doctor.toLowerCase();
          bVal = b.doctor.toLowerCase();
          break;
        case "status":
          aVal = canonicalStatus(a.status);
          bVal = canonicalStatus(b.status);
          break;
        case "payment":
          aVal = canonicalPaymentStatus(a.paymentStatus || "unpaid");
          bVal = canonicalPaymentStatus(b.paymentStatus || "unpaid");
          break;
        case "booked":
          aVal = a.createdAt ? new Date(a.createdAt).getTime() : Number.MIN_VALUE;
          bVal = b.createdAt ? new Date(b.createdAt).getTime() : Number.MIN_VALUE;
          break;
        case "updated":
          aVal = a.updatedAt ? new Date(a.updatedAt).getTime() : Number.MIN_VALUE;
          bVal = b.updatedAt ? new Date(b.updatedAt).getTime() : Number.MIN_VALUE;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return direction === "asc" ? -1 : 1;
      if (aVal > bVal) return direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  const fetchRequests = useCallback(async (page = 1, signal?: AbortSignal) => {
    try {
      setIsRequestsLoading(true);

      const params = new URLSearchParams({
        view: "requests",
        page: String(page),
        limit: String(REQUESTS_PER_PAGE),
      });
      const search = pendingSearchTerm.trim();
      const selectedDoctor = doctorFilter || (pendingDoctorFilter !== "all" ? pendingDoctorFilter : "");

      if (search) params.set("search", search);
      if (pendingStatusFilter !== "all") params.set("status", pendingStatusFilter);
      if (selectedDoctor) params.set("doctor", selectedDoctor);
      if (pendingDateFilter) {
        params.set("startDate", pendingDateFilter);
        params.set("endDate", pendingDateFilter);
      }
      if (pendingSortColumn) {
        params.set("sortBy", pendingSortColumn);
        params.set("sortDirection", pendingSortDirection);
      }

      const response = await fetch(apiUrl(`/api/appointments?${params.toString()}`), {
        credentials: "include",
        headers: getAuthHeaders(),
        signal,
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to fetch appointment requests");
      }

      const data = (result.data || []).map((appointment: Appointment) => ({
        ...appointment,
        status: normalizeAppointmentStatus(appointment.status),
      }));
      const serverReturnedPage = Boolean(result.meta);
      const clientFilteredData = data.filter((appointment: Appointment) => {
        if (isPatientCartStatus(appointment.status) || !isPendingRequestStatus(appointment.status)) {
          return false;
        }

        if (doctorFilter && (appointment.doctor || "").toLowerCase() !== doctorFilter.toLowerCase()) {
          return false;
        }

        if (pendingDoctorFilter !== "all" && appointment.doctor !== pendingDoctorFilter) {
          return false;
        }

        if (
          search &&
          !getCurrentPatientName(appointment).toLowerCase().includes(search.toLowerCase()) &&
          !getAppointmentTypeName(appointment.type, appointment.customType).toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }

        if (pendingStatusFilter !== "all" && canonicalStatus(appointment.status) !== canonicalStatus(pendingStatusFilter)) {
          return false;
        }

        if (pendingDateFilter && appointment.date !== pendingDateFilter) {
          return false;
        }

        return true;
      });
      const clientSortedData = pendingSortColumn
        ? sortAppointmentsForColumn(clientFilteredData, pendingSortColumn, pendingSortDirection)
        : clientFilteredData;
      const total = Number(result.meta?.total ?? clientFilteredData.length);
      const nextTotalPages = Math.max(
        1,
        Number(result.meta?.totalPages) || Math.ceil(total / REQUESTS_PER_PAGE)
      );
      const visibleRequests = serverReturnedPage && clientFilteredData.length <= REQUESTS_PER_PAGE
        ? clientFilteredData
        : clientSortedData.slice((page - 1) * REQUESTS_PER_PAGE, page * REQUESTS_PER_PAGE);

      if (page > nextTotalPages) {
        setRequestCurrentPage(nextTotalPages);
        return;
      }

      setRequests(visibleRequests);
      setRequestTotal(total);
      setRequestTotalPages(nextTotalPages);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;

      console.error("Error fetching appointment requests:", error);
      toast.error(error instanceof Error ? error.message : "Failed to fetch appointment requests");
      setRequests([]);
      setRequestTotal(0);
      setRequestTotalPages(1);
    } finally {
      if (!signal?.aborted) setIsRequestsLoading(false);
    }
  }, [
    doctorFilter,
    pendingDateFilter,
    pendingDoctorFilter,
    pendingSearchTerm,
    pendingSortColumn,
    pendingSortDirection,
    pendingStatusFilter,
  ]);

  useEffect(() => {
    setRequestCurrentPage(1);
  }, [
    doctorFilter,
    pendingDateFilter,
    pendingDoctorFilter,
    pendingSearchTerm,
    pendingSortColumn,
    pendingSortDirection,
    pendingStatusFilter,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    fetchRequests(requestCurrentPage, controller.signal);

    return () => controller.abort();
  }, [fetchRequests, requestCurrentPage, requestRefreshKey, refreshTrigger]);

  const refreshRequests = useCallback(() => {
    setRequestRefreshKey((key) => key + 1);
  }, []);

  const fetchHistory = useCallback(async (page = 1, signal?: AbortSignal) => {
    try {
      setIsHistoryLoading(true);

      const params = new URLSearchParams({
        view: "history",
        page: String(page),
        limit: String(HISTORY_PER_PAGE),
      });
      const search = historySearchTerm.trim();
      const selectedDoctor = doctorFilter || (historyDoctorFilter !== "all" ? historyDoctorFilter : "");

      if (search) params.set("search", search);
      if (historyStatusFilter !== "all") params.set("status", historyStatusFilter);
      if (selectedDoctor) params.set("doctor", selectedDoctor);
      if (historyDateFilter) {
        params.set("startDate", historyDateFilter);
        params.set("endDate", historyDateFilter);
      }
      if (historySortColumn) {
        params.set("sortBy", historySortColumn);
        params.set("sortDirection", historySortDirection);
      }

      const response = await fetch(apiUrl(`/api/appointments?${params.toString()}`), {
        credentials: "include",
        headers: getAuthHeaders(),
        signal,
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to fetch appointment history");
      }

      const data = (result.data || []).map((appointment: Appointment) => ({
        ...appointment,
        status: normalizeAppointmentStatus(appointment.status),
      }));
      const serverReturnedPage = Boolean(result.meta);
      const clientFilteredData = data.filter((appointment: Appointment) => {
        if (isPatientCartStatus(appointment.status) || !isHistoryStatus(appointment.status)) {
          return false;
        }

        if (doctorFilter && (appointment.doctor || "").toLowerCase() !== doctorFilter.toLowerCase()) {
          return false;
        }

        if (
          search &&
          !getCurrentPatientName(appointment).toLowerCase().includes(search.toLowerCase()) &&
          !getAppointmentTypeName(appointment.type, appointment.customType).toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }

        if (historyStatusFilter !== "all" && canonicalStatus(appointment.status) !== canonicalStatus(historyStatusFilter)) {
          return false;
        }

        if (historyDateFilter && appointment.date !== historyDateFilter) {
          return false;
        }

        return true;
      });
      const clientSortedData = sortAppointmentsForColumn(
        clientFilteredData,
        historySortColumn,
        historySortColumn ? historySortDirection : "desc",
        "date"
      );
      const total = Number(result.meta?.total ?? clientFilteredData.length);
      const nextTotalPages = Math.max(
        1,
        Number(result.meta?.totalPages) || Math.ceil(total / HISTORY_PER_PAGE)
      );
      const visibleHistory = serverReturnedPage && clientFilteredData.length <= HISTORY_PER_PAGE
        ? clientFilteredData
        : clientSortedData.slice((page - 1) * HISTORY_PER_PAGE, page * HISTORY_PER_PAGE);

      if (page > nextTotalPages) {
        setHistoryCurrentPage(nextTotalPages);
        return;
      }

      setHistory(visibleHistory);
      setHistoryTotal(total);
      setHistoryTotalPages(nextTotalPages);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;

      console.error("Error fetching appointment history:", error);
      toast.error(error instanceof Error ? error.message : "Failed to fetch appointment history");
      setHistory([]);
      setHistoryTotal(0);
      setHistoryTotalPages(1);
    } finally {
      if (!signal?.aborted) setIsHistoryLoading(false);
    }
  }, [
    doctorFilter,
    historyDateFilter,
    historySearchTerm,
    historySortColumn,
    historySortDirection,
    historyStatusFilter,
    historyDoctorFilter,
  ]);

  useEffect(() => {
    setHistoryCurrentPage(1);
  }, [
    doctorFilter,
    historyDateFilter,
    historySearchTerm,
    historySortColumn,
    historySortDirection,
    historyStatusFilter,
    historyDoctorFilter,
  ]);

  useEffect(() => {
    if (activeTab !== "history") return;
    setHasLoadedHistory(true);

    const controller = new AbortController();
    fetchHistory(historyCurrentPage, controller.signal);

    return () => controller.abort();
  }, [activeTab, fetchHistory, historyCurrentPage, historyRefreshKey, refreshTrigger]);

  const refreshHistory = useCallback(() => {
    setHistoryRefreshKey((key) => key + 1);
  }, []);

  const refreshAppointmentLists = useCallback(() => {
    refreshRequests();
    if (hasLoadedHistory) refreshHistory();
  }, [hasLoadedHistory, refreshHistory, refreshRequests]);

  useEffect(() => {
    const handleAppointmentsUpdated = (event: Event) => {
      const updatedAppointment = (event as CustomEvent<{ appointment?: Appointment }>).detail?.appointment;

      if (updatedAppointment?.id) {
        const normalizedAppointment = {
          ...updatedAppointment,
          status: normalizeAppointmentStatus(updatedAppointment.status),
        };

        const mergeUpdatedAppointment = (items: Appointment[]) =>
          items.map((appointment) =>
            String(appointment.id) === String(normalizedAppointment.id)
              ? { ...appointment, ...normalizedAppointment }
              : appointment
          );

        setRequests(mergeUpdatedAppointment);
        setHistory(mergeUpdatedAppointment);
      }

      refreshAppointmentLists();
    };

    window.addEventListener("appointments:updated", handleAppointmentsUpdated as EventListener);

    return () => {
      window.removeEventListener("appointments:updated", handleAppointmentsUpdated as EventListener);
    };
  }, [refreshAppointmentLists]);

  const handleApprove = async (appointment: Appointment) => {
    setPendingApproveAppointment(appointment);
    setIsApproveConfirmOpen(true);
  };

  const confirmApprove = async () => {
    if (!pendingApproveAppointment) return;
    
    try {
      // Approve reserved requests to scheduled
      // Approve TBD requests to completed (since TBD is for past appointments)
      let newStatus = "scheduled";
      if (pendingApproveAppointment.status === "tbd") {
        newStatus = "completed";
      } else if (canonicalStatus(pendingApproveAppointment.status) === "reserved") {
        newStatus = "scheduled";
      }
      
      await updateAppointment(pendingApproveAppointment.id, { status: newStatus });
      toast.success(`Appointment for ${getCurrentPatientName(pendingApproveAppointment)} approved`);
      // Refresh notifications to show the new status change notification
      refreshAppointmentLists();
      // Also refresh notifications from NotificationPage context if available
      setTimeout(() => {
        window.dispatchEvent(new Event('refreshNotifications'));
      }, 500);
    } catch {
      toast.error("Failed to approve appointment");
    } finally {
      setIsApproveConfirmOpen(false);
      setPendingApproveAppointment(null);
    }
  };

  const handleReject = async (appointment: Appointment) => {
    setPendingRejectAppointment(appointment);
    setIsRejectConfirmOpen(true);
  };

  const handleOpenPayment = async (appointment: Appointment) => {
    try {
      openEditModal(appointment, false, true);
    } catch (error) {
      console.error("Error opening payment modal:", error);
      toast.error("Unable to open payment editor. Please try again.");
    }
  };

  const confirmReject = async () => {
    if (!pendingRejectAppointment) return;
    
    try {
      await updateAppointment(pendingRejectAppointment.id, { status: "cancelled" });
      toast.success(`Appointment for ${getCurrentPatientName(pendingRejectAppointment)} rejected`);
      // Refresh notifications to show the new status change notification
      refreshAppointmentLists();
      // Also refresh notifications from NotificationPage context if available
      setTimeout(() => {
        window.dispatchEvent(new Event('refreshNotifications'));
      }, 500);
    } catch {
      toast.error("Failed to reject appointment");
    } finally {
      setIsRejectConfirmOpen(false);
      setPendingRejectAppointment(null);
    }
  };

  const handleStatusChangeRequest = (appointment: Appointment, statusKey: string) => {
    if (isPatientCartStatus(statusKey)) {
      toast.error("Add to Cart is reserved for patient carts.");
      return;
    }
    // statusKey comes from the select dropdown and directly maps to backend status values
    setPendingStatusChange({ appointment, newStatus: statusKey as Appointment['status'] });
    setIsConfirmOpen(true);
  };

  const handlePaymentStatusChange = async (appointmentId: string, newPaymentStatus: string) => {
    try {
      await updateAppointment(appointmentId, { paymentStatus: newPaymentStatus as any });
      toast.success(`Payment status updated successfully`);
      // Refresh appointments and notifications to show the new payment status change notification
      refreshAppointmentLists();
      // Also refresh notifications from NotificationPage context if available
      setTimeout(() => {
        window.dispatchEvent(new Event('refreshNotifications'));
      }, 500);
    } catch {
      toast.error("Failed to update payment status");
    }
  };

  const handleHistoryStatusChange = async (appointmentId: string, newStatus: string) => {
    if (isPatientCartStatus(newStatus)) {
      toast.error("Add to Cart is reserved for patient carts.");
      return;
    }

    try {
      await updateAppointment(appointmentId, { status: newStatus as any });
      toast.success(`Status updated to ${newStatus}`);
      refreshAppointmentLists();
      setTimeout(() => {
        window.dispatchEvent(new Event('refreshNotifications'));
      }, 500);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return;
    
    const { appointment, newStatus } = pendingStatusChange;
    try {
      await updateAppointment(appointment.id, { status: newStatus });
      toast.success(`Status for ${getCurrentPatientName(appointment)} updated to ${newStatus}`);
      // Refresh appointments and notifications to show the new status change notification
      refreshAppointmentLists();
      // Also refresh notifications from NotificationPage context if available
      setTimeout(() => {
        window.dispatchEvent(new Event('refreshNotifications'));
      }, 500);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsConfirmOpen(false);
      setPendingStatusChange(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusOption = getAppointmentStatusOptionWithColors(status, APPOINTMENT_STATUSES);

    return (
      <Badge className={`${statusOption.bgColor} ${statusOption.textColor} border-none hover:opacity-80 font-medium capitalize`}>
        {statusOption.label || formatAppointmentStatusLabel(status)}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (paymentStatus: string | undefined) => {
    const statusOption = getPaymentStatusOptionWithColors(paymentStatus || "unpaid", PAYMENT_STATUSES);

    return (
      <Badge className={`${statusOption.bgColor} ${statusOption.textColor} border-none hover:opacity-80 font-medium capitalize`}>
        {statusOption.label || paymentStatus || "Unpaid"}
      </Badge>
    );
  };

  const handlePendingSort = (column: string) => {
    setRequestCurrentPage(1);
    if (pendingSortColumn === column) {
      setPendingSortDirection(pendingSortDirection === "asc" ? "desc" : "asc");
    } else {
      setPendingSortColumn(column);
      setPendingSortDirection("asc");
    }
  };

  const handleHistorySort = (column: string) => {
    setHistoryCurrentPage(1);
    if (historySortColumn === column) {
      setHistorySortDirection(historySortDirection === "asc" ? "desc" : "asc");
    } else {
      setHistorySortColumn(column);
      setHistorySortDirection("asc");
    }
  };

  const getSortIcon = (column: string, isPending: boolean) => {
    const currentColumn = isPending ? pendingSortColumn : historySortColumn;
    const currentDirection = isPending ? pendingSortDirection : historySortDirection;
    
    if (currentColumn === column) {
      return currentDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
    }
    return <ArrowUpDown className="h-4 w-4 opacity-40" />;
  };

  const sortedRequests = requests;
  const sortedHistory = history;

  const requestDoctorOptions = useMemo(() => {
    return Array.from(new Set([...appointments, ...requests, ...history].map((appointment) => appointment.doctor).filter(Boolean))).sort();
  }, [appointments, requests, history]);
  const pendingRequestColumnCount = doctorFilter ? 8 : 9;
  const historyColumnCount = doctorFilter ? 7 : 8;

  return (
    <div data-tour-id="requests-page" className="mx-auto max-w-[1600px] space-y-6 p-3 sm:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic">
            {doctorFilter ? "Patient Requests" : "Appointment Management"}
          </h1>
          <p className="text-gray-500 font-medium">Review and manage appointment requests</p>
        </div>
        {(effectiveRole === "admin" || effectiveRole === "doctor") && (
          <Button
            type="button"
            variant="outline"
            onClick={() => openCreateModal()}
            className="gap-2 font-semibold rounded-xl"
          >
            <Plus className="h-4 w-4" />
            <span>New Appointment</span>
          </Button>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          if (value === "history" && !hasLoadedHistory) setIsHistoryLoading(true);
        }}
        className="space-y-6"
      >
        <TabsList className="h-auto w-full rounded-xl border bg-white p-1 shadow-sm sm:w-fit">
          <TabsTrigger value="requests" className="rounded-lg px-4 py-2.5 font-bold transition-all duration-300 data-[state=active]:bg-violet-600 data-[state=active]:text-white sm:px-6">
            Requests
            <Badge className="ml-2 bg-violet-100 text-violet-700 border-none">{requestTotal}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg px-4 py-2.5 font-bold transition-all duration-300 data-[state=active]:bg-violet-600 data-[state=active]:text-white sm:px-6">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card className="border-none shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-gray-100 pb-6 bg-white">
              <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
                <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center">
                  <div className="p-2.5 bg-amber-50 rounded-xl">
                    <AlertCircle className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-gray-900 uppercase">Action Required</CardTitle>
                    <p className="text-sm text-gray-500 font-medium">Please review appointments that need action</p>
                    {sortedRequests.some(canPromptPayment) ? (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-100 px-3 py-1 text-xs font-semibold uppercase text-amber-700">
                        <DollarSign className="h-3.5 w-3.5" />
                        Payment due for {sortedRequests.filter(canPromptPayment).length} appointment{sortedRequests.filter(canPromptPayment).length !== 1 ? "s" : ""}
                      </div>
                    ) : null}
                    <div className="relative mt-4 w-full md:mt-0 lg:w-auto">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input 
                        placeholder="Search patient or service..." 
                        className="w-full rounded-xl border-gray-100 bg-gray-50 pl-10 text-sm sm:w-64"
                        value={pendingSearchTerm}
                        onChange={(e) => {
                          setPendingSearchTerm(e.target.value);
                          setRequestCurrentPage(1);
                        }}
                      />
                    </div>
                  </div>
                  
                  <Select
                    value={pendingStatusFilter}
                    onValueChange={(value) => {
                      setPendingStatusFilter(value);
                      setRequestCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full rounded-xl border-gray-100 bg-gray-50 text-sm sm:w-[160px]">
                      <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-gray-400" />
                        <SelectValue placeholder="All Status" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {staffVisibleStatusOptions.filter((s: any) => isPendingRequestStatus(s.value)).map((status: any) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!doctorFilter && (
                    <Select
                      value={pendingDoctorFilter}
                      onValueChange={(value) => {
                        setPendingDoctorFilter(value);
                        setRequestCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-full rounded-xl border-gray-100 bg-gray-50 text-sm sm:w-[160px]">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-gray-400" />
                          <SelectValue placeholder="All Doctors" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Doctors</SelectItem>
                        {requestDoctorOptions.map((doc: any) => (
                          <SelectItem key={doc} value={doc}>{doc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Button variant="ghost" size="icon" className="rounded-xl border border-gray-100" onClick={() => {
                    setPendingSearchTerm("");
                    setPendingStatusFilter("all");
                    setPendingDoctorFilter("all");
                    setPendingDateFilter("");
                    setRequestCurrentPage(1);
                  }}>
                    <RotateCcw className="h-4 w-4 text-gray-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                      <TableHead className="font-bold text-gray-900 py-5 cursor-pointer" onClick={() => handlePendingSort("patient")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Patient {getSortIcon("patient", true)}
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handlePendingSort("service")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Service {getSortIcon("service", true)}
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handlePendingSort("date")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Schedule {getSortIcon("date", true)}
                        </div>
                      </TableHead>
                      {!doctorFilter && (
                        <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handlePendingSort("doctor")}>
                          <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                            Doctor {getSortIcon("doctor", true)}
                          </div>
                        </TableHead>
                      )}
                      <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handlePendingSort("status")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Status {getSortIcon("status", true)}
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handlePendingSort("payment")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Payment {getSortIcon("payment", true)}
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handlePendingSort("booked")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Booked {getSortIcon("booked", true)}
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handlePendingSort("updated")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Last Updated {getSortIcon("updated", true)}
                        </div>
                      </TableHead>
                      <TableHead className="text-right uppercase text-[11px] tracking-wider font-bold text-gray-900">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isRequestsLoading ? (
                      <TableRow>
                        <TableCell colSpan={pendingRequestColumnCount} className="h-32 text-center text-gray-500 font-medium">
                          Loading requests...
                        </TableCell>
                      </TableRow>
                    ) : sortedRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={pendingRequestColumnCount} className="h-64 text-center">
                          <div className="flex flex-col items-center justify-center py-12">
                            <div className="p-4 bg-gray-50 rounded-full mb-4">
                              <ClipboardList className="h-10 w-10 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 uppercase">All Caught Up!</h3>
                            <p className="text-gray-500 max-w-xs mx-auto mt-2">There are no appointment requests matching your filters.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedRequests.map((request) => {
                        const patientName = getCurrentPatientName(request);
                        return (
                        <TableRow key={request.id} className="hover:bg-violet-50/30 transition-colors border-b border-gray-50">
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <PatientAvatar src={resolveImageSource(getPatientImage(request))} name={patientName} dob={request.patientDateOfBirth || request.patientDob || request.patientBirthDate || request.patientBirthday} className="h-10 w-10 border-2 border-white shadow-sm" sizeClass="h-10 w-10" />
                              <div>
                                <div className="font-bold text-gray-900">{patientName}</div>
                                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">ID: {request.id.slice(0, 8)}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-gray-700">{getAppointmentTypeName(request.type, request.customType)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{formatWordyDate(request.date, { fallback: request.date || 'N/A' })}</span>
                              <span className="text-xs text-gray-500 font-medium">{formatTimeTo12h(request.time)}</span>
                            </div>
                          </TableCell>
                          {!doctorFilter && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-violet-400"></div>
                                <span className="text-sm font-semibold text-gray-700">{request.doctor}</span>
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <Select 
                              value={request.status} 
                              onValueChange={(newStatus) => handleHistoryStatusChange(request.id, newStatus)}
                            >
                              <SelectTrigger className="w-auto h-auto p-0 bg-transparent border-0 hover:opacity-80 transition-opacity [&>svg]:text-gray-400">
                                <div className="cursor-pointer">
                                  {getStatusBadge(request.status)}
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {staffVisibleStatusOptions.map((status: any) => (
                                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {canManagePaymentStatuses ? (
                              <Select
                                value={request.paymentStatus || "unpaid"}
                                onValueChange={(newPaymentStatus) => handlePaymentStatusChange(request.id, newPaymentStatus)}
                              >
                                <SelectTrigger className="w-auto h-auto p-0 bg-transparent border-0 hover:opacity-80 transition-opacity [&>svg]:text-gray-400">
                                  <div className="cursor-pointer">
                                    {getPaymentStatusBadge(request.paymentStatus)}
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_STATUSES.map((status: any) => (
                                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              getPaymentStatusBadge(request.paymentStatus)
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{formatWordyDate(request.createdAt, { fallback: 'N/A' })}</span>
                              <span className="text-xs text-gray-500 font-medium">{request.createdAt ? new Date(request.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{formatWordyDate(request.updatedAt, { fallback: 'N/A' })}</span>
                              <span className="text-xs text-gray-500 font-medium">{request.updatedAt ? new Date(request.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-2">
                              {isActionableStatus(request.status) ? (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-9 w-9 p-0 text-emerald-600 hover:bg-emerald-50 rounded-xl"
                                    onClick={() => handleApprove(request)}
                                    title={request.status === "tbd" ? "Mark as Completed" : "Approve Appointment"}
                                  >
                                    <CheckCircle className="h-5 w-5" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-9 w-9 p-0 text-rose-600 hover:bg-rose-50 rounded-xl"
                                    onClick={() => handleReject(request)}
                                    title={request.status === "tbd" ? "Cancel Appointment" : "Reject Appointment"}
                                  >
                                    <XCircle className="h-5 w-5" />
                                  </Button>
                                </>
                              ) : null}
                              {canPromptPayment(request) ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-9 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                                  onClick={() => handleOpenPayment(request)}
                                >
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  Pay now
                                </Button>
                              ) : null}
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-9 w-9 p-0 text-violet-600 hover:bg-violet-50 rounded-xl"
                                onClick={() => {
                                  handleViewAppointment(request);
                                }}
                              >
                                <Eye className="h-5 w-5" />
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-white">
                <p className="text-sm text-gray-500 font-medium">
                  Page {requestCurrentPage} of {requestTotalPages || 1} | Showing {requests.length} of {requestTotal} requests
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setRequestCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={isRequestsLoading || requestCurrentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setRequestCurrentPage((page) => Math.min(requestTotalPages, page + 1))}
                    disabled={isRequestsLoading || requestCurrentPage >= requestTotalPages || requestTotalPages === 0}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="border-none shadow-xl shadow-gray-200/50 bg-white rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-gray-100 pb-6">
              <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-violet-50 rounded-xl">
                    <History className="h-6 w-6 text-violet-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-gray-900 uppercase">Recent Activity</CardTitle>
                    <p className="text-sm text-gray-500 font-medium">History of processed appointments</p>
                  </div>
                </div>

                <div className="flex w-full flex-wrap gap-2 md:w-auto">
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search patient or service..." 
                      className="w-full rounded-xl border-gray-100 bg-gray-50 pl-10 text-sm sm:w-64"
                      value={historySearchTerm}
                      onChange={(e) => {
                        setHistorySearchTerm(e.target.value);
                        setHistoryCurrentPage(1);
                      }}
                    />
                  </div>
                  
                  <Select
                    value={historyStatusFilter}
                    onValueChange={(value) => {
                      setHistoryStatusFilter(value);
                      setHistoryCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full rounded-xl border-gray-100 bg-gray-50 text-sm sm:w-[160px]">
                      <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-gray-400" />
                        <SelectValue placeholder="All Status" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {staffVisibleStatusOptions.filter((s: any) => isHistoryStatus(s.value)).map((status: any) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!doctorFilter && (
                    <Select
                      value={historyDoctorFilter}
                      onValueChange={(value) => {
                        setHistoryDoctorFilter(value);
                        setHistoryCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-full rounded-xl border-gray-100 bg-gray-50 text-sm sm:w-[160px]">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-gray-400" />
                          <SelectValue placeholder="All Doctors" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Doctors</SelectItem>
                        {requestDoctorOptions.map((doc: any) => (
                          <SelectItem key={doc} value={doc}>{doc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Button variant="ghost" size="icon" className="rounded-xl border border-gray-100" onClick={() => {
                    setHistorySearchTerm("");
                    setHistoryStatusFilter("all");
                    setHistoryDateFilter("");
                    setHistoryDoctorFilter("all");
                    setHistoryCurrentPage(1);
                  }}>
                    <RotateCcw className="h-4 w-4 text-gray-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-100">
                      <TableHead className="font-bold text-gray-900 py-5 cursor-pointer" onClick={() => handleHistorySort("patient")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Patient {getSortIcon("patient", false)}
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handleHistorySort("service")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Service {getSortIcon("service", false)}
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handleHistorySort("date")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Schedule {getSortIcon("date", false)}
                        </div>
                      </TableHead>
                      {!doctorFilter && (
                        <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handleHistorySort("doctor")}>
                          <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                            Doctor {getSortIcon("doctor", false)}
                          </div>
                        </TableHead>
                      )}
                      <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handleHistorySort("status")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Status {getSortIcon("status", false)}
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handleHistorySort("payment")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Payment {getSortIcon("payment", false)}
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handleHistorySort("booked")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Booked {getSortIcon("booked", false)}
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-gray-900 cursor-pointer" onClick={() => handleHistorySort("updated")}>
                        <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                          Last Updated {getSortIcon("updated", false)}
                        </div>
                      </TableHead>
                      <TableHead className="text-right uppercase text-[11px] tracking-wider font-bold text-gray-900">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isHistoryLoading ? (
                      <TableRow>
                        <TableCell colSpan={historyColumnCount} className="h-32 text-center text-gray-500 font-medium">
                          Loading history...
                        </TableCell>
                      </TableRow>
                    ) : sortedHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={historyColumnCount} className="h-64 text-center">
                          <div className="flex flex-col items-center justify-center py-12">
                            <div className="p-4 bg-gray-50 rounded-full mb-4">
                              <History className="h-10 w-10 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 uppercase">No History Found</h3>
                            <p className="text-gray-500 max-w-xs mx-auto mt-2">No appointment history matches your filters.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedHistory.map((item) => {
                        const patientName = getCurrentPatientName(item);
                        return (
                        <TableRow key={item.id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <PatientAvatar src={resolveImageSource(getPatientImage(item))} name={patientName} dob={item.patientDateOfBirth || item.patientDob || item.patientBirthDate || item.patientBirthday} className="h-10 w-10 border-2 border-white shadow-sm" sizeClass="h-10 w-10" />
                              <div>
                                <div className="font-bold text-gray-900">{patientName}</div>
                                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">ID: {item.id.slice(0, 8)}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-gray-700">{getAppointmentTypeName(item.type, item.customType)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{formatWordyDate(item.date, { fallback: item.date || 'N/A' })}</span>
                              <span className="text-xs text-gray-500 font-medium">{formatTimeTo12h(item.time)}</span>
                            </div>
                          </TableCell>
                          {!doctorFilter && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-violet-400"></div>
                                <span className="text-sm font-semibold text-gray-700">{item.doctor}</span>
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <Select 
                              value={item.status} 
                              onValueChange={(newStatus) => handleHistoryStatusChange(item.id, newStatus)}
                            >
                              <SelectTrigger className="w-auto h-auto p-0 bg-transparent border-0 hover:opacity-80 transition-opacity [&>svg]:text-gray-400">
                                <div className="cursor-pointer">
                                  {getStatusBadge(item.status)}
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {staffVisibleStatusOptions.map((status: any) => (
                                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {canManagePaymentStatuses ? (
                              <Select
                                value={item.paymentStatus || "unpaid"}
                                onValueChange={(newPaymentStatus) => handlePaymentStatusChange(item.id, newPaymentStatus)}
                              >
                                <SelectTrigger className="w-auto h-auto p-0 bg-transparent border-0 hover:opacity-80 transition-opacity [&>svg]:text-gray-400">
                                  <div className="cursor-pointer">
                                    {getPaymentStatusBadge(item.paymentStatus)}
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_STATUSES.map((status: any) => (
                                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              getPaymentStatusBadge(item.paymentStatus)
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{formatWordyDate(item.createdAt, { fallback: 'N/A' })}</span>
                              <span className="text-xs text-gray-500 font-medium">{item.createdAt ? new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{formatWordyDate(item.updatedAt, { fallback: 'N/A' })}</span>
                              <span className="text-xs text-gray-500 font-medium">{item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-2">
                              {canPromptPayment(item) ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-9 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                                  onClick={() => handleOpenPayment(item)}
                                >
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  Pay now
                                </Button>
                              ) : null}
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-9 w-9 p-0 text-violet-600 hover:bg-violet-50 rounded-xl"
                                onClick={() => {
                                  handleViewAppointment(item);
                                }}
                              >
                                <Eye className="h-5 w-5" />
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-white">
                <p className="text-sm text-gray-500 font-medium">
                  Page {historyCurrentPage} of {historyTotalPages || 1} | Showing {history.length} of {historyTotal} history items
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setHistoryCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={isHistoryLoading || historyCurrentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setHistoryCurrentPage((page) => Math.min(historyTotalPages, page + 1))}
                    disabled={isHistoryLoading || historyCurrentPage >= historyTotalPages || historyTotalPages === 0}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent 
          className="rounded-2xl border-none shadow-2xl"
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-gray-900 uppercase tracking-tight">Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 font-medium">
              Are you sure you want to update the status of this appointment for <strong>{pendingStatusChange ? getCurrentPatientName(pendingStatusChange.appointment) : "this patient"}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-xs tracking-wider">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmStatusChange}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider"
            >
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ApproveRejectDialog
        open={isApproveConfirmOpen}
        onOpenChange={setIsApproveConfirmOpen}
        mode="approve"
        appointment={pendingApproveAppointment}
        onConfirm={confirmApprove}
        isProcessing={false}
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
        showPreviousInputChanges={false}
      />

      <ApproveRejectDialog
        open={isRejectConfirmOpen}
        onOpenChange={setIsRejectConfirmOpen}
        mode="reject"
        appointment={pendingRejectAppointment}
        onConfirm={confirmReject}
        isProcessing={false}
      />
    </div>
  );
}
