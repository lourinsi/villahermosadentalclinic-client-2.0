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
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import PatientAvatar from "./PatientAvatar";
import {
  Clock,
  CheckCircle,
  Eye,
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
  Loader2,
} from "lucide-react";
import { Appointment } from "../hooks/useAppointments";
import { getAppointmentTypeName } from "../lib/appointment-types";
import { formatAppointmentStatusLabel, isCartAppointmentStatus, normalizeAppointmentStatus } from "@/lib/appointment-status";
import { formatTimeTo12h } from "@/lib/time-slots";
import { formatWordyDate, parseBackendDateToLocal } from "../lib/utils";
import { Input } from "./ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { AppointmentActionsMenu, createRequestsOverflowActions } from "./AppointmentActionsMenu";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { getAuthHeaders } from "@/lib/auth-headers";
import {
  DEFAULT_APPOINTMENT_STATUS_OPTIONS,
  getAppointmentStatusOptionWithColors,
  getPaymentStatusOptionWithColors,
  normalizePaymentStatus,
} from "@/lib/status-colors";
import { getAppointmentPatientDisplayName } from "@/lib/patient-identity";
import { useDoctors } from "@/hooks/useDoctors";
import { useAppointmentTypeOptions } from "@/hooks/useAppointmentTypeOptions";
import { formatDateToYYYYMMDD } from "@/lib/utils";
import { OTHER_APPOINTMENT_TYPE_INDEX } from "@/lib/appointment-types";
import { SelectPatientModal, type PatientSelectOption } from "./SelectPatientModal";
import { SelectScheduleModal } from "./SelectScheduleModal";
import { SelectTreatmentModal, type SelectTreatmentModalSection } from "./SelectTreatmentModal";
import { SelectDoctorModal } from "./SelectDoctorModal";
import { DatePickerModal } from "./DatePickerModal";
import { TimePickerModal } from "./TimePickerModal";
import { SetAppointmentPriceModal } from "./SetAppointmentPriceModal";
import { ToothNumbersEditor } from "./ToothNumbersEditor";
import AppointmentPatientChoiceDialog from "./AppointmentPatientChoiceDialog";
import {
  getBookingToothNumberEntries,
  getBookingToothNumbersValue,
  getBookingTreatmentsValue,
  getBookingTreatmentDisplay,
  buildBookingTreatmentsPayload,
  normalizeBookingDuration,
  normalizeBookingToothNumbers,
  appointmentToTreatmentDraft,
  treatmentDraftToPayload,
} from "./sharedBookingLogic";
import type { TreatmentSelectionDraft } from "./universalSelectModalDrafts";

interface HistoryViewProps {
  doctorFilter?: string;
}

const HISTORY_PER_PAGE = 10;

const getTreatmentDisplay = (appointment: any) =>
  getBookingTreatmentDisplay(appointment, getAppointmentTypeName);

const TreatmentCellContent = ({ appointment, compact = false }: { appointment: any; compact?: boolean }) => {
  const { labels, toothDetail } = getTreatmentDisplay(appointment);

  return (
    <div className="min-w-0 space-y-0.5 text-left">
      {labels.map((label, index) => (
        <span key={`${label}-${index}`} className={index === 0 ? "block font-semibold leading-snug text-gray-900" : "block text-xs font-medium leading-snug text-slate-600"}>
          {label}
        </span>
      ))}
      {toothDetail ? <span className={compact ? "block text-xs font-medium leading-snug text-violet-600" : "block text-xs font-medium leading-snug text-slate-500"}>{toothDetail}</span> : null}
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

export function HistoryView({ doctorFilter }: HistoryViewProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
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
  const { openPaymentFor } = usePaymentModal();
  const { doctors, isLoadingDoctors, reloadDoctors } = useDoctors();
  const { options: treatmentOptions } = useAppointmentTypeOptions();
  const canManagePaymentStatuses = effectiveRole === "admin";
  const hideAuditColumns = effectiveRole === "receptionist";
  const [history, setHistory] = useState<Appointment[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
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
  } = useNotificationAppointmentSnapshot([...appointments, ...history]);

  const handleOpenSnapshotAppointment = async (appointmentId: string, appointmentSnapshotToOpen?: Appointment) => {
    const appointment = [...appointments, ...history].find((item: Appointment) => String(item.id) === String(appointmentId));
    setIsAppointmentHistoryOpen(false);
    resetAppointmentSnapshot();
    const snapshotMatchesAppointment = appointmentSnapshotToOpen?.id && String(appointmentSnapshotToOpen.id) === String(appointmentId);
    const appointmentToOpen = snapshotMatchesAppointment
      ? { ...(appointment || {}), ...appointmentSnapshotToOpen, status: normalizeAppointmentStatus(appointmentSnapshotToOpen.status) }
      : appointment;

    if (appointmentToOpen) {
      openEditModal(appointmentToOpen);
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

  const canonicalStatus = (s?: string) => normalizeAppointmentStatus(s);
  const canonicalPaymentStatus = (s?: string) => normalizePaymentStatus(s);
  const isPatientCartStatus = (status?: string) => isCartAppointmentStatus(status);

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
  const isSoftDeletedAppointment = (appointment?: Partial<Appointment> | null) =>
    Boolean(appointment?.deleted) || canonicalStatus(appointment?.status) === "deleted";
  const getAppointmentStatusForDisplay = (appointment: Appointment) => {
    const normalizedStatus = normalizeAppointmentStatus(appointment.status);
    return appointment.deleted || normalizedStatus === "deleted" ? "deleted" : normalizedStatus;
  };
  const buildStatusLifecycleUpdate = (appointment: Appointment | undefined, newStatus: string): Partial<Appointment> => {
    const normalizedStatus = canonicalStatus(newStatus);

    if (normalizedStatus === "deleted") {
      return {
        status: "deleted",
        deleted: false,
        deletedAt: appointment?.deletedAt || new Date().toISOString(),
      } as Partial<Appointment>;
    }

    if (isSoftDeletedAppointment(appointment)) {
      return {
        status: "cancelled",
        deleted: false,
      } as Partial<Appointment>;
    }

    return { status: newStatus as Appointment["status"] };
  };

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

  const isHistoryStatus = (status?: string) => {
    const k = canonicalStatus(status);
    return k === "scheduled" || k === "completed" || k === "cancelled" || (canSeeDeletedAppointments && k === "deleted");
  };

  const isPendingRequestStatus = (status?: string) => {
    const k = canonicalStatus(status);
    return isActionableStatus(k);
  };

  // History filters state
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [historyDoctorFilter, setHistoryDoctorFilter] = useState("all");
  const [historySortColumn, setHistorySortColumn] = useState<string | null>(null);
  const [historySortDirection, setHistorySortDirection] = useState<"asc" | "desc">("asc");

  // Cell edit state
  const [patientChoiceAppointment, setPatientChoiceAppointment] = useState<Appointment | null>(null);
  const [patientCellAppointment, setPatientCellAppointment] = useState<Appointment | null>(null);
  const [scheduleCellAppointment, setScheduleCellAppointment] = useState<Appointment | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleDuration, setScheduleDuration] = useState("30");
  const [isScheduleDatePickerOpen, setIsScheduleDatePickerOpen] = useState(false);
  const [isScheduleTimePickerOpen, setIsScheduleTimePickerOpen] = useState(false);
  const [treatmentCellAppointment, setTreatmentCellAppointment] = useState<Appointment | null>(null);
  const [treatmentSections, setTreatmentSections] = useState<SelectTreatmentModalSection[] | null>(null);
  const [treatmentToothNumberEntries, setTreatmentToothNumberEntries] = useState<string[]>([""]);
  const [isSavingTreatmentChange, setIsSavingTreatmentChange] = useState(false);
  const [doctorCellAppointment, setDoctorCellAppointment] = useState<Appointment | null>(null);
  const [setPriceAppointment, setSetPriceAppointment] = useState<Appointment | null>(null);
  const [editingToothNumberAptId, setEditingToothNumberAptId] = useState<string | null>(null);
  const [editingToothNumberValue, setEditingToothNumberValue] = useState<string>("");

  const handleSaveToothNumbers = async (appointment: Appointment, newToothNumbers: string) => {
    const appointmentId = String(appointment.id || "");
    if (!appointmentId) return;
    try {
      const patch = {
        toothNumbers: newToothNumbers,
        toothNumber: newToothNumbers,
      };
      const updated = await updateAppointment(appointmentId, patch);
      setHistory((prev) => prev.map((h) => String(h.id) === appointmentId ? { ...h, ...updated, ...patch } : h));
      refreshAppointments();
      toast.success("Tooth numbers updated");
    } catch (err) {
      console.error("Failed to update tooth numbers:", err);
      toast.error("Failed to update tooth numbers");
    }
  };

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

  const renderOverflowMenu = (item: Appointment, triggerClassName?: string) => {
    const isDeleted = isSoftDeletedAppointment(item);
    const canPay = canPromptPayment(item);
    const displayName = getCurrentPatientName(item);
    const patientTarget = (displayName && displayName !== "No patient assigned" ? displayName : "") || item.patientId || "";

    return (
      <AppointmentActionsMenu
        actions={createRequestsOverflowActions(
          {
            onViewDetails: () => handleViewAppointment(item),
            onViewHistory: () => handleViewAppointment(item),
            onPayNow: canPay && !isDeleted ? () => handleOpenPayment(item) : undefined,
            onChangeTreatment: !isDeleted ? () => openTreatmentCell(item) : undefined,
            onChangeDoctor: !isDeleted ? () => setDoctorCellAppointment(item) : undefined,
            onReschedule: !isDeleted ? () => openScheduleCell(item) : undefined,
            onGoToPatient: patientTarget ? () => {
              const basePath = pathname.startsWith("/receptionist") ? "/receptionist" : "/admin";
              router.push(`${basePath}/patients/${encodeURIComponent(patientTarget)}`);
            } : undefined,
          },
          {
            canApprove: false,
            canReject: false,
            canPayNow: canPay && !isDeleted,
            canChangeTreatment: !isDeleted,
            canChangeDoctor: !isDeleted,
            canReschedule: !isDeleted,
            isDoctorUnassigned: !item.doctor,
            rejectLabel: "Reject",
            approveLabel: "Approve",
            canGoToPatient: Boolean(patientTarget),
          }
        )}
        triggerVariant="ghost"
        triggerSize="icon"
        triggerClassName={triggerClassName || "h-8 w-8 text-slate-400 hover:text-slate-900"}
        triggerIcon={<MoreVertical className="h-4 w-4" />}
        ariaLabel="Appointment actions"
      />
    );
  };

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
          aVal = getTreatmentDisplay(a).labels.join(" ").toLowerCase();
          bVal = getTreatmentDisplay(b).labels.join(" ").toLowerCase();
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
        status: getAppointmentStatusForDisplay(appointment),
      }));
      const serverReturnedPage = Boolean(result.meta);
      const clientFilteredData = data.filter((appointment: Appointment) => {
        const appointmentIsDeleted = isSoftDeletedAppointment(appointment);
        if (
          isPatientCartStatus(appointment.status) ||
          (!isHistoryStatus(appointment.status) && !(canSeeDeletedAppointments && appointmentIsDeleted))
        ) {
          return false;
        }

        if (doctorFilter && (appointment.doctor || "").toLowerCase() !== doctorFilter.toLowerCase()) {
          return false;
        }

        if (
          search &&
          !getCurrentPatientName(appointment).toLowerCase().includes(search.toLowerCase()) &&
          !getTreatmentDisplay(appointment).labels.join(" ").toLowerCase().includes(search.toLowerCase()) &&
          !getTreatmentDisplay(appointment).toothDetail.toLowerCase().includes(search.toLowerCase())
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
    const controller = new AbortController();
    fetchHistory(historyCurrentPage, controller.signal);
    return () => controller.abort();
  }, [fetchHistory, historyCurrentPage, historyRefreshKey, refreshTrigger]);

  const refreshHistory = useCallback(() => {
    setHistoryRefreshKey((key) => key + 1);
  }, []);

  const mergeAppointmentIntoHistory = useCallback((updatedAppointment: Appointment) => {
    const normalized = {
      ...updatedAppointment,
      status: normalizeAppointmentStatus(updatedAppointment.status),
    };
    setHistory((prev) =>
      prev.map((item) =>
        String(item.id) === String(normalized.id) ? { ...item, ...normalized } : item
      )
    );
    return normalized;
  }, []);

  const publishAppointmentUpdate = useCallback((updatedAppointment: Appointment) => {
    const normalized = mergeAppointmentIntoHistory(updatedAppointment);
    try {
      window.dispatchEvent(new CustomEvent("appointments:updated", {
        detail: {
          appointment: normalized,
          appointmentId: normalized.id,
          newStatus: normalized.status,
        },
      }));
    } catch {}
    return normalized;
  }, [mergeAppointmentIntoHistory]);

  const saveCellAppointment = async (appointment: Appointment, patch: Partial<Appointment>, message: string) => {
    try {
      const updated = await updateAppointment(appointment.id, patch);
      publishAppointmentUpdate(updated);
      refreshHistory();
      toast.success(message);
    } catch (error) {
      console.error("[HistoryView] Failed to update appointment cell:", error);
      toast.error("Unable to update appointment. Please try again.");
      throw error;
    }
  };

  const openScheduleCell = (appointment: Appointment) => {
    if (isSoftDeletedAppointment(appointment)) return;
    const date = parseBackendDateToLocal(appointment.date);
    setScheduleCellAppointment(appointment);
    setScheduleDate(Number.isNaN(date.getTime()) ? new Date() : date);
    setScheduleTime(String(appointment.time || ""));
    setScheduleDuration(String(appointment.duration || 30));
  };

  const openTreatmentCell = (appointment: Appointment) => {
    if (isSoftDeletedAppointment(appointment)) return;
    const type = Number(appointment.type);
    const resolvedType = Number.isInteger(type) ? type : OTHER_APPOINTMENT_TYPE_INDEX;
    const resolvedCustomType = String(appointment.customType || "");
    const resolvedPrice = String(Number(appointment.price || 0));
    const toothEntries = getBookingToothNumberEntries(getBookingToothNumbersValue(appointment as any));

    const rawTreatments = getBookingTreatmentsValue(appointment as any);
    const hasTreatmentSections = rawTreatments.length > 0;
    const nextSections: SelectTreatmentModalSection[] = hasTreatmentSections
      ? rawTreatments.map((t: any, index: number) => ({
          selectedTreatmentId: Number.isInteger(Number(t.type)) ? Number(t.type) : OTHER_APPOINTMENT_TYPE_INDEX,
          currentTreatmentLabel: index === 0 ? getAppointmentTypeName(appointment.type, appointment.customType) : String(t.customType || getAppointmentTypeName(t.type, t.customType) || ""),
          customTreatmentName: String(t.customType || ""),
          selectedPrice: String(Number(t.price ?? appointment.price ?? 0)),
        }))
      : [{
          selectedTreatmentId: resolvedType,
          currentTreatmentLabel: getAppointmentTypeName(appointment.type, appointment.customType),
          customTreatmentName: resolvedCustomType,
          selectedPrice: resolvedPrice,
        }];

    setTreatmentCellAppointment(appointment);
    setTreatmentSections(nextSections);
    setTreatmentToothNumberEntries(toothEntries || [""]);
  };

  const editableCellClass = "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/70 focus-visible:border-violet-300 focus-visible:bg-violet-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60";

  useEffect(() => {
    const handleAppointmentsUpdated = (event: Event) => {
      const updatedAppointment = (event as CustomEvent<{ appointment?: Appointment }>).detail?.appointment;
      if (updatedAppointment?.id) {
        mergeAppointmentIntoHistory(updatedAppointment);
      }
      refreshHistory();
    };
    window.addEventListener("appointments:updated", handleAppointmentsUpdated as EventListener);
    return () => {
      window.removeEventListener("appointments:updated", handleAppointmentsUpdated as EventListener);
    };
  }, [mergeAppointmentIntoHistory, refreshHistory]);

  const handleOpenPayment = async (appointment: Appointment) => {
    try {
      openPaymentFor(
        appointment,
        String((appointment as any).patientId || (appointment as any).patient?.id || "") || null,
        getCurrentPatientName(appointment)
      );
    } catch (error) {
      console.error("Error opening payment modal:", error);
      toast.error("Unable to open payment editor. Please try again.");
    }
  };

  const handleHistoryStatusChange = async (appointmentId: string, newStatus: string) => {
    if (isPatientCartStatus(newStatus)) {
      toast.error("Add to Cart is reserved for patient carts.");
      return;
    }

    try {
      const appointment = [...history, ...appointments].find(
        (item) => String(item.id) === String(appointmentId)
      );
      const updatedAppointment = await updateAppointment(
        appointmentId,
        buildStatusLifecycleUpdate(appointment, newStatus)
      );
      publishAppointmentUpdate(updatedAppointment);
      toast.success(`Status updated to ${updatedAppointment.status}`);
      refreshHistory();
      setTimeout(() => {
        window.dispatchEvent(new Event("refreshNotifications"));
      }, 500);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleHistoryPaymentStatusChange = async (appointmentId: string, newPaymentStatus: string) => {
    try {
      await updateAppointment(appointmentId, { paymentStatus: newPaymentStatus as any });
      toast.success(`Payment status updated successfully`);
      refreshHistory();
      setTimeout(() => {
        window.dispatchEvent(new Event("refreshNotifications"));
      }, 500);
    } catch {
      toast.error("Failed to update payment status");
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

  const handleHistorySort = (column: string) => {
    setHistoryCurrentPage(1);
    if (historySortColumn === column) {
      setHistorySortDirection(historySortDirection === "asc" ? "desc" : "asc");
    } else {
      setHistorySortColumn(column);
      setHistorySortDirection("asc");
    }
  };

  const getSortIcon = (column: string) => {
    if (historySortColumn === column) {
      return historySortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
    }
    return <ArrowUpDown className="h-4 w-4 opacity-40" />;
  };

  const sortedHistory = history;

  const historyDoctorOptions = useMemo(() => {
    return Array.from(new Set([...appointments, ...history].map((a) => a.doctor).filter(Boolean))).sort();
  }, [appointments, history]);

  const completedHistoryCount = sortedHistory.filter((item) => canonicalStatus(item.status) === "completed").length;
  const paidHistoryCount = sortedHistory.filter((item) => canonicalPaymentStatus(item.paymentStatus) === "paid").length;
  const unpaidHistoryCount = sortedHistory.filter((item) => canonicalPaymentStatus(item.paymentStatus) !== "paid").length;

  const activeDropdownItemClass = (isActive: boolean) =>
    isActive ? "bg-violet-600 text-white focus:bg-violet-600 focus:text-white [&_svg]:text-white" : "";

  const formatAuditDate = (value?: string) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const formatAuditTime = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };
  const formatPaymentCurrency = (value?: number | string | null) =>
    `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const getAppointmentIdLabel = (appointment: Appointment) => `ID: ${appointment.id || "N/A"}`;

  return (
    <div data-tour-id="treatment-history-page" className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-gray-900 md:uppercase md:italic">
            Treatment History
          </h1>
          <p className="mt-1 text-lg font-medium text-gray-500 md:text-base">Completed appointments and history records</p>
        </div>
        {(effectiveRole === "admin" || effectiveRole === "doctor" || effectiveRole === "receptionist") && (
          <Button
            type="button"
            onClick={() => openCreateModal()}
            className="h-14 shrink-0 gap-2 rounded-2xl bg-violet-600 px-4 font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700 sm:px-5"
          >
            <Plus className="h-5 w-5" />
            <span className="hidden min-[420px]:inline">New Appointment</span>
          </Button>
        )}
      </div>

      <Card className="overflow-hidden border-none bg-transparent shadow-none md:rounded-[1.35rem] md:border md:border-gray-100 md:bg-white/90 md:shadow-xl md:shadow-gray-200/50 md:backdrop-blur-xl">
        <CardHeader className="space-y-5 border-0 bg-transparent p-0 md:border-b md:border-gray-100 md:bg-white md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-center gap-4 rounded-3xl border border-violet-50 bg-white p-5 shadow-lg shadow-gray-200/50 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.7rem] bg-violet-50 text-violet-600 md:h-16 md:w-16">
                <History className="h-9 w-9 md:h-7 md:w-7" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-2xl font-black tracking-tight text-gray-900 md:text-xl">Recent Activity</CardTitle>
                <p className="mt-1 text-base font-medium text-gray-500 md:text-sm">History of processed appointments</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:min-w-[620px]">
              {[
                { label: "Total History", value: historyTotal, icon: History, accent: "text-violet-600", bg: "bg-violet-50" },
                { label: "Completed", value: completedHistoryCount, icon: CheckCircle, accent: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Paid", value: paidHistoryCount, icon: DollarSign, accent: "text-blue-600", bg: "bg-blue-50" },
                { label: "Unpaid", value: unpaidHistoryCount, icon: Clock, accent: "text-amber-600", bg: "bg-amber-50" },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-3xl border border-gray-100 bg-white p-4 shadow-md shadow-gray-200/40 md:rounded-2xl md:shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${stat.bg} ${stat.accent} md:h-11 md:w-11 md:rounded-xl`}>
                        <Icon className="h-6 w-6 md:h-5 md:w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-black leading-none text-gray-900">{stat.value}</p>
                        <p className={`mt-1 text-sm font-bold leading-tight ${stat.accent}`}>{stat.label}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full items-center gap-2 lg:max-w-[32rem]">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search patient or service..."
                  className="h-14 w-full rounded-3xl border-gray-100 bg-white pl-12 text-base shadow-md shadow-gray-200/40 md:h-12 md:rounded-2xl md:bg-gray-50 md:text-sm md:shadow-sm"
                  value={historySearchTerm}
                  onChange={(e) => {
                    setHistorySearchTerm(e.target.value);
                    setHistoryCurrentPage(1);
                  }}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hidden rounded-xl border border-gray-100 sm:hidden" title="More filters">
                    <MoreVertical className="h-4 w-4 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    className={activeDropdownItemClass(historyStatusFilter === "all")}
                    onSelect={() => { setHistoryStatusFilter("all"); setHistoryCurrentPage(1); }}
                  >
                    All Status
                  </DropdownMenuItem>
                  {staffVisibleStatusOptions.filter((s: any) => isHistoryStatus(s.value)).map((status: any) => (
                    <DropdownMenuItem
                      key={status.value}
                      className={activeDropdownItemClass(canonicalStatus(historyStatusFilter) === canonicalStatus(status.value))}
                      onSelect={() => { setHistoryStatusFilter(status.value); setHistoryCurrentPage(1); }}
                    >
                      Status: {status.label}
                    </DropdownMenuItem>
                  ))}
                  {!doctorFilter && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className={activeDropdownItemClass(historyDoctorFilter === "all")}
                        onSelect={() => { setHistoryDoctorFilter("all"); setHistoryCurrentPage(1); }}
                      >
                        All Doctors
                      </DropdownMenuItem>
                      {historyDoctorOptions.map((doc: any) => (
                        <DropdownMenuItem
                          key={doc}
                          className={activeDropdownItemClass(historyDoctorFilter === doc)}
                          onSelect={() => { setHistoryDoctorFilter(doc); setHistoryCurrentPage(1); }}
                        >
                          Dr. {doc}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => {
                    setHistorySearchTerm("");
                    setHistoryStatusFilter("all");
                    setHistoryDateFilter("");
                    setHistoryDoctorFilter("all");
                    setHistoryCurrentPage(1);
                  }}>
                    Reset filters
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
              <div className="min-w-0 flex-1 sm:flex-none">
                <Select
                  value={historyStatusFilter}
                  onValueChange={(value) => { setHistoryStatusFilter(value); setHistoryCurrentPage(1); }}
                >
                  <SelectTrigger className="h-14 w-full rounded-3xl border-gray-100 bg-white text-base shadow-md shadow-gray-200/40 sm:w-[180px] md:h-12 md:rounded-2xl md:bg-gray-50 md:text-sm md:shadow-sm">
                    <div className="flex items-center gap-2">
                      <Filter className="h-5 w-5 text-gray-400 md:h-4 md:w-4" />
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
              </div>

              {!doctorFilter && (
                <div className="min-w-0 flex-1 sm:flex-none">
                  <Select
                    value={historyDoctorFilter}
                    onValueChange={(value) => { setHistoryDoctorFilter(value); setHistoryCurrentPage(1); }}
                  >
                    <SelectTrigger className="h-14 w-full rounded-3xl border-gray-100 bg-white text-base shadow-md shadow-gray-200/40 sm:w-[180px] md:h-12 md:rounded-2xl md:bg-gray-50 md:text-sm md:shadow-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-gray-400 md:h-4 md:w-4" />
                        <SelectValue placeholder="All Doctors" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Doctors</SelectItem>
                      {historyDoctorOptions.map((doc: any) => (
                        <SelectItem key={doc} value={doc}>{doc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button variant="ghost" size="icon" className="inline-flex h-14 w-14 shrink-0 rounded-3xl border border-gray-100 bg-white shadow-md shadow-gray-200/40 md:h-12 md:w-12 md:rounded-2xl md:bg-transparent md:shadow-none" onClick={() => {
                setHistorySearchTerm("");
                setHistoryStatusFilter("all");
                setHistoryDateFilter("");
                setHistoryDoctorFilter("all");
                setHistoryCurrentPage(1);
              }}>
                <RotateCcw className="h-5 w-5 text-gray-500" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile cards */}
          <div className="space-y-4 p-4 md:hidden">
            {isHistoryLoading ? (
              <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center text-sm font-semibold text-gray-500 shadow-sm">
                Loading history...
              </div>
            ) : sortedHistory.length === 0 ? (
              <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
                  <History className="h-7 w-7 text-gray-300" />
                </div>
                <h3 className="text-lg font-black text-gray-900">No History Found</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-gray-500">No appointment history matches your filters.</p>
              </div>
            ) : (
              sortedHistory.map((item) => {
                const patientName = getCurrentPatientName(item);
                return (
                  <div key={item.id} className="rounded-[1.75rem] border border-gray-100 bg-white p-4 shadow-xl shadow-gray-200/50">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setPatientChoiceAppointment(item)}
                        disabled={isSoftDeletedAppointment(item)}
                        aria-label={`Patient options for ${patientName}`}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="relative shrink-0">
                          <PatientAvatar
                            src={resolveImageSource(getPatientImage(item))}
                            name={patientName}
                            dob={item.patientDateOfBirth || item.patientDob || item.patientBirthDate || item.patientBirthday}
                            className="h-16 w-16 border-2 border-white shadow-sm"
                            sizeClass="h-16 w-16"
                          />
                          <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-violet-500 text-white shadow-sm">
                            <History className="h-4 w-4" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-lg font-black leading-tight text-gray-900">{patientName}</h3>
                          <p className="mt-1 text-sm font-medium text-gray-500">{getAppointmentIdLabel(item)}</p>
                        </div>
                      </button>
                      {renderOverflowMenu(item, "h-9 w-9 rounded-full text-gray-500 hover:bg-slate-100")}
                    </div>

                    <div className="mt-4 grid grid-cols-2 border-y border-gray-100 py-4">
                      <div className="flex gap-3 border-r border-gray-100 pr-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                          <CalendarIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-gray-900">{formatWordyDate(item.date, { fallback: item.date || "N/A" })}</p>
                          <p className="mt-1 text-sm font-medium text-gray-500">{formatTimeTo12h(item.time)}</p>
                        </div>
                      </div>
                      <div className="flex gap-3 pl-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                          <ClipboardList className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <TreatmentCellContent appointment={item} compact />
                          <p className="mt-1 truncate text-sm font-medium text-gray-500">{item.doctor || "Unassigned"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="h-3 w-3 shrink-0 rounded-full bg-violet-500" />
                        <span className="truncate text-base font-semibold text-gray-900">{item.doctor || "Unassigned"}</span>
                      </div>
                      <Select value={item.status} onValueChange={(newStatus) => handleHistoryStatusChange(item.id, newStatus)}>
                        <SelectTrigger className="h-auto w-auto border-0 bg-transparent p-0 shadow-none hover:opacity-80 [&>svg]:ml-2 [&>svg]:text-gray-400">
                          {getStatusBadge(item.status)}
                        </SelectTrigger>
                        <SelectContent>
                          {staffVisibleStatusOptions.filter((s: any) => isPendingRequestStatus(s.value) || isHistoryStatus(s.value)).map((status: any) => (
                            <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-3 border-b border-gray-100 py-3">
                      {canManagePaymentStatuses ? (
                        <Select value={item.paymentStatus || "unpaid"} onValueChange={(v) => handleHistoryPaymentStatusChange(item.id, v)}>
                          <SelectTrigger className="h-auto w-auto border-0 bg-transparent p-0 shadow-none hover:opacity-80 [&>svg]:ml-2 [&>svg]:text-gray-400">
                            {getPaymentStatusBadge(item.paymentStatus)}
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
                      <span className="text-sm font-medium text-gray-500">Payment Status</span>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 py-3 text-center">
                      <div className="px-2 cursor-pointer hover:bg-violet-50/60 rounded-lg transition-colors" onClick={() => setSetPriceAppointment(item)} title="Click to set new price total">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Total</p>
                        {Number(item.discount) > 0 && (
                          <span className="block text-[10px] font-normal text-gray-400 line-through decoration-rose-400">
                            {formatPaymentCurrency(item.price || 0)}
                          </span>
                        )}
                        <p className="mt-0.5 text-sm font-bold text-gray-900">
                          {formatPaymentCurrency(Math.max(0, Number(item.price || 0) - Number(item.discount || 0)))}
                        </p>
                      </div>
                      <div className="px-2 cursor-pointer hover:bg-emerald-50/60 rounded-lg transition-colors" onClick={() => handleOpenPayment(item)} title="Click to record payment">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Paid</p>
                        <p className="mt-1 text-sm font-bold text-emerald-700">{formatPaymentCurrency(item.totalPaid || 0)}</p>
                      </div>
                      <div className="px-2 cursor-pointer hover:bg-amber-50/60 rounded-lg transition-colors" onClick={() => handleOpenPayment(item)} title="Click to record payment">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Balance</p>
                        <p className={`mt-1 text-sm font-bold ${Math.max(0, Number(item.balance ?? Number(item.price || 0) - Number(item.totalPaid || 0))) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                          {formatPaymentCurrency(Math.max(0, Number(item.balance ?? Number(item.price || 0) - Number(item.totalPaid || 0))))}
                        </p>
                      </div>
                    </div>

                    {!hideAuditColumns ? (
                      <div className="grid grid-cols-2 border-b border-gray-100 py-4">
                        <div className="flex gap-3 border-r border-gray-100 pr-3">
                          <CalendarCheck2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                          <div>
                            <p className="text-sm font-semibold text-gray-500">Booked</p>
                            <p className="mt-1 text-sm font-medium text-gray-600">{formatAuditDate(item.createdAt)} {formatAuditTime(item.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex gap-3 pl-4">
                          <Clock className="mt-0.5 h-6 w-6 shrink-0 text-blue-600" />
                          <div>
                            <p className="text-sm font-semibold text-gray-500">Last Updated</p>
                            <p className="mt-1 text-sm font-medium text-gray-600">{formatAuditDate(item.updatedAt || item.createdAt)} {formatAuditTime(item.updatedAt || item.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className={`mt-4 grid ${canPromptPayment(item) ? "grid-cols-2" : "grid-cols-1"} divide-x divide-gray-100 rounded-3xl border border-gray-100 bg-white py-3 text-center shadow-sm`}>
                      {canPromptPayment(item) ? (
                        <button type="button" onClick={() => handleOpenPayment(item)} className="flex flex-col items-center gap-1.5 rounded-2xl py-1 text-sm font-black text-gray-900">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600">
                            <DollarSign className="h-6 w-6" />
                          </span>
                          Pay
                        </button>
                      ) : null}
                      <button type="button" onClick={() => handleViewAppointment(item)} className="flex flex-col items-center gap-1.5 rounded-2xl py-1 text-sm font-black text-gray-900">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-100 bg-violet-50 text-violet-600">
                          <Eye className="h-6 w-6" />
                        </span>
                        View
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-[1180px] table-fixed">
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-100">
                  <TableHead className="w-[12%] py-5 font-bold text-gray-900 cursor-pointer" onClick={() => handleHistorySort("date")}>
                    <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                      Date &amp; Time {getSortIcon("date")}
                    </div>
                  </TableHead>
                  <TableHead className="w-[14%] font-bold text-gray-900 cursor-pointer" onClick={() => handleHistorySort("patient")}>
                    <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                      Patient {getSortIcon("patient")}
                    </div>
                  </TableHead>
                  <TableHead className="w-[13%] font-bold text-gray-900 cursor-pointer" onClick={() => handleHistorySort("service")}>
                    <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                      Treatment {getSortIcon("service")}
                    </div>
                  </TableHead>
                  <TableHead className="w-[11%] font-bold text-gray-900">
                    <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                      Tooth No.
                    </div>
                  </TableHead>
                  <TableHead className="w-[11%] font-bold text-gray-900 cursor-pointer" onClick={() => handleHistorySort("doctor")}>
                    <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                      Doctor {getSortIcon("doctor")}
                    </div>
                  </TableHead>
                  <TableHead className="w-[9%] font-bold text-gray-900 cursor-pointer" onClick={() => handleHistorySort("status")}>
                    <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                      Status {getSortIcon("status")}
                    </div>
                  </TableHead>
                  <TableHead className="w-[7%] font-bold text-gray-900">Total</TableHead>
                  <TableHead className="w-[7%] font-bold text-gray-900">Paid</TableHead>
                  <TableHead className="w-[7%] font-bold text-gray-900">Balance</TableHead>
                  <TableHead className="w-[9%] text-center uppercase text-[11px] tracking-wider font-bold text-gray-900">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isHistoryLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-gray-500 font-medium">
                      Loading history...
                    </TableCell>
                  </TableRow>
                ) : sortedHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-64 text-center">
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
                      <TableRow key={item.id} className="border-b border-gray-100 hover:bg-violet-50/30 transition-colors">
                        <TableCell className="whitespace-normal">
                          <button type="button" onClick={() => openScheduleCell(item)} disabled={isSoftDeletedAppointment(item)} aria-label={`Edit schedule for ${patientName}`} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/70">
                            <CalendarIcon className="h-5 w-5 shrink-0 text-violet-600" />
                            <div className="min-w-0">
                              <span className="font-bold text-gray-900">{formatWordyDate(item.date, { fallback: item.date || "N/A" })}</span>
                              <span className="block text-xs font-medium text-gray-500">{formatTimeTo12h(item.time)}</span>
                            </div>
                          </button>
                        </TableCell>
                        <TableCell className="py-5 pr-3 whitespace-normal">
                          <button
                            type="button"
                            onClick={() => setPatientChoiceAppointment(item)}
                            disabled={isSoftDeletedAppointment(item)}
                            aria-label={`Patient options for ${patientName}`}
                            className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/70"
                          >
                            <PatientAvatar src={resolveImageSource(getPatientImage(item))} name={patientName} dob={item.patientDateOfBirth || item.patientDob || item.patientBirthDate || item.patientBirthday} className="h-12 w-12 border-2 border-white shadow-sm" sizeClass="h-12 w-12" />
                            <div className="min-w-0">
                              <div className="truncate font-bold text-gray-900">{patientName}</div>
                              <div className="mt-1 truncate text-xs font-medium text-gray-500">{getAppointmentIdLabel(item)}</div>
                            </div>
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <button type="button" onClick={() => openTreatmentCell(item)} disabled={isSoftDeletedAppointment(item)} aria-label={`Edit treatment for ${patientName}`} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/70">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                              <ClipboardList className="h-5 w-5" />
                            </div>
                            <TreatmentCellContent appointment={item} />
                          </button>
                        </TableCell>
                        <TableCell className="max-w-[160px] whitespace-normal">
                          {editingToothNumberAptId === String(item.id) && !isSoftDeletedAppointment(item) ? (
                            <div className="space-y-2 p-1.5 bg-violet-50/80 rounded-lg border border-violet-200" onClick={(e) => e.stopPropagation()}>
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
                                if (!isSoftDeletedAppointment(item)) {
                                  setEditingToothNumberAptId(String(item.id));
                                  setEditingToothNumberValue(getBookingToothNumbersValue(item) || "");
                                }
                              }}
                              disabled={isSoftDeletedAppointment(item)}
                              aria-label={`Edit tooth numbers for ${patientName}`}
                              className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/70"
                            >
                              <span className="truncate font-semibold text-gray-900">
                                {getBookingToothNumbersValue(item) || "—"}
                              </span>
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <button type="button" onClick={() => !isSoftDeletedAppointment(item) && setDoctorCellAppointment(item)} disabled={isSoftDeletedAppointment(item)} aria-label={`Change doctor for ${patientName}`} className={editableCellClass}>
                            <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                            <span className="font-semibold leading-snug text-gray-900">{item.doctor || "Unassigned"}</span>
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <Select value={item.status} onValueChange={(newStatus) => handleHistoryStatusChange(item.id, newStatus)}>
                            <SelectTrigger className="h-auto w-auto border-0 bg-transparent p-0 shadow-none hover:opacity-80 [&>svg]:ml-2 [&>svg]:text-gray-400">
                              {getStatusBadge(item.status)}
                            </SelectTrigger>
                            <SelectContent>
                              {staffVisibleStatusOptions.filter((s: any) => isPendingRequestStatus(s.value) || isHistoryStatus(s.value)).map((status: any) => (
                                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="mt-1.5">
                            {canManagePaymentStatuses ? (
                              <Select value={item.paymentStatus || "unpaid"} onValueChange={(v) => handleHistoryPaymentStatusChange(item.id, v)}>
                                <SelectTrigger className="h-auto w-auto border-0 bg-transparent p-0 shadow-none hover:opacity-80 [&>svg]:ml-2 [&>svg]:text-gray-400">
                                  {getPaymentStatusBadge(item.paymentStatus)}
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_STATUSES.map((status: any) => (
                                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : getPaymentStatusBadge(item.paymentStatus)}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-gray-900 cursor-pointer hover:bg-violet-50/80 transition-colors group/cell rounded-lg" onClick={() => setSetPriceAppointment(item)} title="Click to set new price total">
                          <div className="flex flex-col justify-center leading-tight">
                            {Number(item.discount) > 0 && (
                              <span className="text-[11px] font-normal text-gray-400 line-through decoration-rose-400">
                                {formatPaymentCurrency(item.price || 0)}
                              </span>
                            )}
                            <span className="font-semibold text-gray-900">
                              {formatPaymentCurrency(Math.max(0, Number(item.price || 0) - Number(item.discount || 0)))}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-emerald-700 cursor-pointer hover:bg-emerald-50/80 transition-colors group/cell rounded-lg" onClick={() => handleOpenPayment(item)} title="Click to record payment">
                          <div className="flex items-center gap-1">
                            <span>{formatPaymentCurrency(item.totalPaid || 0)}</span>
                          </div>
                        </TableCell>
                        <TableCell className={`font-semibold cursor-pointer hover:bg-amber-50/80 transition-colors group/cell rounded-lg ${Math.max(0, Number(item.balance ?? Number(item.price || 0) - Number(item.totalPaid || 0))) > 0 ? "text-amber-600" : "text-emerald-600"}`} onClick={() => handleOpenPayment(item)} title="Click to record payment">
                          <div className="flex items-center gap-1">
                            <span>{formatPaymentCurrency(Math.max(0, Number(item.balance ?? Number(item.price || 0) - Number(item.totalPaid || 0))))}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            {renderOverflowMenu(item, "h-10 w-10 rounded-full border border-slate-100 bg-white text-slate-600 shadow-sm hover:bg-slate-50")}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
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

      {/* Modals */}
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

      <SetAppointmentPriceModal
        open={Boolean(setPriceAppointment)}
        onOpenChange={(open) => { if (!open) setSetPriceAppointment(null); }}
        appointment={setPriceAppointment}
        onSuccess={(updated) => {
          mergeAppointmentIntoHistory(updated);
          publishAppointmentUpdate(updated);
          refreshHistory();
        }}
      />

      {/* Patient choice dialog — choose between Profile or Select Patient */}
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
          const patientId = String((patientChoiceAppointment as any)?.patientId || (patientChoiceAppointment as any)?.patient?.id || "").trim();
          const target = (displayName && displayName !== "No patient assigned" ? displayName : "") || patientId;
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
        title="Edit Schedule"
        appointmentLabel={scheduleCellAppointment ? getAppointmentTypeName(scheduleCellAppointment.type, scheduleCellAppointment.customType) : ""}
        doctorLabel={scheduleCellAppointment?.doctor || "Unassigned"}
        selectedDate={scheduleDate}
        selectedTime={scheduleTime}
        selectedDuration={scheduleDuration}
        onDurationChange={setScheduleDuration}
        onDateClick={() => setIsScheduleDatePickerOpen(true)}
        onTimeClick={() => setIsScheduleTimePickerOpen(true)}
        onSave={async () => {
          if (!scheduleCellAppointment || !scheduleDate || !scheduleTime) return;
          await saveCellAppointment(scheduleCellAppointment, {
            date: formatDateToYYYYMMDD(scheduleDate),
            time: scheduleTime,
            duration: Number(scheduleDuration) || 30,
          }, "Schedule updated");
          setScheduleCellAppointment(null);
        }}
        onCancel={() => setScheduleCellAppointment(null)}
        canSave={Boolean(scheduleDate && scheduleTime)}
      />

      <DatePickerModal
        open={isScheduleDatePickerOpen}
        onOpenChange={setIsScheduleDatePickerOpen}
        selectedDate={scheduleDate}
        onDateSelect={setScheduleDate}
        doctorName={scheduleCellAppointment?.doctor || ""}
        selectedTime={scheduleTime}
        duration={scheduleDuration}
        dateSelectionMode="edit"
        excludeAppointmentId={scheduleCellAppointment ? String(scheduleCellAppointment.id) : null}
        title="Select Date"
      />

      {scheduleDate ? <TimePickerModal
        open={isScheduleTimePickerOpen}
        onOpenChange={setIsScheduleTimePickerOpen}
        selectedDate={scheduleDate}
        selectedTime={scheduleTime}
        doctorName={scheduleCellAppointment?.doctor || ""}
        duration={scheduleDuration}
        onTimeSelect={setScheduleTime}
        onDateChange={setScheduleDate}
        excludeAppointmentId={scheduleCellAppointment ? String(scheduleCellAppointment.id) : undefined}
        patientId={String((scheduleCellAppointment as any)?.patientId || "") || null}
        dateSelectionMode="edit"
      /> : null}

      <SelectTreatmentModal
        open={Boolean(treatmentCellAppointment)}
        onOpenChange={(open) => { if (!open) setTreatmentCellAppointment(null); }}
        title="Update Treatment"
        description={treatmentCellAppointment ? getAppointmentTypeName(treatmentCellAppointment.type, treatmentCellAppointment.customType) + " for " + getCurrentPatientName(treatmentCellAppointment) : ""}
        treatments={treatmentOptions.filter((option) => option.isActive !== false)}
        draft={treatmentCellAppointment ? appointmentToTreatmentDraft(treatmentCellAppointment, treatmentOptions.filter((option) => option.isActive !== false)) : undefined}
        onSaveDraft={async (draft) => {
          if (!treatmentCellAppointment) return;
          const activeTreatmentOptions = treatmentOptions.filter((o) => o.isActive !== false);
          const duration = normalizeBookingDuration((treatmentCellAppointment as any).duration || 30);
          const payload = treatmentDraftToPayload(draft, activeTreatmentOptions, duration);

          setIsSavingTreatmentChange(true);
          try {
            await saveCellAppointment(treatmentCellAppointment, payload as Partial<Appointment>, "Treatment updated");
            setTreatmentCellAppointment(null);
          } finally {
            setIsSavingTreatmentChange(false);
          }
        }}
        allowAddTreatment={true}
        allowRemoveTreatment={true}
        onCancel={() => setTreatmentCellAppointment(null)}
        isSaving={isSavingTreatmentChange}
        saveLabel="Save Treatment"
      />

      <SelectDoctorModal
        open={Boolean(doctorCellAppointment)}
        onOpenChange={(open) => !open && setDoctorCellAppointment(null)}
        doctors={doctors}
        isLoading={isLoadingDoctors}
        onDoctorAdded={() => void reloadDoctors()}
        onSelect={async (doctor) => {
          if (!doctorCellAppointment) return;
          await saveCellAppointment(
            doctorCellAppointment,
            { doctor: doctor.name, doctorId: doctor.id, doctorName: doctor.name } as Partial<Appointment>,
            "Doctor updated"
          );
          setDoctorCellAppointment(null);
        }}
      />
    </div>
  );
}
