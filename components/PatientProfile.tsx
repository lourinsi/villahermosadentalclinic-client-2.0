"use client";

import { apiUrl } from "@/lib/api";

import React, { useState, useEffect, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { toast } from "sonner";
import { Checkbox } from "./ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "./ui/select";
import { useAppointmentStatuses } from "@/hooks/useAppointmentStatuses";
import { usePaymentStatuses } from "@/hooks/usePaymentStatuses";
import {
  Mail,
  Phone,
  Edit,
  DollarSign,
  CreditCard,
  Camera,
  Upload,
  Trash2,
  Trash,
  User as UserIcon,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Eye,
  Plus,
  MoreVertical,
  History,
  FileText,
  CreditCard as PaymentIcon,
  Activity,
  Users,
  ShieldCheck,
  MapPin,
  HeartPulse,
  Info,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  UserPlus,
  Search,
  ClipboardList,
  ArrowLeft
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";

import ConfirmDialog from "./ConfirmDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PatientAvatar from "./PatientAvatar";
import { useDoctors } from "@/hooks/useDoctors";
import { Appointment } from "../hooks/useAppointments";
import { RecentTransaction } from "../lib/finance-types";
import { DentalChart } from "./DentalChart";
import { getAppointmentTypeName } from "../lib/appointment-types";
import { formatTimeTo12h } from "@/lib/time-slots";
import { formatWordyDate, parseBackendDateToLocal } from "../lib/utils";
import { getAuthHeaders } from "@/lib/auth-headers";
import AppointmentHistoryView from "./AppointmentHistoryView";
import {
  getAppointmentStatusOptionWithColors,
  getPaymentStatusOptionWithColors,
  normalizePaymentStatus,
} from "@/lib/status-colors";
import { normalizeAppointmentStatus } from "@/lib/appointment-status";
import {
  buildPatientAppointmentSummary,
} from "@/lib/patient-aggregates";
import {
  clearPatientProfileDraft,
  readPatientProfileDraft,
  writePatientProfileDraft,
} from "@/lib/patient-profile-draft";
import PatientUnsavedChangesDialog from "./PatientUnsavedChangesDialog";

export interface Patient {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  phone: string;
  alternateEmail?: string;
  alternatePhone?: string;
  dateOfBirth: string;
  dob?: string;
  birthday?: string;
  birthDate?: string;
  lastVisit?: string;
  nextAppointment?: string | null;
  status?: string;
  overdueAppointmentCount?: number;
  insurance?: string;
  balance?: number;
  createdAt?: string;
  allergies?: string;
  medicalHistory?: string;
  treatmentPlan?: string;
  clinicalNotes?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  notes?: string;
  profilePicture?: string;
  parentId?: string;
  isPrimary?: boolean;
  relationship?: string;
  dentalCharts?: { date: string; data: string; isEmpty: boolean }[];
}

type QuestionnaireQuestion = {
  id: string;
  text: string;
  isActive?: boolean;
};

const resolveImageSource = (source?: string) => {
  if (!source) return undefined;
  if (source.startsWith("http") || source.startsWith("data:") || source.startsWith("blob:")) return source;
  return apiUrl(source);
};

const getDoctorImageFromSnapshot = (s?: any) => {
  if (!s) return undefined;
  return (
    resolveImageSource(s.doctorProfile) ||
    resolveImageSource(s.doctorProfilePicture) ||
    resolveImageSource(s.doctorPhoto) ||
    resolveImageSource(s.doctorImage) ||
    (s.doctor && resolveImageSource(s.doctor.profilePicture)) ||
    undefined
  );
};

const getInitials = (name?: string) => {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

const getPatientStatusTooltip = (status: string, overdueAppointmentCount?: number | null) => {
  switch (status.toLowerCase()) {
    case "overdue": {
      if (typeof overdueAppointmentCount !== "number") return null;
      const count = Math.max(0, overdueAppointmentCount);
      return `You have ${count} overdue appointment${count === 1 ? "" : "s"}.`;
    }
    case "inactive":
      return "It's inactive because you haven't had any appointment for over a year.";
    default:
      return null;
  }
};

export type PatientDetailsRef = {
  save: () => Promise<boolean>;
  discardDraft: () => void;
  changedFields: Record<string, { old: any; new: any }>;
};

interface PatientProfileProps {
  patient: Patient | null;
  detailsRef: React.Ref<PatientDetailsRef>;
  onDeletePatient: (p: Patient) => void;
  isModified: boolean;
  setIsModified: (isModified: boolean) => void;
  doctorFilter?: string;
  openBookingAppointmentId?: string | null;
  onOpenBookingModal?: (appointment: Appointment) => void;
  onBackToPatients?: () => void;
}

export function PatientProfile({
  patient,
  detailsRef,
  onDeletePatient,
  isModified,
  setIsModified,
  doctorFilter,
  openBookingAppointmentId,
  onOpenBookingModal,
  onBackToPatients,
}: PatientProfileProps) {
  const [isHeaderSaving, setIsHeaderSaving] = useState(false);
  const [serverPatient, setServerPatient] = useState<Patient | null>(null);
  const patientDisplayName = patient?.name || [patient?.firstName, patient?.lastName].filter(Boolean).join(" ") || "Patient";

  const { refreshTrigger } = useAppointmentModal();
  const [modalDataRefreshKey, setModalDataRefreshKey] = useState(0);
  const [modalPatientAppointments, setModalPatientAppointments] = useState<Appointment[]>([]);
  const [modalPatientAppointmentsLoaded, setModalPatientAppointmentsLoaded] = useState(false);
  const [modalPatientAppointmentsPatientId, setModalPatientAppointmentsPatientId] = useState("");
  const modalPatientAppointmentsAreFresh =
    modalPatientAppointmentsLoaded &&
    modalPatientAppointmentsPatientId === String(patient?.id || "");
  const modalAppointmentSummary = React.useMemo(
    () => patient ? buildPatientAppointmentSummary(serverPatient || patient, modalPatientAppointments) : null,
    [modalPatientAppointments, patient, serverPatient]
  );
  const displayedBalance =
    modalAppointmentSummary && modalPatientAppointmentsAreFresh
      ? modalPatientAppointments.length > 0
        ? modalAppointmentSummary.appointmentBalance
        : modalAppointmentSummary.balance
      : serverPatient?.balance ?? patient?.balance ?? 0;
  const displayedStatus =
    modalAppointmentSummary && modalPatientAppointmentsAreFresh
      ? modalAppointmentSummary.status
      : serverPatient?.status ?? patient?.status ?? "active";
  const [modalOverdueAppointmentCount, setModalOverdueAppointmentCount] = useState<number | null>(patient?.overdueAppointmentCount ?? null);
  const displayedOverdueAppointmentCount =
    modalAppointmentSummary && modalPatientAppointmentsAreFresh
      ? modalAppointmentSummary.overdueAppointmentCount
      : modalOverdueAppointmentCount ??
        serverPatient?.overdueAppointmentCount ??
        patient?.overdueAppointmentCount;

  const handleSave = async () => {
    const refObject = detailsRef && typeof detailsRef === "object" && "current" in detailsRef ? detailsRef : null;
    if (!refObject?.current) return;

    setIsHeaderSaving(true);
    try {
      await refObject.current.save();
    } finally {
      setIsHeaderSaving(false);
    }
  };

  // Fetch the authoritative patient record so the
  // displayed status reflects server-side computation (which considers
  // appointment paymentStatus values). Fall back to the provided `patient`
  // prop if the fetch fails.
  useEffect(() => {
    let mounted = true;
    const loadPatient = async () => {
      if (!patient?.id) {
        setServerPatient(null);
        return;
      }

      try {
        const res = await fetch(apiUrl(`/api/patients/${encodeURIComponent(String(patient.id))}`), {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const json = await res.json();
        if (mounted && json && json.success && json.data) {
          setServerPatient(json.data as Patient);
        }
      } catch (err) {
        console.warn('Failed to fetch authoritative patient record:', err);
        setServerPatient(null);
      }
    };

    loadPatient();
    return () => { mounted = false; };
  }, [patient?.id, refreshTrigger]);

  useEffect(() => {
    if (!patient?.id) {
      setModalOverdueAppointmentCount(null);
      setModalPatientAppointments([]);
      setModalPatientAppointmentsLoaded(false);
      setModalPatientAppointmentsPatientId("");
      return;
    }

    setModalOverdueAppointmentCount(serverPatient?.overdueAppointmentCount ?? patient?.overdueAppointmentCount ?? null);
  }, [
    patient?.id,
    patient?.overdueAppointmentCount,
    serverPatient?.overdueAppointmentCount,
  ]);

  useEffect(() => {
    const handleDataRefresh = () => setModalDataRefreshKey((key) => key + 1);
    window.addEventListener("appointments:updated", handleDataRefresh);
    window.addEventListener("payments:updated", handleDataRefresh);

    return () => {
      window.removeEventListener("appointments:updated", handleDataRefresh);
      window.removeEventListener("payments:updated", handleDataRefresh);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadPatientAppointmentsForSummary = async () => {
      if (!patient?.id) {
        setModalPatientAppointments([]);
        setModalPatientAppointmentsLoaded(false);
        setModalPatientAppointmentsPatientId("");
        return;
      }

      try {
        const response = await fetch(
          apiUrl(`/api/appointments?patientId=${encodeURIComponent(String(patient.id))}`),
          { headers: getAuthHeaders(), credentials: "include" }
        );
        const result = await response.json().catch(() => null);

        if (!mounted) return;

        if (result?.success && Array.isArray(result.data)) {
          setModalPatientAppointments(result.data as Appointment[]);
          setModalPatientAppointmentsLoaded(true);
          setModalPatientAppointmentsPatientId(String(patient.id));
          return;
        }

        setModalPatientAppointmentsLoaded(false);
        setModalPatientAppointmentsPatientId("");
      } catch (error) {
        if (mounted) {
          console.warn("Failed to fetch patient appointments for summary:", error);
          setModalPatientAppointmentsLoaded(false);
          setModalPatientAppointmentsPatientId("");
        }
      }
    };

    loadPatientAppointmentsForSummary();
    return () => {
      mounted = false;
    };
  }, [patient?.id, refreshTrigger, modalDataRefreshKey]);

  const getStatusBadge = (status: string | undefined, overdueAppointmentCount?: number | null) => {
    const s = status?.toLowerCase() || "active";
    let badge: React.ReactNode;

    switch (s) {
      case "active":
        badge = <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 shadow-none px-2.5 py-0.5">Active</Badge>;
        break;
      case "overdue":
        badge = <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 shadow-none px-2.5 py-0.5">Overdue</Badge>;
        break;
      case "inactive":
        badge = <Badge className="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-50 shadow-none px-2.5 py-0.5">Inactive</Badge>;
        break;
      default:
        badge = <Badge variant="outline" className="capitalize px-2.5 py-0.5">{s}</Badge>;
    }

    const tooltip = getPatientStatusTooltip(s, overdueAppointmentCount);
    if (!tooltip) return badge;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help" title={tooltip} aria-label={tooltip} tabIndex={0}>
            {badge}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-center">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div
      data-tour-id="patient-profile-page"
        title={`Patient Details - ${patientDisplayName}`}
      className="flex min-h-screen flex-col gap-0 bg-slate-50"
      >
        <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 text-left shadow-sm sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="relative group">
                <PatientAvatar src={resolveImageSource(patient?.profilePicture)} name={patientDisplayName} dob={patient?.dateOfBirth || patient?.dob || patient?.birthday} className="h-14 w-14 shrink-0 rounded-lg border border-violet-100 bg-white shadow-sm ring-4 ring-slate-50 transition-all group-hover:ring-violet-50 sm:h-16 sm:w-16" sizeClass="h-14 w-14 sm:h-16 sm:w-16 rounded-lg" />
                <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white shadow-sm sm:h-5 sm:w-5 ${displayedStatus === 'inactive' ? 'bg-slate-300' : 'bg-emerald-500'}`} />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-extrabold leading-tight text-slate-900">
                    {patientDisplayName}
                  </h1>
                  {getStatusBadge(displayedStatus, displayedOverdueAppointmentCount)}
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold text-slate-500">
                  {patient?.email ? (
                    <span className="flex min-w-0 max-w-full items-center gap-2 transition-colors hover:text-violet-600">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span className="truncate">{patient.email}</span>
                    </span>
                  ) : null}
                  {patient?.phone ? (
                    <span className="flex min-w-0 max-w-full items-center gap-2 transition-colors hover:text-violet-600">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span className="truncate">{patient.phone}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              {isModified ? (
                <div className="flex h-10 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Unsaved changes
                </div>
              ) : null}
              {onBackToPatients ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onBackToPatients}
                  disabled={isHeaderSaving}
                  className="h-10 border-slate-200 px-5 font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Patients
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => patient && onDeletePatient(patient)}
                disabled={!patient || isHeaderSaving}
                className="h-10 border-red-100 px-5 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold shadow-sm transition-all active:scale-95"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <Button
                type="button"
                variant="brand"
                size="sm"
                onClick={handleSave}
                disabled={!patient || !isModified || isHeaderSaving}
                className="h-10 px-7 shadow-lg shadow-violet-100 transition-all active:scale-95 disabled:shadow-none font-bold"
              >
                {isHeaderSaving ? (
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                {isHeaderSaving ? "Saving..." : "Update Patient"}
              </Button>
            </div>
          </div>
        </header>

        {patient ? (
          <div className="flex flex-1 flex-col">
            {/* Quick Summary Bar - High Visibility Redesign */}
            <div data-tour-id="patient-details-summary" className="border-b border-slate-100 bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
              <div className="mx-auto grid w-full max-w-[1920px] gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                <div className="flex min-w-0 items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Account Status</span>
                    <div className="flex items-center pt-0.5">{getStatusBadge(displayedStatus, displayedOverdueAppointmentCount)}</div>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Outstanding Balance</span>
                    <span className={`block truncate text-xl font-black leading-tight ${(displayedBalance || 0) > 0 ? "text-red-600" : "text-violet-600"}`}>
                      PHP {Number(displayedBalance || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Patient Since</span>
                    <span className="block truncate text-base font-extrabold leading-tight text-slate-700">
                      {formatPatientLogDate((serverPatient?.createdAt || patient.createdAt) as string | undefined)}
                    </span>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Record Reference</span>
                    <span className="block truncate font-mono text-[11px] font-bold uppercase tracking-tight text-slate-500">
                      {patient.id}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <PatientDetails
              ref={detailsRef}
              patient={serverPatient || patient}
              onDeletePatient={onDeletePatient}
              isModified={isModified}
              setIsModified={setIsModified}
              doctorFilter={doctorFilter}
              openBookingAppointmentId={openBookingAppointmentId}
              onOpenBookingModal={onOpenBookingModal}
              dataRefreshKey={modalDataRefreshKey}
            />
          </div>
        ) : null}
    </div>
  );
}
// Local history appointment shape (type can be string for display)
interface HistoryAppointment extends Omit<Appointment, 'type' | 'date' | 'transactions'> {
  type: string;
  date: string;
  transactions: RecentTransaction[];
}

type PaymentRow = RecentTransaction & {
  patientId?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  deleted?: boolean;
};

type PaymentLogRow = {
  id?: string;
  appointmentId?: string;
  amount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  changedBy?: string;
  changedByName?: string;
  changedAt?: string | Date;
  createdAt?: string | Date;
  previousBalance?: number;
  newBalance?: number;
};

type AppointmentLogRow = {
  id?: string;
  appointmentId?: string;
  previousState?: any;
  newState?: any;
  changedBy?: string;
  changedByName?: string;
  changedAt?: string | Date;
  changeType?: string;
  amount?: number;
  notes?: string;
};

const isLegacyPaymentRow = (txn: RecentTransaction) => String(txn.id || "").startsWith("legacy-");
const isStoredPaymentLogRow = (txn: RecentTransaction) =>
  String((txn as any).source || "") === "payment-log" || String(txn.id || "").startsWith("payment-log-");
const isReadOnlyPaymentRow = (txn: RecentTransaction) => isLegacyPaymentRow(txn) || isStoredPaymentLogRow(txn);
const getEditablePaymentId = (txn: RecentTransaction) => {
  const explicitPaymentId = (txn as any).paymentId || (txn as any).paymentRecordId;
  if (explicitPaymentId) return String(explicitPaymentId).trim();

  if (isStoredPaymentLogRow(txn)) {
    const paymentLogId = String(txn.transactionId || txn.id || "").replace(/^payment-log-/, "").trim();
    return paymentLogId.startsWith("pay_log_") ? paymentLogId : "";
  }

  if (String((txn as any).source || "") === "payment" && txn.id && !isReadOnlyPaymentRow(txn)) {
    return String(txn.id).trim();
  }

  return "";
};

const getPaymentEditUnavailableMessage = (txn: RecentTransaction) => {
  if (isLegacyPaymentRow(txn)) {
    return "This is a legacy recorded total from the appointment, not an individual payment record.";
  }

  if (isStoredPaymentLogRow(txn)) {
    return "Could not connect this payment log to an editable payment record.";
  }

  return "Could not find the payment record to edit.";
};

const toDateOnly = (value?: string | Date) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).split("T")[0].split(" ")[0];
};

const formatPatientLogDate = (value?: string | Date | null, fallback = "N/A") =>
  formatWordyDate(value, { fallback: value ? String(value) : fallback });

const getPaymentTransactionKey = (txn: RecentTransaction) =>
  String(txn.id || txn.transactionId || `${txn.appointmentId || "none"}-${txn.date || "no-date"}-${txn.method || "method"}-${txn.amount || 0}`);

const parsePaymentTimestamp = (value?: string | Date) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();

  const raw = String(value);
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const parsed = new Date(normalized).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
};

const getPaymentEventTimestamps = (txn: RecentTransaction) => {
  const row = txn as PaymentRow;

  return [txn.date, row.createdAt, row.updatedAt]
    .map(parsePaymentTimestamp)
    .filter((timestamp, index, timestamps) => timestamp > 0 && timestamps.indexOf(timestamp) === index);
};

const getPaymentEventDateKey = (txn: RecentTransaction) => {
  const row = txn as PaymentRow;

  return toDateOnly(txn.date) || toDateOnly(row.createdAt) || toDateOnly(row.updatedAt);
};

const hasClosePaymentTimestamp = (a: RecentTransaction, b: RecentTransaction) =>
  getPaymentEventTimestamps(a).some((aTime) =>
    getPaymentEventTimestamps(b).some((bTime) => Math.abs(aTime - bTime) <= 10_000)
  );

const isSamePaymentEvent = (a: RecentTransaction, b: RecentTransaction) => {
  if (!a.appointmentId || !b.appointmentId) return false;
  if (String(a.appointmentId) !== String(b.appointmentId)) return false;

  const aSource = String((a as any).source || "");
  const bSource = String((b as any).source || "");
  const hasCollectionPayment = aSource === "payment" || bSource === "payment";
  const hasPaymentLog = aSource === "payment-log" || bSource === "payment-log";
  const hasCloseTimestamp = hasClosePaymentTimestamp(a, b);

  if (hasCollectionPayment && hasPaymentLog && hasCloseTimestamp) return true;

  if (Math.abs(Number(a.amount || 0) - Number(b.amount || 0)) > 0.01) return false;
  if (hasCloseTimestamp) return true;

  return getPaymentEventDateKey(a) === getPaymentEventDateKey(b);
};

const findMatchingAppointmentPaymentLog = (paymentLog: PaymentLogRow, appointmentLogs: AppointmentLogRow[]) => {
  const paymentAmount = Number(paymentLog.amount || 0);
  const paymentTime = parsePaymentTimestamp(paymentLog.changedAt);

  return appointmentLogs.find((appointmentLog) => {
    if (String(appointmentLog.appointmentId || "") !== String(paymentLog.appointmentId || "")) return false;
    if (Math.abs(Number(appointmentLog.amount || 0) - paymentAmount) > 0.01) return false;

    const appointmentLogTime = parsePaymentTimestamp(appointmentLog.changedAt);
    if (paymentTime && appointmentLogTime) return Math.abs(paymentTime - appointmentLogTime) <= 10_000;

    return toDateOnly(appointmentLog.changedAt) === toDateOnly(paymentLog.changedAt);
  });
};

const comparePaymentTransactionsDesc = (a: RecentTransaction, b: RecentTransaction) => {
  const aRow = a as PaymentRow;
  const bRow = b as PaymentRow;
  const paymentDateDiff = parsePaymentTimestamp(b.date) - parsePaymentTimestamp(a.date);

  if (paymentDateDiff !== 0) return paymentDateDiff;

  const createdDiff = parsePaymentTimestamp(bRow.createdAt) - parsePaymentTimestamp(aRow.createdAt);
  if (createdDiff !== 0) return createdDiff;

  const updatedDiff = parsePaymentTimestamp(bRow.updatedAt) - parsePaymentTimestamp(aRow.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;

  return getPaymentTransactionKey(b).localeCompare(getPaymentTransactionKey(a));
};

const normalizeComparableText = (value: unknown) =>
  String(value ?? "").toLowerCase().trim().replace(/\s+/g, " ");

const normalizeComparableDoctor = (value: unknown) =>
  normalizeComparableText(value).replace(/^dr\.?\s+/, "");

const normalizeComparableNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100) / 100;

  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
};

const normalizeComparableTime = (value: unknown) => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return normalizeComparableText(raw);

  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

const normalizeComparableAppointmentType = (record: any) => {
  const type = record?.type;
  const customType = record?.customType;
  const numericType = typeof type === "number" ? type : typeof type === "string" && type.trim() ? Number(type) : NaN;

  if (Number.isFinite(numericType)) {
    return normalizeComparableText(getAppointmentTypeName(numericType, customType) || String(type));
  }

  return normalizeComparableText(type || customType);
};

const getComparableAppointmentState = (record: any) => {
  const rawDoctor = typeof record?.doctor === "object"
    ? record.doctor?.name || record.doctor?.fullName || record.doctor?.username || record.doctor?.id
    : record?.doctor || record?.doctorName || record?.doctorId;
  const rawPatientName = record?.patientName ||
    record?.patient_name ||
    record?.patient?.name ||
    record?.patient?.fullName ||
    [record?.patientFirstName || record?.patient?.firstName, record?.patientLastName || record?.patient?.lastName].filter(Boolean).join(" ");

  return {
    patientId: normalizeComparableText(record?.patientId || record?.patient?.id),
    patientName: normalizeComparableText(rawPatientName),
    date: toDateOnly(record?.date),
    time: normalizeComparableTime(record?.time || String(record?.date || "").split(" ")[1] || ""),
    duration: normalizeComparableNumber(record?.duration),
    type: normalizeComparableAppointmentType(record),
    doctor: normalizeComparableDoctor(rawDoctor),
    status: normalizeComparableText(record?.status),
    paymentStatus: normalizeComparableText(record?.paymentStatus),
    price: normalizeComparableNumber(record?.price),
    discount: normalizeComparableNumber(record?.discount),
    balance: normalizeComparableNumber(record?.balance),
    totalPaid: normalizeComparableNumber(record?.totalPaid),
    notes: normalizeComparableText(record?.notes),
  };
};

const comparableAppointmentKeys = [
  "patientId",
  "patientName",
  "date",
  "time",
  "duration",
  "type",
  "doctor",
  "status",
  "paymentStatus",
  "price",
  "discount",
  "balance",
  "totalPaid",
  "notes",
] as const;

const hasComparableValue = (value: string | number | null) =>
  value !== null && String(value).trim() !== "";

const compareAppointmentSnapshotToCurrent = (snapshot: any, currentAppointment: any) => {
  if (!snapshot || !currentAppointment) return { compared: 0, matches: false };

  const snapshotState = getComparableAppointmentState(snapshot);
  const currentState = getComparableAppointmentState(currentAppointment);
  let compared = 0;

  for (const key of comparableAppointmentKeys) {
    const snapshotValue = snapshotState[key];
    const currentValue = currentState[key];
    if (!hasComparableValue(snapshotValue) || !hasComparableValue(currentValue)) continue;

    compared += 1;
    if (typeof snapshotValue === "number" || typeof currentValue === "number") {
      if (Math.abs(Number(snapshotValue) - Number(currentValue)) > 0.01) {
        return { compared, matches: false };
      }
      continue;
    }

    if (snapshotValue !== currentValue) {
      return { compared, matches: false };
    }
  }

  return { compared, matches: compared > 0 };
};

const isLatestAppointmentLogForAppointment = (appointmentLog: AppointmentLogRow | undefined, appointmentLogs: AppointmentLogRow[]) => {
  if (!appointmentLog) return true;

  const latestLog = appointmentLogs
    .filter((log) => String(log.appointmentId || "") === String(appointmentLog.appointmentId || ""))
    .sort((a, b) => parsePaymentTimestamp(b.changedAt) - parsePaymentTimestamp(a.changedAt))[0];

  if (!latestLog) return true;

  if (appointmentLog.id && latestLog.id) return String(appointmentLog.id) === String(latestLog.id);
  return parsePaymentTimestamp(appointmentLog.changedAt) === parsePaymentTimestamp(latestLog.changedAt);
};

const MAX_PATIENT_PHOTO_UPLOAD_BYTES = 8 * 1024 * 1024;
const TARGET_PATIENT_PHOTO_DATA_URL_LENGTH = 70_000;

/**
 * Image Processing Utilities for Patient Photos
 */
const imageHelpers = {
  load: (dataUrl: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = dataUrl;
    }),

  readAsDataUrl: (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    }),

  resize: (img: HTMLImageElement, maxDim: number, quality: number) => {
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context failed");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  }
};

const compressPatientPhoto = async (file: File) => {
  const dataUrl = await imageHelpers.readAsDataUrl(file);
  const img = await imageHelpers.load(dataUrl);
  const dims = [384, 320, 256, 192];
  const qualities = [0.8, 0.7, 0.6, 0.5];
  let result = "";

  for (const dim of dims) {
    for (const q of qualities) {
      const res = imageHelpers.resize(img, dim, q);
      if (!result || res.length < result.length) result = res;
      if (res.length <= TARGET_PATIENT_PHOTO_DATA_URL_LENGTH) return res;
    }
  }
  return result;
};

const PatientDetails = React.forwardRef<PatientDetailsRef, {

  patient: Patient;
  onDeletePatient: (p: Patient) => void;
  isModified: boolean;
  setIsModified: (isModified: boolean) => void;
  doctorFilter?: string;
  openBookingAppointmentId?: string | null;
  onOpenBookingModal?: (appointment: Appointment) => void;
  dataRefreshKey?: number;
}>(({
  patient,
  onDeletePatient,
  isModified,
  setIsModified,
  doctorFilter,
  openBookingAppointmentId,
  onOpenBookingModal,
  dataRefreshKey = 0
}, ref) => {
  const { refreshPatients, appointments, refreshAppointments, openCreateModal, refreshTrigger } = useAppointmentModal();
  const { openPaymentModal, openEditPaymentModal } = usePaymentModal();
  const [activeTab, setActiveTab] = useState("info");
  const shouldLoadHistoryData = activeTab === "history" || activeTab === "payments" || Boolean(openBookingAppointmentId);
  const shouldLoadFinancialLog = activeTab === "payments" || activeTab === "history";
  const { doctors } = useDoctors(undefined, { enabled: activeTab === "history" || activeTab === "payments" });
  const { statuses: APPOINTMENT_STATUSES } = useAppointmentStatuses();
  const { statuses: PAYMENT_STATUSES } = usePaymentStatuses();
  const [formData, setFormData] = useState({
    firstName: patient.firstName || patient.name?.split(' ')[0] || '',
    lastName: patient.lastName || patient.name?.split(' ').slice(1).join(' ') || '',
    email: patient.email || '',
    phone: patient.phone || '',
    alternateEmail: patient.alternateEmail || '',
    alternatePhone: patient.alternatePhone || '',
    dateOfBirth: patient.dateOfBirth || '',
    insurance: patient.insurance || '',
    balance: patient.balance ?? 0,
    status: patient.status || 'active',
    createdAt: patient.createdAt || new Date().toISOString().split('T')[0],
    allergies: patient.allergies || '',
    medicalHistory: patient.medicalHistory || '',
    treatmentPlan: patient.treatmentPlan || '',
    clinicalNotes: patient.clinicalNotes || '',
    address: patient.address || '',
    city: patient.city || '',
    zipCode: patient.zipCode || '',
    emergencyContact: patient.emergencyContact || '',
    emergencyPhone: patient.emergencyPhone || '',
    notes: patient.notes || '',
    profilePicture: patient.profilePicture || '', // This will now just trigger a clone
    dentalCharts: patient.dentalCharts || [] // This will now just trigger a clone
  });

  const [loadedPatient, setLoadedPatient] = useState<Patient>(patient);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingPatientPhoto, setIsPreparingPatientPhoto] = useState(false);
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [familyMembers, setFamilyMembers] = useState<Patient[]>([]);
  const [parentPatient, setParentPatient] = useState<Patient | null>(null);
  const [isLoadingFamily, setIsLoadingFamily] = useState(false);
  const [questionnaireQuestions, setQuestionnaireQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, boolean>>({});
  const [savedQuestionnaireAnswers, setSavedQuestionnaireAnswers] = useState<Record<string, boolean>>({});
  const [patientQuestionnaireData, setPatientQuestionnaireData] = useState<Record<string, any>>({});
  const [isLoadingQuestionnaire, setIsLoadingQuestionnaire] = useState(false);
  const [isSavingQuestionnaire, setIsSavingQuestionnaire] = useState(false);
  const [questionnaireLoadedPatientId, setQuestionnaireLoadedPatientId] = useState<string | null>(null);
  const [draftCheckPatientId, setDraftCheckPatientId] = useState<string | null>(null);
  const [hasRestoredQuestionnaireDraft, setHasRestoredQuestionnaireDraft] = useState(false);
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);
  const [isRecoverySaving, setIsRecoverySaving] = useState(false);

  // Payment state and helpers (local to PatientDetails)
  const [allTransactions, setAllTransactions] = useState<RecentTransaction[]>([]);
  const [mockAppointmentHistoryLocal, setMockAppointmentHistoryLocal] = useState<Appointment[]>([]);
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set());
  const patientPhotoInputId = React.useId();
  const patientDisplayName = [formData.firstName, formData.lastName].filter(Boolean).join(" ") || patient.name || "Patient";
  const currentPatientId = patient.id ? String(patient.id) : "";
  const rawPatientIdForBooking = patient.id || loadedPatient.id;
  const patientIdForBooking = rawPatientIdForBooking ? String(rawPatientIdForBooking) : undefined;
  useEffect(() => {
    setActiveTab("info");
  }, [patient.id]);

  const normalizeQuestionnaireAnswers = React.useCallback((data: any): Record<string, boolean> => {
    const rawAnswers = data?.questionnaireAnswers || data?.customQuestionAnswers || {};

    if (Array.isArray(rawAnswers)) {
      return rawAnswers.reduce<Record<string, boolean>>((answers, id) => {
        if (id) answers[String(id)] = true;
        return answers;
      }, {});
    }

    if (rawAnswers && typeof rawAnswers === "object") {
      return Object.entries(rawAnswers).reduce<Record<string, boolean>>((answers, [id, checked]) => {
        answers[id] = Boolean(checked);
        return answers;
      }, {});
    }

    return {};
  }, []);

  const loadQuestionnaireTab = React.useCallback(async () => {
    if (!patient.id) return;

    setIsLoadingQuestionnaire(true);
    try {
      const [questionsResponse, patientQuestionnaireResponse] = await Promise.all([
        fetch(apiUrl("/api/questionnaire-questions"), {
          credentials: "include",
          headers: getAuthHeaders(),
        }),
        fetch(apiUrl(`/api/questionnaires/${encodeURIComponent(String(patient.id))}`), {
          credentials: "include",
          headers: getAuthHeaders(),
        }),
      ]);

      const questionsPayload = await questionsResponse.json().catch(() => ({}));
      if (!questionsResponse.ok || !questionsPayload?.success || !Array.isArray(questionsPayload.data)) {
        throw new Error(questionsPayload?.message || "Failed to load questionnaire questions");
      }

      const patientQuestionnairePayload = await patientQuestionnaireResponse.json().catch(() => ({}));
      const questionnaireData = patientQuestionnairePayload?.data && typeof patientQuestionnairePayload.data === "object"
        ? patientQuestionnairePayload.data
        : {};
      const answers = normalizeQuestionnaireAnswers(questionnaireData);

      setQuestionnaireQuestions(questionsPayload.data.filter((question: QuestionnaireQuestion) => question.isActive !== false));
      setPatientQuestionnaireData(questionnaireData);
      setQuestionnaireAnswers(answers);
      setSavedQuestionnaireAnswers(answers);
      setQuestionnaireLoadedPatientId(String(patient.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load questionnaire");
    } finally {
      setIsLoadingQuestionnaire(false);
    }
  }, [normalizeQuestionnaireAnswers, patient.id]);

  useEffect(() => {
    if (activeTab === "questionnaire") {
      if (hasRestoredQuestionnaireDraft && questionnaireQuestions.length > 0) return;
      if (questionnaireLoadedPatientId === String(patient.id || "")) return;
      loadQuestionnaireTab();
    }
  }, [activeTab, hasRestoredQuestionnaireDraft, loadQuestionnaireTab, patient.id, questionnaireLoadedPatientId, questionnaireQuestions.length]);

  const questionnaireHasChanges = React.useMemo(
    () => JSON.stringify(questionnaireAnswers) !== JSON.stringify(savedQuestionnaireAnswers),
    [questionnaireAnswers, savedQuestionnaireAnswers]
  );

  const handleQuestionnaireAnswerChange = (questionId: string, checked: boolean) => {
    setQuestionnaireAnswers((current) => ({
      ...current,
      [questionId]: checked,
    }));
    setIsModified(true);
  };

  const saveQuestionnaireAnswers = async () => {
    if (!patient.id || !questionnaireHasChanges) return true;

    setIsSavingQuestionnaire(true);
    try {
      const response = await fetch(apiUrl(`/api/questionnaires/${encodeURIComponent(String(patient.id))}`), {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...patientQuestionnaireData,
          questionnaireAnswers,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to save questionnaire answers");
      }

      const nextData = payload.data && typeof payload.data === "object" ? payload.data : {
        ...patientQuestionnaireData,
        questionnaireAnswers,
      };
      const nextAnswers = normalizeQuestionnaireAnswers(nextData);
      setPatientQuestionnaireData(nextData);
      setQuestionnaireAnswers(nextAnswers);
      setSavedQuestionnaireAnswers(nextAnswers);
      setHasRestoredQuestionnaireDraft(false);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save questionnaire answers");
      return false;
    } finally {
      setIsSavingQuestionnaire(false);
    }
  };

  const handlePatientPhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    if (file.size > MAX_PATIENT_PHOTO_UPLOAD_BYTES) {
      toast.error("Please choose an image smaller than 8 MB.");
      return;
    }

    setIsPreparingPatientPhoto(true);
    try {
      const compressedDataUrl = await compressPatientPhoto(file);
      setFormData(prev => ({ ...prev, profilePicture: compressedDataUrl }));
      setIsModified(true);
    } catch (error) {
      console.error("Error preparing patient photo:", error);
      toast.error("Could not read the selected image.");
    } finally {
      setIsPreparingPatientPhoto(false);
    }
  };

  const handleRemovePatientPhoto = () => {
    setFormData(prev => ({ ...prev, profilePicture: "" }));
    setIsModified(true);
  };

  const getHistoryAppointmentType = React.useCallback((apt: Appointment) => {
    return getAppointmentTypeName(apt.type as number, apt.customType) || String(apt.type || "Appointment");
  }, []);

  const createLegacyPaymentRow = React.useCallback((apt: Appointment): RecentTransaction | null => {
    const totalPaid = Number(apt.totalPaid || 0);
    if (totalPaid <= 0) return null;

    const appointmentType = getHistoryAppointmentType(apt);
    const appointmentDate = String(apt.date || "");
    const paymentDate = toDateOnly((apt as any).paymentDate) || toDateOnly(apt.createdAt) || toDateOnly(apt.updatedAt) || toDateOnly(appointmentDate);

    return {
      id: `legacy-${apt.id}`,
      appointmentId: apt.id,
      appointmentType,
      appointmentDate,
      doctor: apt.doctor || "",
      date: paymentDate,
      paymentDate,
      description: `Recorded payment total for ${appointmentType}`,
      amount: totalPaid,
      type: "payment",
      method: "Recorded Total",
      transactionId: `LEGACY-${apt.id}`,
      notes: "Imported from appointment total paid because no individual payment record exists.",
      status: apt.paymentStatus === "unpaid" ? "pending" : "completed",
    };
  }, [getHistoryAppointmentType]);

  const buildPatientTransactions = React.useCallback((history: Appointment[], payments: PaymentRow[] = [], paymentLogs: PaymentLogRow[] = [], appointmentLogs: AppointmentLogRow[] = []) => {
    const appointmentById = new Map(history.map((apt) => [apt.id, apt]));

    // Normalize payments coming from the payments collection
    const paymentsFromCollection = payments
      .filter((payment) => !payment.deleted)
      .map((payment) => {
        const appointment = payment.appointmentId ? appointmentById.get(payment.appointmentId) : undefined;
        const appointmentType = payment.appointmentType || (appointment ? getHistoryAppointmentType(appointment) : "Unassigned Payment");
        const appointmentDate = payment.appointmentDate || (appointment ? String(appointment.date || "") : "");
        const paymentDate = toDateOnly(payment.date) || toDateOnly(payment.createdAt);

        return {
          ...payment,
          id: payment.id || payment.transactionId || `payment-${payment.appointmentId || "unknown"}-${payment.date}`,
          date: paymentDate,
          paymentDate,
          description: payment.description || `Payment for ${appointmentType}`,
          amount: Number(payment.amount || 0),
          type: payment.type || "payment",
          method: payment.method || "Unknown",
          source: (payment as any).source || "payment",
          appointmentId: payment.appointmentId,
          appointmentType,
          appointmentDate,
          doctor: payment.doctor || appointment?.doctor || "",
          status: payment.status || "completed",
        } as RecentTransaction;
      });

    // Also include any per-appointment embedded `transactions` (legacy storage) as individual rows
    const keys = new Set(paymentsFromCollection.map(getPaymentTransactionKey));
    const historyRows: RecentTransaction[] = [];
    history.forEach((apt) => {
      const txns = Array.isArray(apt.transactions) ? apt.transactions : [];
      txns.forEach((rawTxn: any) => {
        const appointmentType = rawTxn.appointmentType || getHistoryAppointmentType(apt);
        const appointmentDate = rawTxn.appointmentDate || String(apt.date || "");
        const paymentDate = toDateOnly(rawTxn.paymentDate) || toDateOnly(rawTxn.date) || toDateOnly(rawTxn.createdAt) || toDateOnly(apt.createdAt) || toDateOnly(apt.updatedAt);
        const txn: RecentTransaction = {
          ...rawTxn,
          id: rawTxn.id || rawTxn.transactionId || `apt-${apt.id}-txn-${rawTxn.date || ''}-${rawTxn.method || ''}-${rawTxn.amount || 0}`,
          date: paymentDate,
          paymentDate,
          description: rawTxn.description || rawTxn.notes || `Payment for ${appointmentType}`,
          amount: Number(rawTxn.amount || 0),
          type: rawTxn.type || "payment",
          method: rawTxn.method || rawTxn.paymentMethod || "Recorded",
          source: (rawTxn as any).source || "appointment-transaction",
          appointmentId: apt.id,
          appointmentType,
          appointmentDate,
          doctor: rawTxn.doctor || apt.doctor || "",
          status: rawTxn.status || "completed",
        } as RecentTransaction;

        const key = getPaymentTransactionKey(txn);
        if (!keys.has(key) && Number(txn.amount || 0) > 0) {
          historyRows.push(txn);
          keys.add(key);
        }
      });
    });

    const representedRows = [...paymentsFromCollection, ...historyRows];
    const paymentLogRows: RecentTransaction[] = paymentLogs
      .filter((log) => Boolean(log.appointmentId) && Number(log.amount || 0) > 0)
      .map((log) => {
        const appointment = log.appointmentId ? appointmentById.get(log.appointmentId) : undefined;
        const appointmentType = appointment ? getHistoryAppointmentType(appointment) : "Appointment Payment";
        const appointmentDate = appointment ? String(appointment.date || "") : "";
        const changedAt = log.changedAt || new Date().toISOString();
        const matchingAppointmentLog = findMatchingAppointmentPaymentLog(log, appointmentLogs);
        const actualPaymentDate = toDateOnly(
          (matchingAppointmentLog?.newState as any)?.paymentDate ||
          (matchingAppointmentLog as any)?.paymentDate
        );
        const recordedPaymentDate = actualPaymentDate;
        const paymentCreatedDate = toDateOnly(log.createdAt) || toDateOnly(changedAt);
        const paymentDisplayDate = recordedPaymentDate || paymentCreatedDate || toDateOnly(appointmentDate);
        const appointmentSnapshotBase = matchingAppointmentLog?.newState && typeof matchingAppointmentLog.newState === "object"
          ? {
              ...(matchingAppointmentLog.newState || {}),
              id: matchingAppointmentLog.newState?.id || log.appointmentId,
              appointmentId: log.appointmentId,
              logType: "payment",
              changeType: matchingAppointmentLog.changeType || "payment",
              previousState: matchingAppointmentLog.previousState,
              newState: matchingAppointmentLog.newState,
              changedAt: matchingAppointmentLog.changedAt || changedAt,
              changedBy: matchingAppointmentLog.changedBy || log.changedBy,
              changedByName: matchingAppointmentLog.changedByName || log.changedByName,
              amount: Number(log.amount || 0),
              paymentAmount: Number(log.amount || 0),
              paymentDate: paymentDisplayDate,
              paymentMethod: log.paymentMethod,
              paymentStatus: log.paymentStatus,
              previousBalance: log.previousBalance,
              newBalance: log.newBalance,
            }
          : undefined;
        const snapshotComparison = appointmentSnapshotBase && appointment
          ? compareAppointmentSnapshotToCurrent(appointmentSnapshotBase, appointment)
          : { compared: 0, matches: false };
        const appointmentSnapshot = appointmentSnapshotBase
          ? {
              ...appointmentSnapshotBase,
              _isHistorical: snapshotComparison.compared > 0
                ? !snapshotComparison.matches
                : !isLatestAppointmentLogForAppointment(matchingAppointmentLog, appointmentLogs),
            }
          : undefined;

        return {
          id: `payment-log-${log.id || `${log.appointmentId}-${String(changedAt)}-${log.amount}`}`,
          appointmentId: log.appointmentId,
          appointmentType,
          appointmentDate,
          doctor: appointment?.doctor || "",
          date: paymentDisplayDate,
          paymentDate: paymentDisplayDate,
          description: `Payment for ${appointmentType}`,
          amount: Number(log.amount || 0),
          type: "payment",
          method: log.paymentMethod || "Payment log",
          transactionId: log.id || `LOG-${log.appointmentId}`,
          notes: log.changedByName ? `Recorded by ${log.changedByName}` : undefined,
          status: log.paymentStatus || "completed",
          source: "payment-log",
          appointmentSnapshot,
          changedAt,
          changedBy: log.changedBy,
          changedByName: log.changedByName,
          previousBalance: log.previousBalance,
          newBalance: log.newBalance,
          createdAt: paymentCreatedDate || changedAt,
          updatedAt: changedAt,
        } as RecentTransaction;
      })
      .filter((txn) => {
        const key = getPaymentTransactionKey(txn);
        if (keys.has(key)) return false;
        if (representedRows.some((row) => isSamePaymentEvent(txn, row))) return false;

        keys.add(key);
        return true;
      });

    const realAppointmentIds = new Set(
      [...paymentsFromCollection, ...historyRows, ...paymentLogRows].map((row) => row.appointmentId).filter(Boolean)
    );

    const legacyRows = history
      .filter((apt) => !realAppointmentIds.has(apt.id))
      .map(createLegacyPaymentRow)
      .filter(Boolean) as RecentTransaction[];

    return [...paymentsFromCollection, ...historyRows, ...paymentLogRows, ...legacyRows]
      .filter((txn) => Number(txn.amount || 0) > 0)
      .sort(comparePaymentTransactionsDesc);
  }, [createLegacyPaymentRow, getHistoryAppointmentType]);

  // Track the original loaded data (after server fetch) for accurate change detection
  const [originalLoadedData, setOriginalLoadedData] = useState(formData);

  // Compute changed fields for unsaved changes dialog
  const changedFields = React.useMemo(() => {
    const changes: Record<string, { old: any; new: any }> = {};
    const fieldLabels: Record<string, string> = {
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Primary Email',
      phone: 'Primary Phone',
      alternateEmail: 'Alternate Email',
      alternatePhone: 'Alternate Phone',
      dateOfBirth: 'Date of Birth',
      insurance: 'Insurance Provider',
      balance: 'Balance',
      status: 'Status',
      createdAt: 'Created Date',
      allergies: 'Allergies',
      medicalHistory: 'Medical History',
      treatmentPlan: 'Treatment Plan',
      clinicalNotes: 'Clinical Notes',
      address: 'Address',
      city: 'City',
      zipCode: 'ZIP Code',
      emergencyContact: 'Emergency Contact',
      emergencyPhone: 'Emergency Phone',
      notes: 'Notes',
      profilePicture: 'Patient Photo',
      dentalCharts: 'Dental Chart',
    };

    const toComparableValue = (value: any) => {
      if (value === undefined || value === null) return "";
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);

      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    // Compare against the originally loaded data (from server), not the initial prop
    Object.keys(fieldLabels).forEach((key) => {
      const orig = originalLoadedData[key as keyof typeof originalLoadedData];
      const current = formData[key as keyof typeof formData];
      if (toComparableValue(orig) !== toComparableValue(current)) {
        changes[fieldLabels[key]] = {
          old: orig,
          new: current,
        };
      }
    });

    const knownQuestionIds = new Set(questionnaireQuestions.map((question) => question.id));
    questionnaireQuestions.forEach((question) => {
      const oldValue = Boolean(savedQuestionnaireAnswers[question.id]);
      const newValue = Boolean(questionnaireAnswers[question.id]);
      if (oldValue !== newValue) {
        changes[`Questionnaire - ${question.text}`] = {
          old: oldValue,
          new: newValue,
        };
      }
    });

    Object.keys(questionnaireAnswers).forEach((questionId) => {
      if (knownQuestionIds.has(questionId)) return;

      const oldValue = Boolean(savedQuestionnaireAnswers[questionId]);
      const newValue = Boolean(questionnaireAnswers[questionId]);
      if (oldValue !== newValue) {
        changes[`Questionnaire - ${questionId}`] = {
          old: oldValue,
          new: newValue,
        };
      }
    });

    return changes;
  }, [formData, originalLoadedData, questionnaireAnswers, questionnaireQuestions, savedQuestionnaireAnswers]);

  const hasTrackedChanges = React.useMemo(() => Object.keys(changedFields).length > 0, [changedFields]);

  const discardStoredDraft = React.useCallback(() => {
    if (currentPatientId) clearPatientProfileDraft(currentPatientId);
    setHasRestoredQuestionnaireDraft(false);
    setIsRecoveryDialogOpen(false);
  }, [currentPatientId]);

  useEffect(() => {
    setIsModified(hasTrackedChanges);
  }, [hasTrackedChanges, setIsModified]);

  // Local confirm dialog state for PatientDetails (prefixed to avoid collisions)
  const [pdIsConfirmOpen, setPdIsConfirmOpen] = useState(false);
  const [pdConfirmLoading, setPdConfirmLoading] = useState(false);
  const [pdConfirmAction, setPdConfirmAction] = useState<null | (() => Promise<void>)>(null);
  const [pdConfirmTitle, setPdConfirmTitle] = useState<string>("");
  const [pdConfirmMessage, setPdConfirmMessage] = useState<string>("");

  // New state for filters
  const [historyPaymentStatusFilter, setHistoryPaymentStatusFilter] = useState('all');
  const [historyAppointmentStatusFilter, setHistoryAppointmentStatusFilter] = useState('all');
  const [historyDoctorFilter, setHistoryDoctorFilter] = useState('all');
  const [historyProcedureFilter, setHistoryProcedureFilter] = useState('all');
  const [historySearchFilter, setHistorySearchFilter] = useState('');

  // Snapshot states
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);
  const [selectedSnapshotIsHistorical, setSelectedSnapshotIsHistorical] = useState(false);
  const [snapshotLogDate, setSnapshotLogDate] = useState("");
  const selectedSnapshotAppointmentId = selectedSnapshot?.id || selectedSnapshot?.appointmentId || "";
  const isSelectedSnapshotAppointmentOpen = Boolean(
    openBookingAppointmentId &&
    selectedSnapshotAppointmentId &&
    String(openBookingAppointmentId) === String(selectedSnapshotAppointmentId)
  );

  const isLatestPaymentTransaction = React.useCallback((transaction: RecentTransaction) => {
    if (!transaction.appointmentId) return true;

    const matchingTransactions = allTransactions.filter((txn) =>
      !isLegacyPaymentRow(txn) &&
      String(txn.appointmentId || "") === String(transaction.appointmentId || "")
    );

    if (matchingTransactions.length <= 1) return true;

    const latestTransaction = [...matchingTransactions].sort(comparePaymentTransactionsDesc)[0];

    return getPaymentTransactionKey(latestTransaction) === getPaymentTransactionKey(transaction);
  }, [allTransactions]);

  const isPaymentLogTransaction = React.useCallback((transaction: RecentTransaction) => {
    if (isLegacyPaymentRow(transaction) || !transaction.appointmentId) return false;

    const transactionSnapshot = (transaction as any).appointmentSnapshot;
    const currentAppointment =
      mockAppointmentHistoryLocal.find((apt: Appointment) => String(apt.id) === String(transaction.appointmentId)) ||
      patientAppointments.find((apt: Appointment) => String(apt.id) === String(transaction.appointmentId));

    if (transactionSnapshot && typeof transactionSnapshot === "object") {
      if (Object.prototype.hasOwnProperty.call(transactionSnapshot, "_isHistorical")) {
        return Boolean(transactionSnapshot._isHistorical);
      }

      const snapshotComparison = compareAppointmentSnapshotToCurrent(transactionSnapshot, currentAppointment);
      if (snapshotComparison.compared > 0) {
        return !snapshotComparison.matches;
      }
    }

    return !isLatestPaymentTransaction(transaction);
  }, [isLatestPaymentTransaction, mockAppointmentHistoryLocal, patientAppointments]);

  const toggleExpandTransactions = (id: string) => {
    setExpandedTransactions((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  const handleEditPaymentTransaction = React.useCallback((txn: RecentTransaction) => {
    const targetPaymentId = getEditablePaymentId(txn);
    const targetPatientId = patient.id ? String(patient.id) : "";

    if (!targetPaymentId) {
      toast.error(getPaymentEditUnavailableMessage(txn));
      return;
    }

    if (!targetPatientId) {
      toast.error("Could not find the patient for this payment");
      return;
    }

    openEditPaymentModal(
      targetPaymentId,
      txn as any,
      targetPatientId,
      mockAppointmentHistoryLocal as Appointment[]
    );
  }, [mockAppointmentHistoryLocal, openEditPaymentModal, patient.id]);

  const handleOpenSnapshot = (appointment: Appointment | HistoryAppointment, transaction?: RecentTransaction) => {
    try {
      console.log("[PatientProfile] handleOpenSnapshot called", { appointmentId: appointment?.id, doctor: appointment?.doctor, transactionId: transaction?.id });
    } catch (e) {}
    const originalAppointment = patientAppointments.find((apt: Appointment) => String(apt.id) === String(appointment.id));
    const transactionRow = transaction as (RecentTransaction & Record<string, any>) | undefined;
    const transactionSnapshot = transactionRow?.appointmentSnapshot && typeof transactionRow.appointmentSnapshot === "object"
      ? transactionRow.appointmentSnapshot
      : undefined;

    const isPaymentSnapshot = Boolean(transaction);
    const isHistoricalPaymentSnapshot = Boolean(transaction && isPaymentLogTransaction(transaction));
    const snapshotBase = {
      ...(originalAppointment || {}),
      ...appointment,
      ...(transactionSnapshot ? transactionSnapshot : {}),
    } as Appointment & Record<string, any>;
    const displayDate = toDateOnly(snapshotBase.date);
    const displayTime = snapshotBase.time || String(snapshotBase.date || "").split(" ")[1] || "";
    const price = Number(snapshotBase.price ?? 0);
    const transactionNewBalance = Number(transactionRow?.newBalance);
    const hasTransactionBalance = isPaymentSnapshot && Number.isFinite(transactionNewBalance);
    const totalPaid = hasTransactionBalance
      ? Math.max(0, price - transactionNewBalance)
      : Number(snapshotBase.totalPaid ?? 0);
    const snapshotBalance = Number(snapshotBase.balance);
    const balance = hasTransactionBalance
      ? transactionNewBalance
      : Number.isFinite(snapshotBalance)
        ? snapshotBalance
        : Math.max(0, price - totalPaid);
    const transactionPaymentDate =
      toDateOnly(transactionRow?.paymentDate) ||
      toDateOnly(transaction?.date) ||
      toDateOnly(snapshotBase.paymentDate);
    const logDate = transactionRow?.changedAt || transactionRow?.createdAt || transactionPaymentDate || snapshotBase.updatedAt || snapshotBase.createdAt || new Date().toISOString();
    const patientDisplayName =
      snapshotBase.patientName ||
      appointment.patientName ||
      originalAppointment?.patientName ||
      patient.name ||
      [patient.firstName, patient.lastName].filter(Boolean).join(" ");

    const tryResolveFromSnapshot = (s: any) => {
      if (!s) return undefined;
      return (
        resolveImageSource(s.doctorProfile) ||
        resolveImageSource(s.doctorProfilePicture) ||
        resolveImageSource(s.doctorPhoto) ||
        resolveImageSource(s.doctorImage) ||
        (s.doctor && resolveImageSource(s.doctor.profilePicture))
      );
    };

    let doctorImage = tryResolveFromSnapshot(snapshotBase) || tryResolveFromSnapshot(appointment) || tryResolveFromSnapshot(originalAppointment);
    if (!doctorImage && Array.isArray(doctors) && doctors.length) {
      const doctorName = String(snapshotBase.doctor || snapshotBase.doctorName || appointment.doctor || (appointment as any).doctorName || "").toLowerCase().trim();
      const matched = doctors.find((d) => (d.name || "").toLowerCase().trim() === doctorName) || doctors.find((d) => doctorName && (d.name || "").toLowerCase().includes(doctorName));
      if (matched && matched.profilePicture) doctorImage = resolveImageSource(matched.profilePicture);
    }

    // Normalize doctor into an object with a `name` property so downstream views can resolve it
    const rawDoctor = snapshotBase.doctor ?? (originalAppointment as any)?.doctor ?? (appointment as any).doctor ?? null;
    const normalizedDoctor: Record<string, any> = typeof rawDoctor === "string" && rawDoctor
      ? { name: rawDoctor }
      : rawDoctor && typeof rawDoctor === "object"
        ? rawDoctor
        : {};
    const doctorWithPicture = {
      ...normalizedDoctor,
      profilePicture: doctorImage || normalizedDoctor?.profilePicture || (appointment as any).doctorProfile || (originalAppointment as any)?.doctorProfile || "",
    };

    setSelectedSnapshot({
      ...snapshotBase,
      logType: isPaymentSnapshot ? "payment" : snapshotBase.logType,
      changeType: isPaymentSnapshot ? "payment" : snapshotBase.changeType,
      changedAt: logDate,
      changedBy: transactionRow?.changedBy || snapshotBase.changedBy,
      changedByName: transactionRow?.changedByName || snapshotBase.changedByName,
      patientName: patientDisplayName,
      patientProfile: formData.profilePicture || patient.profilePicture || "",
      patientProfilePicture: formData.profilePicture || patient.profilePicture || "",
      patient: {
        id: patient.id,
        name: patientDisplayName,
        firstName: patient.firstName,
        lastName: patient.lastName,
        profilePicture: formData.profilePicture || patient.profilePicture || "",
      },
      // attach resolved doctor image info so UI can prefer it
      doctorProfile: doctorWithPicture.profilePicture || (appointment as any).doctorProfile || (originalAppointment as any)?.doctorProfile || "",
      doctorProfilePicture: doctorWithPicture.profilePicture || (appointment as any).doctorProfilePicture || (originalAppointment as any)?.doctorProfilePicture || "",
      doctor: doctorWithPicture,
      date: displayDate,
      time: displayTime,
      price,
      totalPaid,
      balance,
      amount: transaction?.amount,
      paymentAmount: transaction?.amount,
      paymentDate: transactionPaymentDate || snapshotBase.paymentDate,
      paymentMethod: transaction?.method,
      paymentStatus: snapshotBase.paymentStatus || appointment.paymentStatus,
      transactionId: transaction?.transactionId,
      _paymentTransactionId: transaction?.transactionId || transaction?.id || snapshotBase._paymentTransactionId,
      _transactionId: transaction?.transactionId || transaction?.id || snapshotBase._transactionId,
      previousBalance: transactionRow?.previousBalance ?? snapshotBase.previousBalance,
      newBalance: transactionRow?.newBalance ?? snapshotBase.newBalance,
      _isHistorical: isHistoricalPaymentSnapshot,
    });
    setSelectedSnapshotIsHistorical(isHistoricalPaymentSnapshot);
    setSnapshotLogDate(logDate);
    setIsSnapshotOpen(true);
  };

  const handleOpenSnapshotAppointment = (appointmentId: string, appointmentSnapshot?: any) => {
    const appointment =
      patientAppointments.find((apt: Appointment) => String(apt.id) === String(appointmentId)) ||
      mockAppointmentHistoryLocal.find((apt: Appointment) => String(apt.id) === String(appointmentId)) ||
      selectedSnapshot ||
      appointmentSnapshot;

    if (!appointment || !appointment.id) {
      toast.error("Could not find appointment to open");
      return;
    }

    onOpenBookingModal?.(appointment as Appointment);
  };

  const handleOpenTransactionSnapshot = (transaction: RecentTransaction) => {
    const appointment = mockAppointmentHistoryLocal.find((apt: Appointment) => String(apt.id) === String(transaction.appointmentId))
      || patientAppointments.find((apt: Appointment) => String(apt.id) === String(transaction.appointmentId));

    if (!appointment) {
      toast.error("Could not find appointment for this payment");
      return;
    }

    handleOpenSnapshot(appointment, transaction);
  };

  const getTransactionPaymentDisplay = (transaction: RecentTransaction) => {
    if (isPaymentLogTransaction(transaction)) {
      return { label: "Log", className: "bg-gray-100 text-gray-700 border-gray-200", isLog: true };
    }

    return { label: "", className: "", isLog: false };
  };

  const uniqueDoctors = React.useMemo(() => {
    const doctors = new Set(mockAppointmentHistoryLocal.map(apt => apt.doctor).filter(Boolean));
    return ['all', ...Array.from(doctors)];
  }, [mockAppointmentHistoryLocal]);

  // Build a display-only history array (string `type`) derived from internal Appointment[]
  const mappedHistory: HistoryAppointment[] = React.useMemo(() => {
    return (mockAppointmentHistoryLocal || []).map((apt: Appointment) => ({
      ...apt,
      type: getAppointmentTypeName(apt.type as number, apt.customType) || String(apt.type || ''),
      date: String(apt.date || ''),
      transactions: apt.transactions || [],
    } as HistoryAppointment));
  }, [mockAppointmentHistoryLocal]);

  const uniqueProcedures = React.useMemo(() => {
      const procedures = new Set(mappedHistory.map(apt => apt.type).filter(Boolean));
      return ['all', ...Array.from(procedures) as string[]];
  }, [mappedHistory]);

  const filteredHistory = React.useMemo(() => {
    return mappedHistory.filter(apt => {
        if (historyPaymentStatusFilter !== 'all' && apt.paymentStatus !== historyPaymentStatusFilter) return false;
        if (historyAppointmentStatusFilter !== 'all' && apt.status !== historyAppointmentStatusFilter) return false;
        if (historyDoctorFilter !== 'all' && apt.doctor !== historyDoctorFilter) return false;
        if (historyProcedureFilter !== 'all' && String(apt.type) !== historyProcedureFilter) return false;
        
        if (historySearchFilter) {
          const search = historySearchFilter.toLowerCase();
          const match = 
            String(apt.type || '').toLowerCase().includes(search) ||
            String(apt.doctor || '').toLowerCase().includes(search) ||
            String(apt.notes || '').toLowerCase().includes(search);
          if (!match) return false;
        }

        return true;
    });
  }, [mappedHistory, historyPaymentStatusFilter, historyAppointmentStatusFilter, historyDoctorFilter, historyProcedureFilter, historySearchFilter]);

  // Filters for Payments tab
  const [paymentDoctorFilter, setPaymentDoctorFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [paymentProcedureFilter, setPaymentProcedureFilter] = useState('all');

  const uniquePaymentDoctors = React.useMemo(() => {
    const doctors = new Set(allTransactions.map(t => t.doctor).filter(Boolean).map(String));
    return ['all', ...Array.from(doctors)];
  }, [allTransactions]);

  const uniquePaymentMethods = React.useMemo(() => {
    const methods = new Set(allTransactions.map(t => t.method).filter(Boolean).map(String));
    return ['all', ...Array.from(methods)];
  }, [allTransactions]);

  const uniquePaymentProcedures = React.useMemo(() => {
    const procedures = new Set(allTransactions.map(t => t.appointmentType).filter(Boolean).map(String));
    return ['all', ...Array.from(procedures)];
  }, [allTransactions]);

  useEffect(() => {
    if (paymentDoctorFilter !== 'all' && !uniquePaymentDoctors.includes(paymentDoctorFilter)) setPaymentDoctorFilter('all');
  }, [paymentDoctorFilter, uniquePaymentDoctors]);

  useEffect(() => {
    if (paymentMethodFilter !== 'all' && !uniquePaymentMethods.includes(paymentMethodFilter)) setPaymentMethodFilter('all');
  }, [paymentMethodFilter, uniquePaymentMethods]);

  useEffect(() => {
    if (paymentProcedureFilter !== 'all' && !uniquePaymentProcedures.includes(paymentProcedureFilter)) setPaymentProcedureFilter('all');
  }, [paymentProcedureFilter, uniquePaymentProcedures]);

  const filteredTransactions = React.useMemo(() => {
    return allTransactions.filter(t => {
      if (doctorFilter && t.doctor !== doctorFilter) return false;
      if (paymentDoctorFilter !== 'all' && t.doctor !== paymentDoctorFilter) return false;
      if (paymentMethodFilter !== 'all' && t.method !== paymentMethodFilter) return false;
      if (paymentProcedureFilter !== 'all' && t.appointmentType !== paymentProcedureFilter) return false;
      return true;
    });
  }, [allTransactions, doctorFilter, paymentDoctorFilter, paymentMethodFilter, paymentProcedureFilter]);

  const getPaymentMethodIcon = (method: string) => {
    switch ((method || '').toLowerCase()) {
      case 'cash':
        return <DollarSign className="h-4 w-4" />;
      case 'card':
      case 'credit':
      case 'credit card':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const normalizePaymentStatusValue = (value?: string | null) => {
    return normalizePaymentStatus(value);
  };

  const getAppointmentStatusBadge = (status: string) => {
    const statusOption = getAppointmentStatusOptionWithColors(status || "scheduled", APPOINTMENT_STATUSES);

    return (
      <Badge className={`${statusOption.bgColor} ${statusOption.textColor} border-none hover:opacity-80 font-medium capitalize`}>
        {statusOption.label || status}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusOption = getPaymentStatusOptionWithColors(status || "unpaid", PAYMENT_STATUSES);

    return (
      <Badge className={`${statusOption.bgColor} ${statusOption.textColor} border-none hover:opacity-80 font-medium capitalize`}>
        {statusOption.label || status || "Unpaid"}
      </Badge>
    );
  };

  useEffect(() => {
    const fetchFamilyData = async () => {
      if (activeTab !== "family" || !patient?.id) return;

      try {
        setIsLoadingFamily(true);

        // 1. If this patient has a parentId, fetch the parent
        if (patient.parentId && patient.parentId !== patient.id) {
          const parentRes = await fetch(apiUrl(`/api/patients/${encodeURIComponent(patient.parentId)}`), {
            headers: getAuthHeaders(),
            credentials: 'include',
          });
          const parentJson = await parentRes.json();
          if (parentJson.success) {
            setParentPatient(parentJson.data);
          }
        } else {
          setParentPatient(null);
        }

        // 2. Fetch all dependents (patients where parentId is this patient's id)
        const familyRes = await fetch(apiUrl(`/api/patients?parentId=${encodeURIComponent(patient.id)}`), {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const familyJson = await familyRes.json();
        if (familyJson.success) {
          // Filter out the current patient from the family list
          setFamilyMembers(familyJson.data.filter((m: Patient) => m.id !== patient.id));
        }
      } catch (err) {
        console.error("Error fetching family data:", err);
      } finally {
        setIsLoadingFamily(false);
      }
    };

    fetchFamilyData();
  }, [activeTab, patient]);

  useImperativeHandle(ref, () => ({
    save: handleUpdatePatient,
    discardDraft: discardStoredDraft,
    changedFields,
  }));

  useEffect(() => {
    const incomingPatientId = patient.id ? String(patient.id) : "";
    const currentLoadedPatientId = loadedPatient.id ? String(loadedPatient.id) : "";
    if (incomingPatientId && incomingPatientId === currentLoadedPatientId && hasTrackedChanges) {
      setLoadedPatient(patient);
      return;
    }

    const loadedData = {
      firstName: patient.firstName || patient.name?.split(' ')[0] || '',
      lastName: patient.lastName || patient.name?.split(' ').slice(1).join(' ') || '',
      email: patient.email || '',
      phone: patient.phone || '',
      alternateEmail: patient.alternateEmail || '',
      alternatePhone: patient.alternatePhone || '',
      dateOfBirth: patient.dateOfBirth || '',
      insurance: patient.insurance || '',
      balance: patient.balance ?? 0,
      status: patient.status || 'active',
      createdAt: patient.createdAt ? new Date(patient.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      allergies: patient.allergies || '',
      medicalHistory: patient.medicalHistory || '',
      treatmentPlan: patient.treatmentPlan || '',
      clinicalNotes: patient.clinicalNotes || '',
      address: patient.address || '',
      city: patient.city || '',
      zipCode: patient.zipCode || '',
      emergencyContact: patient.emergencyContact || '',
      emergencyPhone: patient.emergencyPhone || '',
      notes: patient.notes || '',
      profilePicture: patient.profilePicture || '',
      dentalCharts: patient.dentalCharts || []
    };
    setLoadedPatient(patient);
    setFormData(loadedData);
    setOriginalLoadedData(loadedData);
    setQuestionnaireLoadedPatientId(null);
  }, [loadedPatient.id, patient]);

  useEffect(() => {
    if (!currentPatientId || draftCheckPatientId === currentPatientId) return;

    const draft = readPatientProfileDraft();
    if (draft?.patientId === currentPatientId) {
      setFormData((current) => ({
        ...current,
        ...draft.formData,
      }));
      setOriginalLoadedData((current) => ({
        ...current,
        ...draft.originalLoadedData,
      }));
      setQuestionnaireAnswers(draft.questionnaireAnswers || {});
      setSavedQuestionnaireAnswers(draft.savedQuestionnaireAnswers || {});
      setPatientQuestionnaireData(draft.patientQuestionnaireData || {});
      setQuestionnaireQuestions(draft.questionnaireQuestions || []);
      setQuestionnaireLoadedPatientId(currentPatientId);
      setActiveTab(draft.activeTab || "info");
      setHasRestoredQuestionnaireDraft((draft.questionnaireQuestions || []).length > 0);
      setIsRecoveryDialogOpen(true);
      setIsModified(true);
    }

    setDraftCheckPatientId(currentPatientId);
  }, [currentPatientId, draftCheckPatientId, setIsModified]);

  useEffect(() => {
    if (!currentPatientId || draftCheckPatientId !== currentPatientId) return;

    if (!hasTrackedChanges) {
      clearPatientProfileDraft(currentPatientId);
      return;
    }

    writePatientProfileDraft({
      version: 1,
      patientId: currentPatientId,
      patientName: patientDisplayName,
      path: typeof window === "undefined" ? `/receptionist/patients/${encodeURIComponent(patientDisplayName)}` : window.location.pathname,
      updatedAt: new Date().toISOString(),
      activeTab,
      formData,
      originalLoadedData,
      questionnaireAnswers,
      savedQuestionnaireAnswers,
      patientQuestionnaireData,
      questionnaireQuestions,
    });
  }, [
    activeTab,
    currentPatientId,
    draftCheckPatientId,
    formData,
    hasTrackedChanges,
    originalLoadedData,
    patientDisplayName,
    patientQuestionnaireData,
    questionnaireAnswers,
    questionnaireQuestions,
    savedQuestionnaireAnswers,
  ]);

  useEffect(() => {
    if (!shouldLoadHistoryData) return;

    // If doctorFilter is set, fetch appointments directly from API for this patient
    // This ensures we get the doctor's appointments even if shared state is empty
    if (doctorFilter) {
      const fetchPatientAppointments = async () => {
        try {
          const response = await fetch(
            apiUrl(`/api/appointments?doctor=${encodeURIComponent(doctorFilter)}&patientId=${encodeURIComponent(String(patient.id || ""))}`),
            { headers: getAuthHeaders(), credentials: 'include' }
          );
          const result = await response.json();
          if (result.success && result.data) {
            const filtered = (result.data as Appointment[]).sort((a: Appointment, b: Appointment) =>
              parseBackendDateToLocal(b.date).getTime() - parseBackendDateToLocal(a.date).getTime()
            );
            setPatientAppointments(filtered);
          }
        } catch (error) {
          console.error("Error fetching patient appointments:", error);
          setPatientAppointments([]);
        }
      };
      fetchPatientAppointments();
    } else {
      const fetchPatientAppointments = async () => {
        const fallback = appointments.filter((apt: Appointment) =>
          apt.patientId === patient.id ||
          apt.patientName === `${patient.firstName} ${patient.lastName}` ||
          apt.patientName === patient.name
        ).sort((a: Appointment, b: Appointment) => parseBackendDateToLocal(b.date).getTime() - parseBackendDateToLocal(a.date).getTime());

        if (!patient.id) {
          setPatientAppointments(fallback);
          return;
        }

        try {
          const response = await fetch(
            apiUrl(`/api/appointments?patientId=${encodeURIComponent(patient.id)}`),
            { headers: getAuthHeaders(), credentials: 'include' }
          );
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) {
            const fetched = result.data.sort((a: Appointment, b: Appointment) =>
              parseBackendDateToLocal(b.date).getTime() - parseBackendDateToLocal(a.date).getTime()
            );
            setPatientAppointments(fetched);
            return;
          }
        } catch (error) {
          console.error("Error fetching patient appointments:", error);
        }

        setPatientAppointments(fallback);
      };

      fetchPatientAppointments();
    }
  }, [appointments, patient, doctorFilter, shouldLoadHistoryData, refreshTrigger, dataRefreshKey]);

  useEffect(() => {
    const summary = buildPatientAppointmentSummary(loadedPatient, patientAppointments);
    const summaryBalance = patientAppointments.length > 0 ? summary.appointmentBalance : summary.balance;

    setFormData((prev) => {
      if (prev.balance === summaryBalance && prev.status === summary.status) return prev;
      return {
        ...prev,
        balance: summaryBalance,
        status: summary.status,
      };
    });

    setOriginalLoadedData((prev) => {
      if (prev.balance === summaryBalance && prev.status === summary.status) return prev;
      return {
        ...prev,
        balance: summaryBalance,
        status: summary.status,
      };
    });
  }, [loadedPatient, patientAppointments]);

    // Map patientAppointments into local appointment history shape used for payments
    useEffect(() => {
  const mapped: Appointment[] = patientAppointments.map((apt: Appointment, i: number) => {
        const id = apt.id || `apt-${i}`;
        const cost = (apt.price != null ? apt.price : 0);
        const totalPaid = apt.totalPaid != null ? apt.totalPaid : 0;
        const transactions = apt.transactions ? apt.transactions : [];

        let computedPaymentStatus: Appointment["paymentStatus"] | "over-paid";
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const aptDateStr = (apt.date || '').split(' ')[0];
        const appointmentDate = parseBackendDateToLocal(aptDateStr);

        if (totalPaid > cost && cost > 0) {
          computedPaymentStatus = 'over-paid';
        } else if (totalPaid > 0 && totalPaid < cost) {
          computedPaymentStatus = 'half-paid';
        } else if (totalPaid >= cost && cost > 0) {
          computedPaymentStatus = 'paid';
        } else if (totalPaid === 0 && cost > 0 && appointmentDate < oneWeekAgo) {
          computedPaymentStatus = 'overdue';
        } else {
          computedPaymentStatus = 'unpaid';
        }

        // Prefer the stored appointment.paymentStatus (server-authoritative) or any legacy snapshot
        const storedStatusRaw = (apt as any).paymentStatus;
        const storedStatus = normalizePaymentStatusValue(storedStatusRaw) || '';
        const paymentStatus = storedStatus || (computedPaymentStatus as string);

        return {
            ...apt,
            id,
            date: apt.date + (apt.time ? ` ${formatTimeTo12h(apt.time)}` : ''),
            // keep internal type numeric if available
            type: (typeof apt.type === 'number' ? apt.type : 0) as number,
            doctor: apt.doctor || '',
            notes: apt.notes || '',
            price: cost,
            totalPaid,
            paymentStatus: paymentStatus as Appointment["paymentStatus"],
            transactions: transactions,
          } as Appointment;
      });

      const applyTransactions = (payments: PaymentRow[] = [], paymentLogs: PaymentLogRow[] = [], appointmentLogs: AppointmentLogRow[] = []) => {
        const normalized = buildPatientTransactions(mapped, payments, paymentLogs, appointmentLogs);
        const paymentsByAppointment = new Map<string, RecentTransaction[]>();

        normalized.forEach((txn) => {
          if (!txn.appointmentId) return;
          const existing = paymentsByAppointment.get(txn.appointmentId) || [];
          paymentsByAppointment.set(txn.appointmentId, [...existing, txn]);
        });

        const mergedHistory = mapped.map((apt) => {
          const transactions = paymentsByAppointment.get(apt.id) || [];
          const totalPaid = Number(apt.totalPaid || 0);

          const price = Number(apt.price || 0);
          let computedPaymentStatus: Appointment["paymentStatus"] | "over-paid";
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          const aptDateStr = (apt.date || '').split(' ')[0];
          const appointmentDate = parseBackendDateToLocal(aptDateStr);

          if (totalPaid > price && price > 0) {
            computedPaymentStatus = 'over-paid';
          } else if (totalPaid > 0 && totalPaid < price) {
            computedPaymentStatus = 'half-paid';
          } else if (totalPaid >= price && price > 0) {
            computedPaymentStatus = 'paid';
          } else if (totalPaid === 0 && price > 0 && appointmentDate < oneWeekAgo) {
            computedPaymentStatus = 'overdue';
          } else {
            computedPaymentStatus = 'unpaid';
          }

          // If any transaction includes an appointment snapshot with an explicit paymentStatus, prefer it
          const snapshotTxn = transactions.find((t) => (t as any).appointmentSnapshot && (t as any).appointmentSnapshot.paymentStatus);
          const snapshotStatus = snapshotTxn ? normalizePaymentStatusValue((snapshotTxn as any).appointmentSnapshot.paymentStatus) : '';

          // The appointment row should reflect the latest appointment record.
          // Payment log snapshots are only history rows and must not override it.
          const storedStatus = normalizePaymentStatusValue((apt as any).paymentStatus);
          const finalPaymentStatus = storedStatus || snapshotStatus || (computedPaymentStatus as string);

          return {
            ...apt,
            totalPaid,
            transactions,
            paymentStatus: finalPaymentStatus as Appointment["paymentStatus"],
          } as Appointment;
        });

        setMockAppointmentHistoryLocal(mergedHistory);
        setAllTransactions(normalized);
      };

      applyTransactions();
      if (!shouldLoadFinancialLog) return;

      const controller = new AbortController();
      const loadPersistedTransactions = async () => {
        const headers = getAuthHeaders({ "Content-Type": "application/json" });
        const appointmentIds = Array.from(new Set(mapped.map((apt) => apt.id).filter(Boolean)));

        const fetchPatientPayments = async (): Promise<PaymentRow[]> => {
          if (!patient?.id) return [];

          try {
            const res = await fetch(apiUrl(`/api/payments/patient/${encodeURIComponent(String(patient.id))}`), {
              headers,
              credentials: 'include',
              signal: controller.signal,
            });
            const json = await res.json().catch(() => null);

            return json?.success && Array.isArray(json.data) ? json.data as PaymentRow[] : [];
          } catch (err) {
            if ((err as any)?.name !== "AbortError") {
              console.warn('[Payments] Failed to fetch patient payments:', err);
            }
            return [];
          }
        };

        const fetchAppointmentPaymentLogs = async (): Promise<PaymentLogRow[]> => {
          if (appointmentIds.length === 0) return [];

          const logSets = await Promise.all(
            appointmentIds.map(async (appointmentId) => {
              try {
                const res = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(String(appointmentId))}/payments`), {
                  headers,
                  credentials: 'include',
                  signal: controller.signal,
                });
                const json = await res.json().catch(() => null);

                return res.ok && json?.success && Array.isArray(json.data) ? json.data as PaymentLogRow[] : [];
              } catch (err) {
                if ((err as any)?.name !== "AbortError") {
                  console.warn(`[Payments] Failed to fetch appointment payment logs for ${appointmentId}:`, err);
                }
                return [];
              }
            })
          );

          return logSets.flat();
        };

        const fetchAppointmentLogs = async (): Promise<AppointmentLogRow[]> => {
          if (appointmentIds.length === 0) return [];

          const logSets = await Promise.all(
            appointmentIds.map(async (appointmentId) => {
              try {
                const res = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(String(appointmentId))}/logs`), {
                  headers,
                  credentials: 'include',
                  signal: controller.signal,
                });
                const json = await res.json().catch(() => null);

                return res.ok && json?.success && Array.isArray(json.data) ? json.data as AppointmentLogRow[] : [];
              } catch (err) {
                if ((err as any)?.name !== "AbortError") {
                  console.warn(`[Payments] Failed to fetch appointment logs for ${appointmentId}:`, err);
                }
                return [];
              }
            })
          );

          return logSets.flat();
        };

        const [payments, paymentLogs, appointmentLogs] = await Promise.all([
          fetchPatientPayments(),
          fetchAppointmentPaymentLogs(),
          fetchAppointmentLogs(),
        ]);

        if (!controller.signal.aborted) {
          applyTransactions(payments, paymentLogs, appointmentLogs);
        }
      };

      loadPersistedTransactions().catch((err) => {
        if ((err as any)?.name !== "AbortError") {
          console.warn('[Payments] Failed to load persisted payment history:', err);
        }
      });

      return () => controller.abort();
    }, [buildPatientTransactions, patientAppointments, patient?.id, shouldLoadFinancialLog]);

  const handleUpdatePatient = async () => {
    console.log("=== UPDATE PATIENT BUTTON CLICKED ===");
    console.log("Patient ID:", patient.id);
    console.log("Form data:", formData);

    setIsSaving(true);
    try {
      const response = await fetch(apiUrl(`/api/patients/${patient.id}`), { method: "PUT", headers: getAuthHeaders({ "Content-Type": "application/json" }), credentials: 'include', body: JSON.stringify({ ...formData }) });

      const result = await response.json().catch(() => null);
      console.log("Update response:", result);
      if (!response.ok || result?.success === false) {
        if (response.status === 413) {
          toast.error("The patient photo is still too large. Please choose a smaller image.");
          return false;
        }

        toast.error(result?.message || "Failed to update patient");
        return false;
      }

      if (result?.success) {
        setOriginalLoadedData(formData);

        const questionnaireSaved = await saveQuestionnaireAnswers();
        if (!questionnaireSaved) {
          refreshPatients();
          return false;
        }

        toast.success("Patient updated successfully");
        refreshPatients();
        discardStoredDraft();
        setIsModified(false);
        return true; // Indicate success
      }

      toast.error("Failed to update patient");
      return false; // Indicate failure
    } catch (err) {
      console.error("Error updating patient:", err);
      toast.error("Error connecting to server. Make sure the backend is running on port 3001.");
      return false; // Indicate failure
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePayment = async (paymentId: string, appointmentId?: string) => {
    console.log("=== DELETE PAYMENT STARTED ===");
    console.log("Payment ID:", paymentId);
    console.log("Appointment ID:", appointmentId);

    if (paymentId.startsWith("legacy-")) {
      toast.error("This payment total comes from legacy appointment data and cannot be deleted here.");
      return;
    }

    try {
      const deleteUrl = apiUrl(`/api/payments/${paymentId}`);
      console.log("DELETE URL:", deleteUrl);

      const response = await fetch(deleteUrl, {
        method: "DELETE",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
      });

      console.log("Response Status:", response.status);
      console.log("Response OK:", response.ok);

      const result = await response.json();
      console.log("Response JSON:", result);

      if (result.success) {
        toast.success("Payment deleted successfully");
        setAllTransactions((prev) => prev.filter((txn) => txn.id !== paymentId));
        setMockAppointmentHistoryLocal((prev) => prev.map((apt) => {
          if (appointmentId && apt.id !== appointmentId) return apt;
          const newTransactions = apt.transactions?.filter((txn: RecentTransaction) => txn.id !== paymentId) || [];
          if (appointmentId && apt.id === appointmentId) {
            return {
              ...apt,
              transactions: newTransactions,
              totalPaid: newTransactions.reduce((sum: number, txn: RecentTransaction) => sum + Number(txn.amount || 0), 0),
            };
          }
          return {
            ...apt,
            transactions: newTransactions,
          };
        }));
        console.log("Delete successful, refreshing patients...");
        // Refresh the appointments to reflect the deletion
        refreshPatients();
      } else {
        console.log("Delete failed with message:", result.message);
        toast.error(result.message || "Failed to delete payment");
      }
    } catch (err) {
      console.error("Error deleting payment:", err);
      toast.error("Error deleting payment");
    }
  };

  const handleDeleteLegacyPayment = async (appointmentId: string) => {
    if (!appointmentId) return;
    try {
      setPdConfirmLoading(true);

      const res = await fetch(apiUrl(`/api/appointments/${appointmentId}`), {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ totalPaid: 0 }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.message || "Failed to remove recorded total");
        return;
      }

      // Update local state to remove legacy transaction rows for this appointment
      setMockAppointmentHistoryLocal((prev) => prev.map((apt) => {
        if (String(apt.id) !== String(appointmentId)) return apt;
        return {
          ...apt,
          totalPaid: 0,
          transactions: (apt.transactions || []).filter((t: RecentTransaction) => !String(t.id || "").startsWith("legacy-")),
        };
      }));

      setAllTransactions((prev) => prev.filter((txn) => !(String(txn.appointmentId || "") === String(appointmentId) && String(txn.id || "").startsWith("legacy-"))));

      // Refresh server-side view
      refreshPatients();
      toast.success("Recorded total removed");
    } catch (err) {
      console.error("Error removing recorded total:", err);
      toast.error("Error removing recorded total");
    } finally {
      setPdConfirmLoading(false);
    }
  };

  const handleSaveRecoveredDraft = async () => {
    setIsRecoverySaving(true);
    try {
      const saved = await handleUpdatePatient();
      if (saved) setIsRecoveryDialogOpen(false);
    } finally {
      setIsRecoverySaving(false);
    }
  };

  const handleDiscardRecoveredDraft = () => {
    discardStoredDraft();
    setFormData(originalLoadedData);
    setQuestionnaireAnswers(savedQuestionnaireAnswers);
    setIsModified(false);
  };

  const textareaClass = "mt-1.5 min-h-24 rounded-lg border-slate-200 bg-white text-slate-900 shadow-none focus-visible:ring-violet-200";
  const cardClass = "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm";
  const cardHeaderClass = "border-b border-slate-100 bg-white px-5 py-5 sm:px-6";
  const cardContentClass = "space-y-6 p-5 sm:p-6";
  return (
    <div className="flex-1 overflow-hidden bg-slate-50">
      <div className="h-full flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} data-tour-id="patient-details-tabs" className="flex-1 flex flex-col overflow-hidden">
          {/* Modern Navigation Tabs */}
          <div className="shrink-0 bg-slate-50 px-4 pb-4 pt-5 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1920px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <TabsList className="flex h-auto min-h-14 w-full justify-start gap-0 overflow-x-auto overflow-y-hidden rounded-none border-none bg-transparent p-0">
              {[
                { value: "info", label: "Personal Info", icon: UserIcon },
                { value: "family", label: "Family & Relations", icon: Users },
                { value: "records", label: "Medical Records", icon: FileText },
                { value: "questionnaire", label: "Questionnaire", icon: ClipboardList },
                { value: "chart", label: "Dental Chart", icon: Activity },
                { value: "history", label: "Visit History", icon: History },
                { value: "payments", label: "Financial Log", icon: PaymentIcon },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  data-tour-id={`patient-details-${tab.value}-tab`}
                  className="group relative h-14 min-w-[165px] flex-1 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-1 pt-1 text-sm font-bold text-slate-500 transition-all data-[state=active]:border-violet-600 data-[state=active]:bg-violet-50/30 data-[state=active]:text-violet-600 hover:bg-slate-50 hover:text-slate-800 sm:px-4"
                >
                  <div className="flex items-center gap-2">
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
            </div>
          </div>

          <div data-tour-id="patient-details-scroll-area" className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-8 sm:px-6 lg:px-8">
            <TabsContent value="info" data-tour-id="patient-details-info-content" className="mt-0 outline-none">
                <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-8 2xl:gap-10">
                {/* Left Column: Profile Insight Card */}
                <div className="min-w-0 space-y-6 xl:space-y-8">
                  <Card className="border-none shadow-xl ring-1 ring-slate-200 overflow-hidden bg-white">
                    <div className="h-32 bg-gradient-to-br from-violet-600 via-violet-500 to-fuchsia-500" />
                    <CardContent className="-mt-16 px-5 pb-7 pt-0 text-center sm:px-8 sm:pb-10">
                      <div className="relative inline-block group">
                        <PatientAvatar src={resolveImageSource(formData.profilePicture)} name={patientDisplayName} dob={formData.dateOfBirth || patient?.dateOfBirth || patient?.dob || patient?.birthday} className="h-36 w-36 border-[6px] border-white bg-white shadow-2xl transition-transform duration-300 group-hover:scale-105" sizeClass="h-36 w-36 rounded-full" />
                        <Label
                          htmlFor={patientPhotoInputId}
                          className="absolute bottom-2 right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-4 border-white bg-violet-600 text-white shadow-xl transition-all hover:scale-110 active:scale-90 hover:bg-violet-700"
                        >
                          <Camera className="h-5 w-5" />
                          <Input
                            id={patientPhotoInputId}
                            type="file"
                            accept="image/*"
                            onChange={handlePatientPhotoSelect}
                            disabled={isSaving || isPreparingPatientPhoto}
                            className="sr-only"
                          />
                        </Label>
                      </div>

                      <div className="mt-6 space-y-1">
                        <h3 className="text-2xl font-black text-slate-900 leading-tight">{patientDisplayName}</h3>
                        <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-400">
                          <Info className="h-3.5 w-3.5" />
                          PID: {patient.id || "Unregistered"}
                        </div>
                      </div>

                      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isSaving || isPreparingPatientPhoto}
                          asChild
                          className="h-11 border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <Label htmlFor={patientPhotoInputId} className="cursor-pointer">
                            <Upload className="mr-2 h-4 w-4" />
                            Upload / Edit Photo
                          </Label>
                        </Button>
                        {formData.profilePicture && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemovePatientPhoto}
                            className="h-11 text-red-600 hover:bg-red-50 font-bold transition-colors"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </CardContent>
                    <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-6 sm:px-8">
                      <div className="grid grid-cols-2 gap-4 text-center sm:gap-8 xl:grid-cols-1 2xl:grid-cols-2">
                        <div className="space-y-1">
                          <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Total Encounters</span>
                          <span className="text-2xl font-black text-slate-800">{patientAppointments.length}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Upcoming</span>
                          <span className="text-sm font-black text-violet-600 truncate block">
                            {patient.nextAppointment ? formatPatientLogDate(patient.nextAppointment, "No Schedule") : "No Schedule"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="border-none bg-white shadow-xl ring-1 ring-slate-200">
                    <CardHeader className="pb-4 border-b border-slate-50">
                      <CardTitle className="text-base font-black flex items-center gap-2 text-slate-800 uppercase tracking-tight">
                        <HeartPulse className="h-5 w-5 text-red-500" />
                        Clinical Alert
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          Allergies
                          {formData.allergies && <AlertCircle className="h-3 w-3 text-red-500 animate-pulse" />}
                        </Label>
                        <Textarea
                          placeholder="List known allergies (e.g., Penicillin, Latex)..."
                          value={formData.allergies}
                          onChange={(e) => { setFormData(prev => ({ ...prev, allergies: e.target.value })); setIsModified(true); }}
                          className="min-h-[90px] bg-slate-50/50 border-slate-200 resize-none text-sm font-medium focus:ring-violet-200 transition-all rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Medical Backdrop</Label>
                        <Textarea
                          placeholder="Chronic conditions, surgeries, medications..."
                          value={formData.medicalHistory}
                          onChange={(e) => { setFormData(prev => ({ ...prev, medicalHistory: e.target.value })); setIsModified(true); }}
                          className="min-h-[120px] bg-slate-50/50 border-slate-200 resize-none text-sm font-medium focus:ring-violet-200 transition-all rounded-xl"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                  {/* Right Column: Detailed Forms */}
                  <div className="min-w-0 space-y-6 pb-10 xl:space-y-8 xl:pb-12">
                  {/* Identity Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-2 rounded-full bg-violet-600 shadow-lg shadow-violet-200" />
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Identity & Account</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Personal Identification Details</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 sm:gap-6 sm:p-6 2xl:grid-cols-3 2xl:p-7">
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">First Name</Label>
                        <Input
                          value={formData.firstName}
                          onChange={(e) => { setFormData(prev => ({ ...prev, firstName: e.target.value })); setIsModified(true); }}
                          className="h-12 bg-slate-50/30 border-slate-200 font-bold text-slate-800 rounded-xl focus:ring-violet-200"
                        />
                      </div>
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Name</Label>
                        <Input
                          value={formData.lastName}
                          onChange={(e) => { setFormData(prev => ({ ...prev, lastName: e.target.value })); setIsModified(true); }}
                          className="h-12 bg-slate-50/30 border-slate-200 font-bold text-slate-800 rounded-xl focus:ring-violet-200"
                        />
                      </div>
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Birth Date</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                          <Input
                            type="date"
                            value={formData.dateOfBirth}
                            onChange={(e) => { setFormData(prev => ({ ...prev, dateOfBirth: e.target.value })); setIsModified(true); }}
                            className="h-12 pl-11 bg-slate-50/30 border-slate-200 font-bold text-slate-800 rounded-xl focus:ring-violet-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) => { setFormData(prev => ({ ...prev, status: value })); setIsModified(true); }}
                        >
                          <SelectTrigger className="h-12 bg-slate-50/30 border-slate-200 font-bold text-slate-800 rounded-xl focus:ring-violet-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200">
                            <SelectItem value="active" className="font-bold text-emerald-600">Active Patient</SelectItem>
                            <SelectItem value="overdue" className="font-bold text-amber-600">Pending Review</SelectItem>
                            <SelectItem value="inactive" className="font-bold text-slate-500">Inactive Record</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ledger Balance (PHP)</Label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">₱</span>
                          <Input
                            type="number"
                            value={formData.balance}
                            onChange={(e) => { setFormData(prev => ({ ...prev, balance: parseFloat(e.target.value) || 0 })); setIsModified(true); }}
                            className="h-12 pl-10 bg-slate-50/30 border-slate-200 font-black text-slate-900 rounded-xl focus:ring-violet-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Insurance Carrier</Label>
                        <div className="relative">
                          <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                          <Input
                            value={formData.insurance}
                            onChange={(e) => { setFormData(prev => ({ ...prev, insurance: e.target.value })); setIsModified(true); }}
                            placeholder="Provider Name"
                            className="h-12 pl-11 bg-slate-50/30 border-slate-200 font-bold text-slate-800 rounded-xl focus:ring-violet-200"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Communication & Location Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-2 rounded-full bg-blue-600 shadow-lg shadow-blue-200" />
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Contact & Location</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reachability & Residence Information</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 sm:gap-6 sm:p-6 2xl:p-7">
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                          <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => { setFormData(prev => ({ ...prev, email: e.target.value })); setIsModified(true); }}
                            className="h-12 pl-11 bg-slate-50/30 border-slate-200 font-bold text-slate-800 rounded-xl focus:ring-violet-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Phone</Label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                          <Input
                            value={formData.phone}
                            onChange={(e) => { setFormData(prev => ({ ...prev, phone: e.target.value })); setIsModified(true); }}
                            className="h-12 pl-11 bg-slate-50/30 border-slate-200 font-bold text-slate-800 rounded-xl focus:ring-violet-200"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2 space-y-2.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Address</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3.5 top-4 h-4.5 w-4.5 text-slate-400" />
                          <Input
                            value={formData.address}
                            onChange={(e) => { setFormData(prev => ({ ...prev, address: e.target.value })); setIsModified(true); }}
                            className="h-12 pl-11 bg-slate-50/30 border-slate-200 font-bold text-slate-800 rounded-xl focus:ring-violet-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">City</Label>
                        <Input
                          value={formData.city}
                          onChange={(e) => { setFormData(prev => ({ ...prev, city: e.target.value })); setIsModified(true); }}
                          className="h-12 bg-slate-50/30 border-slate-200 font-bold text-slate-800 rounded-xl focus:ring-violet-200"
                        />
                      </div>
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Zip Code</Label>
                        <Input
                          value={formData.zipCode}
                          onChange={(e) => { setFormData(prev => ({ ...prev, zipCode: e.target.value })); setIsModified(true); }}
                          className="h-12 bg-slate-50/30 border-slate-200 font-bold text-slate-800 rounded-xl focus:ring-violet-200"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Emergency Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-2 rounded-full bg-red-600 shadow-lg shadow-red-200" />
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Emergency Contact</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Crisis Contact Information</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-5 rounded-lg border border-red-100 bg-red-50/30 p-5 shadow-sm md:grid-cols-2 sm:gap-6 sm:p-6 2xl:p-7">
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-red-600 uppercase tracking-wider">Contact Person</Label>
                        <Input
                          value={formData.emergencyContact}
                          onChange={(e) => { setFormData(prev => ({ ...prev, emergencyContact: e.target.value })); setIsModified(true); }}
                          className="h-12 bg-white border-red-100 font-bold text-slate-800 rounded-xl focus:ring-red-200"
                        />
                      </div>
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-red-600 uppercase tracking-wider">Emergency Phone</Label>
                        <Input
                          value={formData.emergencyPhone}
                          onChange={(e) => { setFormData(prev => ({ ...prev, emergencyPhone: e.target.value })); setIsModified(true); }}
                          className="h-12 bg-white border-red-100 font-bold text-slate-800 rounded-xl focus:ring-red-200"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Additional Notes Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-2 rounded-full bg-slate-400 shadow-lg shadow-slate-100" />
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Internal Notes</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Supplemental Administrative Notes</p>
                      </div>
                    </div>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => { setFormData(prev => ({ ...prev, notes: e.target.value })); setIsModified(true); }}
                      placeholder="Internal administrative notes about the patient..."
                      className="min-h-[140px] rounded-lg border-slate-200 bg-white p-5 text-base font-medium shadow-sm focus:ring-violet-200 sm:p-6"
                    />
                  </section>
                </div>
              </div>
            </TabsContent>

            {/* Family & Relations Tab */}
            <TabsContent value="family" data-tour-id="patient-details-family-content" className="mt-0 outline-none">
              <div className="mx-auto w-full max-w-[1680px] space-y-8 py-2 sm:py-4">
                <div className="flex flex-col items-start justify-between gap-4 overflow-hidden rounded-lg bg-violet-600 p-5 text-white shadow-xl shadow-violet-100 sm:p-7 md:flex-row md:items-center">
                  <div className="relative z-10">
                    <h2 className="text-2xl font-black tracking-tight">Family Network</h2>
                    <p className="text-violet-100 font-medium opacity-90">Manage household connections and shared information</p>
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black uppercase tracking-widest text-violet-200">Account Type</p>
                      <p className="text-lg font-black">{patient.isPrimary ? "Primary Holder" : "Dependent Record"}</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                      {patient.isPrimary ? <ShieldCheck className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
                  <Card className="border-none shadow-xl ring-1 ring-slate-200 bg-white overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/80 py-5 sm:py-6">
                      <CardTitle className="text-lg font-black flex items-center gap-3 text-slate-800">
                        <UserIcon className="h-5 w-5 text-violet-600" />
                        Account Context
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 p-5 sm:p-7 lg:space-y-8 lg:p-8">
                      {!patient.isPrimary && parentPatient ? (
                        <div className="space-y-4">
                          <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Primary Contact / Guardian</Label>
                          <div className="group flex items-center rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-violet-100 hover:shadow-md sm:p-5">
                            <PatientAvatar src={resolveImageSource(parentPatient.profilePicture)} name={parentPatient.name} dob={parentPatient.dateOfBirth || parentPatient.dob || parentPatient.birthday} className="h-14 w-14 mr-5 ring-4 ring-slate-50 group-hover:ring-violet-50 transition-all" sizeClass="h-14 w-14 rounded-md" />
                            <div className="min-w-0 flex-1">
                              <div className="font-black text-slate-900 text-lg leading-tight truncate">{parentPatient.name}</div>
                              <div className="text-sm font-bold text-slate-500 flex items-center gap-2 mt-1">
                                <Phone className="h-3.5 w-3.5 text-violet-400" /> {parentPatient.phone}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full text-slate-400 hover:text-violet-600 hover:bg-violet-50">
                              <ChevronRight className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      ) : patient.isPrimary ? (
                        <div className="flex items-start gap-4 rounded-lg border border-emerald-100 bg-emerald-50 p-5 sm:p-7">
                          <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                            <ShieldCheck className="h-6 w-6 text-emerald-600" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-black text-emerald-900">Primary Account Holder</p>
                            <p className="text-sm font-bold text-emerald-700/70 leading-relaxed">
                              This patient is the primary contact. Household billing and common address details are anchored to this record.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-5 text-center sm:p-7">
                          <Info className="h-8 w-8 text-slate-300 mx-auto" />
                          <p className="text-sm font-bold text-slate-500">Standalone patient record. No family links established.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-xl ring-1 ring-slate-200 bg-white overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/80 py-5 sm:py-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-black flex items-center gap-3 text-slate-800">
                          <Users className="h-5 w-5 text-blue-600" />
                          Linked Dependents
                        </CardTitle>
                        {patient.isPrimary && (
                          <Button variant="ghost" size="sm" className="h-8 font-black text-xs text-violet-600 hover:bg-violet-50 hover:text-violet-700 rounded-lg">
                            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                            Add Linked
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 sm:p-7 lg:p-8">
                      {isLoadingFamily ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                          <Clock className="h-10 w-10 text-violet-200 animate-spin" />
                          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Retrieving Family...</p>
                        </div>
                      ) : familyMembers.length === 0 ? (
                        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
                          <Users className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                          <p className="text-sm font-black text-slate-400 uppercase tracking-widest leading-relaxed">No associated dependents found</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {familyMembers.map((member) => (
                            <div key={member.id} className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-blue-100 hover:shadow-lg sm:p-5">
                              <div className="flex items-center min-w-0">
                                <PatientAvatar src={resolveImageSource(member.profilePicture)} name={member.name} dob={member.dateOfBirth || member.dob || member.birthday} className="h-12 w-12 mr-4 ring-2 ring-slate-50 group-hover:ring-blue-50 transition-all" sizeClass="h-12 w-12 rounded-md" />
                                <div className="min-w-0">
                                  <div className="text-base font-black text-slate-900 truncate">{member.name}</div>
                                  <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{member.relationship || "Dependent"}</div>
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" className="rounded-xl text-slate-300 hover:text-blue-600 hover:bg-blue-50">
                                <Eye className="h-5 w-5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

        <TabsContent value="records" data-tour-id="patient-details-records-content" className="mx-auto w-full max-w-[1680px] space-y-4">
          <Card className={cardClass}>
            <CardHeader className={cardHeaderClass}>
              <CardTitle className="text-base font-semibold text-slate-900">Dental Records & Treatment Notes</CardTitle>
            </CardHeader>
            <CardContent className={`${cardContentClass} [&_label]:text-xs [&_label]:font-semibold [&_label]:uppercase [&_label]:tracking-wide [&_label]:text-slate-500`}>
              <div>
                <Label>Allergies</Label>
                <Textarea value={formData.allergies} onChange={(e) => { setFormData(prev => ({ ...prev, allergies: e.target.value })); setIsModified(true); }} disabled={isSaving} placeholder="Enter any allergies or sensitivities..." className={textareaClass} />
              </div>
              <div>
                <Label>Medical History</Label>
                <Textarea value={formData.medicalHistory} onChange={(e) => { setFormData(prev => ({ ...prev, medicalHistory: e.target.value })); setIsModified(true); }} disabled={isSaving} placeholder="Enter relevant medical history..." className={textareaClass} />
              </div>
              <div>
                <Label>Current Treatment Plan</Label>
                <Textarea value={formData.treatmentPlan} onChange={(e) => { setFormData(prev => ({ ...prev, treatmentPlan: e.target.value })); setIsModified(true); }} disabled={isSaving} placeholder="Enter treatment plan..." className={textareaClass} />
              </div>
              <div>
                <Label>Clinical Notes</Label>
                <Textarea value={formData.clinicalNotes} onChange={(e) => { setFormData(prev => ({ ...prev, clinicalNotes: e.target.value })); setIsModified(true); }} disabled={isSaving} placeholder="Enter clinical observations and notes..." className={textareaClass} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questionnaire" data-tour-id="patient-details-questionnaire-content" className="mx-auto w-full max-w-[1680px] space-y-4">
          <Card className={cardClass}>
            <CardHeader className={cardHeaderClass}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base font-bold text-slate-900">Questionnaire</CardTitle>
                  <p className="mt-1 text-sm font-medium text-slate-500">Patient questionnaire responses</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              {isLoadingQuestionnaire ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                  Loading questionnaire...
                </div>
              ) : questionnaireQuestions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                  No questionnaire questions have been saved yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {questionnaireQuestions.map((question) => (
                    <label
                      key={question.id}
                      htmlFor={`patient-questionnaire-${question.id}`}
                      className="flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-200 hover:bg-violet-50/30"
                    >
                      <Checkbox
                        id={`patient-questionnaire-${question.id}`}
                        checked={Boolean(questionnaireAnswers[question.id])}
                        onCheckedChange={(checked) => handleQuestionnaireAnswerChange(question.id, checked === true)}
                        disabled={isSavingQuestionnaire}
                        className="mt-0.5 border-violet-200 data-[state=checked]:border-violet-600 data-[state=checked]:bg-violet-600"
                      />
                      <span className="text-sm font-semibold leading-6 text-slate-800">{question.text}</span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart" data-tour-id="patient-details-chart-content" className="mx-auto w-full max-w-[1680px] space-y-4">
          <DentalChart
            records={formData.dentalCharts}
            onSaveRecords={(updatedRecords) => {
              setFormData(prev => ({ ...prev, dentalCharts: updatedRecords }));
              setIsModified(true);
            }}
            patientDateOfBirth={formData.dateOfBirth}
          />
        </TabsContent>

        <TabsContent value="history" data-tour-id="patient-details-history-content" className="mx-auto w-full max-w-[1680px] space-y-4">
          <Card className={cardClass}>
            <CardHeader>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <CardTitle>Appointment History</CardTitle>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => openCreateModal(undefined, undefined, undefined, patientIdForBooking)}
                      className="gap-2 font-semibold"
                    >
                      <Plus className="h-4 w-4" />
                      <span>New Appointment</span>
                    </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-5 xl:flex xl:items-center">
                    <div className="relative w-full xl:w-[250px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            placeholder="Search history..."
                            value={historySearchFilter}
                            onChange={(e) => setHistorySearchFilter(e.target.value)}
                            className="pl-9 h-10 border-gray-300 bg-white"
                        />
                    </div>
                    <Select value={historyAppointmentStatusFilter} onValueChange={setHistoryAppointmentStatusFilter}>
                        <SelectTrigger className="w-full xl:w-[150px]">
                            <SelectValue placeholder="Appointment Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {APPOINTMENT_STATUSES.map(status => (
                                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={historyPaymentStatusFilter} onValueChange={setHistoryPaymentStatusFilter}>
                        <SelectTrigger className="w-full xl:w-[150px]">
                            <SelectValue placeholder="Payment Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Payments</SelectItem>
                            {PAYMENT_STATUSES.map(status => (
                                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {/* Hide doctor filter when viewing as a doctor - they only see their own appointments */}
                    {!doctorFilter && (
                      <Select value={historyDoctorFilter} onValueChange={setHistoryDoctorFilter}>
                          <SelectTrigger className="w-full xl:w-[180px]">
                              <SelectValue placeholder="Filter by doctor" />
                          </SelectTrigger>
                          <SelectContent>
                              {uniqueDoctors.map(doctor => (
                                  <SelectItem key={doctor} value={doctor}>{doctor === 'all' ? 'All Doctors' : doctor}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                    )}
                    <Select value={historyProcedureFilter} onValueChange={setHistoryProcedureFilter}>
                        <SelectTrigger className="w-full xl:w-[180px]">
                            <SelectValue placeholder="Filter by procedure" />
                        </SelectTrigger>
                        <SelectContent>
                            {uniqueProcedures.map(proc => (
                                <SelectItem key={proc} value={proc}>{proc === 'all' ? 'All Procedures' : proc}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(filteredHistory.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {mockAppointmentHistoryLocal.length === 0 ? "No appointments scheduled for this patient yet." : "No appointments match the selected filters."}
                    </div>
                ) : (
                  <div className="space-y-4">
                    {filteredHistory.map((appointment: HistoryAppointment, index: number) => {
                      const sortedTransactions = Array.from(new Map((appointment.transactions || []).map((t: RecentTransaction) => [t.id, t])).values())
                        .sort(comparePaymentTransactionsDesc);
                      const isExpanded = expandedTransactions.has(appointment.id);
                      const visibleTransactions = isExpanded ? sortedTransactions : sortedTransactions.slice(0, 1);
                      const appointmentBalance = Number((appointment as any).balance);
                      const computedOutstandingBalance = Math.max(0, Number(appointment.price || 0) - Number(appointment.totalPaid || 0));
                      const storedDisplayedBalance = Number.isFinite(appointmentBalance)
                        ? appointmentBalance
                        : computedOutstandingBalance;
                      const isCancelledAppointment = normalizeAppointmentStatus(String(appointment.status || "")) === "cancelled";
                      const originalDisplayedBalance = isCancelledAppointment
                        ? Math.max(storedDisplayedBalance, computedOutstandingBalance)
                        : storedDisplayedBalance;
                      const displayedBalance = isCancelledAppointment ? 0 : originalDisplayedBalance;

                      // Resolve doctor image for this appointment entry (snapshot fields first, then staff list)
                      const resolveDoctorImageFor = (apt: any) => {
                        let img = getDoctorImageFromSnapshot(apt);
                        if (!img && Array.isArray(doctors) && doctors.length) {
                          const doctorName = String(apt.doctor || '').toLowerCase().trim();
                          const matched = doctors.find((d) => (d.name || '').toLowerCase().trim() === doctorName) || doctors.find((d) => doctorName && (d.name || '').toLowerCase().includes(doctorName));
                          if (matched && matched.profilePicture) img = resolveImageSource(matched.profilePicture);
                        }
                        return img;
                      };

                      const doctorImage = resolveDoctorImageFor(appointment as any);

                      return (
                        <div key={appointment.id || `apt-${index}`} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-3">
                                <div className="text-sm">
                                  <div className="font-medium text-base">{appointment.type}</div>
                                  <div className="text-muted-foreground">{formatPatientLogDate(appointment.date)}</div>
                                </div>
                                <div className="flex gap-2">
                                  {getAppointmentStatusBadge(String(appointment.status || ''))}
                                  {getPaymentStatusBadge(String(appointment.paymentStatus || ''))}
                                </div>
                              </div>
                              <div className="text-sm flex items-center gap-3">
                                <div className="flex-shrink-0">
                                  <Avatar className="h-8 w-8 rounded-md overflow-hidden">
                                    {doctorImage ? (
                                      <AvatarImage src={doctorImage} alt={String(appointment.doctor || '')} className="object-cover" />
                                    ) : (
                                      <AvatarFallback className="bg-slate-100 text-slate-700 text-sm">{getInitials(String(appointment.doctor || ''))}</AvatarFallback>
                                    )}
                                  </Avatar>
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{appointment.doctor}</div>
                                  <div className="text-muted-foreground truncate">{appointment.notes}</div>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2 md:text-right">
                              <div>
                                <div className="text-sm font-medium">Total: ${appointment.price}</div>
                                <div className="text-sm text-muted-foreground">Paid: ${appointment.totalPaid}</div>
                                {isCancelledAppointment && originalDisplayedBalance > 0 ? (
                                  <div className="text-sm font-medium">
                                    <span className="text-red-500 line-through decoration-red-400 decoration-2">
                                      Balance: ${originalDisplayedBalance}
                                    </span>
                                    <span className="ml-2 text-emerald-600">
                                      Balance: $0
                                    </span>
                                  </div>
                                ) : displayedBalance > 0 && (
                                  <div className="text-sm font-medium text-red-600">
                                    Balance: ${displayedBalance}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-4 mt-4 border-t">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const original = patientAppointments.find((x: Appointment) => x.id === appointment.id);

                                if (original && onOpenBookingModal) {
                                  onOpenBookingModal(original);
                                }
                              }}
                            >
                              <DollarSign className="h-3 w-3 mr-1" />
                              Record Payment
                            </Button>
                          </div>
                          {sortedTransactions.length > 0 && (
                            <div className="border-t pt-3 mt-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium">Payment Transactions</div>
                                {sortedTransactions.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1 px-2 text-sm text-slate-600 hover:text-slate-900"
                                    onClick={() => toggleExpandTransactions(appointment.id)}
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="h-4 w-4" />
                                        See less
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="h-4 w-4" />
                                        See more
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-2">
                                {visibleTransactions.map((txn: RecentTransaction, transactionIndex: number) => {
                                  const isLatestPayment = transactionIndex === 0;

                                  return (
                                  <div key={txn.id} className="flex flex-col gap-2 rounded bg-gray-50 p-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex min-w-0 items-center space-x-2">
                                      {getPaymentMethodIcon(txn.method)}
                                      <div>
                                        <div className="flex items-center gap-2 font-medium">
                                          <span>{txn.method} - ${txn.amount}</span>
                                          {isLatestPayment && (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                              Latest
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">{formatPatientLogDate(txn.date)} • {txn.transactionId}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => handleOpenSnapshot(appointment, txn)}
                                      >
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">View Appointment Snapshot</span>
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`h-8 w-8 p-0 ${getEditablePaymentId(txn) ? "" : "opacity-60"}`}
                                        title={getEditablePaymentId(txn) ? "Edit payment" : getPaymentEditUnavailableMessage(txn)}
                                        onClick={() => handleEditPaymentTransaction(txn)}
                                      >
                                        <Edit className="h-4 w-4" />
                                        <span className="sr-only">Edit Payment</span>
                                      </Button>
                                        {/* Hide edit/delete controls for now — keep view (eye) only */}
                                    </div>
                                  </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" data-tour-id="patient-details-payments-content" className="mx-auto w-full max-w-[1680px] space-y-4">
          <Card className={cardClass}>
            <CardHeader>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <CardTitle>Payment History</CardTitle>
                    <div className="flex flex-col gap-1 sm:items-end">
                            <Button
                            size="sm"
                            onClick={() => {
                              if (patient.id && patient.name) {
                                // Open payment modal for adding a new payment (no appointment selected)
                                openPaymentModal(patient.id, patient.name, mockAppointmentHistoryLocal, null);
                              }
                            }}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Payment
                        </Button>
                        <div className="text-sm text-muted-foreground">
                            Total Transactions: <span className="font-semibold">{filteredTransactions.length}</span>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:items-center">
                    <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                        <SelectTrigger className="w-full xl:w-[180px]">
                            <SelectValue placeholder="Filter by payment method" />
                        </SelectTrigger>
                        <SelectContent>
                            {uniquePaymentMethods.map(method => (
                                <SelectItem key={method} value={method}>{method === 'all' ? 'All Methods' : method}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {/* Hide doctor filter when viewing as a doctor */}
                    {!doctorFilter && (
                      <Select value={paymentDoctorFilter} onValueChange={setPaymentDoctorFilter}>
                          <SelectTrigger className="w-full xl:w-[180px]">
                              <SelectValue placeholder="Filter by doctor" />
                          </SelectTrigger>
                          <SelectContent>
                {uniquePaymentDoctors.map(doctor => (
                  <SelectItem key={String(doctor)} value={String(doctor)}>{String(doctor) === 'all' ? 'All Doctors' : String(doctor)}</SelectItem>
                ))}
                          </SelectContent>
                      </Select>
                    )}
                    <Select value={paymentProcedureFilter} onValueChange={setPaymentProcedureFilter}>
                        <SelectTrigger className="w-full xl:w-[180px]">
                            <SelectValue placeholder="Filter by procedure" />
                        </SelectTrigger>
                        <SelectContent>
              {uniquePaymentProcedures.map(proc => (
                <SelectItem key={String(proc)} value={String(proc)}>{String(proc) === 'all' ? 'All Procedures' : String(proc)}</SelectItem>
              ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="mb-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Paid</p>
                          <p className="text-2xl font-semibold text-green-600">
                            ${mockAppointmentHistoryLocal.reduce((sum: number, apt: Appointment) => sum + (apt.totalPaid || 0), 0)}
                          </p>
                        </div>
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Outstanding</p>
                          <p className="text-2xl font-semibold text-red-600">
                            ${mockAppointmentHistoryLocal.reduce((sum: number, apt: Appointment) => sum + ((apt.price || 0) - (apt.totalPaid || 0)), 0)}
                          </p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Billed</p>
                          <p className="text-2xl font-semibold">
                            ${mockAppointmentHistoryLocal.reduce((sum: number, apt: Appointment) => sum + (apt.price || 0), 0)}
                          </p>
                        </div>
                        <DollarSign className="h-8 w-8 text-gray-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Transaction List */}
                <div className="space-y-3">
                  <h3 className="font-medium">All Transactions</h3>
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((txn) => {
                      const paymentDisplay = getTransactionPaymentDisplay(txn);
                      const txnPaymentDate = formatPatientLogDate((txn as any).paymentDate || txn.date);

                      return (
                      <div
                        key={txn.id}
                        className={`border rounded-lg p-4 ${paymentDisplay.isLog ? "bg-gray-50/60 border-gray-200 opacity-80" : ""}`}
                      >
                        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-center space-x-3">
                            <div className="p-2 bg-gray-100 rounded">
                              {getPaymentMethodIcon(txn.method)}
                            </div>
                            <div>
                              <div className="font-medium">{txn.method}</div>
                              <div className="text-sm text-muted-foreground">
                                {txn.appointmentType} - Appointment: {formatPatientLogDate(txn.appointmentDate, "N/A")}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Dr: {txn.doctor}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 sm:justify-end">
                            <div className="sm:text-right">
                              <div className="text-lg font-semibold text-green-600">${txn.amount}</div>
                              <div className="text-xs text-muted-foreground">Payment Date: {txnPaymentDate}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenTransactionSnapshot(txn)}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View Appointment Snapshot</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${getEditablePaymentId(txn) ? "" : "opacity-60"}`}
                              title={getEditablePaymentId(txn) ? "Edit payment" : getPaymentEditUnavailableMessage(txn)}
                              onClick={() => handleEditPaymentTransaction(txn)}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit Payment</span>
                            </Button>
                            {!isReadOnlyPaymentRow(txn) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleEditPaymentTransaction(txn)}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setPdConfirmTitle("Delete Payment");
                                      setPdConfirmMessage("Are you sure you want to delete this payment?");
                                      setPdConfirmAction(() => async () => {
                                        if (txn.id) await handleDeletePayment(String(txn.id), txn.appointmentId);
                                      });
                                      setPdIsConfirmOpen(true);
                                    }}
                                    className="text-red-600"
                                  >
                                    <Trash className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm pt-2 border-t">
                          <div className="text-muted-foreground">
                            ID: {txn.transactionId}
                          </div>
                          {paymentDisplay.label && (
                            <Badge variant="outline" className={paymentDisplay.className}>
                              {paymentDisplay.label}
                            </Badge>
                          )}
                        </div>
                        {txn.notes && (
                          <div className="text-sm text-muted-foreground mt-2 italic">
                            {txn.notes}
                          </div>
                        )}
                      </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No payment transactions found for the selected filters.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
          </div>
      </Tabs>
      <PatientUnsavedChangesDialog
        open={isRecoveryDialogOpen}
        onOpenChange={setIsRecoveryDialogOpen}
        title="Recovered Unsaved Changes"
        description="The previous session ended before these changes were saved. Your changes are still here; save them now or keep editing."
        changes={changedFields}
        primaryLabel={isRecoverySaving ? "Saving..." : "Save Changes"}
        secondaryLabel="Discard Draft"
        cancelLabel="Keep Editing"
        onPrimary={handleSaveRecoveredDraft}
        onSecondary={handleDiscardRecoveredDraft}
        loading={isRecoverySaving}
      />
      {/* Record Payment Dialog is now a separate component */}
      <ConfirmDialog
        open={pdIsConfirmOpen}
        onOpenChange={(open: boolean) => {
          if (!open) setPdConfirmAction(null);
          setPdIsConfirmOpen(open);
        }}
        title={pdConfirmTitle || "Confirm"}
        message={pdConfirmMessage || "Are you sure?"}
        loading={pdConfirmLoading}
        onConfirm={async () => {
          if (pdConfirmAction) {
            try {
              setPdConfirmLoading(true);
              await pdConfirmAction();
            } finally {
              setPdConfirmLoading(false);
              setPdConfirmAction(null);
            }
          }
        }}
        confirmLabel="Yes"
        cancelLabel="No"
      />

      {/* Appointment Snapshot Dialog */}
      <AppointmentHistoryView
        open={isSnapshotOpen}
        onOpenChange={setIsSnapshotOpen}
        appointmentSnapshot={selectedSnapshot}
        logDate={snapshotLogDate}
        onOpenAppointment={onOpenBookingModal ? handleOpenSnapshotAppointment : undefined}
        isAppointmentOpen={isSelectedSnapshotAppointmentOpen}
        isHistorical={selectedSnapshotIsHistorical}
        openedFromBookingModal={false}
      />

      </div>
    </div>
  );
});
PatientDetails.displayName = "PatientDetails";
