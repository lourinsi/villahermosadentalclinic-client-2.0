"use client";

import { apiUrl } from "@/lib/api";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useAppointmentStatuses } from "@/hooks/useAppointmentStatuses";
import { usePaymentStatuses } from "@/hooks/usePaymentStatuses";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
import { useDoctors } from "@/hooks/useDoctors";
import { useAppointmentTypeOptions } from "@/hooks/useAppointmentTypeOptions";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import PatientAvatar from "./PatientAvatar";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  Clock,
  CheckCircle,
  Eye,
  DollarSign,
  ClipboardList,
  Search,
  Calendar,
  History,
  Plus,
  Filter,
  RotateCcw,
  Users,
  User,
  Loader2,
  Stethoscope,
  FileText,
  MoreVertical,
  Check,
  X,
} from "lucide-react";
import { Appointment } from "../hooks/useAppointments";
import { getAppointmentTypeName } from "../lib/appointment-types";
import { formatAppointmentStatusLabel, isCartAppointmentStatus, isStatusAllowedForAppointment, normalizeAppointmentStatus } from "@/lib/appointment-status";
import { formatTimeTo12h } from "@/lib/time-slots";
import { formatDateToYYYYMMDD, formatWordyDate, parseBackendDateToLocal } from "../lib/utils";
import { Input } from "./ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import AppointmentHistoryView from "./AppointmentHistoryView";
import ApproveRejectDialog from "./ApproveRejectDialog";
import { AppointmentActionsMenu, createRequestsOverflowActions, createVisitHistoryActions } from "./AppointmentActionsMenu";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { getAuthHeaders } from "@/lib/auth-headers";
import {
  DEFAULT_APPOINTMENT_STATUS_OPTIONS,
  getAppointmentStatusOptionWithColors,
  getPaymentStatusOptionWithColors,
  normalizePaymentStatus,
} from "@/lib/status-colors";
import { getAppointmentPatientDisplayName } from "@/lib/patient-identity";
import { OTHER_APPOINTMENT_TYPE_INDEX } from "@/lib/appointment-types";
import { isOverdueAppointmentDisplay } from "@/lib/appointment-status";
import { SelectPatientModal, type PatientSelectOption } from "./SelectPatientModal";
import { SelectScheduleModal } from "./SelectScheduleModal";
import { SelectTreatmentModal, type SelectTreatmentModalSection } from "./SelectTreatmentModal";
import { SelectDoctorModal } from "./SelectDoctorModal";
import { DatePickerModal } from "./DatePickerModal";
import { TimePickerModal } from "./TimePickerModal";
import { SetAppointmentPriceModal } from "./SetAppointmentPriceModal";
import { ToothNumbersEditor } from "./ToothNumbersEditor";
import AppointmentPatientChoiceDialog from "./AppointmentPatientChoiceDialog";
import { AppointmentStatusSelect } from "./AppointmentStatusSelect";
import { CurrencyText } from "./CurrencyAmount";
import {
  getBookingToothNumberEntries,
  getBookingToothNumbersValue,
  getBookingTreatmentsValue,
  getBookingTreatmentDisplay,
  appointmentToTreatmentDraft,
  treatmentDraftToPayload,
  normalizeBookingDuration,
} from "./sharedBookingLogic";
import type { TreatmentSelectionDraft } from "./universalSelectModalDrafts";
import type { ServiceCatalogItem } from "@/lib/appointment-service-catalog";

export interface TreatmentHistoryViewProps {
  patientId?: string;
  patientName?: string;
  showPatientColumn?: boolean;
  showStatsCards?: boolean;
  initialViewMode?: "history" | "list";
  doctorFilter?: string;
  title?: string;
  subtitle?: string;
  appointmentsData?: Appointment[];
  onRefreshData?: () => void;
  /** When set, only shows appointments with these statuses (e.g. ["tbd","reserved"]) */
  allowedStatuses?: string[];
  /** When true, shows ✓ and ✗ action buttons to approve/reject */
  showApproveReject?: boolean;
}

const HISTORY_PER_PAGE = 15;

const getTreatmentDisplay = (appointment: any) =>
  getBookingTreatmentDisplay(appointment, getAppointmentTypeName);

const TreatmentCellContent = ({ appointment, compact = false, hideToothDetail = false }: { appointment: any; compact?: boolean; hideToothDetail?: boolean }) => {
  const { labels, toothDetail } = getTreatmentDisplay(appointment);

  return (
    <div className="min-w-0 space-y-0.5 text-left">
      {labels.map((label, index) => (
        <span key={`${label}-${index}`} className={index === 0 ? "block font-semibold leading-snug text-gray-900" : "block text-xs font-medium leading-snug text-slate-600"}>
          {label}
        </span>
      ))}
      {!hideToothDetail && toothDetail ? <span className={compact ? "block text-xs font-medium leading-snug text-violet-600" : "block text-xs font-medium leading-snug text-slate-500"}>{toothDetail}</span> : null}
    </div>
  );
};

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
    patientRecord?.profilePicture ||
    patientRecord?.profilePictureUrl ||
    patientRecord?.photo ||
    patientRecord?.avatar
  );
};

const formatCurrency = (value?: number | string | null) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getInitials = (name: string) => {
  if (!name) return "P";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
};

export function TreatmentHistoryView({
  patientId,
  patientName: propPatientName,
  showPatientColumn = true,
  showStatsCards = true,
  initialViewMode = "history",
  doctorFilter,
  title = "Treatment History",
  subtitle = "All past appointments and treatments",
  appointmentsData,
  onRefreshData,
  allowedStatuses,
  showApproveReject = false,
}: TreatmentHistoryViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { effectiveRole } = useAdminViewMode();
  const isAdmin = effectiveRole === "admin";
  const {
    appointments: contextAppointments,
    updateAppointment,
    openEditModal,
    openEditModalById,
    refreshTrigger,
    isEditModalOpen,
    selectedAppointment,
    refreshAppointments,
    openCreateModal,
  } = useAppointmentModal();

  const { statuses: APPOINTMENT_STATUSES } = useAppointmentStatuses();
  const { statuses: PAYMENT_STATUSES } = usePaymentStatuses();
  const { openPaymentFor, openPaymentModal, openEditPaymentModal } = usePaymentModal();
  const { doctors } = useDoctors();
  const { options: treatmentOptions } = useAppointmentTypeOptions();
  const activeTreatmentOptions = useMemo<ServiceCatalogItem[]>(
    () => treatmentOptions.filter((o) => o.isActive !== false),
    [treatmentOptions]
  );

  // Responsive view mode: list on large screens, history on small screens
  // The initialViewMode prop is used as a fallback for SSR
  const [historyViewMode, setHistoryViewMode] = useState<"history" | "list">(initialViewMode);
  const [userOverrodeViewMode, setUserOverrodeViewMode] = useState(false);
  // Filters / sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [procedureFilter, setProcedureFilter] = useState<string>("all");
  const [localDoctorFilter, setLocalDoctorFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Modal and cell edit state
  const [approveDialogAppointment, setApproveDialogAppointment] = useState<Appointment | null>(null);
  const [rejectDialogAppointment, setRejectDialogAppointment] = useState<Appointment | null>(null);
  const [isProcessingApproveReject, setIsProcessingApproveReject] = useState(false);

  const [scheduleCellAppointment, setScheduleCellAppointment] = useState<Appointment | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [scheduleTime, setScheduleTime] = useState<string>("");
  const [scheduleDuration, setScheduleDuration] = useState<string>("30");
  const [scheduleStatus, setScheduleStatus] = useState<string>("scheduled");
  const [isScheduleDatePickerOpen, setIsScheduleDatePickerOpen] = useState(false);
  const [isScheduleTimePickerOpen, setIsScheduleTimePickerOpen] = useState(false);

  const [treatmentCellAppointment, setTreatmentCellAppointment] = useState<Appointment | null>(null);
  const [doctorCellAppointment, setDoctorCellAppointment] = useState<Appointment | null>(null);
  const [patientChoiceAppointment, setPatientChoiceAppointment] = useState<Appointment | null>(null);
  const [patientCellAppointment, setPatientCellAppointment] = useState<Appointment | null>(null);

  const [editingToothNumberAptId, setEditingToothNumberAptId] = useState<string | null>(null);
  const [editingToothNumberValue, setEditingToothNumberValue] = useState<string>("");

  const isSoftDeletedAppointment = (appointment?: Partial<Appointment> | null) =>
    Boolean(appointment?.deleted) || normalizeAppointmentStatus(String(appointment?.status || "")) === "deleted";

  const getAppointmentStatusForDisplay = (appointment: any) => {
    if (!appointment) return "";
    if (Boolean(appointment.deleted)) return "deleted";
    return normalizeAppointmentStatus(String(appointment.status || ""));
  };

  const getCurrentPatientName = (appointment: any) => getAppointmentPatientDisplayName(appointment);

  const buildStatusLifecycleUpdate = (appointment: Appointment | undefined, newStatus: string): Partial<Appointment> => {
    const normalized = normalizeAppointmentStatus(newStatus);
    if (!appointment) return { status: normalized };
    if (Boolean(appointment.deleted)) return { status: "deleted" };
    return { status: normalized };
  };

  const appointmentStatusOptionsWithDeleted = (() => {
    const statuses = APPOINTMENT_STATUSES || [];
    const hasDeleted = statuses.some((s: any) => normalizeAppointmentStatus(s.value) === "deleted");
    if (hasDeleted) return statuses;
    return [...statuses, { value: "deleted", label: "Deleted" }];
  })();

  const staffVisibleStatusOptions = appointmentStatusOptionsWithDeleted;

  useEffect(() => {
    if (userOverrodeViewMode) return; // user manually selected — don't override
    const mq = window.matchMedia("(min-width: 1024px)");
    const applyMode = (e: MediaQueryListEvent | MediaQueryList) => {
      setHistoryViewMode(e.matches ? "list" : "history");
    };
    applyMode(mq);
    mq.addEventListener("change", applyMode);
    return () => mq.removeEventListener("change", applyMode);
  }, [userOverrodeViewMode]);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [unfilteredHistory, setUnfilteredHistory] = useState<Appointment[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const allAppointmentsPool = useMemo(() => {
    return appointmentsData || contextAppointments;
  }, [appointmentsData, contextAppointments]);

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
  } = useNotificationAppointmentSnapshot([...allAppointmentsPool, ...history]);

  const canonicalStatus = (s?: string) => normalizeAppointmentStatus(s);
  const canonicalPaymentStatus = (s?: string) => normalizePaymentStatus(s);
  const fetchHistory = useCallback(async (page = 1, signal?: AbortSignal) => {
    try {
      setIsHistoryLoading(true);

      const params = new URLSearchParams({ page: String(page), limit: String(HISTORY_PER_PAGE) });
      if (patientId) params.set("patientId", patientId);

      const search = (searchTerm || "").trim();
      const selectedDoc = doctorFilter || (localDoctorFilter !== "all" ? localDoctorFilter : "");
      if (search) params.set("search", search);
      if (statusFilter !== "all") {
        params.set("status", statusFilter === "overdue" ? "tbd,completed,overdue" : canonicalStatus(statusFilter));
      }
      if (paymentStatusFilter !== "all") params.set("paymentStatus", canonicalPaymentStatus(paymentStatusFilter));
      if (selectedDoc) params.set("doctor", selectedDoc);
      if (sortColumn) {
        params.set("sortBy", sortColumn);
        params.set("sortDirection", sortDirection);
      }

      const res = await fetch(apiUrl(`/api/appointments?${params.toString()}`), { credentials: "include", headers: getAuthHeaders(), signal });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to fetch appointment history");

      const rawData = (json.data || []).map((apt: any) => {
        const backendStatus = normalizeAppointmentStatus(apt.status);
        return { ...apt, rawStatus: backendStatus, status: getAppointmentStatusForDisplay(apt) };
      });

      const visibleHistoryData = isAdmin
        ? rawData
        : rawData.filter((item: any) => !isSoftDeletedAppointment(item));

      setUnfilteredHistory(visibleHistoryData);
      let data = visibleHistoryData;

      if (statusFilter !== "all") {
        if (statusFilter === "overdue") {
          data = visibleHistoryData.filter((item: any) => isOverdueAppointmentDisplay(item.rawStatus || item.status, item.paymentStatus));
        } else {
          const expected = canonicalStatus(statusFilter);
          data = visibleHistoryData.filter((item: any) => normalizeAppointmentStatus(item.status) === expected);
        }
      }

      if (paymentStatusFilter !== "all") {
        const expectedPayment = canonicalPaymentStatus(paymentStatusFilter);
        data = data.filter((item: any) => canonicalPaymentStatus(item.paymentStatus) === expectedPayment);
      }

      if (patientId) {
        data = data.filter((item: any) => {
          const itemPid = String(item.patientId || item.patient?.id || "");
          return itemPid === String(patientId) || getCurrentPatientName(item) === propPatientName;
        });
      }

      if (allowedStatuses && allowedStatuses.length > 0) {
        data = data.filter((item: any) => {
          const sourceStatus = normalizeAppointmentStatus(String(item.rawStatus || item.status || ""));
          return allowedStatuses.some((a) => {
            const normalizedAllowed = normalizeAppointmentStatus(a);
            if (normalizedAllowed === "overdue") return isOverdueAppointmentDisplay(sourceStatus, item.paymentStatus);
            return normalizedAllowed === sourceStatus;
          });
        });
      }

      if (procedureFilter !== "all") {
        data = data.filter((item: any) => getTreatmentDisplay(item).labels.some((l: string) => l.toLowerCase().includes(procedureFilter.toLowerCase())));
      }

      if (showPatientColumn && patientFilter !== "all") {
        data = data.filter((item: any) => getCurrentPatientName(item) === patientFilter);
      }

      const total = Number(json.meta?.total ?? data.length);
      const pages = Math.max(1, Math.ceil(total / HISTORY_PER_PAGE));
      setHistory(data);
      setHistoryTotal(total);
      setHistoryTotalPages(pages);
    } catch (err: any) {
      if (err && err.name === "AbortError") return;
      console.error("Error fetching appointment history:", err);
      toast.error(err instanceof Error ? err.message : "Failed to fetch appointment history");
      setHistory([]);
      setHistoryTotal(0);
      setHistoryTotalPages(1);
    } finally {
      if (!(signal as any)?.aborted) setIsHistoryLoading(false);
    }
  }, [
    patientId,
    propPatientName,
    searchTerm,
    statusFilter,
    paymentStatusFilter,
    procedureFilter,
    doctorFilter,
    localDoctorFilter,
    patientFilter,
    showPatientColumn,
    sortColumn,
    sortDirection,
  ]);
  
  useEffect(() => {
    setHistoryCurrentPage(1);
  }, [
    searchTerm,
    patientFilter,
    statusFilter,
    paymentStatusFilter,
    procedureFilter,
    localDoctorFilter,
    doctorFilter,
    sortColumn,
    sortDirection,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    fetchHistory(historyCurrentPage, controller.signal);
    return () => controller.abort();
  }, [fetchHistory, historyCurrentPage, historyRefreshKey, refreshTrigger]);

  const refreshHistory = useCallback(() => {
    setHistoryRefreshKey((key) => key + 1);
    if (onRefreshData) onRefreshData();
  }, [onRefreshData]);

  const handleApproveConfirm = async () => {
    if (!approveDialogAppointment) return;
    setIsProcessingApproveReject(true);
    try {
      const currentStatus = normalizeAppointmentStatus(String(approveDialogAppointment.status || ""));
      const nextStatus = currentStatus === "tbd" ? "completed" : "scheduled";
      await updateAppointment(approveDialogAppointment.id, { status: nextStatus as any });
      toast.success(`Appointment ${nextStatus === "completed" ? "marked as completed" : "approved"}`);
      refreshHistory();
      refreshAppointments();
    } catch {
      toast.error("Failed to approve appointment");
    } finally {
      setIsProcessingApproveReject(false);
      setApproveDialogAppointment(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectDialogAppointment) return;
    setIsProcessingApproveReject(true);
    try {
      await updateAppointment(rejectDialogAppointment.id, { status: "cancelled" as any });
      toast.success("Appointment cancelled");
      refreshHistory();
      refreshAppointments();
    } catch {
      toast.error("Failed to cancel appointment");
    } finally {
      setIsProcessingApproveReject(false);
      setRejectDialogAppointment(null);
    }
  };

  const handleGoToPatient = (item: Appointment) => {
    const basePath = pathname.startsWith("/receptionist") ? "/receptionist" : "/admin";
    const displayName = getCurrentPatientName(item);
    const pId = String((item as any)?.patientId || (item as any)?.patient?.id || "").trim();
    const target = (displayName && displayName !== "No patient assigned" ? displayName : "") || pId;
    if (target) {
      router.push(`${basePath}/patients/${encodeURIComponent(target)}`);
    } else {
      toast.error("No patient profile found for this appointment.");
    }
  };

  const handleOpenScheduleModal = (item: Appointment) => {
    setScheduleCellAppointment(item);
    if (item.date) {
      const parsedDate = parseBackendDateToLocal(item.date) || new Date(item.date);
      setScheduleDate(Number.isNaN(parsedDate.getTime()) ? null : parsedDate);
    } else {
      setScheduleDate(null);
    }
    setScheduleTime(item.time || "");
    setScheduleDuration(String(item.duration || 30));
    setScheduleStatus(normalizeAppointmentStatus(item.status || "scheduled"));
  };

  const handleOpenEditPayment = async (item: Appointment) => {
    if (isSoftDeletedAppointment(item)) return;
    const pId = String((item as any).patientId || (item as any).patient?.id || "");
    const aptId = String(item.id || "");
    if (!aptId) return;

    const patientDisplayName = getCurrentPatientName(item);

    try {
      const res = await fetch(
        apiUrl(`/api/payments/appointment/${encodeURIComponent(aptId)}`),
        {
          credentials: "include",
          headers: getAuthHeaders(),
        }
      );
      const json = await res.json().catch(() => ({}));
      const payments = res.ok && json?.success && Array.isArray(json.data) ? json.data : [];
      const latest = payments.length > 0 ? payments[payments.length - 1] : null;

      if (latest && (latest.id || latest._id)) {
        openEditPaymentModal(String(latest.id || latest._id), latest, pId, [item]);
      } else {
        openPaymentFor(item, pId, patientDisplayName);
      }
    } catch (err) {
      openPaymentFor(item, pId, patientDisplayName);
    }
  };

  const saveCellAppointment = async (appointment: Appointment, patch: Partial<Appointment>, message: string) => {
    try {
      const updated = await updateAppointment(appointment.id, patch);
      refreshHistory();
      refreshAppointments();
      toast.success(message);
    } catch (error) {
      console.error("[TreatmentHistoryView] Failed to update cell:", error);
      toast.error("Unable to update appointment. Please try again.");
      throw error;
    }
  };

  const handleSaveToothNumbers = async (appointment: Appointment, newToothNumbers: string) => {
    const appointmentId = String(appointment.id || "");
    if (!appointmentId) return;
    try {
      await updateAppointment(appointmentId, {
        toothNumbers: newToothNumbers,
      });
      refreshHistory();
      refreshAppointments();
      toast.success("Tooth numbers updated");
    } catch (err) {
      console.error("Failed to update tooth numbers:", err);
      toast.error("Failed to update tooth numbers");
    }
  };

  const handleStatusChange = async (appointment: Appointment, newStatus: string) => {
    const normalizedNewStatus = normalizeAppointmentStatus(newStatus);
    const rawStatus = normalizeAppointmentStatus(String((appointment as any).rawStatus || appointment.status || ""));

    if (normalizedNewStatus === "overdue" && isOverdueAppointmentDisplay(rawStatus, appointment.paymentStatus)) {
      return;
    }
    if (isCartAppointmentStatus(normalizedNewStatus)) {
      toast.error("Add to Cart is reserved for patient carts.");
      return;
    }
    if (!isStatusAllowedForAppointment(normalizedNewStatus, appointment.date, appointment.paymentStatus, isAdmin)) {
      toast.error("This status option is not allowed for the appointment's scheduled date.");
      return;
    }

    try {
      const updatedAppointment = await updateAppointment(
        appointment.id,
        buildStatusLifecycleUpdate(appointment, normalizedNewStatus)
      );
      toast.success(`Status updated to ${updatedAppointment.status}`);
      refreshHistory();
      refreshAppointments();
    } catch {
      toast.error("Failed to update status");
    }
  };

  // Option lists for filter dropdowns
  const dropdownPool = useMemo(() => {
    const map = new Map<string, Appointment>();
    allAppointmentsPool.forEach((item) => {
      if (item && item.id) map.set(String(item.id), item);
    });
    unfilteredHistory.forEach((item) => {
      if (item && item.id) map.set(String(item.id), item);
    });
    return Array.from(map.values());
  }, [allAppointmentsPool, unfilteredHistory]);

  const uniquePatients = useMemo(() => {
    return Array.from(new Set(dropdownPool.map((item) => getCurrentPatientName(item)).filter(Boolean))).sort();
  }, [dropdownPool]);

  const uniqueProcedures = useMemo(() => {
    const set = new Set<string>();
    dropdownPool.forEach((item) => {
      getTreatmentDisplay(item).labels.forEach((l) => set.add(l));
    });
    return Array.from(set).sort();
  }, [dropdownPool]);

  const uniqueDoctors = useMemo(() => {
    return Array.from(new Set(dropdownPool.map((a) => a.doctor).filter(Boolean))).sort();
  }, [dropdownPool]);

  const completedCount = useMemo(() => history.filter((item) => canonicalStatus(item.status) === "completed").length, [history]);
  const paidCount = useMemo(() => history.filter((item) => canonicalPaymentStatus(item.paymentStatus) === "paid").length, [history]);
  const unpaidCount = useMemo(() => history.filter((item) => canonicalPaymentStatus(item.paymentStatus) !== "paid").length, [history]);

  const resetFilters = () => {
    setSearchTerm("");
    setPatientFilter("all");
    setStatusFilter("all");
    setPaymentStatusFilter("all");
    setProcedureFilter("all");
    setLocalDoctorFilter("all");
    setHistoryCurrentPage(1);
  };

  const activeDropdownItemClass = (isActive: boolean) =>
    isActive ? "bg-violet-600 text-white focus:bg-violet-600 focus:text-white [&_svg]:text-white" : "";

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-gray-900 md:uppercase md:italic">
            {title}
          </h1>
          <p className="mt-1 text-base font-medium text-gray-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1" aria-label="Treatment history view">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setHistoryViewMode("history"); setUserOverrodeViewMode(true); }}
              className={`h-9 rounded-lg px-3 text-xs font-black ${historyViewMode === "history" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}
            >
              <History className="mr-1.5 h-4 w-4" />
              History
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setHistoryViewMode("list"); setUserOverrodeViewMode(true); }}
              className={`h-9 rounded-lg px-3 text-xs font-black ${historyViewMode === "list" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}
            >
              <ClipboardList className="mr-1.5 h-4 w-4" />
              List
            </Button>
          </div>

          <Button
            type="button"
            onClick={() => openCreateModal(undefined, undefined, undefined, patientId)}
            className="h-11 shrink-0 gap-2 rounded-2xl bg-violet-600 px-4 font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700"
          >
            <Plus className="h-5 w-5" />
            <span>New Appointment</span>
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards (Optional) */}
      {showStatsCards && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total History", value: historyTotal, icon: History, accent: "text-violet-600", bg: "bg-violet-50" },
            { label: "Completed", value: completedCount, icon: CheckCircle, accent: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Paid", value: paidCount, icon: DollarSign, accent: "text-blue-600", bg: "bg-blue-50" },
            { label: "Unpaid", value: unpaidCount, icon: Clock, accent: "text-amber-600", bg: "bg-amber-50" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-3xl border border-gray-100 bg-white p-4 shadow-md shadow-gray-200/40 md:rounded-2xl md:shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${stat.bg} ${stat.accent}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-black leading-none text-gray-900">{stat.value}</p>
                    <p className={`mt-1 text-xs font-bold leading-tight ${stat.accent}`}>{stat.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Filter & Content Card */}
      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm rounded-2xl">
        <CardHeader className="border-b border-slate-100 p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            {/* Filter Bar Grid */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search treatments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm font-medium shadow-sm"
                />
              </div>

              {/* Patient Filter Dropdown (if showPatientColumn is true) */}
              {showPatientColumn && !patientId && (
                <div className="min-w-[160px]">
                  <Select value={patientFilter} onValueChange={setPatientFilter}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-400" />
                        <SelectValue placeholder="All Patients" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Patients</SelectItem>
                      {uniquePatients.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Procedure / Service Filter */}
              <div className="min-w-[160px]">
                <Select value={procedureFilter} onValueChange={setProcedureFilter}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-slate-400" />
                      <SelectValue placeholder="All Services" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    {uniqueProcedures.map((proc) => (
                      <SelectItem key={proc} value={proc}>{proc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Doctor / Provider Filter */}
              {!doctorFilter && (
                <div className="min-w-[160px]">
                  <Select value={localDoctorFilter} onValueChange={setLocalDoctorFilter}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <SelectValue placeholder="All Doctors" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Doctors</SelectItem>
                      {(doctors || []).map((doc: any) => (
                        <SelectItem key={doc.id || doc.name} value={doc.name}>Dr. {doc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Appointment Status Filter */}
              <div className="min-w-[160px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-slate-400" />
                      <SelectValue placeholder="All Statuses" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {staffVisibleStatusOptions.map((s: any) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Status Filter */}
              <div className="min-w-[160px]">
                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-slate-400" />
                      <SelectValue placeholder="All Payments" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    {(PAYMENT_STATUSES || [])
                      .filter((status: any) => normalizePaymentStatus(status.value) !== "overdue")
                      .map((status: any) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Filters */}
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                onClick={resetFilters}
                title="Reset filters"
              >
                <RotateCcw className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {isHistoryLoading ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                <p className="text-sm font-semibold text-slate-500">Loading treatment history...</p>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <History className="h-7 w-7 text-slate-400" />
              </div>
              <h3 className="text-lg font-black text-slate-900">No Treatment Records Found</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">No appointments match the selected filters.</p>
              <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4 rounded-xl">
                Reset Filters
              </Button>
            </div>
          ) : historyViewMode === "history" ? (
            /* HISTORY CARD TIMELINE VIEW MODE */
            <div className="space-y-4">
              {history.map((appointment: Appointment, index: number) => {
                const appointmentId = String(appointment.id || `apt-${index}`);
                const appointmentStatus = normalizeAppointmentStatus(String(appointment.status || ""));
                const isDeletedAppointment = isSoftDeletedAppointment(appointment);
                const isVoidedAppointment = isDeletedAppointment || appointmentStatus === "cancelled";
                const priceValue = Number(appointment.price || 0);
                const discountValue = Number(appointment.discount || 0);
                const discountedPriceValue = Math.max(0, priceValue - discountValue);
                const computedBalance = Math.max(0, priceValue - discountValue - Number(appointment.totalPaid || 0));
                const displayedBalance = isVoidedAppointment ? 0 : computedBalance;
                const isPaid = displayedBalance <= 0 && priceValue > 0;
                const doctorName = appointment.doctor || "";
                const isDoctorUnassigned = !doctorName;
                const patientDisplayName = getCurrentPatientName(appointment);
                const treatmentDisplay = getTreatmentDisplay(appointment);
                const treatmentNames = treatmentDisplay.labels.join(", ");
                const toothNumbers = getBookingToothNumbersValue(appointment);
                const notesText = String(appointment.notes || "").trim() || "No notes";

                const parsedDate = appointment.date ? new Date(appointment.date) : null;
                const dateParts = parsedDate
                  ? {
                      month: parsedDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
                      day: parsedDate.toLocaleDateString("en-US", { day: "2-digit" }),
                      year: parsedDate.toLocaleDateString("en-US", { year: "numeric" }),
                    }
                  : { month: "---", day: "--", year: "" };
                const appointmentTime = formatTimeTo12h(appointment.time);
                const originalDisplayedBalance = Math.max(0, priceValue - discountValue);

                return (
                  <div key={appointmentId} className="grid gap-3 xl:grid-cols-[7.5rem_minmax(0,1fr)]">
                    <div className="relative hidden xl:flex">
                      <div className="absolute left-6 top-10 h-[calc(100%+0.75rem)] w-px bg-slate-200" />
                      <div className="relative z-10 flex w-full items-start gap-3">
                        <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 shadow-sm ring-4 ring-white">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div className="pt-1 text-slate-900">
                          <div className="text-xs font-black uppercase tracking-widest text-slate-500">{dateParts.month}</div>
                          <div className="text-3xl font-black leading-none">{dateParts.day}</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">{dateParts.year}</div>
                        </div>
                      </div>
                    </div>

                    <div className={`rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${isDeletedAppointment ? "border-slate-300 bg-slate-50 opacity-90" : "border-slate-200 bg-white"}`}>
                      <div className="mb-3 flex items-center gap-3 xl:hidden">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-900">{formatWordyDate(appointment.date)}</div>
                          <div className="text-xs font-semibold text-slate-500">{appointmentTime}</div>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px_190px_36px] xl:items-center">
                        <div className="flex min-w-0 items-start gap-4">
                          <Avatar className="h-14 w-14 flex-none overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                            <AvatarFallback className="bg-blue-50 text-blue-600">{isDoctorUnassigned ? <Stethoscope className="h-5 w-5" /> : getInitials(doctorName)}</AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-base font-black text-slate-950" title={treatmentNames}>
                              {treatmentNames}
                            </div>
                            {isDoctorUnassigned ? (
                              <button
                                type="button"
                                onClick={() => setDoctorCellAppointment(appointment)}
                                className="block max-w-full truncate text-left text-sm font-semibold text-blue-600 underline-offset-2 transition-colors hover:text-blue-700 hover:underline mt-0.5"
                              >
                                Assign doctor
                              </button>
                            ) : (
                              <div className="truncate text-sm font-semibold text-slate-500 mt-0.5">{doctorName}</div>
                            )}
                            {toothNumbers ? (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50/50 px-2.5 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100/50">
                                  Tooth {toothNumbers}
                                </span>
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {appointmentTime}
                              </span>
                              <AppointmentStatusSelect
                                value={isDeletedAppointment ? "deleted" : String(appointment.status || "")}
                                statuses={APPOINTMENT_STATUSES}
                                includeDeleted={isAdmin}
                                appointmentDate={appointment.date}
                                paymentStatus={appointment.paymentStatus}
                                onChange={(nextStatus) => handleStatusChange(appointment, nextStatus)}
                              />
                              {isOverdueAppointmentDisplay(normalizeAppointmentStatus(String(appointment.status || "")), appointment.paymentStatus) ? (
                                <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Overdue</Badge>
                              ) : null}
                              <span className="inline-flex min-w-0 items-center gap-1 text-slate-500">
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{notesText}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 border-slate-200 text-sm sm:grid-cols-3 xl:grid-cols-1 xl:border-l xl:pl-5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-500">Total</span>
                            <div className="flex items-center gap-1.5">
                              {discountValue > 0 && (
                                <span className="text-xs text-slate-400 line-through decoration-rose-400 font-normal">
                                  <CurrencyText value={formatCurrency(priceValue)} />
                                </span>
                              )}
                              <span className="font-black text-slate-900">
                                <CurrencyText value={formatCurrency(discountedPriceValue)} />
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-500">Paid</span>
                            <span className={isPaid ? "font-black text-emerald-600" : "font-black text-slate-900"}><CurrencyText value={formatCurrency(appointment.totalPaid)} /></span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-500">Balance</span>
                            {isVoidedAppointment && originalDisplayedBalance > 0 ? (
                              <span className="font-black">
                                <span className="text-red-500 line-through decoration-red-400 decoration-2"><CurrencyText value={formatCurrency(originalDisplayedBalance)} /></span>
                                <span className="ml-2 text-emerald-600"><CurrencyText value={formatCurrency(0)} /></span>
                              </span>
                            ) : (
                              <span className={displayedBalance > 0 ? "font-black text-red-600" : "font-black text-emerald-600"}><CurrencyText value={formatCurrency(displayedBalance)} /></span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                          {!isVoidedAppointment ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={
                                displayedBalance > 0
                                  ? "h-9 rounded-xl border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                                  : "h-9 rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }
                              onClick={() => openPaymentFor(appointment, String((appointment as any).patientId || ""), patientDisplayName)}
                            >
                              <DollarSign className="mr-2 h-4 w-4" />
                              Record Payment
                            </Button>
                          ) : (
                            <div className="flex h-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-600">
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Closed
                            </div>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-xl border-violet-100 text-violet-700 hover:bg-violet-50"
                            onClick={() => handleOpenScheduleModal(appointment)}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            Reschedule
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-xl border-slate-200 text-slate-800 hover:bg-slate-50"
                            onClick={() => handleViewAppointment(appointment)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Button>
                        </div>

                        <AppointmentActionsMenu
                          actions={createVisitHistoryActions(
                            {
                              onViewDetails: () => handleViewAppointment(appointment),
                              onViewHistory: () => {},
                              onRecordPayment: !isVoidedAppointment ? () => openPaymentFor(appointment, String((appointment as any).patientId || ""), patientDisplayName) : undefined,
                              onRestoreAppointment: undefined,
                              onReschedule: () => handleOpenScheduleModal(appointment),
                              onUpdateTreatment: () => setTreatmentCellAppointment(appointment),
                              onAssignDoctor: () => setDoctorCellAppointment(appointment),
                            },
                            {
                              canRestoreAppointment: false,
                              canReschedule: true,
                              canUpdateTreatment: true,
                              canAssignDoctor: isDoctorUnassigned,
                            }
                          )}
                          triggerVariant="ghost"
                          triggerSize="icon"
                          triggerClassName="h-9 w-9 justify-self-end rounded-xl text-slate-500 hover:bg-slate-100"
                          triggerIcon={<MoreVertical className="h-4 w-4" />}
                          ariaLabel="Visit actions"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST TABLE VIEW MODE */
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="font-bold text-slate-900">Date & Time</TableHead>
                    {showPatientColumn && <TableHead className="font-bold text-slate-900">Patient</TableHead>}
                    <TableHead className="font-bold text-slate-900">Tooth No.</TableHead>
                    <TableHead className="font-bold text-slate-900">Treatment</TableHead>
                    <TableHead className="font-bold text-slate-900">Doctor</TableHead>
                    <TableHead className="font-bold text-slate-900">Status</TableHead>
                    <TableHead className="font-bold text-slate-900">Payment</TableHead>
                    <TableHead className="font-bold text-slate-900">Total</TableHead>
                    <TableHead className="font-bold text-slate-900">Paid</TableHead>
                    <TableHead className="font-bold text-slate-900">Balance</TableHead>
                    <TableHead className="text-right font-bold text-slate-900">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item: Appointment) => {
                    const patientDisplayName = getCurrentPatientName(item);
                    const isDeleted = isSoftDeletedAppointment(item);

                    return (
                      <TableRow key={item.id} className="group hover:bg-violet-50/30 transition-colors">
                        {/* Date & Time Cell */}
                        <TableCell className="whitespace-normal">
                          <button
                            type="button"
                            onClick={() => !isDeleted && handleOpenScheduleModal(item)}
                            disabled={isDeleted}
                            aria-label={`Edit schedule for ${item.id}`}
                            className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/70 focus-visible:border-violet-300 focus-visible:bg-violet-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Calendar className="h-4 w-4 shrink-0 text-violet-600" />
                            <span className="min-w-0">
                              <span className="block font-semibold text-slate-900">{formatWordyDate(item.date, { fallback: item.date || "N/A" })}</span>
                              <span className="block text-xs font-medium text-slate-500">{formatTimeTo12h(item.time)}</span>
                            </span>
                          </button>
                        </TableCell>

                        {/* Patient Cell (Conditional) */}
                        {showPatientColumn && (
                          <TableCell className="whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setPatientChoiceAppointment(item)}
                              disabled={isDeleted}
                              className={`flex items-center gap-2.5 text-left rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors ${isDeleted ? "opacity-50 cursor-default" : "hover:bg-violet-100 hover:text-violet-700 cursor-pointer"}`}
                            >
                              <PatientAvatar
                                src={resolveImageSource(getPatientImage(item))}
                                name={patientDisplayName}
                                className="h-9 w-9 rounded-full border border-slate-200 shadow-sm"
                                sizeClass="h-9 w-9"
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate">{patientDisplayName}</div>
                                <div className="text-xs font-semibold text-slate-400">ID: {item.id}</div>
                              </div>
                            </button>
                          </TableCell>
                        )}

                        {/* Tooth No. Cell */}
                        <TableCell className="max-w-[200px] whitespace-normal">
                          {editingToothNumberAptId === String(item.id) && !isDeleted ? (
                            <div className="space-y-1.5 p-1.5 bg-violet-50 rounded-lg border border-violet-200" onClick={(e) => e.stopPropagation()}>
                              <ToothNumbersEditor
                                value={editingToothNumberValue}
                                onChange={(val) => setEditingToothNumberValue(val)}
                                size="sm"
                                autoFocusFirst
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveToothNumbers(item, editingToothNumberValue);
                                  setEditingToothNumberAptId(null);
                                }}
                                className="text-xs font-bold text-violet-700 hover:underline block"
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (!isDeleted) {
                                  setEditingToothNumberAptId(String(item.id));
                                  setEditingToothNumberValue(getBookingToothNumbersValue(item) || "");
                                }
                              }}
                              disabled={isDeleted}
                              aria-label={`Edit tooth numbers for ${item.id}`}
                              className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/70 focus-visible:border-violet-300 focus-visible:bg-violet-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <span className="truncate font-medium text-slate-900">{getBookingToothNumbersValue(item) || "—"}</span>
                            </button>
                          )}
                        </TableCell>

                        {/* Treatment Cell */}
                        <TableCell className="max-w-xs whitespace-normal">
                          <button
                            type="button"
                            onClick={() => !isDeleted && setTreatmentCellAppointment(item)}
                            disabled={isDeleted}
                            aria-label={`Edit treatment for ${item.id}`}
                            className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/70 focus-visible:border-violet-300 focus-visible:bg-violet-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <ClipboardList className="h-4 w-4 shrink-0 text-violet-600" />
                            <TreatmentCellContent appointment={item} compact hideToothDetail />
                          </button>
                        </TableCell>

                        {/* Doctor Cell */}
                        <TableCell className="whitespace-nowrap font-medium">
                          <button
                            type="button"
                            onClick={() => !isDeleted && setDoctorCellAppointment(item)}
                            disabled={isDeleted}
                            className={`flex items-center gap-2 text-left rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors ${isDeleted ? "opacity-50 cursor-default" : "hover:bg-violet-100 hover:text-violet-700 cursor-pointer"}`}
                          >
                            <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                            <span className="font-semibold text-slate-900">{item.doctor || "Unassigned"}</span>
                          </button>
                        </TableCell>

                        {/* Status Cell */}
                        <TableCell className="whitespace-nowrap">
                          <AppointmentStatusSelect
                            value={isDeleted ? "deleted" : String(item.status || "")}
                            statuses={APPOINTMENT_STATUSES}
                            includeDeleted={isAdmin}
                            appointmentDate={item.date}
                            paymentStatus={item.paymentStatus}
                            onChange={(nextStatus) => handleStatusChange(item, nextStatus)}
                          />
                        </TableCell>

                        {/* Payment Status Cell */}
                        <TableCell className="whitespace-nowrap">
                          <Badge className={`${getPaymentStatusOptionWithColors(item.paymentStatus || "unpaid", PAYMENT_STATUSES).bgColor} ${getPaymentStatusOptionWithColors(item.paymentStatus || "unpaid", PAYMENT_STATUSES).textColor} border-none font-semibold capitalize`}>
                            {item.paymentStatus || "Unpaid"}
                          </Badge>
                        </TableCell>

                        {/* Total Cell */}
                        <TableCell className="whitespace-nowrap font-medium">
                          <button
                            type="button"
                            onClick={() => openPaymentFor(item, String((item as any).patientId || ""), patientDisplayName)}
                            className={`rounded-lg px-2 py-1 -mx-2 -my-1 text-left transition-colors ${isDeleted ? "text-slate-400 cursor-default" : "hover:bg-violet-100 hover:text-violet-700 cursor-pointer"}`}
                            disabled={isDeleted}
                            title="Record payment"
                          >
                            {Number((item as any).discount || 0) > 0 ? (
                              <div className="flex flex-col leading-tight">
                                <span className="text-xs text-slate-400 line-through decoration-rose-400 font-normal">
                                  {formatCurrency(item.price)}
                                </span>
                                <span className="font-bold text-slate-900">
                                  <CurrencyText value={formatCurrency(Math.max(0, Number(item.price || 0) - Number((item as any).discount || 0)))} />
                                </span>
                              </div>
                            ) : (
                              <span className="font-bold text-slate-900">
                                <CurrencyText value={formatCurrency(item.price)} />
                              </span>
                            )}
                          </button>
                        </TableCell>

                        {/* Paid Cell */}
                        <TableCell className="whitespace-nowrap font-medium text-emerald-700">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPayment(item)}
                            disabled={isDeleted}
                            className={`font-bold rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors ${isDeleted ? "text-slate-400 cursor-default" : "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"}`}
                            title="Edit latest payment"
                          >
                            <CurrencyText value={formatCurrency(item.totalPaid)} />
                          </button>
                        </TableCell>

                        {/* Balance Cell */}
                        <TableCell className="whitespace-nowrap font-medium">
                          {(() => {
                            const displayedBalance = isDeleted ? 0 : Math.max(0, Number(item.price || 0) - Number(item.discount || 0) - Number(item.totalPaid || 0));
                            return (
                              <button
                                type="button"
                                onClick={() => openPaymentFor(item, String((item as any).patientId || ""), patientDisplayName)}
                                className={`font-bold rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors ${isDeleted ? "text-slate-400 cursor-default" : displayedBalance > 0 ? "text-amber-600 hover:bg-amber-50 hover:text-amber-700 cursor-pointer" : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"}`}
                                disabled={isDeleted}
                                title="Record payment"
                              >
                                <CurrencyText value={formatCurrency(displayedBalance)} />
                              </button>
                            );
                          })()}
                        </TableCell>

                        {/* Actions Cell */}
                        <TableCell className="text-right whitespace-nowrap">
                          {(() => {
                            const rawStatus = normalizeAppointmentStatus(String(item.status || ""));
                            const isTBDOrReserved = rawStatus === "tbd" || rawStatus === "reserved";
                            const isOverdueAppointment = isOverdueAppointmentDisplay(rawStatus, item.paymentStatus);
                            const shouldShowApproveReject = (showApproveReject || isTBDOrReserved) && !isDeleted && !isOverdueAppointment;
                            const shouldShowOverdueActions = isOverdueAppointment && !isDeleted;

                            return (
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {shouldShowApproveReject ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 rounded-lg border-emerald-200 bg-emerald-50 px-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                      onClick={() => setApproveDialogAppointment(item)}
                                    >
                                      <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                                      {rawStatus === "tbd" ? "Mark completed" : "Approve"}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 rounded-lg border-rose-200 bg-rose-50 px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                                      onClick={() => setRejectDialogAppointment(item)}
                                    >
                                      <X className="mr-1 h-3.5 w-3.5 text-rose-600" />
                                      Reject
                                    </Button>
                                  </>
                                ) : null}
                                {shouldShowOverdueActions ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 rounded-lg border-violet-200 bg-violet-50 px-2.5 text-xs font-bold text-violet-700 hover:bg-violet-100"
                                      onClick={() => openPaymentFor(item, String((item as any).patientId || ""), patientDisplayName)}
                                    >
                                      <DollarSign className="mr-1 h-3.5 w-3.5 text-violet-600" />
                                      Pay now
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 rounded-lg border-rose-200 bg-rose-50 px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                                      onClick={() => setRejectDialogAppointment(item)}
                                    >
                                      <X className="mr-1 h-3.5 w-3.5 text-rose-600" />
                                      Reject
                                    </Button>
                                  </>
                                ) : null}



                                {!isDeleted && !shouldShowApproveReject && !shouldShowOverdueActions && Math.max(0, Number(item.price || 0) - Number(item.discount || 0) - Number(item.totalPaid || 0)) > 0 ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg border-violet-200 bg-violet-50/50 px-2.5 text-xs font-bold text-violet-700 hover:bg-violet-100"
                                    onClick={() => openPaymentFor(item, String((item as any).patientId || ""), patientDisplayName)}
                                  >
                                    <DollarSign className="mr-1 h-3.5 w-3.5 text-violet-600" />
                                    Pay
                                  </Button>
                                ) : null}


                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg border-slate-200 px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                  onClick={() => handleViewAppointment(item)}
                                >
                                  <Eye className="mr-1 h-3.5 w-3.5 text-slate-500" />
                                  View
                                </Button>
                                <AppointmentActionsMenu
                                  actions={createVisitHistoryActions(
                                    {
                                      onViewDetails: () => handleViewAppointment(item),
                                      onApprove: isTBDOrReserved && !isDeleted ? () => setApproveDialogAppointment(item) : undefined,
                                      onReject: isTBDOrReserved && !isDeleted ? () => setRejectDialogAppointment(item) : undefined,
                                      onRecordPayment: !isDeleted && !shouldShowApproveReject && !shouldShowOverdueActions && Math.max(0, Number(item.price || 0) - Number(item.discount || 0) - Number(item.totalPaid || 0)) > 0 ? () => openPaymentFor(item, String((item as any).patientId || ""), patientDisplayName) : undefined,
                                      onReschedule: !isDeleted ? () => handleOpenScheduleModal(item) : undefined,
                                      onUpdateTreatment: !isDeleted ? () => setTreatmentCellAppointment(item) : undefined,
                                      onAssignDoctor: !isDeleted ? () => setDoctorCellAppointment(item) : undefined,
                                      onGoToPatient: showPatientColumn ? () => handleGoToPatient(item) : undefined,
                                    },
                                    {
                                      canApprove: isTBDOrReserved && !isDeleted,
                                      canReject: isTBDOrReserved && !isDeleted,
                                      canReschedule: !isDeleted,
                                      canUpdateTreatment: !isDeleted,
                                      canAssignDoctor: !isDeleted,
                                      isDoctorUnassigned: !item.doctor,
                                      canGoToPatient: true,
                                      isTBD: rawStatus === "tbd",
                                      isReserved: rawStatus === "reserved",
                                    }
                                  )}
                                  triggerVariant="outline"
                                  triggerSize="icon"
                                  triggerIcon={<MoreVertical className="h-4 w-4" />}
                                  triggerClassName="h-8 w-8 rounded-lg border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                />
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SelectTreatmentModal */}
      <SelectTreatmentModal
        open={Boolean(treatmentCellAppointment)}
        onOpenChange={(open) => { if (!open) setTreatmentCellAppointment(null); }}
        title="Change Treatment"
        description={treatmentCellAppointment ? `${getTreatmentDisplay(treatmentCellAppointment).labels.join(", ")} for ${getCurrentPatientName(treatmentCellAppointment)}` : undefined}
        treatments={activeTreatmentOptions}
        draft={appointmentToTreatmentDraft(treatmentCellAppointment, activeTreatmentOptions)}
        allowAddTreatment
        allowRemoveTreatment
        onSaveDraft={async (draft: TreatmentSelectionDraft) => {
          if (!treatmentCellAppointment) return;
          const duration = normalizeBookingDuration((treatmentCellAppointment as any).duration || 30);
          const payload = treatmentDraftToPayload(draft, activeTreatmentOptions, duration);
          await saveCellAppointment(treatmentCellAppointment, payload as Partial<Appointment>, "Treatment updated");
          setTreatmentCellAppointment(null);
        }}
        onCancel={() => setTreatmentCellAppointment(null)}
        saveLabel="Save Treatment"
      />

      {/* Modal Interceptors */}
      <AppointmentPatientChoiceDialog
        open={Boolean(patientChoiceAppointment)}
        onOpenChange={(open) => { if (!open) setPatientChoiceAppointment(null); }}
        patientName={patientChoiceAppointment ? getCurrentPatientName(patientChoiceAppointment) : ""}
        patientImage={patientChoiceAppointment ? resolveImageSource(getPatientImage(patientChoiceAppointment)) : undefined}
        patientDob={patientChoiceAppointment?.patientDateOfBirth || patientChoiceAppointment?.patientDob || patientChoiceAppointment?.patientBirthDate || patientChoiceAppointment?.patientBirthday}
        canSelectPatient={!isSoftDeletedAppointment(patientChoiceAppointment)}
        canOpenProfile={Boolean(
          patientChoiceAppointment &&
          (
            (patientChoiceAppointment as any).patientId ||
            (patientChoiceAppointment as any).patient?.id ||
            (getCurrentPatientName(patientChoiceAppointment) && getCurrentPatientName(patientChoiceAppointment) !== "No patient assigned")
          )
        )}
        onSelectPatient={() => {
          const appt = patientChoiceAppointment;
          setPatientChoiceAppointment(null);
          setPatientCellAppointment(appt);
        }}
        onOpenProfile={() => {
          if (!patientChoiceAppointment) return;
          const basePath = pathname.startsWith("/receptionist") ? "/receptionist" : "/admin";
          const displayName = getCurrentPatientName(patientChoiceAppointment);
          const pId = String((patientChoiceAppointment as any)?.patientId || (patientChoiceAppointment as any)?.patient?.id || "").trim();
          const target = (displayName && displayName !== "No patient assigned" ? displayName : "") || pId;
          setPatientChoiceAppointment(null);
          if (target) {
            router.push(`${basePath}/patients/${encodeURIComponent(target)}`);
          } else {
            toast.error("No patient profile found for this appointment.");
          }
        }}
      />

      <SelectPatientModal
        open={Boolean(patientCellAppointment)}
        onOpenChange={(open) => !open && setPatientCellAppointment(null)}
        selectedPatientId={String((patientCellAppointment as any)?.patientId || (patientCellAppointment as any)?.patient?.id || "")}
        selectedPatientName={patientCellAppointment ? getCurrentPatientName(patientCellAppointment) : ""}
        title="Change Patient"
        confirmLabel="Save Patient"
        onConfirm={async (patient: PatientSelectOption) => {
          if (!patientCellAppointment) return;
          await saveCellAppointment(patientCellAppointment, {
            patientId: patient.id,
            patientName: patient.name,
            patient: { ...(patientCellAppointment as any).patient, id: patient.id, name: patient.name },
          } as Partial<Appointment>, "Patient updated");
          setPatientCellAppointment(null);
        }}
      />

      <SelectScheduleModal
        open={Boolean(scheduleCellAppointment)}
        onOpenChange={(open) => !open && setScheduleCellAppointment(null)}
        title="Change Schedule"
        description={scheduleCellAppointment ? `${getTreatmentDisplay(scheduleCellAppointment).labels.join(", ")} for ${getCurrentPatientName(scheduleCellAppointment)}` : undefined}
        appointmentLabel={scheduleCellAppointment ? getTreatmentDisplay(scheduleCellAppointment).labels.join(", ") : undefined}
        doctorLabel={scheduleCellAppointment?.doctor || "No doctor assigned"}
        selectedDate={scheduleDate}
        selectedTime={scheduleTime}
        selectedDuration={scheduleDuration}
        onDurationChange={setScheduleDuration}
        status={scheduleStatus}
        statusOptions={APPOINTMENT_STATUSES}
        onStatusChange={setScheduleStatus}
        onDateClick={() => setIsScheduleDatePickerOpen(true)}
        onTimeClick={() => setIsScheduleTimePickerOpen(true)}
        onSave={async () => {
          if (!scheduleCellAppointment) return;
          const dateStr = scheduleDate ? formatDateToYYYYMMDD(scheduleDate) : "";
          await saveCellAppointment(scheduleCellAppointment, {
            date: dateStr,
            time: scheduleTime,
            duration: Number(scheduleDuration),
            status: scheduleStatus as any,
          } as Partial<Appointment>, "Schedule updated");
          setScheduleCellAppointment(null);
        }}
        onCancel={() => setScheduleCellAppointment(null)}
        canSave={Boolean(scheduleDate && scheduleTime.trim())}
        saveLabel="Save Schedule"
      />

      <DatePickerModal
        open={isScheduleDatePickerOpen}
        onOpenChange={setIsScheduleDatePickerOpen}
        selectedDate={scheduleDate}
        onDateSelect={(date) => {
          setScheduleDate(date ? (date instanceof Date ? date : new Date(date)) : null);
        }}
        doctorName={scheduleCellAppointment?.doctor || ""}
        patientId={String((scheduleCellAppointment as any)?.patientId || "")}
        selectedTime={scheduleTime}
        duration={scheduleDuration}
        dateSelectionMode="edit"
        excludeAppointmentId={String(scheduleCellAppointment?.id || "")}
      />

      {scheduleDate ? (
        <TimePickerModal
          open={isScheduleTimePickerOpen}
          onOpenChange={setIsScheduleTimePickerOpen}
          selectedDate={scheduleDate}
          selectedTime={scheduleTime}
          doctorName={scheduleCellAppointment?.doctor || ""}
          duration={scheduleDuration}
          onTimeSelect={setScheduleTime}
          onDateChange={(date) => setScheduleDate(date ? (date instanceof Date ? date : new Date(date)) : null)}
          excludeAppointmentId={String(scheduleCellAppointment?.id || "")}
          patientId={String((scheduleCellAppointment as any)?.patientId || "")}
          dateSelectionMode="edit"
        />
      ) : null}

      <SelectDoctorModal
        open={Boolean(doctorCellAppointment)}
        onOpenChange={(open) => !open && setDoctorCellAppointment(null)}
        title="Assign Doctor"
        description={doctorCellAppointment ? `${getTreatmentDisplay(doctorCellAppointment).labels.join(", ")} for ${getCurrentPatientName(doctorCellAppointment)}` : undefined}
        selectedValue={doctorCellAppointment?.doctor || ""}
        doctors={doctors.map((d: any) => ({ ...d, avatar: resolveImageSource(d.profilePicture || d.profilePictureUrl || "") }))}
        onSelect={async (doctor) => {
          if (!doctorCellAppointment) return;
          await saveCellAppointment(doctorCellAppointment, {
            doctor: doctor.name,
          } as Partial<Appointment>, "Doctor updated");
          setDoctorCellAppointment(null);
        }}
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
        isHistorical={appointmentSnapshotIsHistorical}
        showPreviousInputChanges={false}
      />

      <ApproveRejectDialog
        open={Boolean(approveDialogAppointment)}
        onOpenChange={(open) => !open && setApproveDialogAppointment(null)}
        mode="approve"
        appointment={approveDialogAppointment}
        isProcessing={isProcessingApproveReject}
        onConfirm={handleApproveConfirm}
      />

      <ApproveRejectDialog
        open={Boolean(rejectDialogAppointment)}
        onOpenChange={(open) => !open && setRejectDialogAppointment(null)}
        mode="reject"
        appointment={rejectDialogAppointment}
        isProcessing={isProcessingApproveReject}
        onConfirm={handleRejectConfirm}
      />
    </div>
  );
}

export default TreatmentHistoryView;
