"use client";

import { apiUrl } from "@/lib/api";

import React, { useState, useEffect, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
import { useAppointmentTypeOptions } from "@/hooks/useAppointmentTypeOptions";
import { useIsMobile } from "./ui/use-mobile";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { toast } from "sonner";
import { Checkbox } from "./ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
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
  PenLine,
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
  Loader2,
  Save,
  ArrowLeft,
  Stethoscope,
  RotateCcw,
  X,
  MoreHorizontal
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PatientAvatar from "./PatientAvatar";
import DeletePaymentDialog from "./DeletePaymentDialog";
import SignatureInputModal from "./SignatureInputModal";
import { CurrencyText } from "./CurrencyAmount";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDoctors } from "@/hooks/useDoctors";
import { Appointment } from "../hooks/useAppointments";
import { RecentTransaction } from "../lib/finance-types";
import { DentalChart } from "./DentalChart";
import { getAppointmentTypeName, OTHER_APPOINTMENT_TYPE_INDEX } from "../lib/appointment-types";
import type { ServiceCatalogItem } from "@/lib/appointment-service-catalog";
import { formatTimeTo12h } from "@/lib/time-slots";
import { formatDateToYYYYMMDD, formatWordyDate, parseBackendDateToLocal } from "../lib/utils";
import { getAuthHeaders } from "@/lib/auth-headers";
import AppointmentHistoryView from "./AppointmentHistoryView";
import { AppointmentStatusSelect } from "./AppointmentStatusSelect";
import BookingAppointmentHistory from "./BookingAppointmentHistory";
import { DatePickerModal } from "./DatePickerModal";
import { TimePickerModal } from "./TimePickerModal";
import {
  getPaymentStatusOptionWithColors,
  normalizePaymentStatus,
} from "@/lib/status-colors";
import { normalizeAppointmentStatus } from "@/lib/appointment-status";
import {
  buildPatientAppointmentSummary,
  getAppointmentOutstandingBalance,
} from "@/lib/patient-aggregates";
import {
  clearPatientProfileDraft,
  readPatientProfileDraft,
  writePatientProfileDraft,
} from "@/lib/patient-profile-draft";
import {
  loadQuestionnaireQuestions,
  type QuestionnaireQuestion,
} from "@/lib/questionnaire-questions";
import PatientUnsavedChangesDialog, { getVisiblePatientChanges } from "./PatientUnsavedChangesDialog";
import {
  PaymentTransactionStatusBadge,
  cancelledPaymentBadgeClass,
  deletedPaymentBadgeClass,
  deletedPaymentRowClass,
  getDeletedPaymentLabel,
  isAppointmentCancelledStatusTransaction,
  isActualDeletedPaymentTransaction,
  isSoftDeletedPaymentTransaction,
} from "./PaymentTransactionStatusBadge";
import {
  getBookingToothNumberEntries,
  getBookingToothNumbersValue,
  getBookingTreatmentsValue,
  buildBookingTreatmentsPayload,
  normalizeBookingDuration,
  normalizeBookingPaymentMethod,
  normalizeBookingToothNumbers,
  NO_PAYMENT_METHOD_LABEL,
  type BookingInitialStep,
} from "./sharedBookingLogic";
import { SelectDoctorModal } from "./SelectDoctorModal";
import { SelectScheduleModal } from "./SelectScheduleModal";
import { SelectTreatmentModal, type SelectTreatmentModalSection } from "./SelectTreatmentModal";
import { AppointmentActionsMenu, createVisitHistoryActions } from "./AppointmentActionsMenu";

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
  profileCompletion?: "complete" | "incomplete" | string;
  profileCompletionMissing?: string[];
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
  deleted?: boolean;
}

const PHYSICIAN_INFORMATION_QUESTION_ID = "baseline_physician_information";

const GENERAL_MEDICAL_INFO_IDS = new Set([
  "baseline_good_health",
  "baseline_under_medical_treatment",
  "baseline_serious_illness_or_operation",
  "baseline_hospitalized",
  "baseline_medication",
  "baseline_tobacco",
  "baseline_alcohol_or_drugs"
]);

const ALLERGY_IDS = new Set([
  "baseline_allergy_local_anesthetic",
  "baseline_allergy_penicillin_antibiotics",
  "baseline_allergy_sulfa",
  "baseline_allergy_aspirin",
  "baseline_allergy_latex",
  "baseline_allergy_others"
]);

const WOMEN_ONLY_IDS = new Set([
  "baseline_pregnant",
  "baseline_nursing",
  "baseline_birth_control"
]);

const OTHER_MEDICAL_IDS = new Set([
  "baseline_bleeding_time",
  "baseline_blood_type",
  "baseline_blood_pressure"
]);

const MEDICAL_CONDITION_IDS = new Set([
  "baseline_condition_high_blood_pressure",
  "baseline_condition_low_blood_pressure",
  "baseline_condition_epilepsy_convulsions",
  "baseline_condition_aids_hiv",
  "baseline_condition_sexually_transmitted_disease",
  "baseline_condition_stomach_troubles_ulcers",
  "baseline_condition_fainting_seizure",
  "baseline_condition_rapid_weight_loss",
  "baseline_condition_radiation_therapy",
  "baseline_condition_joint_replacement_implant",
  "baseline_condition_heart_surgery",
  "baseline_condition_heart_attack",
  "baseline_condition_thyroid_problem",
  "baseline_condition_heart_disease",
  "baseline_condition_heart_murmur",
  "baseline_condition_hepatitis_liver_disease",
  "baseline_condition_rheumatic_fever",
  "baseline_condition_hay_fever_allergies",
  "baseline_condition_respiratory_problems",
  "baseline_condition_hepatitis_jaundice",
  "baseline_condition_tuberculosis",
  "baseline_condition_swollen_ankles",
  "baseline_condition_kidney_disease",
  "baseline_condition_diabetes",
  "baseline_condition_chest_pain",
  "baseline_condition_stroke",
  "baseline_condition_cancer_tumors",
  "baseline_condition_anemia",
  "baseline_condition_angina",
  "baseline_condition_asthma",
  "baseline_condition_emphysema",
  "baseline_condition_bleeding_problems",
  "baseline_condition_blood_diseases",
  "baseline_condition_head_injuries",
  "baseline_condition_arthritis_rheumatism",
  "baseline_condition_other"
]);

type PhysicianInformationState = {
  name: string;
  officeAddress: string;
  officeNumber: string;
};

type PhysicianInformationField = keyof PhysicianInformationState;

const EMPTY_PHYSICIAN_INFORMATION: PhysicianInformationState = {
  name: "",
  officeAddress: "",
  officeNumber: "",
};

const PHYSICIAN_INFORMATION_FIELDS: Array<{
  id: PhysicianInformationField;
  label: string;
  placeholder: string;
}> = [
    { id: "name", label: "Name of Physician", placeholder: "Enter physician name" },
    { id: "officeAddress", label: "Office Address", placeholder: "Enter office address" },
    { id: "officeNumber", label: "Office Number", placeholder: "Enter office number" },
  ];

const stringValue = (value: unknown) => String(value ?? "");

const createPhysicianInformationState = (data?: Record<string, any>): PhysicianInformationState => {
  const source = data && typeof data === "object" ? data : {};
  const nested = source.physicianInformation && typeof source.physicianInformation === "object"
    ? source.physicianInformation
    : {};

  return {
    name: stringValue(source.physicianName ?? source.nameOfPhysician ?? source.name ?? nested.name),
    officeAddress: stringValue(source.physicianOfficeAddress ?? source.officeAddress ?? nested.officeAddress),
    officeNumber: stringValue(source.physicianOfficeNumber ?? source.officeNumber ?? nested.officeNumber),
  };
};

const serializePhysicianInformation = (physicianInformation: PhysicianInformationState) => {
  const name = physicianInformation.name.trim();
  const officeAddress = physicianInformation.officeAddress.trim();
  const officeNumber = physicianInformation.officeNumber.trim();

  return {
    physicianInformation: {
      name,
      officeAddress,
      officeNumber,
    },
    physicianName: name,
    physicianOfficeAddress: officeAddress,
    physicianOfficeNumber: officeNumber,
  };
};

const physicianInformationComparable = (physicianInformation: PhysicianInformationState) => ({
  name: physicianInformation.name.trim(),
  officeAddress: physicianInformation.officeAddress.trim(),
  officeNumber: physicianInformation.officeNumber.trim(),
});

const CONSENT_VERSION = "focused-informed-consent-v1";

const CONSENT_ACKNOWLEDGEMENTS = [
  {
    id: "treatment",
    title: "Treatment to be done",
    description:
      "Consent is given for explained dental care, including diagnostic images, cleaning, periodontal treatment, restorations, crowns, bridges, extractions, root canal therapy, dentures, local anesthesia, and surgical care when needed.",
  },
  {
    id: "medications",
    title: "Drugs and medications",
    description:
      "The patient understands that antibiotics, pain relievers, anesthetics, and other medicines may cause side effects or allergic reactions that may require urgent care.",
  },
  {
    id: "treatmentPlanChanges",
    title: "Changes in treatment plan",
    description:
      "The patient authorizes clinically necessary changes, additions, or postponements if conditions discovered during treatment require them.",
  },
  {
    id: "noGuarantee",
    title: "No guaranteed result",
    description:
      "The patient understands that dentistry is not an exact science and that treatment results cannot be guaranteed in every situation.",
  },
  {
    id: "authorization",
    title: "Authorization to proceed",
    description:
      "The patient authorizes the clinic dentist and dental auxiliaries to perform the explained dental restorations and treatments.",
  },
  {
    id: "financialResponsibility",
    title: "Financial responsibility",
    description:
      "The patient accepts responsibility for dental fees and agreed charges related to care, including collection or legal costs if an account becomes unpaid.",
  },
] as const;

type ConsentAcknowledgementId = (typeof CONSENT_ACKNOWLEDGEMENTS)[number]["id"];
type ConsentAcknowledgements = Record<ConsentAcknowledgementId, boolean>;

type ConsentFormState = {
  accepted: boolean;
  acknowledgements: ConsentAcknowledgements;
  patientSignatureName: string;
  guardianName: string;
  dentistSignatureName: string;
  signedDate: string;
  patientSignatureImage: string;
  dentistSignatureImage: string;
  signedAt: string;
};

const todayDateInputValue = () => new Date().toISOString().slice(0, 10);

const createConsentAcknowledgements = (
  values?: Partial<Record<string, boolean>>,
  defaultValue = false
): ConsentAcknowledgements =>
  CONSENT_ACKNOWLEDGEMENTS.reduce((acknowledgements, item) => {
    acknowledgements[item.id] = values?.[item.id] ?? defaultValue;
    return acknowledgements;
  }, {} as ConsentAcknowledgements);

const createConsentFormState = (data?: Record<string, any>): ConsentFormState => {
  const source = data && typeof data === "object" ? data : {};
  const rawAcknowledgements =
    source.acknowledgements && typeof source.acknowledgements === "object"
      ? source.acknowledgements
      : source.consentAcknowledgements && typeof source.consentAcknowledgements === "object"
        ? source.consentAcknowledgements
        : undefined;
  const defaultAcknowledged = !rawAcknowledgements && (source.accepted === true || source.consentAccepted === true);

  return {
    accepted: Boolean(source.accepted ?? source.consentAccepted),
    acknowledgements: createConsentAcknowledgements(rawAcknowledgements, defaultAcknowledged),
    patientSignatureName: String(source.patientSignatureName ?? source.consentPatientSignatureName ?? ""),
    guardianName: String(source.guardianName ?? source.consentGuardianSignatureName ?? ""),
    dentistSignatureName: String(source.dentistSignatureName ?? source.consentDentistSignatureName ?? ""),
    signedDate: String(source.signedDate ?? source.consentSignedDate ?? todayDateInputValue()),
    patientSignatureImage: String(source.patientSignatureImage ?? source.consentPatientSignatureImage ?? ""),
    dentistSignatureImage: String(source.dentistSignatureImage ?? source.consentDentistSignatureImage ?? ""),
    signedAt: String(source.signedAt ?? source.consentSignedAt ?? ""),
  };
};

const serializeConsentForm = (consentForm: ConsentFormState) => ({
  consentAccepted: consentForm.accepted,
  consentVersion: CONSENT_VERSION,
  consentAcknowledgements: consentForm.acknowledgements,
  consentPatientSignatureName: consentForm.patientSignatureName.trim(),
  consentGuardianSignatureName: consentForm.guardianName.trim(),
  consentDentistSignatureName: consentForm.dentistSignatureName.trim(),
  consentPatientSignatureImage: consentForm.patientSignatureImage,
  consentDentistSignatureImage: consentForm.dentistSignatureImage,
  consentSignedDate: consentForm.signedDate,
  consentSignedAt: consentForm.signedAt,
});

const consentFormComparable = (consentForm: ConsentFormState) => ({
  accepted: consentForm.accepted,
  acknowledgements: consentForm.acknowledgements,
  patientSignatureName: consentForm.patientSignatureName.trim(),
  guardianName: consentForm.guardianName.trim(),
  dentistSignatureName: consentForm.dentistSignatureName.trim(),
  signedDate: consentForm.signedDate,
  patientSignatureImage: consentForm.patientSignatureImage,
  dentistSignatureImage: consentForm.dentistSignatureImage,
});

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

const formatMissingProfileSections = (missing?: string[] | null) => {
  const sections = Array.isArray(missing) ? missing.filter(Boolean) : [];
  if (sections.some((section) => section.toLowerCase() === "consent form")) {
    return "Incomplete: consent form is not finished.";
  }
  if (sections.length === 0) return "Some required profile details are missing.";
  return `Missing ${sections.join(", ")}.`;
};

export type PatientDetailsRef = {
  save: () => Promise<boolean>;
  discardDraft: () => void;
  changedFields: Record<string, { old: any; new: any }>;
};

type OpenBookingModalOptions = {
  initialStep?: BookingInitialStep;
};

interface PatientProfileProps {
  patient: Patient | null;
  detailsRef: React.Ref<PatientDetailsRef>;
  onDeletePatient: (p: Patient) => void;
  isModified: boolean;
  setIsModified: (isModified: boolean) => void;
  doctorFilter?: string;
  openBookingAppointmentId?: string | null;
  onOpenBookingModal?: (appointment: Appointment, options?: OpenBookingModalOptions) => void;
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
  const displayedProfileCompletion = serverPatient?.profileCompletion ?? patient?.profileCompletion ?? "incomplete";
  const displayedProfileCompletionMissing =
    serverPatient?.profileCompletionMissing ?? patient?.profileCompletionMissing ?? ["consent form"];
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
    window.addEventListener("villahermosa:data-refresh", handleDataRefresh);

    return () => {
      window.removeEventListener("appointments:updated", handleDataRefresh);
      window.removeEventListener("payments:updated", handleDataRefresh);
      window.removeEventListener("villahermosa:data-refresh", handleDataRefresh);
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

  const getProfileCompletionBadge = (profileCompletion?: string, missing?: string[] | null) => {
    const completion = profileCompletion?.toLowerCase() === "incomplete" ? "incomplete" : "complete";
    const badge =
      completion === "complete" ? (
        <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-emerald-700 hover:bg-emerald-50 shadow-none">
          <CheckCircle className="h-3.5 w-3.5" />
          Complete
        </Badge>
      ) : (
        <Badge className="gap-1.5 border-orange-200 bg-orange-50 px-2.5 py-0.5 text-orange-700 hover:bg-orange-50 shadow-none">
          <AlertTriangle className="h-3.5 w-3.5" />
          Incomplete
        </Badge>
      );

    const tooltip = completion === "complete" ? "Complete: consent form is finished." : formatMissingProfileSections(missing);

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help" title={tooltip} aria-label={tooltip} tabIndex={0}>
            {badge}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[280px] text-center">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div
      data-tour-id="patient-profile-page"
      title={`Patient Details - ${patientDisplayName}`}
      className="flex min-h-screen flex-col gap-0 bg-slate-50 md:bg-slate-50"
    >
      <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:hidden">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBackToPatients}
            className="h-11 w-11 rounded-full text-slate-900 hover:bg-slate-100"
            aria-label="Back to patients"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="truncate text-center text-2xl font-black tracking-tight text-slate-950">
            Patient Details
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full text-slate-900 hover:bg-slate-100"
                aria-label="More patient actions"
              >
                <MoreVertical className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleSave}
                disabled={!patient || !isModified || isHeaderSaving}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {isHeaderSaving ? "Saving..." : "Update Patient"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => patient && onDeletePatient(patient)}
                disabled={!patient || isHeaderSaving}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <header className="hidden shrink-0 border-b border-slate-200 bg-white px-4 py-4 text-left shadow-sm sm:px-6 md:block lg:px-8">
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
                {getProfileCompletionBadge(displayedProfileCompletion, displayedProfileCompletionMissing)}
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
          <div data-tour-id="patient-details-summary" className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6 md:py-5 lg:px-8">
            <div className="mx-auto w-full max-w-[1920px] space-y-4 md:space-y-0">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
                <div className="grid grid-cols-[minmax(88px,0.34fr)_minmax(0,1fr)] gap-4">
                  <div className="relative">
                    <PatientAvatar
                      src={resolveImageSource((serverPatient || patient)?.profilePicture)}
                      name={patientDisplayName}
                      dob={patient?.dateOfBirth || patient?.dob || patient?.birthday}
                      className="aspect-square h-auto w-full rounded-lg border border-slate-200 bg-white shadow-sm"
                      sizeClass="h-full w-full rounded-lg"
                    />
                    <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-violet-600 text-white shadow-lg">
                      <Camera className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h2 className="truncate text-2xl font-black leading-tight text-slate-950">
                          {patientDisplayName}
                        </h2>
                        {getStatusBadge(displayedStatus, displayedOverdueAppointmentCount)}
                        {getProfileCompletionBadge(displayedProfileCompletion, displayedProfileCompletionMissing)}
                      </div>
                      <div className="mt-3 space-y-2 text-sm font-semibold text-slate-500">
                        {patient?.email ? (
                          <span className="flex min-w-0 items-center gap-2">
                            <Mail className="h-4 w-4 shrink-0 text-slate-500" />
                            <span className="truncate">{patient.email}</span>
                          </span>
                        ) : null}
                        {patient?.phone ? (
                          <span className="flex min-w-0 items-center gap-2">
                            <Phone className="h-4 w-4 shrink-0 text-slate-500" />
                            <span className="truncate">{patient.phone}</span>
                          </span>
                        ) : null}
                        <span className="block truncate text-xs font-bold text-slate-500">
                          PID: {patient.id || "Unregistered"}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (isModified) {
                            handleSave();
                            return;
                          }
                          document.querySelector('[data-tour-id="patient-details-info-content"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        disabled={!patient || isHeaderSaving}
                        className="h-12 rounded-lg border-violet-300 font-black text-violet-700 hover:bg-violet-50"
                      >
                        {isHeaderSaving ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : <Edit className="mr-2 h-4 w-4" />}
                        {isModified ? "Save" : "Edit"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => patient && onDeletePatient(patient)}
                        disabled={!patient || isHeaderSaving}
                        className="h-12 rounded-lg border-red-200 font-black text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:gap-4 [grid-template-columns:repeat(2,minmax(0,1fr))] md:[grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm md:gap-4 md:p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 md:h-12 md:w-12">
                    <CheckCircle className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Account Status</span>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {getStatusBadge(displayedStatus, displayedOverdueAppointmentCount)}
                      {getProfileCompletionBadge(displayedProfileCompletion, displayedProfileCompletionMissing)}
                    </div>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm md:gap-4 md:p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 md:h-12 md:w-12">
                    <CreditCard className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Outstanding Balance</span>
                    <span className={`block truncate text-lg font-black leading-tight md:text-xl ${(displayedBalance || 0) > 0 ? "text-red-600" : "text-violet-600"}`}>
                      <CurrencyText value={`\u20b1${Number(displayedBalance || 0).toLocaleString()}`} />
                    </span>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm md:gap-4 md:p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 md:h-12 md:w-12">
                    <Calendar className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Patient Since</span>
                    <span className="block truncate text-base font-extrabold leading-tight text-slate-700">
                      {formatPatientLogDate((serverPatient?.createdAt || patient.createdAt) as string | undefined)}
                    </span>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm md:gap-4 md:p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 md:h-12 md:w-12">
                    <FileText className="h-5 w-5 md:h-6 md:w-6" />
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
  deleted?: boolean;
  deletedAt?: string | null;
}

type PaymentRow = RecentTransaction & {
  patientId?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  deleted?: boolean;
  deletedAt?: string | Date | null;
};

const isPaymentLogLikeRow = (row?: Partial<RecentTransaction> | Record<string, any> | null) => {
  const source = String((row as any)?.source || "").trim().toLowerCase();
  if (source === "payment-log" || source === "appointment-log") return true;

  return [
    (row as any)?.id,
    (row as any)?.transactionId,
    (row as any)?.paymentId,
    (row as any)?.paymentRecordId,
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
const isLegacyPaymentRow = (txn: RecentTransaction) => String(txn.id || "").startsWith("legacy-");
const isStoredPaymentLogRow = (txn: RecentTransaction) => isPaymentLogLikeRow(txn);
const isReadOnlyPaymentRow = (txn: RecentTransaction) => isLegacyPaymentRow(txn) || isStoredPaymentLogRow(txn);
const isSoftDeletedAppointment = (appointment?: Partial<Appointment> | HistoryAppointment | null) =>
  Boolean(appointment?.deleted) ||
  normalizeAppointmentStatus(String(appointment?.status || "")) === "deleted";
const getEditablePaymentId = (txn: RecentTransaction) => {
  if (isStoredPaymentLogRow(txn)) return "";
  if (isSoftDeletedPaymentTransaction(txn)) return "";

  const explicitPaymentId = (txn as any).paymentId || (txn as any).paymentRecordId;
  if (explicitPaymentId) return String(explicitPaymentId).trim();

  if (String((txn as any).source || "") === "payment" && txn.id && !isReadOnlyPaymentRow(txn)) {
    return String(txn.id).trim();
  }

  return "";
};

const getRestorablePaymentId = (txn: RecentTransaction) => {
  if (isStoredPaymentLogRow(txn)) return "";

  const explicitPaymentId = (txn as any).paymentId || (txn as any).paymentRecordId;
  if (explicitPaymentId) return String(explicitPaymentId).trim();

  const id = String(txn.id || "").trim();
  if (id.startsWith("pay_") || String((txn as any).source || "") === "payment") return id;

  return "";
};

const getPaymentEditUnavailableMessage = (txn: RecentTransaction) => {
  if (isActualDeletedPaymentTransaction(txn)) {
    return "This payment has been deleted.";
  }

  if (isSoftDeletedPaymentTransaction(txn)) {
    return "This payment belongs to a deleted appointment.";
  }

  if (isLegacyPaymentRow(txn)) {
    return "This is a legacy recorded total from the appointment, not an individual payment record.";
  }

  if (isStoredPaymentLogRow(txn)) {
    return "Could not connect this payment log to an editable payment record.";
  }

  return "Could not find the payment record to edit.";
};

const PAYMENT_BALANCE_EPSILON = 0.01;
const PAYMENT_TRANSACTION_STATUS_VALUES = new Set(["paid", "half-paid", "over-paid", "unpaid", "overdue"]);

const toFinitePaymentNumber = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const getTransactionAppointmentId = (transaction: RecentTransaction) => {
  const snapshot = (transaction as any).appointmentSnapshot || {};
  return String(
    transaction.appointmentId ||
    snapshot.appointmentId ||
    snapshot.id ||
    snapshot._id ||
    ""
  ).trim();
};

const getPaymentStatusFromCurrentBalance = (source?: any, fallbackStatus?: string | null) => {
  const balance = toFinitePaymentNumber(source?.currentAppointmentBalance ?? source?.balance);
  const price = toFinitePaymentNumber(source?.currentAppointmentPrice ?? source?.price) ?? 0;
  const discount = toFinitePaymentNumber(source?.currentAppointmentDiscount ?? source?.discount) ?? 0;
  const totalPaid = toFinitePaymentNumber(source?.currentAppointmentTotalPaid ?? source?.totalPaid);
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

  const normalizedFallback = normalizePaymentStatus(fallbackStatus);
  return PAYMENT_TRANSACTION_STATUS_VALUES.has(normalizedFallback) ? normalizedFallback : "paid";
};

const toDateOnly = (value?: string | Date) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).split("T")[0].split(" ")[0];
};

const formatPatientLogDate = (value?: string | Date | null, fallback = "N/A") =>
  formatWordyDate(value, { fallback: value ? String(value) : fallback });

const formatPatientHistoryCurrency = (value?: number | string | null) => {
  const amount = Number(value || 0);
  return `\u20b1${Number.isFinite(amount) ? amount.toLocaleString("en-PH") : "0"}`;
};

const getPatientHistoryDateParts = (value?: string | Date | null) => {
  const fallback = { month: "---", day: "--", year: "", weekday: "" };
  if (!value) return fallback;

  const rawValue = value instanceof Date ? value : String(value);
  const normalizedValue =
    typeof rawValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
      ? `${rawValue}T00:00:00`
      : rawValue;
  const parsed = normalizedValue instanceof Date ? normalizedValue : new Date(normalizedValue);

  if (Number.isNaN(parsed.getTime())) return fallback;

  return {
    month: parsed.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: parsed.toLocaleDateString("en-US", { day: "2-digit" }),
    year: parsed.toLocaleDateString("en-US", { year: "numeric" }),
    weekday: parsed.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
  };
};

const formatPatientHistoryTime = (date?: string | Date | null, time?: string | null) => {
  const rawTime = String(time || (typeof date === "string" ? date.split(" ")[1] : "") || "").trim();
  if (!rawTime) return "No time";

  return formatTimeTo12h(rawTime);
};

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

const getPaymentSortDateValue = (txn: RecentTransaction) =>
  String((txn as any).paymentDate || txn.date || "");

const comparePaymentTransactionsChronologically = (
  a: RecentTransaction,
  b: RecentTransaction,
  direction: "asc" | "desc" = "desc"
) => {
  const paymentDateDiff = parsePaymentTimestamp(getPaymentSortDateValue(b)) - parsePaymentTimestamp(getPaymentSortDateValue(a));

  if (paymentDateDiff !== 0) {
    return direction === "asc" ? -paymentDateDiff : paymentDateDiff;
  }

  const keyDiff = getPaymentTransactionKey(b).localeCompare(getPaymentTransactionKey(a));
  return direction === "asc" ? -keyDiff : keyDiff;
};

const comparePaymentTransactionsByDate = (
  a: RecentTransaction,
  b: RecentTransaction,
  direction: "asc" | "desc" = "desc"
) => {
  const aDeleted = isSoftDeletedPaymentTransaction(a);
  const bDeleted = isSoftDeletedPaymentTransaction(b);

  if (aDeleted !== bDeleted) return aDeleted ? 1 : -1;

  return comparePaymentTransactionsChronologically(a, b, direction);
};

const comparePaymentTransactionsDesc = (a: RecentTransaction, b: RecentTransaction) =>
  comparePaymentTransactionsByDate(a, b, "desc");

const normalizeComparableText = (value: unknown) =>
  String(value ?? "").toLowerCase().trim().replace(/\s+/g, " ");

const normalizeComparableDoctor = (value: unknown) =>
  normalizeComparableText(value).replace(/^dr\.?\s+/, "");

const isUnassignedDoctorValue = (value: unknown) => {
  const normalized = normalizeComparableDoctor(value);
  return !normalized || /^(none|null|undefined|unassigned|no doctor assigned|n\/a|n\.a\.?|na|-)$/.test(normalized);
};

const normalizeTreatmentNameForMatch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getTreatmentNameDistance = (first: string, second: string) => {
  const a = normalizeTreatmentNameForMatch(first);
  const b = normalizeTreatmentNameForMatch(second);
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
};

const getTreatmentSimilarityScore = (input: string, treatmentName: string) => {
  const normalizedInput = normalizeTreatmentNameForMatch(input);
  const normalizedTreatment = normalizeTreatmentNameForMatch(treatmentName);
  if (!normalizedInput || !normalizedTreatment) return 0;
  if (normalizedInput === normalizedTreatment) return 1;

  const maxLength = Math.max(normalizedInput.length, normalizedTreatment.length);
  const distanceScore = 1 - getTreatmentNameDistance(normalizedInput, normalizedTreatment) / maxLength;
  const inputWords = normalizedInput.split(" ").filter(Boolean);
  const treatmentWords = new Set(normalizedTreatment.split(" ").filter(Boolean));
  const sharedWords = inputWords.filter((word) => treatmentWords.has(word)).length;
  const wordScore = sharedWords / Math.max(1, Math.min(inputWords.length, treatmentWords.size));
  const containsScore =
    maxLength >= 6 && (normalizedInput.includes(normalizedTreatment) || normalizedTreatment.includes(normalizedInput))
      ? 0.88
      : 0;

  return Math.max(distanceScore, wordScore, containsScore);
};

const findSimilarTreatmentService = (input: string, treatments: ServiceCatalogItem[]) => {
  const normalizedInput = normalizeTreatmentNameForMatch(input);
  if (!normalizedInput) return null;

  const ranked = treatments
    .filter((treatment) => treatment.isActive !== false && treatment.id !== OTHER_APPOINTMENT_TYPE_INDEX)
    .map((treatment) => ({
      treatment,
      score: getTreatmentSimilarityScore(normalizedInput, treatment.label),
    }))
    .sort((a, b) => b.score - a.score);

  const bestMatch = ranked[0];
  return bestMatch && bestMatch.score >= 0.78 ? bestMatch.treatment : null;
};

const getVisitDoctorName = (appointment: Partial<Appointment> | HistoryAppointment | null | undefined) => {
  if (!appointment) return "";
  const rawDoctor = typeof appointment.doctor === "object"
    ? (appointment.doctor as any)?.name || (appointment.doctor as any)?.fullName || (appointment.doctor as any)?.username || (appointment.doctor as any)?.id
    : appointment.doctor || (appointment as any).doctorName || (appointment as any).doctorId;

  return isUnassignedDoctorValue(rawDoctor) ? "" : String(rawDoctor || "").trim();
};

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
  onOpenBookingModal?: (appointment: Appointment, options?: OpenBookingModalOptions) => void;
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
  const { refreshPatients, appointments, refreshAppointments, openCreateModal, updateAppointment, refreshTrigger } = useAppointmentModal();
  const { openPaymentModal, openEditPaymentModal } = usePaymentModal();
  const { effectiveRole } = useAdminViewMode();
  const [activeTab, setActiveTab] = useState("history");
  const shouldLoadHistoryData = activeTab === "history" || activeTab === "payments" || Boolean(openBookingAppointmentId);
  const shouldLoadFinancialLog = activeTab === "payments" || activeTab === "history";
  const canSeeDeletedAppointments = effectiveRole === "admin";
  const shouldLoadTreatmentOptions = activeTab === "history" || activeTab === "payments";
  const { options: treatmentOptions, isLoading: isLoadingTreatmentOptions } = useAppointmentTypeOptions(shouldLoadTreatmentOptions);
  const { doctors, isLoadingDoctors, reloadDoctors } = useDoctors(undefined, { enabled: activeTab === "history" || activeTab === "payments" });
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
  const [assignDoctorAppointment, setAssignDoctorAppointment] = useState<HistoryAppointment | null>(null);
  const [isAssigningVisitDoctor, setIsAssigningVisitDoctor] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | HistoryAppointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [isRescheduleDatePickerOpen, setIsRescheduleDatePickerOpen] = useState(false);
  const [isRescheduleTimePickerOpen, setIsRescheduleTimePickerOpen] = useState(false);
  const [rescheduleDuration, setRescheduleDuration] = useState("30");
  const [rescheduleStatus, setRescheduleStatus] = useState("scheduled");
  const [isRescheduleSaving, setIsRescheduleSaving] = useState(false);
  const [updateTreatmentAppointment, setUpdateTreatmentAppointment] = useState<Appointment | HistoryAppointment | null>(null);
  const [selectedVisitTreatmentSections, setSelectedVisitTreatmentSections] = useState<SelectTreatmentModalSection[] | null>(null);
  const [selectedVisitTreatmentId, setSelectedVisitTreatmentId] = useState<number | null>(null);
  const [customVisitTreatmentName, setCustomVisitTreatmentName] = useState("");
  const [visitTreatmentPrice, setVisitTreatmentPrice] = useState("");
  const [visitTreatmentToothNumberEntries, setVisitTreatmentToothNumberEntries] = useState<string[]>([""]);
  const [similarVisitTreatmentPrompt, setSimilarVisitTreatmentPrompt] = useState<{
    input: string;
    service: ServiceCatalogItem;
  } | null>(null);
  const [isUpdatingVisitTreatment, setIsUpdatingVisitTreatment] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<Patient[]>([]);
  const [parentPatient, setParentPatient] = useState<Patient | null>(null);
  const [isLoadingFamily, setIsLoadingFamily] = useState(false);
  const [questionnaireQuestions, setQuestionnaireQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, boolean>>({});
  const [savedQuestionnaireAnswers, setSavedQuestionnaireAnswers] = useState<Record<string, boolean>>({});
  const [patientQuestionnaireData, setPatientQuestionnaireData] = useState<Record<string, any>>({});
  const [savedPatientQuestionnaireData, setSavedPatientQuestionnaireData] = useState<Record<string, any>>({});
  const [physicianInformation, setPhysicianInformation] = useState<PhysicianInformationState>(() => ({ ...EMPTY_PHYSICIAN_INFORMATION }));
  const [savedPhysicianInformation, setSavedPhysicianInformation] = useState<PhysicianInformationState>(() => ({ ...EMPTY_PHYSICIAN_INFORMATION }));
  const [isLoadingQuestionnaire, setIsLoadingQuestionnaire] = useState(false);
  const [isSavingQuestionnaire, setIsSavingQuestionnaire] = useState(false);
  const [questionnaireLoadedPatientId, setQuestionnaireLoadedPatientId] = useState<string | null>(null);
  const [consentForm, setConsentForm] = useState<ConsentFormState>(() => createConsentFormState());
  const [savedConsentForm, setSavedConsentForm] = useState<ConsentFormState>(() => createConsentFormState());
  const [consentSignatureModalTarget, setConsentSignatureModalTarget] = useState<"patient" | "dentist" | null>(null);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
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
    setActiveTab("history");
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
      const [questionsResult, patientQuestionnaireResponse] = await Promise.all([
        loadQuestionnaireQuestions(),
        fetch(apiUrl(`/api/questionnaires/${encodeURIComponent(String(patient.id))}`), {
          credentials: "include",
          headers: getAuthHeaders(),
        }),
      ]);

      const patientQuestionnairePayload = await patientQuestionnaireResponse.json().catch(() => ({}));
      const questionnaireData = patientQuestionnairePayload?.data && typeof patientQuestionnairePayload.data === "object"
        ? patientQuestionnairePayload.data
        : {};
      const answers = normalizeQuestionnaireAnswers(questionnaireData);
      const nextConsentForm = createConsentFormState(questionnaireData);
      const nextPhysicianInformation = createPhysicianInformationState(questionnaireData);

      setQuestionnaireQuestions(questionsResult.questions.filter((question) => question.isActive !== false));
      setPatientQuestionnaireData(questionnaireData);
      setSavedPatientQuestionnaireData(questionnaireData);
      setQuestionnaireAnswers(answers);
      setSavedQuestionnaireAnswers(answers);
      setPhysicianInformation(nextPhysicianInformation);
      setSavedPhysicianInformation(nextPhysicianInformation);
      setConsentForm(nextConsentForm);
      setSavedConsentForm(nextConsentForm);
      setQuestionnaireLoadedPatientId(String(patient.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load questionnaire");
    } finally {
      setIsLoadingQuestionnaire(false);
    }
  }, [normalizeQuestionnaireAnswers, patient.id]);

  useEffect(() => {
    if (activeTab === "questionnaire" || activeTab === "consent") {
      if (activeTab === "questionnaire" && hasRestoredQuestionnaireDraft && questionnaireQuestions.length > 0) return;
      if (questionnaireLoadedPatientId === String(patient.id || "")) return;
      loadQuestionnaireTab();
    }
  }, [activeTab, hasRestoredQuestionnaireDraft, loadQuestionnaireTab, patient.id, questionnaireLoadedPatientId, questionnaireQuestions.length]);

  const questionnaireHasChanges = React.useMemo(
    () =>
      JSON.stringify(questionnaireAnswers) !== JSON.stringify(savedQuestionnaireAnswers) ||
      JSON.stringify(patientQuestionnaireData) !== JSON.stringify(savedPatientQuestionnaireData) ||
      JSON.stringify(physicianInformationComparable(physicianInformation)) !==
      JSON.stringify(physicianInformationComparable(savedPhysicianInformation)),
    [physicianInformation, patientQuestionnaireData, questionnaireAnswers, savedPatientQuestionnaireData, savedPhysicianInformation, savedQuestionnaireAnswers]
  );

  const consentFormHasChanges = React.useMemo(
    () =>
      JSON.stringify(consentFormComparable(consentForm)) !== JSON.stringify(consentFormComparable(savedConsentForm)),
    [consentForm, savedConsentForm]
  );

  const allConsentAcknowledgementsAccepted = React.useMemo(
    () => CONSENT_ACKNOWLEDGEMENTS.every((item) => consentForm.acknowledgements[item.id]),
    [consentForm.acknowledgements]
  );

  const hasConsentSignature = Boolean(consentForm.patientSignatureImage);
  const isConsentFormComplete =
    allConsentAcknowledgementsAccepted &&
    Boolean(consentForm.patientSignatureName.trim()) &&
    Boolean(consentForm.signedDate) &&
    Boolean(consentForm.dentistSignatureName.trim()) &&
    hasConsentSignature;

  const handleQuestionnaireAnswerChange = (questionId: string, checked: boolean) => {
    setQuestionnaireAnswers((current) => ({
      ...current,
      [questionId]: checked,
    }));

    if (questionId === PHYSICIAN_INFORMATION_QUESTION_ID && !checked) {
      setPhysicianInformation({ ...EMPTY_PHYSICIAN_INFORMATION });
    }

    setIsModified(true);
  };

  const updatePhysicianInformation = (field: PhysicianInformationField, value: string) => {
    setPhysicianInformation((current) => ({
      ...current,
      [field]: value,
    }));
    setIsModified(true);
  };

  const updateQuestionnaireDataField = (field: string, value: string) => {
    setPatientQuestionnaireData((current) => ({
      ...current,
      [field]: value,
    }));
    setIsModified(true);
  };

  const updateConsentField = <K extends keyof ConsentFormState>(field: K, value: ConsentFormState[K]) => {
    setConsentForm((current) => ({
      ...current,
      accepted: false,
      [field]: value,
    }));
    setIsModified(true);
  };

  const updateConsentAcknowledgement = (id: ConsentAcknowledgementId, checked: boolean) => {
    setConsentForm((current) => ({
      ...current,
      accepted: false,
      acknowledgements: {
        ...current.acknowledgements,
        [id]: checked,
      },
    }));
    setIsModified(true);
  };

  const saveQuestionnaireAnswers = async () => {
    if (!patient.id || !questionnaireHasChanges) return true;

    setIsSavingQuestionnaire(true);
    try {
      const submittedPhysicianInformation = questionnaireAnswers[PHYSICIAN_INFORMATION_QUESTION_ID]
        ? physicianInformation
        : EMPTY_PHYSICIAN_INFORMATION;

      const response = await fetch(apiUrl(`/api/questionnaires/${encodeURIComponent(String(patient.id))}`), {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...patientQuestionnaireData,
          questionnaireAnswers,
          ...serializePhysicianInformation(submittedPhysicianInformation),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to save questionnaire answers");
      }

      const nextData = payload.data && typeof payload.data === "object" ? payload.data : {
        ...patientQuestionnaireData,
        questionnaireAnswers,
        ...serializePhysicianInformation(submittedPhysicianInformation),
      };
      const nextAnswers = normalizeQuestionnaireAnswers(nextData);
      const nextPhysicianInformation = createPhysicianInformationState(nextData);
      setPatientQuestionnaireData(nextData);
      setSavedPatientQuestionnaireData(nextData);
      setQuestionnaireAnswers(nextAnswers);
      setSavedQuestionnaireAnswers(nextAnswers);
      setPhysicianInformation(nextPhysicianInformation);
      setSavedPhysicianInformation(nextPhysicianInformation);
      setHasRestoredQuestionnaireDraft(false);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save questionnaire answers");
      return false;
    } finally {
      setIsSavingQuestionnaire(false);
    }
  };

  const saveConsentForm = async () => {
    if (!patient.id || !consentFormHasChanges) return true;

    setIsSavingConsent(true);
    try {
      const signatureImage = consentForm.patientSignatureImage;
      const isComplete =
        allConsentAcknowledgementsAccepted &&
        Boolean(consentForm.patientSignatureName.trim()) &&
        Boolean(consentForm.signedDate) &&
        Boolean(consentForm.dentistSignatureName.trim()) &&
        Boolean(signatureImage);
      const nextConsentForm: ConsentFormState = {
        ...consentForm,
        accepted: isComplete,
        patientSignatureName: consentForm.patientSignatureName.trim(),
        guardianName: consentForm.guardianName.trim(),
        dentistSignatureName: consentForm.dentistSignatureName.trim(),
        patientSignatureImage: signatureImage,
        signedAt: isComplete ? new Date().toISOString() : "",
      };
      const submittedPhysicianInformation = questionnaireAnswers[PHYSICIAN_INFORMATION_QUESTION_ID]
        ? physicianInformation
        : EMPTY_PHYSICIAN_INFORMATION;

      const response = await fetch(apiUrl(`/api/questionnaires/${encodeURIComponent(String(patient.id))}`), {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...patientQuestionnaireData,
          questionnaireAnswers,
          ...serializePhysicianInformation(submittedPhysicianInformation),
          ...serializeConsentForm(nextConsentForm),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to save consent form");
      }

      const nextData = payload.data && typeof payload.data === "object" ? payload.data : {
        ...patientQuestionnaireData,
        questionnaireAnswers,
        ...serializePhysicianInformation(submittedPhysicianInformation),
        ...serializeConsentForm(nextConsentForm),
      };
      const nextAnswers = normalizeQuestionnaireAnswers(nextData);
      const nextPhysicianInformation = createPhysicianInformationState(nextData);
      const savedConsent = createConsentFormState(nextData);
      setPatientQuestionnaireData(nextData);
      setSavedPatientQuestionnaireData(nextData);
      setQuestionnaireAnswers(nextAnswers);
      setSavedQuestionnaireAnswers(nextAnswers);
      setPhysicianInformation(nextPhysicianInformation);
      setSavedPhysicianInformation(nextPhysicianInformation);
      setConsentForm(savedConsent);
      setSavedConsentForm(savedConsent);
      setHasRestoredQuestionnaireDraft(false);
      toast.success("Consent form saved");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save consent form");
      return false;
    } finally {
      setIsSavingConsent(false);
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
      method: normalizeBookingPaymentMethod((apt as any).paymentMethod),
      transactionId: `LEGACY-${apt.id}`,
      notes: "Imported from appointment total paid because no individual payment record exists.",
      status: apt.paymentStatus === "unpaid" ? "pending" : "completed",
      deleted: false,
      deletedAt: null,
      paymentDeleted: false,
      paymentDeletedAt: null,
      appointmentDeleted: isSoftDeletedAppointment(apt),
      appointmentDeletedAt: (apt as any).deletedAt ?? null,
      appointmentStatus: apt.status,
    };
  }, [getHistoryAppointmentType]);

  const buildPatientTransactions = React.useCallback((history: Appointment[], payments: PaymentRow[] = []) => {
    const appointmentById = new Map(history.map((apt) => [apt.id, apt]));

    // Normalize payments coming from the payments collection
    const paymentsFromCollection = payments
      .filter((payment) => !isPaymentLogLikeRow(payment))
      .map((payment) => {
        const appointment = payment.appointmentId ? appointmentById.get(payment.appointmentId) : undefined;
        const appointmentType = payment.appointmentType || (appointment ? getHistoryAppointmentType(appointment) : "Unassigned Payment");
        const appointmentDate = payment.appointmentDate || (appointment ? String(appointment.date || "") : "");
        const paymentDate = toDateOnly(payment.date) || toDateOnly(payment.createdAt);
        const appointmentDeleted = Boolean((payment as any).appointmentDeleted) || isSoftDeletedAppointment(appointment);
        const appointmentDeletedAt = (payment as any).appointmentDeletedAt || (appointment as any)?.deletedAt || null;
        const paymentDeleted =
          (payment as any).paymentDeleted !== undefined
            ? Boolean((payment as any).paymentDeleted)
            : Boolean(payment.deleted) && !appointmentDeleted;
        const paymentDeletedAt = paymentDeleted
          ? ((payment as any).paymentDeletedAt || payment.deletedAt || null)
          : null;

        return {
          ...payment,
          id: payment.id || payment.transactionId || `payment-${payment.appointmentId || "unknown"}-${payment.date}`,
          date: paymentDate,
          paymentDate,
          description: payment.description || `Payment for ${appointmentType}`,
          amount: Number(payment.amount || 0),
          type: payment.type || "payment",
          method: normalizeBookingPaymentMethod(payment.method),
          source: (payment as any).source || "payment",
          appointmentId: payment.appointmentId,
          appointmentType,
          appointmentDate,
          doctor: payment.doctor || appointment?.doctor || "",
          status: payment.status || "completed",
          deleted: paymentDeleted,
          deletedAt: paymentDeletedAt,
          paymentDeleted,
          paymentDeletedAt,
          appointmentDeleted,
          appointmentDeletedAt: appointmentDeleted ? appointmentDeletedAt : null,
          appointmentStatus: appointment?.status,
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
        const appointmentDeleted = Boolean(rawTxn.appointmentDeleted) || isSoftDeletedAppointment(apt);
        const appointmentDeletedAt = rawTxn.appointmentDeletedAt || (apt as any).deletedAt || null;
        const paymentDeleted =
          rawTxn.paymentDeleted !== undefined
            ? Boolean(rawTxn.paymentDeleted)
            : Boolean(rawTxn.deleted) && !appointmentDeleted;
        const paymentDeletedAt = paymentDeleted ? (rawTxn.paymentDeletedAt || rawTxn.deletedAt || null) : null;
        const txn: RecentTransaction = {
          ...rawTxn,
          id: rawTxn.id || rawTxn.transactionId || `apt-${apt.id}-txn-${rawTxn.date || ''}-${rawTxn.method || ''}-${rawTxn.amount || 0}`,
          date: paymentDate,
          paymentDate,
          description: rawTxn.description || rawTxn.notes || `Payment for ${appointmentType}`,
          amount: Number(rawTxn.amount || 0),
          type: rawTxn.type || "payment",
          method: normalizeBookingPaymentMethod(rawTxn.method || rawTxn.paymentMethod),
          source: (rawTxn as any).source || "appointment-transaction",
          appointmentId: apt.id,
          appointmentType,
          appointmentDate,
          doctor: rawTxn.doctor || apt.doctor || "",
          status: rawTxn.status || "completed",
          deleted: paymentDeleted,
          deletedAt: paymentDeletedAt,
          paymentDeleted,
          paymentDeletedAt,
          appointmentDeleted,
          appointmentDeletedAt: appointmentDeleted ? appointmentDeletedAt : null,
          appointmentStatus: apt.status,
        } as RecentTransaction;

        const key = getPaymentTransactionKey(txn);
        if (!keys.has(key) && Number(txn.amount || 0) > 0) {
          historyRows.push(txn);
          keys.add(key);
        }
      });
    });

    const realAppointmentIds = new Set(
      [...paymentsFromCollection, ...historyRows].map((row) => row.appointmentId).filter(Boolean)
    );

    const legacyRows = history
      .filter((apt) => !realAppointmentIds.has(apt.id))
      .map(createLegacyPaymentRow)
      .filter(Boolean) as RecentTransaction[];

    return [...paymentsFromCollection, ...historyRows, ...legacyRows]
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

    const questionnaireDataFieldLabels: Record<string, string> = {
      bleedingTime: "Questionnaire - Bleeding Time",
      bloodType: "Questionnaire - Blood Type",
      bloodPressure: "Questionnaire - Blood Pressure",
      otherConditionsDetails: "Questionnaire - Other medical condition details",
      otherMedicalCondition: "Questionnaire - Other medical condition",
      allergyOthersDetails: "Questionnaire - Additional allergy details",
    };

    Object.entries(questionnaireDataFieldLabels).forEach(([fieldKey, label]) => {
      const oldValue = savedPatientQuestionnaireData[fieldKey];
      const newValue = patientQuestionnaireData[fieldKey];
      if (toComparableValue(oldValue) !== toComparableValue(newValue)) {
        changes[label] = {
          old: oldValue,
          new: newValue,
        };
      }
    });

    const physicianFieldLabels: Record<PhysicianInformationField, string> = {
      name: "Questionnaire - Name of Physician",
      officeAddress: "Questionnaire - Physician Office Address",
      officeNumber: "Questionnaire - Physician Office Number",
    };

    PHYSICIAN_INFORMATION_FIELDS.forEach((field) => {
      const oldValue = savedPhysicianInformation[field.id];
      const newValue = physicianInformation[field.id];
      if (toComparableValue(oldValue) !== toComparableValue(newValue)) {
        changes[physicianFieldLabels[field.id]] = {
          old: oldValue,
          new: newValue,
        };
      }
    });

    CONSENT_ACKNOWLEDGEMENTS.forEach((item) => {
      const oldValue = Boolean(savedConsentForm.acknowledgements[item.id]);
      const newValue = Boolean(consentForm.acknowledgements[item.id]);
      if (oldValue !== newValue) {
        changes[`Consent Form - ${item.title}`] = {
          old: oldValue,
          new: newValue,
        };
      }
    });

    const consentFieldLabels: Record<keyof Pick<ConsentFormState, "patientSignatureName" | "guardianName" | "dentistSignatureName" | "signedDate" | "patientSignatureImage" | "dentistSignatureImage">, string> = {
      patientSignatureName: "Consent Form - Patient / Parent / Guardian Signature Name",
      guardianName: "Consent Form - Parent / Guardian Name",
      dentistSignatureName: "Consent Form - Dentist Signature",
      signedDate: "Consent Form - Date",
      patientSignatureImage: "Consent Form - Drawn Signature",
      dentistSignatureImage: "Consent Form - Dentist Drawn Signature",
    };

    Object.entries(consentFieldLabels).forEach(([field, label]) => {
      const consentField = field as keyof typeof consentFieldLabels;
      const oldValue = toComparableValue(savedConsentForm[consentField]);
      const newValue = toComparableValue(consentForm[consentField]);
      if (oldValue !== newValue) {
        changes[label] = {
          old: field === "patientSignatureImage" || field === "dentistSignatureImage" ? Boolean(savedConsentForm[consentField]) : savedConsentForm[consentField],
          new: field === "patientSignatureImage" || field === "dentistSignatureImage" ? Boolean(consentForm[consentField]) : consentForm[consentField],
        };
      }
    });

    return changes;
  }, [
    consentForm,
    formData,
    originalLoadedData,
    patientQuestionnaireData,
    physicianInformation,
    questionnaireAnswers,
    questionnaireQuestions,
    savedConsentForm,
    savedPatientQuestionnaireData,
    savedPhysicianInformation,
    savedQuestionnaireAnswers,
  ]);

  const visibleChangedFields = React.useMemo(() => getVisiblePatientChanges(changedFields), [changedFields]);
  const hasTrackedChanges = React.useMemo(() => Object.keys(visibleChangedFields).length > 0, [visibleChangedFields]);

  const discardStoredDraft = React.useCallback(() => {
    if (currentPatientId) clearPatientProfileDraft(currentPatientId);
    setHasRestoredQuestionnaireDraft(false);
    setIsRecoveryDialogOpen(false);
  }, [currentPatientId]);

  useEffect(() => {
    setIsModified(hasTrackedChanges);
  }, [hasTrackedChanges, setIsModified]);

  // Local payment deletion state for PatientDetails (prefixed to avoid collisions)
  const [pdConfirmLoading, setPdConfirmLoading] = useState(false);
  const [pdPaymentToDelete, setPdPaymentToDelete] = useState<{
    transaction: RecentTransaction;
    paymentId: string;
    appointmentId?: string;
  } | null>(null);

  const isMobile = useIsMobile();

  // New state for filters
  const [historyPaymentStatusFilter, setHistoryPaymentStatusFilter] = useState('all');
  const [historyDoctorFilter, setHistoryDoctorFilter] = useState('all');
  const [historyProcedureFilter, setHistoryProcedureFilter] = useState('all');
  const [historySearchFilter, setHistorySearchFilter] = useState('');
  const [historyViewMode, setHistoryViewMode] = useState<'history' | 'list'>('list');
  const [historyPaymentHistoryOpenByAppointment, setHistoryPaymentHistoryOpenByAppointment] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof isMobile === 'boolean') {
      setHistoryViewMode(isMobile ? 'history' : 'list');
    }
  }, [isMobile]);

  // Snapshot states
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);
  const [selectedPaymentSnapshot, setSelectedPaymentSnapshot] = useState<any | null>(null);
  const [selectedSnapshotIsHistorical, setSelectedSnapshotIsHistorical] = useState(false);
  const [snapshotLogDate, setSnapshotLogDate] = useState("");

  // Booking history state
  const [isBookingHistoryOpen, setIsBookingHistoryOpen] = useState(false);
  const [bookingHistoryAppointment, setBookingHistoryAppointment] = useState<any>(null);
  const [bookingHistoryLogs, setBookingHistoryLogs] = useState<any[]>([]);
  const [bookingPaymentLogs, setBookingPaymentLogs] = useState<any[]>([]);
  const [isLoadingBookingHistory, setIsLoadingBookingHistory] = useState(false);
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
    } catch (e) { }

    // Check if this snapshot has a focused payment from history (from BookingAppointmentHistory)
    const focusedPaymentSnapshot = (appointment as any)?._focusedPaymentSnapshot;
    const effectiveTransaction = transaction || focusedPaymentSnapshot;

    const originalAppointment = patientAppointments.find((apt: Appointment) => String(apt.id) === String(appointment.id));
    const transactionRow = effectiveTransaction as (RecentTransaction & Record<string, any>) | undefined;
    const transactionSnapshot = transactionRow?.appointmentSnapshot && typeof transactionRow.appointmentSnapshot === "object"
      ? transactionRow.appointmentSnapshot
      : undefined;

    const isPaymentSnapshot = Boolean(effectiveTransaction);
    const isHistoricalPaymentSnapshot = (appointment as any)?._isHistorical || false;
    const snapshotBase = {
      ...(originalAppointment || {}),
      ...appointment,
      ...(!isPaymentSnapshot && transactionSnapshot ? transactionSnapshot : {}),
    } as Appointment & Record<string, any>;
    const displayDate = toDateOnly(snapshotBase.date);
    const displayTime = snapshotBase.time || String(snapshotBase.date || "").split(" ")[1] || "";
    const price = Number(snapshotBase.price ?? 0);
    const totalPaid = Number(snapshotBase.totalPaid ?? 0);
    const snapshotBalance = Number(snapshotBase.balance);
    const balance = Number.isFinite(snapshotBalance)
      ? snapshotBalance
      : Math.max(0, price - totalPaid);
    const transactionPaymentDate =
      toDateOnly(transactionRow?.paymentDate) ||
      toDateOnly(effectiveTransaction?.date) ||
      toDateOnly(snapshotBase.paymentDate);
    const logDate = (appointment as any)?.changedAt || transactionRow?.changedAt || transactionRow?.createdAt || transactionPaymentDate || snapshotBase.updatedAt || snapshotBase.createdAt || new Date().toISOString();
    const patientDisplayName =
      snapshotBase.patientName ||
      appointment.patientName ||
      originalAppointment?.patientName ||
      patient.name ||
      [patient.firstName, patient.lastName].filter(Boolean).join(" ");
    const paymentSnapshotForDialog = transactionRow
      ? {
        ...transactionRow,
        id: transactionRow.paymentId || transactionRow.paymentRecordId || transactionRow.id,
        paymentId: transactionRow.paymentId || transactionRow.paymentRecordId || transactionRow.id,
        paymentRecordId: transactionRow.paymentRecordId || transactionRow.paymentId || transactionRow.id,
        transactionId: transactionRow.transactionId || transactionRow.id,
        amount: Number(transactionRow.amount || 0),
        paymentAmount: Number(transactionRow.amount || 0),
        date: transactionPaymentDate || toDateOnly(transactionRow.date),
        paymentDate: transactionPaymentDate || toDateOnly(transactionRow.date),
        method: transactionRow.method,
        paymentMethod: transactionRow.method,
        changedAt: transactionRow.changedAt || transactionRow.updatedAt || transactionRow.createdAt,
        _paymentHistoryAction: isActualDeletedPaymentTransaction(transactionRow) ? "deleted" : undefined,
      }
      : null;

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
      amount: paymentSnapshotForDialog?.amount,
      paymentAmount: paymentSnapshotForDialog?.amount,
      paymentDate: paymentSnapshotForDialog?.paymentDate || snapshotBase.paymentDate,
      paymentMethod: paymentSnapshotForDialog?.paymentMethod || snapshotBase.paymentMethod,
      paymentStatus: snapshotBase.paymentStatus || appointment.paymentStatus,
      transactionId: effectiveTransaction?.transactionId,
      _paymentTransactionId: effectiveTransaction?.transactionId || effectiveTransaction?.id || snapshotBase._paymentTransactionId,
      _transactionId: effectiveTransaction?.transactionId || effectiveTransaction?.id || snapshotBase._transactionId,
      previousBalance: transactionRow?.previousBalance ?? snapshotBase.previousBalance,
      newBalance: transactionRow?.newBalance ?? snapshotBase.newBalance,
      _isHistorical: isHistoricalPaymentSnapshot,
    });
    setSelectedPaymentSnapshot(paymentSnapshotForDialog);
    setSelectedSnapshotIsHistorical(isHistoricalPaymentSnapshot);
    setSnapshotLogDate(logDate);
    setIsSnapshotOpen(true);
  };

  const handleOpenBookingHistory = async (appointment: Appointment | HistoryAppointment) => {
    const appointmentId = appointment?.id;
    if (!appointmentId) {
      toast.error("Could not load appointment history");
      return;
    }

    try {
      setIsLoadingBookingHistory(true);
      setBookingHistoryAppointment(appointment);

      // Fetch appointment logs
      const logsResponse = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(String(appointmentId))}/logs`), {
        headers: getAuthHeaders(),
      });

      const logsData = await logsResponse.json();
      const appointmentLogs = logsResponse.ok && logsData?.success && Array.isArray(logsData.data) ? logsData.data : [];

      // Fetch payment logs
      const paymentResponse = await fetch(
        apiUrl(`/api/payments/appointment/${encodeURIComponent(String(appointmentId))}`),
        { headers: getAuthHeaders() }
      );

      const paymentData = await paymentResponse.json();
      const paymentLogs = paymentResponse.ok && paymentData?.success && Array.isArray(paymentData.data)
        ? paymentData.data
        : [];

      setBookingHistoryLogs(appointmentLogs);
      setBookingPaymentLogs(paymentLogs);
      setIsBookingHistoryOpen(true);
    } catch (error) {
      console.error("Error loading booking history:", error);
      toast.error("Failed to load appointment history");
    } finally {
      setIsLoadingBookingHistory(false);
    }
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

  const openRescheduleModal = (appointment: Appointment | HistoryAppointment) => {
    const appointmentId = String(appointment?.id || "");
    if (!appointmentId) {
      toast.error("Could not find appointment to reschedule");
      return;
    }

    const sourceAppointment =
      patientAppointments.find((apt: Appointment) => String(apt.id) === appointmentId) ||
      mockAppointmentHistoryLocal.find((apt: Appointment) => String(apt.id) === appointmentId) ||
      appointment;
    const appointmentDate = parseBackendDateToLocal(toDateOnly(sourceAppointment.date));

    setRescheduleAppointment(sourceAppointment);
    setRescheduleDate(Number.isNaN(appointmentDate.getTime()) ? new Date() : appointmentDate);
    setRescheduleTime(String((sourceAppointment as any).time || "").trim());
    setRescheduleDuration(String(normalizeBookingDuration((sourceAppointment as any).duration || 30)));
    setRescheduleStatus(String(normalizeAppointmentStatus((sourceAppointment as any).status || "scheduled")));
    setIsRescheduleDatePickerOpen(false);
    setIsRescheduleTimePickerOpen(false);
  };

  const closeRescheduleModal = (force = false) => {
    if (isRescheduleSaving && !force) return;

    setRescheduleAppointment(null);
    setRescheduleDate(null);
    setRescheduleTime("");
    setRescheduleDuration("30");
    setRescheduleStatus("scheduled");
    setIsRescheduleDatePickerOpen(false);
    setIsRescheduleTimePickerOpen(false);
  };

  const handleSaveReschedule = async () => {
    const appointmentId = String(rescheduleAppointment?.id || "");
    const selectedTime = rescheduleTime.trim();

    if (!appointmentId) {
      toast.error("Could not find appointment to reschedule");
      return;
    }

    if (!rescheduleDate || !selectedTime) {
      toast.error("Please select a date and time");
      return;
    }

    const date = formatDateToYYYYMMDD(rescheduleDate);

    setIsRescheduleSaving(true);
    try {
      const updated = await updateAppointment(appointmentId, {
        date,
        time: selectedTime,
        duration: Number(rescheduleDuration) || 30,
        status: normalizeAppointmentStatus(rescheduleStatus) as Appointment["status"],
      } as Partial<Appointment>);

      const patchAppointment = (apt: Appointment) =>
        String(apt.id) === appointmentId
          ? ({
            ...apt,
            ...updated,
            date: updated.date || date,
            time: updated.time || selectedTime,
            duration: updated.duration ?? (Number(rescheduleDuration) || 30),
            status: updated.status || rescheduleStatus,
          } as Appointment)
          : apt;

      setPatientAppointments((current) => current.map(patchAppointment));
      setMockAppointmentHistoryLocal((current) => current.map(patchAppointment));
      refreshAppointments();
      refreshPatients();
      try {
        window.dispatchEvent(
          new CustomEvent("appointments:updated", {
            detail: { appointment: updated, appointmentId },
          })
        );
      } catch { }

      toast.success("Appointment rescheduled");
      closeRescheduleModal(true);
    } catch (error) {
      console.error("[PatientProfile] Failed to reschedule appointment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reschedule appointment");
    } finally {
      setIsRescheduleSaving(false);
    }
  };

  const openUpdateTreatmentModal = (appointment: Appointment | HistoryAppointment) => {
    const appointmentId = String(appointment?.id || "");
    if (!appointmentId) {
      toast.error("Could not find appointment to update");
      return;
    }

    const sourceAppointment =
      patientAppointments.find((apt: Appointment) => String(apt.id) === appointmentId) ||
      mockAppointmentHistoryLocal.find((apt: Appointment) => String(apt.id) === appointmentId) ||
      appointment;
    const numericType = Number((sourceAppointment as any).type);
    const selectedId = Number.isInteger(numericType) ? numericType : OTHER_APPOINTMENT_TYPE_INDEX;
    const selectedService = treatmentOptions.find((option) => option.id === selectedId);
    const currentTreatmentName =
      getAppointmentTypeName(numericType, (sourceAppointment as any).customType) ||
      String((sourceAppointment as any).type || "");
    const currentPrice = Number((sourceAppointment as any).price ?? selectedService?.price ?? 0);
    const initialSections = (() => {
      const bookingTreatments = getBookingTreatmentsValue(sourceAppointment);
      if (bookingTreatments.length > 0) {
        return bookingTreatments.map((bookingTreatment, index) => {
          const treatmentType = Number.isFinite(Number(bookingTreatment.type)) ? Number(bookingTreatment.type) : selectedId;
          const matchedTreatment = activeTreatmentOptions.find((option) => option.id === treatmentType) || null;
          const priceValue = Number.isFinite(Number(bookingTreatment.price))
            ? Number(bookingTreatment.price)
            : Number.isFinite(currentPrice)
              ? currentPrice
              : matchedTreatment?.price ?? 0;
          return {
            selectedTreatmentId: treatmentType,
            currentTreatmentLabel: index === 0 ? currentTreatmentName : "",
            customTreatmentName:
              treatmentType === OTHER_APPOINTMENT_TYPE_INDEX
                ? String(bookingTreatment.customType || (sourceAppointment as any).customType || currentTreatmentName || "").trim()
                : "",
            selectedPrice: String(Math.max(0, Number(priceValue) || 0)),
          } satisfies SelectTreatmentModalSection;
        });
      }

      return [{
        selectedTreatmentId: selectedId,
        currentTreatmentLabel: currentTreatmentName,
        customTreatmentName:
          selectedId === OTHER_APPOINTMENT_TYPE_INDEX
            ? String((sourceAppointment as any).customType || currentTreatmentName || "").trim()
            : "",
        selectedPrice: String(Number.isFinite(currentPrice) ? Math.max(0, currentPrice) : 0),
      }] satisfies SelectTreatmentModalSection[];
    })();

    setUpdateTreatmentAppointment(sourceAppointment);
    setSelectedVisitTreatmentSections(initialSections);
    const firstSection = initialSections[0];
    setSelectedVisitTreatmentId(firstSection.selectedTreatmentId ?? null);
    setCustomVisitTreatmentName(firstSection.customTreatmentName || "");
    setVisitTreatmentPrice(String(firstSection.selectedPrice ?? ""));
    setVisitTreatmentToothNumberEntries(getBookingToothNumberEntries(getBookingToothNumbersValue(sourceAppointment)));
    setSimilarVisitTreatmentPrompt(null);
  };

  const closeUpdateTreatmentModal = (force = false) => {
    if (isUpdatingVisitTreatment && !force) return;

    setUpdateTreatmentAppointment(null);
    setSelectedVisitTreatmentSections(null);
    setSelectedVisitTreatmentId(null);
    setCustomVisitTreatmentName("");
    setVisitTreatmentPrice("");
    setVisitTreatmentToothNumberEntries([""]);
    setSimilarVisitTreatmentPrompt(null);
  };

  const handleSaveVisitTreatment = async (skipSimilarityCheck = false) => {
    const appointmentId = String(updateTreatmentAppointment?.id || "");
    const sections = selectedVisitTreatmentSections && selectedVisitTreatmentSections.length > 0
      ? selectedVisitTreatmentSections
      : [{
          selectedTreatmentId: selectedVisitTreatmentId,
          customTreatmentName: customVisitTreatmentName,
          selectedPrice: visitTreatmentPrice,
        }];

    if (!appointmentId) {
      toast.error("Could not find appointment to update");
      return;
    }

    if (sections.length === 0) {
      toast.error("Please select a treatment");
      return;
    }

    const invalidSection = sections.find((section) => {
      const selectedId = section.selectedTreatmentId;
      if (selectedId === undefined || selectedId === null) return true;
      const selectedOption = treatmentOptions.find((option) => option.id === selectedId);
      if (!selectedOption) return true;
      if (selectedOption.id === OTHER_APPOINTMENT_TYPE_INDEX && !String(section.customTreatmentName || "").trim()) return true;
      const priceValue = Number(section.selectedPrice ?? selectedOption.price ?? 0);
      if (!Number.isFinite(priceValue) || priceValue < 0) return true;
      return false;
    });

    if (invalidSection) {
      toast.error("Please complete all treatment sections before saving");
      return;
    }

    const firstSection = sections[0];
    const selectedTreatment = treatmentOptions.find((option) => option.id === firstSection.selectedTreatmentId);

    if (!selectedTreatment) {
      toast.error("Please select a treatment");
      return;
    }

    const isOtherTreatment = selectedTreatment.id === OTHER_APPOINTMENT_TYPE_INDEX;
    const customType = isOtherTreatment ? String(firstSection.customTreatmentName || "").trim() : "";
    if (isOtherTreatment && !customType) {
      toast.error("Custom treatment name is required");
      return;
    }

    if (isOtherTreatment && !skipSimilarityCheck) {
      const similarService = findSimilarTreatmentService(customType, treatmentOptions);
      if (similarService) {
        setSimilarVisitTreatmentPrompt({ input: customType, service: similarService });
        return;
      }
    }

    const nextDuration = normalizeBookingDuration((updateTreatmentAppointment as any).duration || 30);
    const nextTreatments = sections.map((section) => {
      const selectedOption = treatmentOptions.find((option) => option.id === section.selectedTreatmentId) || { id: OTHER_APPOINTMENT_TYPE_INDEX, price: 0 };
      const isCustomTreatment = selectedOption.id === OTHER_APPOINTMENT_TYPE_INDEX;
      const priceValue = Number(section.selectedPrice ?? selectedOption.price ?? 0);
      return {
        type: selectedOption.id,
        customType: isCustomTreatment ? String(section.customTreatmentName || "").trim() : undefined,
        duration: nextDuration,
        price: Math.max(0, priceValue),
      };
    });
    const firstUpdatedTreatment = nextTreatments[0];
    const nextPrice = Number(firstUpdatedTreatment.price ?? 0);
    const nextToothNumbers = normalizeBookingToothNumbers(visitTreatmentToothNumberEntries);

    setIsUpdatingVisitTreatment(true);
    try {
      const updated = await updateAppointment(appointmentId, {
        type: firstUpdatedTreatment.type,
        customType: firstUpdatedTreatment.customType,
        duration: nextDuration,
        price: Math.max(0, nextPrice),
        ...buildBookingTreatmentsPayload(nextTreatments),
        toothNumbers: nextToothNumbers,
      } as Partial<Appointment>);

      const patchAppointment = (apt: Appointment) =>
        String(apt.id) === appointmentId
          ? ({
            ...apt,
            ...updated,
            type: updated.type ?? firstUpdatedTreatment.type,
            customType: firstUpdatedTreatment.customType ?? updated.customType,
            duration: updated.duration ?? nextDuration,
            price: updated.price ?? Math.max(0, nextPrice),
            toothNumbers: (updated as any).toothNumbers ?? nextToothNumbers,
            treatments: (updated as any).treatments ?? nextTreatments,
          } as Appointment)
          : apt;

      setPatientAppointments((current) => current.map(patchAppointment));
      setMockAppointmentHistoryLocal((current) => current.map(patchAppointment));
      refreshAppointments();
      refreshPatients();
      try {
        window.dispatchEvent(
          new CustomEvent("appointments:updated", {
            detail: { appointment: updated, appointmentId },
          })
        );
      } catch { }

      toast.success("Treatment updated");
      closeUpdateTreatmentModal(true);
    } catch (error) {
      console.error("[PatientProfile] Failed to update treatment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update treatment");
    } finally {
      setIsUpdatingVisitTreatment(false);
    }
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

  const handleAssignVisitDoctor = async (doctor: any) => {
    const appointmentId = String(assignDoctorAppointment?.id || "");
    if (!appointmentId) {
      toast.error("No appointment id available");
      return;
    }

    const isChangingDoctor = Boolean(getVisitDoctorName(assignDoctorAppointment));
    setIsAssigningVisitDoctor(true);
    try {
      const updated = await updateAppointment(appointmentId, {
        doctor: doctor.name,
        doctorId: doctor.id,
        doctorName: doctor.name,
      } as Partial<Appointment>);

      const patchAppointment = (apt: Appointment) =>
        String(apt.id) === appointmentId
          ? ({
            ...apt,
            ...updated,
            doctor: doctor.name,
            doctorId: doctor.id,
            doctorName: doctor.name,
            doctorProfile: doctor.profilePicture || doctor.profilePictureUrl || (apt as any).doctorProfile,
            doctorProfilePicture: doctor.profilePicture || doctor.profilePictureUrl || (apt as any).doctorProfilePicture,
          } as Appointment)
          : apt;

      setPatientAppointments((current) => current.map(patchAppointment));
      setMockAppointmentHistoryLocal((current) => current.map(patchAppointment));
      refreshAppointments();
      refreshPatients();
      setAssignDoctorAppointment(null);
      toast.success(isChangingDoctor ? "Doctor changed" : "Doctor assigned");
    } catch (error) {
      console.error("[PatientProfile] Failed to assign doctor:", error);
      toast.error("Failed to assign doctor");
    } finally {
      setIsAssigningVisitDoctor(false);
    }
  };

  const getTransactionPaymentDisplay = (transaction: RecentTransaction) => {
    if (isSoftDeletedPaymentTransaction(transaction)) {
      return {
        label: getDeletedPaymentLabel(transaction),
        status: "deleted",
        className: deletedPaymentBadgeClass,
        isLog: false,
      };
    }

    const appointmentId = getTransactionAppointmentId(transaction);
    const currentAppointment =
      mockAppointmentHistoryLocal.find((apt) => String(apt.id) === appointmentId) ||
      patientAppointments.find((apt) => String(apt.id) === appointmentId);
    const isCancelledAppointment =
      normalizeAppointmentStatus(String(currentAppointment?.status || "")) === "cancelled" ||
      isAppointmentCancelledStatusTransaction(transaction);

    if (isCancelledAppointment) {
      return {
        label: "Cancelled",
        status: "cancelled",
        className: cancelledPaymentBadgeClass,
        isLog: false,
      };
    }

    const transactionSnapshot = (transaction as any).appointmentSnapshot || {};
    const currentTransactionState = {
      currentAppointmentBalance: (transaction as any).currentAppointmentBalance,
      currentAppointmentTotalPaid: (transaction as any).currentAppointmentTotalPaid,
      currentAppointmentPrice: (transaction as any).currentAppointmentPrice,
      currentAppointmentDiscount: (transaction as any).currentAppointmentDiscount,
    };
    const status = getPaymentStatusFromCurrentBalance(
      currentAppointment || currentTransactionState,
      (transaction as any).currentPaymentStatus
    );
    const statusOption = getPaymentStatusOptionWithColors(status, PAYMENT_STATUSES);

    return {
      label: statusOption.label || "Paid",
      status: normalizePaymentStatus(statusOption.value) || status,
      className: `${statusOption.bgColor} ${statusOption.textColor} border-transparent`,
      isLog: isPaymentLogTransaction(transaction),
    };
  };

  const handleRestoreVisitAppointment = async (appointment: Appointment | HistoryAppointment) => {
    const appointmentId = String(appointment?.id || "");
    if (!appointmentId) {
      toast.error("Could not find appointment to restore");
      return;
    }

    try {
      const updated = await updateAppointment(appointmentId, {
        status: "cancelled",
        deleted: false,
        deletedAt: null,
      } as any);
      const restored = {
        ...appointment,
        ...updated,
        status: "cancelled",
        deleted: false,
        deletedAt: null,
        updatedAt: new Date().toISOString(),
      } as Appointment;
      const patchAppointment = (apt: Appointment) =>
        String(apt.id) === appointmentId ? ({ ...apt, ...restored } as Appointment) : apt;

      setPatientAppointments((current) => current.map(patchAppointment));
      setMockAppointmentHistoryLocal((current) => current.map(patchAppointment));
      refreshAppointments();
      refreshPatients();
      try {
        window.dispatchEvent(new CustomEvent("appointments:updated", {
          detail: { appointment: restored, appointmentId, restored: true, newStatus: "cancelled" },
        }));
      } catch { }
      toast.success("Appointment restored");
    } catch (error) {
      console.error("[PatientProfile] Failed to restore appointment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to restore appointment");
    }
  };

  const uniqueDoctors = React.useMemo(() => {
    const doctors = new Set(
      mockAppointmentHistoryLocal
        .map((apt) => getVisitDoctorName(apt))
        .filter(Boolean)
    );
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
    const procedures = new Set<string>();
    for (const apt of mappedHistory) {
      if (apt.type) {
        procedures.add(apt.type);
      }
      const bookingTreatments = getBookingTreatmentsValue(apt);
      for (const t of bookingTreatments) {
        const name = getAppointmentTypeName(t.type, t.customType) || String(t.type || '');
        if (name) {
          procedures.add(name);
        }
      }
    }
    return ['all', ...Array.from(procedures)];
  }, [mappedHistory]);
  const activeHistoryFilterItemClass = (isActive: boolean) =>
    isActive ? "bg-violet-600 text-white focus:bg-violet-600 focus:text-white" : "";
  const historyProcedureLabel = historyProcedureFilter === "all" ? "All Services" : String(historyProcedureFilter);
  const historyDoctorLabel = doctorFilter
    ? String(doctorFilter)
    : historyDoctorFilter === "all"
      ? "All Providers"
      : String(historyDoctorFilter);
  const historyPaymentLabel = historyPaymentStatusFilter === "all"
    ? "All Payments"
    : PAYMENT_STATUSES.find((status) => status.value === historyPaymentStatusFilter)?.label || "Payment";
  const resetHistoryFilters = () => {
    setHistoryProcedureFilter("all");
    if (!doctorFilter) setHistoryDoctorFilter("all");
    setHistoryPaymentStatusFilter("all");
  };

  const filteredHistory = React.useMemo(() => {
    return mappedHistory.filter(apt => {
      const normalizedStatus = normalizeAppointmentStatus(String(apt.status || ""));
      if (!canSeeDeletedAppointments && isSoftDeletedAppointment(apt)) return false;
      if (historyPaymentStatusFilter !== 'all' && apt.paymentStatus !== historyPaymentStatusFilter) return false;
      if (historyDoctorFilter !== 'all' && getVisitDoctorName(apt) !== historyDoctorFilter) return false;

      if (historyProcedureFilter !== 'all') {
        const bookingTreatments = getBookingTreatmentsValue(apt);
        const hasProcedure = bookingTreatments.some(t => {
          const name = getAppointmentTypeName(t.type, t.customType) || String(t.type || '');
          return name === historyProcedureFilter;
        });
        if (String(apt.type) !== historyProcedureFilter && !hasProcedure) return false;
      }

      if (historySearchFilter) {
        const search = historySearchFilter.toLowerCase();
        const bookingTreatments = getBookingTreatmentsValue(apt);
        const hasTreatmentMatch = bookingTreatments.some(t => {
          const name = getAppointmentTypeName(t.type, t.customType) || String(t.type || '');
          return name.toLowerCase().includes(search);
        });
        const match =
          String(apt.type || '').toLowerCase().includes(search) ||
          hasTreatmentMatch ||
          getVisitDoctorName(apt).toLowerCase().includes(search) ||
          String(apt.notes || '').toLowerCase().includes(search);
        if (!match) return false;
      }

      return true;
    });
  }, [canSeeDeletedAppointments, mappedHistory, historyPaymentStatusFilter, historyDoctorFilter, historyProcedureFilter, historySearchFilter]);

  // Filters for Payments tab
  const [paymentDoctorFilter, setPaymentDoctorFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [paymentProcedureFilter, setPaymentProcedureFilter] = useState('all');
  const [paymentSearchFilter, setPaymentSearchFilter] = useState('');
  const [paymentDateSortDirection, setPaymentDateSortDirection] = useState<"asc" | "desc">("desc");
  const [showDeletedPayments, setShowDeletedPayments] = useState(false);

  const uniquePaymentDoctors = React.useMemo(() => {
    const doctors = new Set(
      allTransactions
        .filter((t) => !isPaymentLogLikeRow(t))
        .map(t => t.doctor)
        .filter(Boolean)
        .map(String)
    );
    return ['all', ...Array.from(doctors)];
  }, [allTransactions]);

  const uniquePaymentMethods = React.useMemo(() => {
    const methods = new Set(
      allTransactions
        .filter((t) => !isPaymentLogLikeRow(t))
        .map(t => t.method)
        .filter(Boolean)
        .map(String)
    );
    return ['all', ...Array.from(methods)];
  }, [allTransactions]);

  const uniquePaymentProcedures = React.useMemo(() => {
    const procedures = new Set(
      allTransactions
        .filter((t) => !isPaymentLogLikeRow(t))
        .map(t => t.appointmentType)
        .filter(Boolean)
        .map(String)
    );
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

  const paymentMethodLabel = paymentMethodFilter === "all" ? "All Methods" : String(paymentMethodFilter);
  const paymentDoctorLabel = doctorFilter
    ? String(doctorFilter)
    : paymentDoctorFilter === "all"
      ? "All Doctors"
      : String(paymentDoctorFilter);
  const paymentProcedureLabel = paymentProcedureFilter === "all" ? "All Procedures" : String(paymentProcedureFilter);
  const paymentSortLabel = paymentDateSortDirection === "desc" ? "Newest Paid" : "Oldest Paid";
  const paymentDeletedLabel = showDeletedPayments ? "Showing deleted" : "Deleted hidden";

  const filteredTransactions = React.useMemo(() => {
    const search = paymentSearchFilter.trim().toLowerCase();

    return allTransactions
      .filter(t => {
        if (isPaymentLogLikeRow(t)) return false;
        if (!showDeletedPayments && isSoftDeletedPaymentTransaction(t)) return false;
        if (doctorFilter && t.doctor !== doctorFilter) return false;
        if (paymentDoctorFilter !== 'all' && t.doctor !== paymentDoctorFilter) return false;
        if (paymentMethodFilter !== 'all' && t.method !== paymentMethodFilter) return false;
        if (paymentProcedureFilter !== 'all' && t.appointmentType !== paymentProcedureFilter) return false;
        if (search) {
          const searchText = [
            t.method,
            t.doctor,
            t.appointmentType,
            t.appointmentDate,
            t.transactionId,
            t.notes,
            t.amount,
            formatPatientLogDate((t as any).paymentDate || t.date, ""),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (!searchText.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        return comparePaymentTransactionsChronologically(a, b, paymentDateSortDirection);
      });
  }, [allTransactions, doctorFilter, paymentDateSortDirection, paymentDoctorFilter, paymentMethodFilter, paymentProcedureFilter, paymentSearchFilter, showDeletedPayments]);

  const paymentSummary = React.useMemo(() => {
    return mockAppointmentHistoryLocal.reduce(
      (summary, apt: Appointment) => {
        if (isSoftDeletedAppointment(apt)) return summary;

        const billed = Number(apt.price || 0);
        const paid = Number(apt.totalPaid || 0);

        summary.totalBilled += billed;
        summary.totalPaid += paid;
        summary.outstanding += getAppointmentOutstandingBalance(apt);

        return summary;
      },
      { totalPaid: 0, outstanding: 0, totalBilled: 0 }
    );
  }, [mockAppointmentHistoryLocal]);

  const hasPaymentFilters =
    Boolean(paymentSearchFilter.trim()) ||
    paymentMethodFilter !== "all" ||
    paymentDoctorFilter !== "all" ||
    paymentProcedureFilter !== "all" ||
    showDeletedPayments;

  const clearPaymentFilters = () => {
    setPaymentSearchFilter("");
    setPaymentMethodFilter("all");
    setPaymentDoctorFilter("all");
    setPaymentProcedureFilter("all");
    setShowDeletedPayments(false);
  };

  const getPaymentMethodIcon = (method: string) => {
    switch ((method || '').toLowerCase()) {
      case NO_PAYMENT_METHOD_LABEL.toLowerCase():
        return <CreditCard className="h-4 w-4" />;
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

  const handleVisitStatusChange = async (appointment: Appointment | HistoryAppointment, nextStatus: string) => {
    const appointmentId = String(appointment.id || "");
    const normalizedStatus = normalizeAppointmentStatus(nextStatus);
    if (!appointmentId || !normalizedStatus) return;
    if (normalizedStatus === normalizeAppointmentStatus(String(appointment.status || ""))) return;

    try {
      const statusPatch: Partial<Appointment> = { status: normalizedStatus as Appointment["status"] };
      if (isSoftDeletedAppointment(appointment) || normalizedStatus === "deleted") {
        (statusPatch as any).deleted = false;
        if (normalizedStatus === "deleted") (statusPatch as any).deletedAt = (appointment as any).deletedAt || new Date().toISOString();
      }
      const updated = await updateAppointment(appointmentId, statusPatch);
      const patchAppointment = (apt: Appointment) =>
        String(apt.id) === appointmentId ? ({ ...apt, ...updated, ...statusPatch } as Appointment) : apt;

      setPatientAppointments((current) => current.map(patchAppointment));
      setMockAppointmentHistoryLocal((current) => current.map(patchAppointment));
      refreshAppointments();
      refreshPatients();
      window.dispatchEvent(new CustomEvent("appointments:updated", { detail: { appointment: updated, appointmentId } }));
      toast.success("Status updated");
    } catch (error) {
      console.error("[PatientProfile] Failed to update status:", error);
      toast.error("Failed to update status");
    }
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
    changedFields: visibleChangedFields,
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
    setPhysicianInformation({ ...EMPTY_PHYSICIAN_INFORMATION });
    setSavedPhysicianInformation({ ...EMPTY_PHYSICIAN_INFORMATION });
    const blankConsentForm = createConsentFormState();
    setConsentForm(blankConsentForm);
    setSavedConsentForm(blankConsentForm);
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
      setSavedPatientQuestionnaireData(draft.savedPatientQuestionnaireData || draft.patientQuestionnaireData || {});
      setPhysicianInformation(createPhysicianInformationState(draft.physicianInformation || draft.patientQuestionnaireData || {}));
      setSavedPhysicianInformation(createPhysicianInformationState(draft.savedPhysicianInformation || draft.patientQuestionnaireData || {}));
      setQuestionnaireQuestions(draft.questionnaireQuestions || []);
      const restoredConsentForm = createConsentFormState(draft.consentForm || draft.patientQuestionnaireData || {});
      const restoredSavedConsentForm = createConsentFormState(draft.savedConsentForm || draft.patientQuestionnaireData || {});
      setConsentForm(restoredConsentForm);
      setSavedConsentForm(restoredSavedConsentForm);
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
      physicianInformation,
      savedPhysicianInformation,
      questionnaireQuestions,
      consentForm,
      savedConsentForm,
    });
  }, [
    activeTab,
    consentForm,
    currentPatientId,
    draftCheckPatientId,
    formData,
    hasTrackedChanges,
    originalLoadedData,
    patientDisplayName,
    patientQuestionnaireData,
    physicianInformation,
    questionnaireAnswers,
    questionnaireQuestions,
    savedConsentForm,
    savedPhysicianInformation,
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

    const applyTransactions = (payments: PaymentRow[] = []) => {
      const normalized = buildPatientTransactions(mapped, payments);
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

      const fetchPatientPayments = async (): Promise<PaymentRow[]> => {
        if (!patient?.id) return [];

        try {
          const res = await fetch(apiUrl(`/api/payments/patient/${encodeURIComponent(String(patient.id))}?includeDeleted=true`), {
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

      const payments = await fetchPatientPayments();

      if (!controller.signal.aborted) {
        applyTransactions(payments);
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

        const consentSaved = await saveConsentForm();
        if (!consentSaved) {
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
    if (!paymentId || paymentId.startsWith("legacy-")) {
      toast.error("This payment total comes from legacy appointment data and cannot be deleted here.");
      return false;
    }

    try {
      const deleteUrl = apiUrl(`/api/payments/${paymentId}`);

      const response = await fetch(deleteUrl, {
        method: "DELETE",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
      });

      const result = await response.json();

      if (result.success) {
        const deletedAt = new Date().toISOString();
        const matchesDeletedPayment = (txn: RecentTransaction) =>
          getEditablePaymentId(txn) === paymentId ||
          String(txn.id || "") === paymentId ||
          String(txn.transactionId || "") === paymentId;
        const markDeletedPayment = (txn: RecentTransaction) =>
          matchesDeletedPayment(txn)
            ? ({
              ...txn,
              deleted: true,
              deletedAt,
              paymentDeleted: true,
              paymentDeletedAt: deletedAt,
            } as RecentTransaction)
            : txn;

        toast.success("Payment deleted successfully");
        setAllTransactions((prev) => prev.map(markDeletedPayment));
        setMockAppointmentHistoryLocal((prev) => prev.map((apt) => {
          if (appointmentId && apt.id !== appointmentId) return apt;
          const newTransactions = apt.transactions?.map(markDeletedPayment) || [];
          return {
            ...apt,
            transactions: newTransactions,
          };
        }));
        window.dispatchEvent(new CustomEvent("payments:updated"));
        refreshPatients();
        return true;
      } else {
        toast.error(result.message || "Failed to delete payment");
        return false;
      }
    } catch (err) {
      console.error("Error deleting payment:", err);
      toast.error("Error deleting payment");
      return false;
    }
  };

  const handleRestorePayment = async (paymentId: string, appointmentId?: string) => {
    if (!paymentId) {
      toast.error("Could not find the payment to restore");
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/payments/${encodeURIComponent(paymentId)}/restore`), {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        toast.error(result.message || "Failed to restore payment");
        return;
      }

      const restoredPayment = result.data?.payment || {};
      const matchesRestoredPayment = (txn: RecentTransaction) =>
        getRestorablePaymentId(txn) === paymentId ||
        String(txn.id || "") === paymentId ||
        String(txn.transactionId || "") === paymentId;
      const markRestoredPayment = (txn: RecentTransaction) =>
        matchesRestoredPayment(txn)
          ? ({
            ...txn,
            ...restoredPayment,
            source: (txn as any).source || "payment",
            deleted: false,
            deletedAt: null,
            paymentDeleted: false,
            paymentDeletedAt: null,
          } as RecentTransaction)
          : txn;

      setAllTransactions((prev) => prev.map(markRestoredPayment));
      setMockAppointmentHistoryLocal((prev) => prev.map((apt) => {
        if (appointmentId && apt.id !== appointmentId) return apt;
        const newTransactions = apt.transactions?.map(markRestoredPayment) || [];
        return {
          ...apt,
          transactions: newTransactions,
        };
      }));
      window.dispatchEvent(new CustomEvent("payments:updated"));
      refreshPatients();
      refreshAppointments();
      toast.success("Payment restored successfully");
    } catch (err) {
      console.error("Error restoring payment:", err);
      toast.error("Error restoring payment");
    }
  };

  const requestDeletePaymentTransaction = (txn: RecentTransaction) => {
    const paymentId = getEditablePaymentId(txn);

    if (!paymentId) {
      toast.error(getPaymentEditUnavailableMessage(txn));
      return;
    }

    setPdPaymentToDelete({
      transaction: txn,
      paymentId,
      appointmentId: txn.appointmentId || getTransactionAppointmentId(txn),
    });
  };

  const confirmDeletePaymentTransaction = async () => {
    if (!pdPaymentToDelete) return;

    try {
      setPdConfirmLoading(true);
      const deleted = await handleDeletePayment(pdPaymentToDelete.paymentId, pdPaymentToDelete.appointmentId);
      if (deleted) {
        setPdPaymentToDelete(null);
      }
    } finally {
      setPdConfirmLoading(false);
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
    setPhysicianInformation(savedPhysicianInformation);
    setConsentForm(savedConsentForm);
    setIsModified(false);
  };

  const textareaClass = "mt-1.5 min-h-24 rounded-lg border-slate-200 bg-white text-slate-900 shadow-none focus-visible:ring-violet-200";
  const cardClass = "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm";
  const cardHeaderClass = "border-b border-slate-100 bg-white px-5 py-5 sm:px-6";
  const cardContentClass = "space-y-6 p-5 sm:p-6";
  const rescheduleDoctorName = getVisitDoctorName(rescheduleAppointment);
  const rescheduleAppointmentLabel = rescheduleAppointment
    ? typeof (rescheduleAppointment as any).type === "number"
      ? getHistoryAppointmentType(rescheduleAppointment as Appointment)
      : String((rescheduleAppointment as any).type || "Appointment")
    : "";
  const rescheduleAppointmentId = rescheduleAppointment?.id ? String(rescheduleAppointment.id) : "";
  const activeTreatmentOptions = treatmentOptions.filter((option): option is ServiceCatalogItem => option.isActive !== false);
  const updateTreatmentCurrentLabel = updateTreatmentAppointment
    ? typeof (updateTreatmentAppointment as any).type === "number"
      ? getHistoryAppointmentType(updateTreatmentAppointment as Appointment)
      : String((updateTreatmentAppointment as any).type || "Appointment")
    : "";
  const isVisitTreatmentSectionValid = (section: SelectTreatmentModalSection) => {
    const selectedId = section.selectedTreatmentId;
    if (selectedId === undefined || selectedId === null) return false;
    const selectedOption = activeTreatmentOptions.find((option) => option.id === selectedId);
    if (!selectedOption) return false;
    if (selectedOption.id === OTHER_APPOINTMENT_TYPE_INDEX && !String(section.customTreatmentName || "").trim()) return false;
    const priceValue = Number(section.selectedPrice ?? selectedOption.price ?? 0);
    if (!Number.isFinite(priceValue) || priceValue < 0) return false;
    return true;
  };

  const selectedVisitTreatment = activeTreatmentOptions.find((option) => option.id === (selectedVisitTreatmentSections?.[0]?.selectedTreatmentId ?? selectedVisitTreatmentId)) || null;
  const visitTreatmentPriceNumber = Number(selectedVisitTreatmentSections?.[0]?.selectedPrice ?? visitTreatmentPrice);
  const canSaveVisitTreatment = Boolean(
    updateTreatmentAppointment &&
    !isUpdatingVisitTreatment &&
    !isLoadingTreatmentOptions &&
    (
      selectedVisitTreatmentSections
        ? selectedVisitTreatmentSections.length > 0 && selectedVisitTreatmentSections.every(isVisitTreatmentSectionValid)
        : selectedVisitTreatment &&
          (!selectedVisitTreatment || selectedVisitTreatment.id !== OTHER_APPOINTMENT_TYPE_INDEX || customVisitTreatmentName.trim()) &&
          Number.isFinite(visitTreatmentPriceNumber) &&
          visitTreatmentPriceNumber >= 0
    )
  );
  const assignDoctorActionLabel = assignDoctorAppointment && getVisitDoctorName(assignDoctorAppointment)
    ? "Change Doctor"
    : "Assign Doctor";

  return (
    <div className="flex-1 overflow-hidden bg-slate-50">
      <div className="h-full flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} data-tour-id="patient-details-tabs" className="flex-1 flex flex-col overflow-hidden">
          {/* Modern Navigation Tabs */}
          <div className="shrink-0 bg-slate-50 px-4 pb-3 pt-3 sm:px-6 md:pb-4 md:pt-5 lg:px-8">
            <div className="mx-auto w-full max-w-[1920px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:rounded-lg">
              <TabsList className="flex h-auto min-h-14 w-full justify-start gap-0 overflow-x-auto overflow-y-hidden rounded-none border-none bg-transparent p-1 md:p-0">
                {[
                  { value: "history", label: "Treatment History", icon: History },
                  { value: "info", label: "Personal Info", icon: UserIcon },
                  // { value: "family", label: "Family & Relations", icon: Users },
                  { value: "records", label: "Medical Records", icon: FileText },
                  { value: "questionnaire", label: "Questionnaire", icon: ClipboardList },
                  { value: "consent", label: "Consent Form", icon: ShieldCheck },
                  { value: "chart", label: "Dental Chart", icon: Activity },

                  { value: "payments", label: "Financial Log", icon: PaymentIcon },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    data-tour-id={`patient-details-${tab.value}-tab`}
                    className="group relative h-12 min-w-[150px] flex-1 shrink-0 rounded-lg border border-transparent bg-transparent px-3 text-sm font-bold text-slate-500 transition-all data-[state=active]:border-violet-500 data-[state=active]:bg-white data-[state=active]:text-violet-600 data-[state=active]:shadow-sm hover:bg-slate-50 hover:text-slate-800 md:h-14 md:min-w-[165px] md:rounded-none md:border-x-0 md:border-t-0 md:border-b-2 md:data-[state=active]:bg-violet-50/30 md:data-[state=active]:shadow-none sm:px-4"
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
              <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-8 2xl:gap-10">
                {/* Left Column: Profile Insight Card */}
                <div className="hidden min-w-0 space-y-6 xl:block xl:space-y-8">
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
                <div className="min-w-0 space-y-4 pb-10 md:space-y-6 xl:space-y-8 xl:pb-12">
                  {/* Identity Section */}
                  <section className="space-y-3 md:space-y-6">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 md:h-10 md:w-2 md:bg-violet-600 md:text-transparent md:shadow-lg md:shadow-violet-200">
                        <UserIcon className="h-5 w-5 md:hidden" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black tracking-tight text-slate-900 md:text-xl">Identity & Account</h2>
                        <p className="hidden text-xs font-bold uppercase tracking-widest text-slate-400 md:block">Personal Identification Details</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 md:gap-5 md:rounded-lg sm:p-6 2xl:grid-cols-3 2xl:p-7">
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
                      {/* <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ledger Balance ({"\u20b1"})</Label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">₱</span>
                          <Input
                            type="number"
                            value={formData.balance}
                            onChange={(e) => { setFormData(prev => ({ ...prev, balance: parseFloat(e.target.value) || 0 })); setIsModified(true); }}
                            className="h-12 pl-10 bg-slate-50/30 border-slate-200 font-black text-slate-900 rounded-xl focus:ring-violet-200"
                          />
                        </div>
                      </div> */}
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
                  <section className="space-y-3 md:space-y-6">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 md:h-10 md:w-2 md:bg-blue-600 md:text-transparent md:shadow-lg md:shadow-blue-200">
                        <MapPin className="h-5 w-5 md:hidden" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black tracking-tight text-slate-900 md:text-xl">Contact & Location</h2>
                        <p className="hidden text-xs font-bold uppercase tracking-widest text-slate-400 md:block">Reachability & Residence Information</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 md:gap-5 md:rounded-lg sm:p-6 2xl:p-7">
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
                    <section className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                          <HeartPulse className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-black tracking-tight text-slate-900">Clinical Alert</h2>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Allergies</Label>
                          <Textarea
                            placeholder="List known allergies (e.g., Penicillin, Latex)..."
                            value={formData.allergies}
                            onChange={(e) => { setFormData(prev => ({ ...prev, allergies: e.target.value })); setIsModified(true); }}
                            className="min-h-[46px] resize-none rounded-lg border-slate-200 bg-slate-50/40 text-sm font-medium focus:ring-violet-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Medical Backdrop</Label>
                          <Textarea
                            placeholder="Chronic conditions, surgeries, medications..."
                            value={formData.medicalHistory}
                            onChange={(e) => { setFormData(prev => ({ ...prev, medicalHistory: e.target.value })); setIsModified(true); }}
                            className="min-h-[46px] resize-none rounded-lg border-slate-200 bg-slate-50/40 text-sm font-medium focus:ring-violet-200"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                          <Activity className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-black tracking-tight text-slate-900">Encounters & Schedule</h2>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-4 text-center">
                          <span className="block text-[11px] font-black uppercase tracking-wide text-slate-400">Total Encounters</span>
                          <span className="mt-3 block text-2xl font-black text-slate-950">{patientAppointments.length}</span>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-4 text-center">
                          <span className="block text-[11px] font-black uppercase tracking-wide text-slate-400">Upcoming</span>
                          <span className="mt-3 block truncate text-base font-black text-violet-600">
                            {patient.nextAppointment ? formatPatientLogDate(patient.nextAppointment, "No Schedule") : "No Schedule"}
                          </span>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Emergency Section */}
                  <section className="space-y-3 md:space-y-6">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 md:h-10 md:w-2 md:bg-red-600 md:text-transparent md:shadow-lg md:shadow-red-200">
                        <Phone className="h-5 w-5 md:hidden" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black tracking-tight text-slate-900 md:text-xl">Emergency Contact</h2>
                        <p className="hidden text-xs font-bold uppercase tracking-widest text-slate-400 md:block">Crisis Contact Information</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 rounded-xl border border-red-100 bg-red-50/30 p-4 shadow-sm md:grid-cols-2 md:gap-5 md:rounded-lg sm:p-6 2xl:p-7">
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
                  <section className="space-y-3 md:space-y-6">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 md:h-10 md:w-2 md:bg-slate-400 md:text-transparent md:shadow-lg md:shadow-slate-100">
                        <FileText className="h-5 w-5 md:hidden" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black tracking-tight text-slate-900 md:text-xl">Internal Notes</h2>
                        <p className="hidden text-xs font-bold uppercase tracking-widest text-slate-400 md:block">Supplemental Administrative Notes</p>
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
            {/* <TabsContent value="family" data-tour-id="patient-details-family-content" className="mt-0 outline-none">
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
            </TabsContent> */}

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
              {isLoadingQuestionnaire ? (
                <Card className={cardClass}>
                  <CardContent className="p-8 text-center text-sm font-semibold text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                      Loading questionnaire...
                    </div>
                  </CardContent>
                </Card>
              ) : questionnaireQuestions.length === 0 ? (
                <Card className={cardClass}>
                  <CardContent className="p-8 text-center text-sm font-semibold text-slate-500">
                    No questionnaire questions have been saved yet.
                  </CardContent>
                </Card>
              ) : (() => {
                const generalMedicalQuestions = questionnaireQuestions.filter(q => q.id === PHYSICIAN_INFORMATION_QUESTION_ID || GENERAL_MEDICAL_INFO_IDS.has(q.id));
                const allergyQuestions = questionnaireQuestions.filter(q => ALLERGY_IDS.has(q.id));
                const medicalConditionQuestions = questionnaireQuestions.filter(q => MEDICAL_CONDITION_IDS.has(q.id));
                const otherMedicalQuestions = questionnaireQuestions.filter(q => OTHER_MEDICAL_IDS.has(q.id));
                const womenOnlyQuestions = questionnaireQuestions.filter(q => WOMEN_ONLY_IDS.has(q.id));

                const baselineAllKnownIds = new Set([
                  PHYSICIAN_INFORMATION_QUESTION_ID,
                  ...GENERAL_MEDICAL_INFO_IDS,
                  ...ALLERGY_IDS,
                  ...MEDICAL_CONDITION_IDS,
                  ...OTHER_MEDICAL_IDS,
                  ...WOMEN_ONLY_IDS
                ]);
                const additionalQuestions = questionnaireQuestions.filter(q => !baselineAllKnownIds.has(q.id));

                const qPhysician = questionnaireQuestions.find(q => q.id === PHYSICIAN_INFORMATION_QUESTION_ID);
                const qGoodHealth = questionnaireQuestions.find(q => q.id === "baseline_good_health");
                const qUnderTreatment = questionnaireQuestions.find(q => q.id === "baseline_under_medical_treatment");
                const qSeriousIllness = questionnaireQuestions.find(q => q.id === "baseline_serious_illness_or_operation");
                const qHospitalized = questionnaireQuestions.find(q => q.id === "baseline_hospitalized");
                const qMedication = questionnaireQuestions.find(q => q.id === "baseline_medication");
                const qTobacco = questionnaireQuestions.find(q => q.id === "baseline_tobacco");
                const qDrugs = questionnaireQuestions.find(q => q.id === "baseline_alcohol_or_drugs");

                const qPregnant = questionnaireQuestions.find(q => q.id === "baseline_pregnant");
                const qNursing = questionnaireQuestions.find(q => q.id === "baseline_nursing");
                const qBirthControl = questionnaireQuestions.find(q => q.id === "baseline_birth_control");

                const renderRowToggle = (question: QuestionnaireQuestion | undefined, detailKey?: string, detailLabel?: string, detailPlaceholder?: string) => {
                  if (!question) return null;
                  const checked = Boolean(questionnaireAnswers[question.id]);
                  return (
                    <div key={question.id} className="space-y-2 py-3 border-b border-slate-100 last:border-b-0">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-sm font-semibold text-slate-800 leading-tight">{question.text}</span>
                        <ToggleGroup
                          type="single"
                          value={checked ? "yes" : "no"}
                          onValueChange={(value) => handleQuestionnaireAnswerChange(question.id, value === "yes")}
                          disabled={isSavingQuestionnaire}
                          aria-label={`Answer ${question.text}`}
                          className="h-9 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-50 p-1"
                          variant="outline"
                          size="sm"
                        >
                          <ToggleGroupItem value="yes" className="px-3 text-[10px] font-bold uppercase tracking-wider data-[state=on]:bg-violet-600 data-[state=on]:text-white">
                            Yes
                          </ToggleGroupItem>
                          <ToggleGroupItem value="no" className="px-3 text-[10px] font-bold uppercase tracking-wider data-[state=on]:bg-violet-600 data-[state=on]:text-white">
                            No
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </div>

                      {checked && detailKey && (
                        <div className="mt-2 pl-4 border-l-2 border-violet-100">
                          {detailLabel && (
                            <Label className="text-xs font-bold text-slate-500 mb-1 block">{detailLabel}</Label>
                          )}
                          <Input
                            value={patientQuestionnaireData[detailKey] || ""}
                            onChange={(e) => updateQuestionnaireDataField(detailKey, e.target.value)}
                            placeholder={detailPlaceholder || "Specify details..."}
                            className="h-9 rounded-lg border-slate-200 bg-white text-sm shadow-none focus-visible:ring-violet-200"
                            disabled={isSavingQuestionnaire}
                          />
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
                    {/* Left & Middle Column */}
                    <div className="space-y-6 lg:col-span-2">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* 1. GENERAL MEDICAL INFORMATION */}
                        <Card className={cardClass}>
                          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                            <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                              1. General Medical Information
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 space-y-1">
                            {/* Physician Information Question */}
                            {qPhysician && (() => {
                              const checked = Boolean(questionnaireAnswers[qPhysician.id]);
                              const checkboxId = `patient-questionnaire-${qPhysician.id}`;
                              return (
                                <div key={qPhysician.id} className="space-y-2 py-3 border-b border-slate-100">
                                  <div className="flex items-start justify-between gap-4">
                                    <span className="text-sm font-semibold text-slate-800 leading-tight">{qPhysician.text}</span>
                                    <ToggleGroup
                                      type="single"
                                      value={checked ? "yes" : "no"}
                                      onValueChange={(value) => handleQuestionnaireAnswerChange(qPhysician.id, value === "yes")}
                                      disabled={isSavingQuestionnaire}
                                      aria-label={`Answer ${qPhysician.text}`}
                                      className="h-9 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-50 p-1"
                                      variant="outline"
                                      size="sm"
                                    >
                                      <ToggleGroupItem value="yes" className="px-3 text-[10px] font-bold uppercase tracking-wider data-[state=on]:bg-violet-600 data-[state=on]:text-white">
                                        Yes
                                      </ToggleGroupItem>
                                      <ToggleGroupItem value="no" className="px-3 text-[10px] font-bold uppercase tracking-wider data-[state=on]:bg-violet-600 data-[state=on]:text-white">
                                        No
                                      </ToggleGroupItem>
                                    </ToggleGroup>
                                  </div>

                                  {checked && (
                                    <div className="mt-3 grid gap-3 pl-4 border-l-2 border-violet-100 pt-1">
                                      {PHYSICIAN_INFORMATION_FIELDS.map((field) => (
                                        <div key={field.id} className="space-y-1">
                                          <Label htmlFor={`${checkboxId}-${field.id}`} className="text-xs font-bold text-slate-500">
                                            {field.label}
                                          </Label>
                                          <Input
                                            id={`${checkboxId}-${field.id}`}
                                            value={physicianInformation[field.id]}
                                            onChange={(event) => updatePhysicianInformation(field.id, event.target.value)}
                                            disabled={isSavingQuestionnaire}
                                            placeholder={field.placeholder}
                                            className="h-9 rounded-lg border-slate-200 bg-white text-sm shadow-none focus-visible:ring-violet-200"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Standard General Medical Questions */}
                            {renderRowToggle(qGoodHealth)}
                            {renderRowToggle(qUnderTreatment, "underMedicalTreatmentDetails", "If so, what is the condition being treated?", "Specify condition...")}
                            {renderRowToggle(qSeriousIllness, "seriousIllnessOrOperationDetails", "If so, what illness or operation?", "Specify illness or operation...")}
                            {renderRowToggle(qHospitalized, "hospitalizedDetails", "If so, when and why?", "Specify when and why...")}
                            {renderRowToggle(qMedication, "medicationDetails", "If so, please specify.", "Specify medication details...")}
                            {renderRowToggle(qTobacco)}
                            {renderRowToggle(qDrugs)}
                          </CardContent>
                        </Card>

                        {/* 2. ALLERGIES */}
                        <Card className={cardClass}>
                          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                            <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                              2. Allergies
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 space-y-4">
                            <p className="text-xs font-semibold text-slate-500">
                              Are you allergic to any of the following? Check which apply:
                            </p>
                            <div className="grid grid-cols-1 gap-4">
                              {allergyQuestions.map((question) => {
                                const checked = Boolean(questionnaireAnswers[question.id]);
                                const isOthers = question.id === "baseline_allergy_others";
                                return (
                                  <div key={question.id} className="flex items-start gap-3">
                                    <Checkbox
                                      id={`allergy-${question.id}`}
                                      checked={checked}
                                      onCheckedChange={(val) => handleQuestionnaireAnswerChange(question.id, Boolean(val))}
                                      disabled={isSavingQuestionnaire}
                                      className="h-5 w-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500 mt-0.5"
                                    />
                                    <div className="grid gap-1.5 leading-none w-full">
                                      <Label
                                        htmlFor={`allergy-${question.id}`}
                                        className="text-sm font-semibold text-slate-700 cursor-pointer"
                                      >
                                        {isOthers ? "Other (Specify)" : question.text.replace(/Are you allergic to /i, "").replace(/\?/g, "").trim()}
                                      </Label>
                                      {isOthers && checked && (
                                        <div className="mt-2 w-full pl-1">
                                          <Input
                                            value={patientQuestionnaireData.allergyOthersDetails || ""}
                                            onChange={(e) => updateQuestionnaireDataField("allergyOthersDetails", e.target.value)}
                                            placeholder="Specify other allergies..."
                                            className="h-9 rounded-lg border-slate-200 bg-white text-sm shadow-none focus-visible:ring-violet-200"
                                            disabled={isSavingQuestionnaire}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* 3. MEDICAL CONDITIONS (HISTORY) */}
                      <Card className={cardClass}>
                        <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                          <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                            3. Medical Conditions (History)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                          <p className="text-xs font-semibold text-slate-500">
                            Do you have or have you had any of the following? Check which apply:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3.5">
                            {medicalConditionQuestions.map((question) => {
                              const checked = Boolean(questionnaireAnswers[question.id]);
                              return (
                                <div key={question.id} className="flex items-center gap-3">
                                  <Checkbox
                                    id={`condition-${question.id}`}
                                    checked={checked}
                                    onCheckedChange={(val) => handleQuestionnaireAnswerChange(question.id, Boolean(val))}
                                    disabled={isSavingQuestionnaire}
                                    className="h-5 w-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                                  />
                                  <Label
                                    htmlFor={`condition-${question.id}`}
                                    className="text-sm font-semibold text-slate-700 cursor-pointer leading-tight"
                                  >
                                    {question.text.replace(/Have you had /i, "").replace(/\?/g, "").trim()}
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6 lg:col-span-1">
                      {/* 4. OTHER MEDICAL DETAILS */}
                      <Card className={cardClass}>
                        <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                          <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                            4. Other Medical Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-5">
                          {/* Bleeding Time */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500">Bleeding Time</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.1"
                              value={patientQuestionnaireData.bleedingTime || ""}
                              onChange={(e) => updateQuestionnaireDataField("bleedingTime", e.target.value)}
                              placeholder="Enter bleeding time"
                              className="h-9 rounded-lg border-slate-200 bg-white text-sm shadow-none focus-visible:ring-violet-200"
                              disabled={isSavingQuestionnaire}
                            />
                          </div>

                          {/* Blood Type */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500">Blood Type</Label>
                            <Select
                              value={patientQuestionnaireData.bloodType || ""}
                              onValueChange={(value) => updateQuestionnaireDataField("bloodType", value)}
                              disabled={isSavingQuestionnaire}
                            >
                              <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white text-sm shadow-none focus-visible:ring-violet-200">
                                <SelectValue placeholder="Select blood type" />
                              </SelectTrigger>
                              <SelectContent>
                                {[
                                  "A+",
                                  "A-",
                                  "B+",
                                  "B-",
                                  "AB+",
                                  "AB-",
                                  "O+",
                                  "O-",
                                  "Unknown",
                                ].map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Blood Pressure */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500">Blood Pressure</Label>
                            <Input
                              value={patientQuestionnaireData.bloodPressure || ""}
                              onChange={(e) => updateQuestionnaireDataField("bloodPressure", e.target.value)}
                              placeholder="Specify blood pressure (e.g. 120/80)"
                              className="h-9 rounded-lg border-slate-200 bg-white text-sm shadow-none focus-visible:ring-violet-200"
                              disabled={isSavingQuestionnaire}
                            />
                          </div>

                          {/* Other medical condition textarea */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500">Have you had any other medical condition?</Label>
                            <Textarea
                              value={patientQuestionnaireData.otherConditionsDetails || ""}
                              onChange={(e) => updateQuestionnaireDataField("otherConditionsDetails", e.target.value)}
                              placeholder="Enter details of other conditions..."
                              className="min-h-[100px] rounded-lg border-slate-200 bg-white text-slate-900 shadow-none focus-visible:ring-violet-200 text-sm"
                              disabled={isSavingQuestionnaire}
                            />
                          </div>

                          {/* Women Only Section */}
                          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              For women only:
                            </p>
                            
                            {[
                              { question: qPregnant, label: "Are you pregnant?" },
                              { question: qNursing, label: "Are you nursing?" },
                              { question: qBirthControl, label: "Are you taking birth control pills?" }
                            ].map(({ question, label }) => {
                              if (!question) return null;
                              const checked = Boolean(questionnaireAnswers[question.id]);
                              return (
                                <div key={question.id} className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-100 last:border-b-0 last:pb-0">
                                  <span className="text-xs font-semibold text-slate-700 leading-tight">{label}</span>
                                  <ToggleGroup
                                    type="single"
                                    value={checked ? "yes" : "no"}
                                    onValueChange={(value) => handleQuestionnaireAnswerChange(question.id, value === "yes")}
                                    disabled={isSavingQuestionnaire}
                                    className="h-8 overflow-hidden rounded-full border border-slate-200 bg-slate-50 p-0.5"
                                    variant="outline"
                                    size="sm"
                                  >
                                    <ToggleGroupItem value="yes" className="h-7 px-2.5 text-[9px] font-bold uppercase tracking-wider data-[state=on]:bg-violet-600 data-[state=on]:text-white">
                                      Yes
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="no" className="h-7 px-2.5 text-[9px] font-bold uppercase tracking-wider data-[state=on]:bg-violet-600 data-[state=on]:text-white">
                                      No
                                    </ToggleGroupItem>
                                  </ToggleGroup>
                                </div>
                              );
                            })}
                          </div>

                          {/* Bottom extra medical condition input */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500">Have you had any other medical condition?</Label>
                            <Input
                              value={patientQuestionnaireData.otherMedicalCondition || ""}
                              onChange={(e) => updateQuestionnaireDataField("otherMedicalCondition", e.target.value)}
                              placeholder="Specify here..."
                              className="h-9 rounded-lg border-slate-200 bg-white text-sm shadow-none focus-visible:ring-violet-200"
                              disabled={isSavingQuestionnaire}
                            />
                          </div>

                        </CardContent>
                      </Card>
                    </div>

                    {/* Additional questions if they are dynamic */}
                    {additionalQuestions.length > 0 && (
                      <div className="col-span-full mt-4">
                        <Card className={cardClass}>
                          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                            <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                              Additional Questionnaire Questions
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {additionalQuestions.map((question) => {
                              const checked = Boolean(questionnaireAnswers[question.id]);
                              return (
                                <div key={question.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-slate-100 bg-slate-50/30">
                                  <span className="text-xs font-semibold text-slate-700">{question.text}</span>
                                  <ToggleGroup
                                    type="single"
                                    value={checked ? "yes" : "no"}
                                    onValueChange={(value) => handleQuestionnaireAnswerChange(question.id, value === "yes")}
                                    disabled={isSavingQuestionnaire}
                                    className="h-8 overflow-hidden rounded-full border border-slate-200 bg-slate-50 p-0.5"
                                    variant="outline"
                                    size="sm"
                                  >
                                    <ToggleGroupItem value="yes" className="h-7 px-2.5 text-[9px] font-bold uppercase tracking-wider data-[state=on]:bg-violet-600 data-[state=on]:text-white">
                                      Yes
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="no" className="h-7 px-2.5 text-[9px] font-bold uppercase tracking-wider data-[state=on]:bg-violet-600 data-[state=on]:text-white">
                                      No
                                    </ToggleGroupItem>
                                  </ToggleGroup>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="consent" data-tour-id="patient-details-consent-content" className="mx-auto w-full max-w-[1680px] space-y-4">
              <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <CardHeader className="px-5 py-5 sm:px-6 lg:px-7">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-xl font-black leading-tight text-slate-950 sm:text-2xl">Consent Form</CardTitle>
                        <p className="mt-1 text-sm font-medium text-slate-600">Receptionist-managed informed consent and signatures</p>
                      </div>
                    </div>
                    {savedConsentForm.accepted && !consentFormHasChanges && (
                      <Badge className="w-fit border-none bg-emerald-100 text-emerald-700">
                        Consent saved
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 px-5 pb-5 sm:px-6 sm:pb-6 lg:px-7 lg:pb-7">
                  {isLoadingQuestionnaire ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                      Loading consent form...
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {CONSENT_ACKNOWLEDGEMENTS.map((item, index) => (
                          <label
                            key={item.id}
                            htmlFor={`patient-consent-${item.id}`}
                            className="flex min-h-[74px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-violet-200 hover:bg-violet-50/30 sm:gap-4 sm:px-5"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-black text-violet-600">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 space-y-1 pr-1">
                              <span className="block text-sm font-black leading-5 text-slate-950">{item.title}</span>
                              <span className="block text-sm font-medium leading-5 text-slate-600">{item.description}</span>
                            </span>
                            <Checkbox
                              id={`patient-consent-${item.id}`}
                              checked={consentForm.acknowledgements[item.id]}
                              onCheckedChange={(checked) => updateConsentAcknowledgement(item.id, checked === true)}
                              disabled={isSavingConsent}
                              className="shrink-0 rounded-full border-violet-400 data-[state=checked]:border-violet-600 data-[state=checked]:bg-violet-600"
                            />
                          </label>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                        <div className="flex min-h-full flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(210px,1fr)]">
                            <div className="space-y-2">
                              <Label htmlFor="patient-consent-signature-name" className="text-sm font-black text-slate-950">
                                Patient / Parent / Guardian Full Name *
                              </Label>
                              <Input
                                id="patient-consent-signature-name"
                                value={consentForm.patientSignatureName}
                                onChange={(event) => updateConsentField("patientSignatureName", event.target.value)}
                                disabled={isSavingConsent}
                                placeholder="Type full legal name"
                                className="h-11 rounded-lg border-slate-200 bg-white font-medium"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="patient-consent-date" className="text-sm font-black text-slate-950">Date *</Label>
                              <Input
                                id="patient-consent-date"
                                type="date"
                                value={consentForm.signedDate}
                                onChange={(event) => updateConsentField("signedDate", event.target.value)}
                                disabled={isSavingConsent}
                                className="h-11 rounded-lg border-slate-200 bg-white font-medium"
                              />
                            </div>
                          </div>
                          {/* <div className="mt-3 space-y-2">
                        <Label htmlFor="patient-consent-guardian-name" className="text-sm font-black text-slate-950">Parent / Guardian Name</Label>
                        <Input
                          id="patient-consent-guardian-name"
                          value={consentForm.guardianName}
                          onChange={(event) => updateConsentField("guardianName", event.target.value)}
                          disabled={isSavingConsent}
                          placeholder="Required only when applicable"
                          className="h-11 rounded-lg border-slate-200 bg-white font-medium"
                        />
                      </div> */}
                          <div className="mt-4 flex flex-1 flex-col">
                            <Label className="text-sm font-black text-slate-950">Patient / Parent / Guardian Drawn Signature *</Label>
                            <button
                              type="button"
                              onClick={() => setConsentSignatureModalTarget("patient")}
                              disabled={isSavingConsent}
                              className="mt-2 flex min-h-[184px] w-full flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-4 transition-colors hover:border-violet-300 hover:bg-violet-50/30 disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-[216px]"
                            >
                              {consentForm.patientSignatureImage ? (
                                <img src={consentForm.patientSignatureImage} alt="Patient signature" className="max-h-[152px] max-w-full object-contain sm:max-h-[184px]" />
                              ) : (
                                <span className="flex items-center gap-2 text-sm font-bold text-slate-400">
                                  <PenLine className="h-4 w-4" />
                                  Add signature
                                </span>
                              )}
                            </button>
                            <div className="grid gap-2 pt-3 sm:grid-cols-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-10 w-full rounded-lg border-slate-200 font-black"
                                onClick={() => setConsentSignatureModalTarget("patient")}
                                disabled={isSavingConsent}
                              >
                                <PenLine className="mr-2 h-4 w-4" />
                                {consentForm.patientSignatureImage ? "Edit Signature" : "Open Signature Pad"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-10 w-full rounded-lg border-slate-200 font-black"
                                onClick={() => updateConsentField("patientSignatureImage", "")}
                                disabled={isSavingConsent || !consentForm.patientSignatureImage}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Clear Signature
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="flex min-h-full flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                          <div className="mb-3 flex items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                              <UserIcon className="h-4 w-4" />
                            </span>
                            <Label htmlFor="patient-consent-dentist-signature" className="text-sm font-black text-slate-950">
                              Dentist / Signature
                            </Label>
                          </div>
                          <Input
                            id="patient-consent-dentist-signature"
                            value={consentForm.dentistSignatureName}
                            onChange={(event) => updateConsentField("dentistSignatureName", event.target.value)}
                            disabled={isSavingConsent}
                            placeholder="Dentist name"
                            className="h-11 rounded-lg border-slate-200 bg-white font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => setConsentSignatureModalTarget("dentist")}
                            disabled={isSavingConsent}
                            className="mt-4 flex min-h-[184px] w-full flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-4 transition-colors hover:border-violet-300 hover:bg-violet-50/30 disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-[216px]"
                          >
                            {consentForm.dentistSignatureImage ? (
                              <img src={consentForm.dentistSignatureImage} alt="Dentist signature" className="max-h-[152px] max-w-full object-contain sm:max-h-[184px]" />
                            ) : (
                              <span className="flex items-center gap-2 text-sm font-bold text-slate-400">
                                <PenLine className="h-4 w-4" />
                                Add dentist signature
                              </span>
                            )}
                          </button>
                          <div className="grid gap-2 pt-3 sm:grid-cols-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setConsentSignatureModalTarget("dentist")}
                              disabled={isSavingConsent}
                              className="h-10 w-full rounded-lg border-slate-200 font-black"
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Upload
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateConsentField("dentistSignatureImage", "")}
                              disabled={isSavingConsent || !consentForm.dentistSignatureImage}
                              className="h-10 w-full rounded-lg border-slate-200 font-black"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Clear
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                          <ShieldCheck className="h-4 w-4 shrink-0 text-violet-500" />
                          <span>{isConsentFormComplete ? "Ready to save completed consent." : "Incomplete consent can be saved as a draft."}</span>
                        </p>
                        <Button
                          type="button"
                          onClick={saveConsentForm}
                          disabled={isSavingConsent || !consentFormHasChanges}
                          className="h-11 gap-2 rounded-lg bg-violet-600 px-5 font-black text-white shadow-lg shadow-violet-200 hover:bg-violet-700"
                        >
                          {isSavingConsent ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : consentFormHasChanges ? (
                            <Save className="h-4 w-4" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                          {consentFormHasChanges ? "Save Consent Form" : savedConsentForm.accepted ? "Consent Saved" : "Save Consent Form"}
                        </Button>
                      </div>
                    </>
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
              <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100 px-4 py-5 sm:px-6">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-2xl font-black text-slate-950">Treatment History</CardTitle>
                        <p className="mt-1 text-sm font-medium text-slate-500">All past appointments and treatments</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 justify-end">
                        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1" aria-label="Treatment history view">
                          <Button type="button" size="sm" variant="ghost" onClick={() => setHistoryViewMode("history")} className={`h-8 rounded-lg px-3 text-xs font-black ${historyViewMode === "history" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>
                            <History className="mr-1.5 h-3.5 w-3.5" />
                            History
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setHistoryViewMode("list")} className={`h-8 rounded-lg px-3 text-xs font-black ${historyViewMode === "list" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>
                            <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                            List
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => openCreateModal(undefined, undefined, undefined, patientIdForBooking)}
                          className="h-10 rounded-xl bg-violet-600 px-4 font-bold text-white shadow-md shadow-violet-100 hover:bg-violet-700"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          New Appointment
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_180px] xl:grid-cols-[minmax(280px,1fr)_190px_190px_190px]">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <Input
                          placeholder="Search treatments"
                          value={historySearchFilter}
                          onChange={(e) => setHistorySearchFilter(e.target.value)}
                          className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm font-medium shadow-sm"
                        />
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-slate-200 bg-white shadow-sm md:hidden" aria-label="Treatment history filters">
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="max-h-[70vh] w-72 overflow-y-auto">
                          <DropdownMenuLabel>Treatment filters</DropdownMenuLabel>
                          <DropdownMenuLabel className="max-w-full truncate text-xs font-semibold text-slate-500">
                            Filters: {historyProcedureLabel} / {historyDoctorLabel} / {historyPaymentLabel}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-slate-500">Services</DropdownMenuLabel>
                          {uniqueProcedures.map((proc) => (
                            <DropdownMenuItem
                              key={proc}
                              className={activeHistoryFilterItemClass(historyProcedureFilter === proc)}
                              onSelect={() => setHistoryProcedureFilter(proc)}
                            >
                              {proc === "all" ? "All Services" : proc}
                            </DropdownMenuItem>
                          ))}
                          {!doctorFilter ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-slate-500">Providers</DropdownMenuLabel>
                              {uniqueDoctors.map((doctor) => (
                                <DropdownMenuItem
                                  key={doctor}
                                  className={activeHistoryFilterItemClass(historyDoctorFilter === doctor)}
                                  onSelect={() => setHistoryDoctorFilter(doctor)}
                                >
                                  {doctor === "all" ? "All Providers" : doctor}
                                </DropdownMenuItem>
                              ))}
                            </>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-slate-500">Payments</DropdownMenuLabel>
                          <DropdownMenuItem
                            className={activeHistoryFilterItemClass(historyPaymentStatusFilter === "all")}
                            onSelect={() => setHistoryPaymentStatusFilter("all")}
                          >
                            All Payments
                          </DropdownMenuItem>
                          {PAYMENT_STATUSES.map((status) => (
                            <DropdownMenuItem
                              key={status.value}
                              className={activeHistoryFilterItemClass(historyPaymentStatusFilter === status.value)}
                              onSelect={() => setHistoryPaymentStatusFilter(status.value)}
                            >
                              {status.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={resetHistoryFilters}>
                            Reset filters
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="hidden md:block">
                        <Select value={historyProcedureFilter} onValueChange={setHistoryProcedureFilter}>
                          <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                            <SelectValue placeholder="All Services" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueProcedures.map(proc => (
                              <SelectItem key={proc} value={proc}>{proc === 'all' ? 'All Services' : proc}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {!doctorFilter ? (
                        <div className="hidden md:block">
                          <Select value={historyDoctorFilter} onValueChange={setHistoryDoctorFilter}>
                            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                              <SelectValue placeholder="All Providers" />
                            </SelectTrigger>
                            <SelectContent>
                              {uniqueDoctors.map(doctor => (
                                <SelectItem key={doctor} value={doctor}>{doctor === 'all' ? 'All Providers' : doctor}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="hidden md:block" />
                      )}

                      <div className="hidden md:block">
                        <Select value={historyPaymentStatusFilter} onValueChange={setHistoryPaymentStatusFilter}>
                          <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                            <SelectValue placeholder="All Payments" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Payments</SelectItem>
                            {PAYMENT_STATUSES.map(status => (
                              <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                  {(filteredHistory.length === 0) ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-medium text-slate-500">
                      {mockAppointmentHistoryLocal.length === 0 ? "No appointments scheduled for this patient yet." : "No appointments match the selected filters."}
                    </div>
                  ) : (
                    historyViewMode === "history" ? (
                      <div className="space-y-3">
                        {filteredHistory.map((appointment: HistoryAppointment, index: number) => {
                        const appointmentId = String(appointment.id || `apt-${index}`);
                        const appointmentBalance = Number((appointment as any).balance);
                        const computedOutstandingBalance = Math.max(0, Number(appointment.price || 0) - Number(appointment.totalPaid || 0));
                        const storedDisplayedBalance = Number.isFinite(appointmentBalance)
                          ? appointmentBalance
                          : computedOutstandingBalance;
                        const appointmentStatus = normalizeAppointmentStatus(String(appointment.status || ""));
                        const isDeletedAppointment = isSoftDeletedAppointment(appointment);
                        const isVoidedAppointment = isDeletedAppointment || appointmentStatus === "cancelled";
                        const canRestoreAppointment = isDeletedAppointment && effectiveRole === "admin";
                        const originalDisplayedBalance = isVoidedAppointment
                          ? Math.max(storedDisplayedBalance, computedOutstandingBalance)
                          : storedDisplayedBalance;
                        const displayedBalance = isVoidedAppointment ? 0 : originalDisplayedBalance;
                        const dateParts = getPatientHistoryDateParts(appointment.date);
                        const appointmentTime = formatPatientHistoryTime(appointment.date, (appointment as any).time);
                        const patientDisplayName = patient.name || [patient.firstName, patient.lastName].filter(Boolean).join(" ") || "Patient";
                        const notesText = String(appointment.notes || "").trim() || "No notes";
                        const isPaid = displayedBalance <= 0 && Number(appointment.price || 0) > 0;
                        const doctorName = getVisitDoctorName(appointment);
                        const isDoctorUnassigned = !doctorName;
                        const serviceName = String(appointment.type || "Appointment");

                        const bookingTreatments = getBookingTreatmentsValue(appointment);
                        const treatmentNames = bookingTreatments.length > 0
                          ? bookingTreatments.map(t => getAppointmentTypeName(t.type, t.customType) || String(t.type || 'Treatment')).join(", ")
                          : serviceName;

                        const resolveDoctorImageFor = (apt: any) => {
                          let img = getDoctorImageFromSnapshot(apt);
                          if (!img && Array.isArray(doctors) && doctors.length) {
                            const normalizedDoctorName = normalizeComparableDoctor(getVisitDoctorName(apt));
                            const matched = doctors.find((d) => normalizeComparableDoctor(d.name) === normalizedDoctorName) || doctors.find((d) => normalizedDoctorName && normalizeComparableDoctor(d.name).includes(normalizedDoctorName));
                            if (matched && matched.profilePicture) img = resolveImageSource(matched.profilePicture);
                          }
                          return img;
                        };

                        const doctorImage = isDoctorUnassigned ? undefined : resolveDoctorImageFor(appointment as any);
                        const originalAppointment = patientAppointments.find((x: Appointment) => String(x.id) === appointmentId);
                        const visitTransactions = (appointment.transactions || []).filter((txn) =>
                          Number(txn.amount || 0) > 0 &&
                          !isPaymentLogLikeRow(txn)
                        ).sort((a, b) => comparePaymentTransactionsByDate(a, b, "desc"));

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

                            <div className={`rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${isDeletedAppointment
                              ? "border-slate-300 bg-slate-50 opacity-90"
                              : "border-slate-200 bg-white"
                              }`}>
                              <div className="mb-3 flex items-center gap-3 xl:hidden">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                                  <Calendar className="h-5 w-5" />
                                </div>
                                <div>
                                  <div className="text-sm font-black text-slate-900">{formatPatientLogDate(appointment.date)}</div>
                                  <div className="text-xs font-semibold text-slate-500">{appointmentTime}</div>
                                </div>
                              </div>

                              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px_190px_36px] xl:items-center">
                                <div className="flex min-w-0 items-start gap-4">
                                  <Avatar className="h-14 w-14 flex-none overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                                    {doctorImage ? (
                                      <AvatarImage src={doctorImage} alt={doctorName} className="object-cover" />
                                    ) : (
                                      <AvatarFallback className="bg-blue-50 text-blue-600">
                                        {isDoctorUnassigned ? <Stethoscope className="h-5 w-5" /> : getInitials(doctorName)}
                                      </AvatarFallback>
                                    )}
                                  </Avatar>

                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-base font-black text-slate-950" title={treatmentNames}>
                                      {treatmentNames}
                                    </div>
                                    {isDoctorUnassigned ? (
                                      <button
                                        type="button"
                                        onClick={() => setAssignDoctorAppointment(appointment)}
                                        className="block max-w-full truncate text-left text-sm font-semibold text-blue-600 underline-offset-2 transition-colors hover:text-blue-700 hover:underline mt-0.5"
                                      >
                                        Assign doctor
                                      </button>
                                    ) : (
                                      <div className="truncate text-sm font-semibold text-slate-500 mt-0.5">{doctorName}</div>
                                    )}
                                     {getBookingToothNumbersValue(appointment) ? (
                                       <div className="mt-2.5 flex flex-wrap gap-1.5">
                                         <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50/50 px-2.5 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100/50">
                                           Tooth {getBookingToothNumbersValue(appointment)}
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
                                        includeDeleted={effectiveRole === "admin"}
                                        onChange={(nextStatus) => handleVisitStatusChange(appointment, nextStatus)}
                                      />
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
                                      {Number(appointment.discount) > 0 && (
                                        <span className="text-xs text-slate-400 line-through decoration-rose-400 font-normal">
                                          <CurrencyText value={formatPatientHistoryCurrency(appointment.price)} />
                                        </span>
                                      )}
                                      <span className="font-black text-slate-900">
                                        <CurrencyText value={formatPatientHistoryCurrency(Math.max(0, Number(appointment.price || 0) - Number(appointment.discount || 0)))} />
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-slate-500">Paid</span>
                                    <span className={isPaid ? "font-black text-emerald-600" : "font-black text-slate-900"}><CurrencyText value={formatPatientHistoryCurrency(appointment.totalPaid)} /></span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-slate-500">Balance</span>
                                    {isVoidedAppointment && originalDisplayedBalance > 0 ? (
                                      <span className="font-black">
                                        <span className="text-red-500 line-through decoration-red-400 decoration-2"><CurrencyText value={formatPatientHistoryCurrency(originalDisplayedBalance)} /></span>
                                        <span className="ml-2 text-emerald-600"><CurrencyText value={formatPatientHistoryCurrency(0)} /></span>
                                      </span>
                                    ) : (
                                      <span className={displayedBalance > 0 ? "font-black text-red-600" : "font-black text-emerald-600"}><CurrencyText value={formatPatientHistoryCurrency(displayedBalance)} /></span>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                                  {canRestoreAppointment ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-9 rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                      onClick={() => handleRestoreVisitAppointment(appointment)}
                                    >
                                      <RotateCcw className="mr-2 h-4 w-4" />
                                      Restore
                                    </Button>
                                  ) : !isVoidedAppointment ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className={
                                        displayedBalance > 0
                                          ? "h-9 rounded-xl border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                                          : "h-9 rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                      }
                                      disabled={!patient.id}
                                      onClick={() => {
                                        if (patient.id) {
                                          openPaymentModal(String(patient.id), patientDisplayName, mockAppointmentHistoryLocal, appointmentId);
                                        }
                                      }}
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
                                  {originalAppointment && !isDeletedAppointment ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-9 rounded-xl border-violet-100 text-violet-700 hover:bg-violet-50"
                                      onClick={() => openRescheduleModal(originalAppointment)}
                                    >
                                      <Calendar className="mr-2 h-4 w-4" />
                                      Reschedule
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 rounded-xl border-slate-200 text-slate-800 hover:bg-slate-50"
                                    onClick={() => handleOpenSnapshot(appointment)}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </Button>
                                </div>

                                <AppointmentActionsMenu
                                  actions={createVisitHistoryActions(
                                    {
                                      onViewDetails: () => handleOpenSnapshot(appointment),
                                      onViewHistory: () => handleOpenBookingHistory(appointment),
                                      onRecordPayment: () => {
                                        if (patient.id && !isVoidedAppointment) {
                                          openPaymentModal(String(patient.id), patientDisplayName, mockAppointmentHistoryLocal, appointmentId);
                                        }
                                      },
                                      onRestoreAppointment: () => handleRestoreVisitAppointment(appointment),
                                      onReschedule: () => {
                                        if (originalAppointment) {
                                          openRescheduleModal(originalAppointment);
                                        }
                                      },
                                      onUpdateTreatment: () => {
                                        if (originalAppointment) {
                                          openUpdateTreatmentModal(originalAppointment);
                                        }
                                      },
                                      onAssignDoctor: () => {
                                        if (originalAppointment) {
                                          setAssignDoctorAppointment(originalAppointment as unknown as HistoryAppointment);
                                        }
                                      },
                                    },
                                    {
                                      canRestoreAppointment,
                                      canReschedule: Boolean(originalAppointment && !isDeletedAppointment),
                                      canUpdateTreatment: Boolean(originalAppointment && !isDeletedAppointment),
                                      canAssignDoctor: Boolean(originalAppointment && !isDeletedAppointment),
                                      isDoctorUnassigned,
                                    }
                                  )}
                                  triggerVariant="ghost"
                                  triggerSize="icon"
                                  triggerClassName="h-9 w-9 justify-self-end rounded-xl text-slate-500 hover:bg-slate-100"
                                  triggerIcon={<MoreVertical className="h-4 w-4" />}
                                  ariaLabel="Visit actions"
                                />
                              </div>

                              {visitTransactions.length > 0 ? (
                                (() => {
                                  const isPaymentHistoryOpen = historyPaymentHistoryOpenByAppointment[appointmentId] ?? false;
                                  return (
                                    <div className="mt-4 border-t border-slate-100 pt-4">
                                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <PaymentIcon className="h-4 w-4 text-violet-600" />
                                          <h4 className="text-sm font-black text-slate-950">Payment History</h4>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-8 rounded-xl border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50"
                                          onClick={() => setHistoryPaymentHistoryOpenByAppointment((prev) => ({
                                            ...prev,
                                            [appointmentId]: !isPaymentHistoryOpen,
                                          }))}
                                        >
                                          {isPaymentHistoryOpen ? "Hide payments" : `Show payments (${visitTransactions.length})`}
                                        </Button>
                                      </div>
                                      {isPaymentHistoryOpen ? (
                                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                          <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(110px,0.5fr)_minmax(150px,0.7fr)_minmax(150px,0.8fr)_124px] border-b border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 md:grid">
                                            <span>Payment Method</span>
                                            <span>Amount</span>
                                            <span>Date</span>
                                            <span>Reference No.</span>
                                            <span className="text-right">Actions</span>
                                          </div>
                                          <div className="divide-y divide-slate-100">
                                            {visitTransactions.map((txn) => {
                                              const transactionKey = getPaymentTransactionKey(txn);
                                              const paymentDisplay = getTransactionPaymentDisplay(txn);
                                              const methodLabel = normalizeBookingPaymentMethod(txn.method);
                                              const txnDate = formatPatientLogDate((txn as any).paymentDate || txn.date);
                                              const referenceNo = String(txn.transactionId || txn.id || "N/A");
                                              const editablePaymentId = getEditablePaymentId(txn);
                                              const restorablePaymentId = getRestorablePaymentId(txn);
                                              const isCashPayment = methodLabel.toLowerCase() === "cash";
                                              const isDeletedPayment = isSoftDeletedPaymentTransaction(txn);
                                              const isCancelledPayment =
                                                appointmentStatus === "cancelled" ||
                                                isAppointmentCancelledStatusTransaction(txn);
                                              const isInactivePayment = isDeletedPayment || isCancelledPayment;

                                              return (
                                                <div
                                                  key={transactionKey}
                                                  className={`grid gap-3 px-4 py-4 text-sm md:grid-cols-[minmax(0,1.3fr)_minmax(110px,0.5fr)_minmax(150px,0.7fr)_minmax(150px,0.8fr)_124px] md:items-center ${isInactivePayment ? deletedPaymentRowClass : paymentDisplay.isLog ? "bg-slate-50/70" : "bg-white"
                                                    }`}
                                                >
                                                  <div className="flex min-w-0 items-center gap-3">
                                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isCashPayment ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}>
                                                      {getPaymentMethodIcon(methodLabel)}
                                                    </div>
                                                    <div className="min-w-0">
                                                      <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`truncate font-black ${isInactivePayment ? "text-gray-700" : "text-slate-900"}`}>{methodLabel}</span>
                                                        <span className="font-semibold text-slate-400">-</span>
                                                        <span className={`font-bold ${isInactivePayment ? "text-gray-600" : "text-slate-700"}`}>
                                                          <CurrencyText value={formatPatientHistoryCurrency(txn.amount)} />
                                                        </span>
                                                        {paymentDisplay.label ? (
                                                          <PaymentTransactionStatusBadge
                                                            display={paymentDisplay}
                                                            className="rounded-full px-2.5 py-0.5 text-xs"
                                                            showIcon={false}
                                                          />
                                                        ) : null}
                                                      </div>
                                                      {txn.notes ? (
                                                        <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">{txn.notes}</p>
                                                      ) : null}
                                                    </div>
                                                  </div>

                                                  <div className="flex items-center justify-between gap-3 md:block">
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">Amount</span>
                                                    <span className={`font-black ${isInactivePayment ? "text-gray-600" : "text-emerald-600"}`}>
                                                      <CurrencyText value={formatPatientHistoryCurrency(txn.amount)} />
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center justify-between gap-3 md:block">
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">Date</span>
                                                    <span className="font-bold text-slate-700">{txnDate}</span>
                                                  </div>
                                                  <div className="flex items-center justify-between gap-3 md:block">
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">Reference</span>
                                                    <span className="font-mono text-xs font-bold text-slate-600">Ref: {referenceNo}</span>
                                                  </div>
                                                  <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                      type="button"
                                                      variant="outline"
                                                      size="icon"
                                                      className="h-9 w-9 rounded-xl border-violet-100 text-violet-700 hover:bg-violet-50"
                                                      onClick={() => handleOpenTransactionSnapshot(txn)}
                                                      title="View payment snapshot"
                                                    >
                                                      <Eye className="h-4 w-4" />
                                                      <span className="sr-only">View payment snapshot</span>
                                                    </Button>
                                                    {!isDeletedPayment ? (
                                                      <>
                                                        <Button
                                                          type="button"
                                                          variant="outline"
                                                          size="icon"
                                                          className={`h-9 w-9 rounded-xl border-violet-100 text-violet-700 hover:bg-violet-50 ${editablePaymentId ? "" : "opacity-60"}`}
                                                          onClick={() => handleEditPaymentTransaction(txn)}
                                                          title={editablePaymentId ? "Edit payment" : getPaymentEditUnavailableMessage(txn)}
                                                        >
                                                          <Edit className="h-4 w-4" />
                                                          <span className="sr-only">Edit payment</span>
                                                        </Button>
                                                        <Button
                                                          type="button"
                                                          variant="outline"
                                                          size="icon"
                                                          className={`h-9 w-9 rounded-xl border-red-100 text-red-600 hover:bg-red-50 ${editablePaymentId ? "" : "opacity-60"}`}
                                                          onClick={() => requestDeletePaymentTransaction(txn)}
                                                          title={editablePaymentId ? "Delete payment" : getPaymentEditUnavailableMessage(txn)}
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                          <span className="sr-only">Delete payment</span>
                                                        </Button>
                                                      </>
                                                    ) : isActualDeletedPaymentTransaction(txn) && restorablePaymentId ? (
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-9 rounded-xl border-emerald-200 bg-white px-3 text-xs font-black uppercase text-emerald-700 hover:bg-emerald-50"
                                                        onClick={() => handleRestorePayment(restorablePaymentId, txn.appointmentId || getTransactionAppointmentId(txn))}
                                                        title="Restore payment"
                                                      >
                                                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                                                        Restore
                                                      </Button>
                                                    ) : null}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })()
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : historyViewMode === "list" ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date &amp; Time</TableHead>
                            <TableHead>Tooth No.</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Doctor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Paid</TableHead>
                            <TableHead>Balance</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredHistory.map((appointment: HistoryAppointment, index: number) => {
                            const appointmentId = String(appointment.id || `apt-${index}`);
                            const appointmentTime = formatPatientHistoryTime(appointment.date, (appointment as any).time);
                            const doctorName = getVisitDoctorName(appointment);
                            const isDeletedAppointment = isSoftDeletedAppointment(appointment);
                            const appointmentStatus = normalizeAppointmentStatus(String(appointment.status || ""));
                            const bookingTreatments = getBookingTreatmentsValue(appointment);
                            const treatmentNames = bookingTreatments.length > 0
                              ? bookingTreatments.map(t => getAppointmentTypeName(t.type, t.customType) || String(t.type || 'Treatment')).join(", ")
                              : String(appointment.type || "Appointment");
                            const appointmentBalance = Number((appointment as any).balance);
                            const computedOutstandingBalance = Math.max(0, Number(appointment.price || 0) - Number(appointment.totalPaid || 0));
                            const storedDisplayedBalance = Number.isFinite(appointmentBalance)
                              ? appointmentBalance
                              : computedOutstandingBalance;
                            const originalDisplayedBalance = isDeletedAppointment
                              ? Math.max(storedDisplayedBalance, computedOutstandingBalance)
                              : storedDisplayedBalance;
                            const displayedBalance = isDeletedAppointment ? 0 : originalDisplayedBalance;
                            const toothNumbers = getBookingToothNumbersValue(appointment);
                            const patientDisplayName = patient.name || [patient.firstName, patient.lastName].filter(Boolean).join(" ") || "Patient";
                            const originalAppointment = patientAppointments.find((x: Appointment) => String(x.id) === appointmentId);
                            const editableAppointment = originalAppointment || appointment;
                            const canRestoreAppointment = isDeletedAppointment && effectiveRole === "admin";
                            const isDoctorUnassigned = !doctorName;

                            return (
                              <TableRow key={appointmentId} className={isDeletedAppointment ? deletedPaymentRowClass : undefined}>
                                <TableCell className="whitespace-normal">
                                  <button
                                    type="button"
                                    onClick={() => !isDeletedAppointment && openRescheduleModal(editableAppointment)}
                                    disabled={isDeletedAppointment}
                                    aria-label={`Edit schedule for ${treatmentNames}: ${formatPatientLogDate(appointment.date)} at ${appointmentTime}`}
                                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/70 focus-visible:border-violet-300 focus-visible:bg-violet-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Calendar className="h-4 w-4 shrink-0 text-violet-600" />
                                    <span className="min-w-0">
                                      <span className="block font-semibold text-slate-900">{formatPatientLogDate(appointment.date)}</span>
                                      <span className="block text-xs font-medium text-slate-500">{appointmentTime}</span>
                                    </span>
                                  </button>
                                </TableCell>
                                <TableCell>{toothNumbers || "—"}</TableCell>
                                <TableCell className="max-w-xs whitespace-normal">
                                  <button
                                    type="button"
                                    onClick={() => !isDeletedAppointment && openUpdateTreatmentModal(editableAppointment)}
                                    disabled={isDeletedAppointment}
                                    aria-label={`Edit treatment for ${treatmentNames}`}
                                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/70 focus-visible:border-violet-300 focus-visible:bg-violet-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <ClipboardList className="h-4 w-4 shrink-0 text-violet-600" />
                                    <span className="truncate font-medium text-slate-900">{treatmentNames}</span>
                                  </button>
                                </TableCell>
                                <TableCell className="max-w-[10rem] whitespace-normal">
                                  <button
                                    type="button"
                                    onClick={() => !isDeletedAppointment && setAssignDoctorAppointment(editableAppointment as HistoryAppointment)}
                                    disabled={isDeletedAppointment}
                                    aria-label={`${doctorName ? "Change" : "Assign"} doctor for ${treatmentNames}`}
                                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/70 focus-visible:border-violet-300 focus-visible:bg-violet-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                                    <span className="truncate font-medium text-slate-900">{doctorName || "Unassigned"}</span>
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <AppointmentStatusSelect
                                      value={isDeletedAppointment ? "deleted" : String(appointment.status || "")}
                                      statuses={APPOINTMENT_STATUSES}
                                      includeDeleted={effectiveRole === "admin"}
                                      onChange={(nextStatus) => handleVisitStatusChange(appointment, nextStatus)}
                                      badgeClassName="font-medium"
                                    />
                                    <span className="text-slate-400">/</span>
                                    {getPaymentStatusBadge(String(appointment.paymentStatus || "unpaid"))}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {Number(appointment.discount) > 0 ? (
                                    <div className="flex flex-col leading-tight">
                                      <span className="text-xs text-slate-400 line-through decoration-rose-400 font-normal">
                                        {formatPatientHistoryCurrency(appointment.price)}
                                      </span>
                                      <span className="font-semibold text-slate-900">
                                        {formatPatientHistoryCurrency(Math.max(0, Number(appointment.price || 0) - Number(appointment.discount || 0)))}
                                      </span>
                                    </div>
                                  ) : (
                                    formatPatientHistoryCurrency(appointment.price)
                                  )}
                                </TableCell>
                                <TableCell className="font-medium text-emerald-700">{formatPatientHistoryCurrency(appointment.totalPaid)}</TableCell>
                                <TableCell className={`font-medium ${displayedBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                  {formatPatientHistoryCurrency(displayedBalance)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenSnapshot(appointment)}
                                    >
                                      View
                                    </Button>
                                    {!isDeletedAppointment && displayedBalance > 0 ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          if (patient.id) {
                                            openPaymentModal(String(patient.id), patientDisplayName, mockAppointmentHistoryLocal, appointmentId);
                                          }
                                        }}
                                      >
                                        Pay
                                      </Button>
                                    ) : null}
                                    <AppointmentActionsMenu
                                      actions={createVisitHistoryActions(
                                        {
                                          onViewDetails: () => handleOpenSnapshot(appointment),
                                          onViewHistory: () => handleOpenBookingHistory(appointment),
                                          onRecordPayment: !isDeletedAppointment && displayedBalance > 0 && patient.id ? () => openPaymentModal(String(patient.id), patientDisplayName, mockAppointmentHistoryLocal, appointmentId) : undefined,
                                          onRestoreAppointment: canRestoreAppointment ? () => handleRestoreVisitAppointment(appointment) : undefined,
                                          onReschedule: originalAppointment && !isDeletedAppointment ? () => openRescheduleModal(originalAppointment) : undefined,
                                          onUpdateTreatment: originalAppointment && !isDeletedAppointment ? () => openUpdateTreatmentModal(originalAppointment) : undefined,
                                          onAssignDoctor: originalAppointment && !isDeletedAppointment ? () => setAssignDoctorAppointment(originalAppointment as unknown as HistoryAppointment) : undefined,
                                        },
                                        {
                                          canRestoreAppointment,
                                          canReschedule: Boolean(originalAppointment && !isDeletedAppointment),
                                          canUpdateTreatment: Boolean(originalAppointment && !isDeletedAppointment),
                                          canAssignDoctor: Boolean(originalAppointment && !isDeletedAppointment),
                                          isDoctorUnassigned,
                                        }
                                      )}
                                      triggerVariant="outline"
                                      triggerSize="icon"
                                      triggerIcon={<MoreVertical className="h-4 w-4" />}
                                      ariaLabel="Visit actions"
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null)}
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="payments" data-tour-id="patient-details-payments-content" className="mx-auto w-full max-w-[1680px] space-y-4">
              <Card className={`${cardClass} overflow-hidden border-slate-200 bg-white shadow-sm`}>
                <CardHeader className="space-y-6 p-5 sm:p-7">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <CardTitle className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                        Payment History
                      </CardTitle>
                      <p className="mt-2 text-sm font-medium text-slate-500">
                        View and manage your payment transactions
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:items-end">
                      <Button
                        size="sm"
                        className="h-11 rounded-lg bg-violet-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700"
                        onClick={() => {
                          if (patient.id) {
                            openPaymentModal(String(patient.id), patientDisplayName, mockAppointmentHistoryLocal, null);
                          }
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Payment
                      </Button>
                      <div className="text-sm font-medium text-slate-400">
                        Total Transactions: <span className="font-bold text-slate-600">{filteredTransactions.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-md shadow-slate-200/60">
                    <div className="grid grid-cols-[minmax(0,1fr)_3rem] gap-3 md:grid-cols-[minmax(220px,1fr)_3rem_180px_180px_180px_auto_auto] xl:grid-cols-[minmax(280px,1fr)_3rem_190px_190px_190px_auto_auto]">
                      <div className="relative min-w-0">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={paymentSearchFilter}
                          onChange={(event) => setPaymentSearchFilter(event.target.value)}
                          placeholder="Search payments..."
                          className="h-12 rounded-lg border-slate-200 bg-white pl-11 text-sm font-medium shadow-none placeholder:text-slate-400"
                        />
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-lg border-slate-200 text-slate-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                            title="Payment history filters"
                            aria-label="Payment history filters"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="max-h-[70vh] w-72 overflow-y-auto">
                          <DropdownMenuLabel>Payment filters</DropdownMenuLabel>
                          <DropdownMenuLabel className="max-w-full truncate text-xs font-semibold text-slate-500">
                            Filters: {paymentMethodLabel} / {paymentDoctorLabel} / {paymentProcedureLabel}
                          </DropdownMenuLabel>
                          <DropdownMenuLabel className="max-w-full truncate text-xs font-semibold text-slate-500">
                            {paymentSortLabel} / {paymentDeletedLabel}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-slate-500">Methods</DropdownMenuLabel>
                          {uniquePaymentMethods.map((method) => (
                            <DropdownMenuItem
                              key={String(method)}
                              className={activeHistoryFilterItemClass(paymentMethodFilter === method)}
                              onSelect={() => setPaymentMethodFilter(String(method))}
                            >
                              {method === "all" ? "All Methods" : String(method)}
                            </DropdownMenuItem>
                          ))}
                          {!doctorFilter ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-slate-500">Doctors</DropdownMenuLabel>
                              {uniquePaymentDoctors.map((doctor) => (
                                <DropdownMenuItem
                                  key={String(doctor)}
                                  className={activeHistoryFilterItemClass(paymentDoctorFilter === doctor)}
                                  onSelect={() => setPaymentDoctorFilter(String(doctor))}
                                >
                                  {String(doctor) === "all" ? "All Doctors" : String(doctor)}
                                </DropdownMenuItem>
                              ))}
                            </>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-slate-500">Procedures</DropdownMenuLabel>
                          {uniquePaymentProcedures.map((procedure) => (
                            <DropdownMenuItem
                              key={String(procedure)}
                              className={activeHistoryFilterItemClass(paymentProcedureFilter === procedure)}
                              onSelect={() => setPaymentProcedureFilter(String(procedure))}
                            >
                              {String(procedure) === "all" ? "All Procedures" : String(procedure)}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-slate-500">Sort</DropdownMenuLabel>
                          <DropdownMenuItem
                            className={activeHistoryFilterItemClass(paymentDateSortDirection === "desc")}
                            onSelect={() => setPaymentDateSortDirection("desc")}
                          >
                            Newest Paid
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className={activeHistoryFilterItemClass(paymentDateSortDirection === "asc")}
                            onSelect={() => setPaymentDateSortDirection("asc")}
                          >
                            Oldest Paid
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-slate-500">Deleted payments</DropdownMenuLabel>
                          <DropdownMenuItem
                            className={activeHistoryFilterItemClass(!showDeletedPayments)}
                            onSelect={() => setShowDeletedPayments(false)}
                          >
                            Hide deleted payments
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className={activeHistoryFilterItemClass(showDeletedPayments)}
                            onSelect={() => setShowDeletedPayments(true)}
                          >
                            Show deleted payments
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={clearPaymentFilters}>
                            Reset filters
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="hidden md:block">
                        <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                          <SelectTrigger className="h-12 w-full rounded-lg border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-none">
                            <SelectValue placeholder="All Methods" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniquePaymentMethods.map(method => (
                              <SelectItem key={method} value={method}>{method === 'all' ? 'All Methods' : method}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {!doctorFilter ? (
                        <div className="hidden md:block">
                          <Select value={paymentDoctorFilter} onValueChange={setPaymentDoctorFilter}>
                            <SelectTrigger className="h-12 w-full rounded-lg border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-none">
                              <SelectValue placeholder="All Doctors" />
                            </SelectTrigger>
                            <SelectContent>
                              {uniquePaymentDoctors.map(doctor => (
                                <SelectItem key={String(doctor)} value={String(doctor)}>{String(doctor) === 'all' ? 'All Doctors' : String(doctor)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="hidden md:block" />
                      )}

                      <div className="hidden md:block">
                        <Select value={paymentProcedureFilter} onValueChange={setPaymentProcedureFilter}>
                          <SelectTrigger className="h-12 w-full rounded-lg border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-none">
                            <SelectValue placeholder="All Procedures" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniquePaymentProcedures.map(proc => (
                              <SelectItem key={String(proc)} value={String(proc)}>{String(proc) === 'all' ? 'All Procedures' : String(proc)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="hidden h-12 rounded-lg border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 md:inline-flex"
                        onClick={() => setPaymentDateSortDirection((direction) => direction === "desc" ? "asc" : "desc")}
                        title="Sort by payment date"
                      >
                        {paymentDateSortDirection === "desc" ? (
                          <ChevronDown className="mr-2 h-4 w-4 text-violet-600" />
                        ) : (
                          <ChevronUp className="mr-2 h-4 w-4 text-violet-600" />
                        )}
                        {paymentDateSortDirection === "desc" ? "Newest Paid" : "Oldest Paid"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="hidden h-12 rounded-lg border-violet-300 px-4 text-sm font-bold text-violet-600 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50 md:inline-flex"
                        onClick={clearPaymentFilters}
                        disabled={!hasPaymentFilters}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-8 p-5 pt-0 sm:p-7 sm:pt-0">
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-md shadow-slate-200/50 sm:p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 sm:h-11 sm:w-11">
                          <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-slate-500">Total Paid</p>
                          <div className="mt-1 flex min-w-0 items-baseline gap-2">
                            <span className="max-w-[calc(100%-2rem)] shrink-0 truncate text-xl font-black text-emerald-600">
                              <CurrencyText value={formatPatientHistoryCurrency(paymentSummary.totalPaid)} />
                            </span>
                            <span className="min-w-0 flex-1 truncate rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">Paid</span>
                          </div>
                        </div>
                      </div>
                      <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-md shadow-slate-200/50 sm:p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 sm:h-11 sm:w-11">
                          <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-slate-500">Outstanding</p>
                          <div className="mt-1 flex min-w-0 items-baseline gap-2">
                            <span className="max-w-[calc(100%-2rem)] shrink-0 truncate text-xl font-black text-red-600">
                              <CurrencyText value={formatPatientHistoryCurrency(paymentSummary.outstanding)} />
                            </span>
                            <span className="min-w-0 flex-1 truncate rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-600">Due</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-md shadow-slate-200/50 sm:p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 sm:h-11 sm:w-11">
                          <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-slate-500">Total Billed</p>
                          <div className="mt-1 flex min-w-0 items-baseline gap-2">
                            <span className="max-w-[calc(100%-2rem)] shrink-0 truncate text-xl font-black text-slate-950">
                              <CurrencyText value={formatPatientHistoryCurrency(paymentSummary.totalBilled)} />
                            </span>
                            <span className="min-w-0 flex-1 truncate rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black text-violet-700">Billed</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-violet-600 bg-white text-violet-600">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-950">Transaction Timeline</h3>
                        <p className="text-sm font-medium text-slate-500">
                          {filteredTransactions.length} payment{filteredTransactions.length === 1 ? "" : "s"} found
                        </p>
                      </div>
                    </div>

                    {filteredTransactions.length > 0 ? (
                      <div className="relative space-y-5 pl-8 sm:pl-12">
                        <div className="absolute bottom-8 left-[15px] top-0 border-l border-dashed border-slate-200 sm:left-[15px]" />
                        {filteredTransactions.map((txn) => {
                          const paymentDisplay = getTransactionPaymentDisplay(txn);
                          const txnPaymentDateRaw = (txn as any).paymentDate || txn.date;
                          const txnPaymentDate = formatPatientLogDate(txnPaymentDateRaw);
                          const txnDateParts = getPatientHistoryDateParts(txnPaymentDateRaw);
                          const transactionIdLabel = txn.transactionId || txn.id || "N/A";
                          const editablePaymentId = getEditablePaymentId(txn);
                          const restorablePaymentId = getRestorablePaymentId(txn);
                          const isDeletedPayment = isSoftDeletedPaymentTransaction(txn);
                          const isCancelledPayment = isAppointmentCancelledStatusTransaction(txn);
                          const isInactivePayment = isDeletedPayment || isCancelledPayment;

                          return (
                            <div key={txn.id} className="relative">
                              <span className={`absolute -left-[2rem] top-11 h-4 w-4 rounded-full border-4 border-white shadow-md sm:-left-[3rem] ${isInactivePayment ? "bg-gray-400 shadow-gray-100" : "bg-violet-600 shadow-violet-200"}`} />
                              <div className={`rounded-lg border p-4 shadow-md shadow-slate-200/60 transition-colors hover:border-violet-200 sm:p-5 ${isInactivePayment ? `border-slate-200 ${deletedPaymentRowClass}` : paymentDisplay.isLog ? "border-slate-200 bg-slate-50/70 opacity-90" : "border-slate-200 bg-white"}`}>
                                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                                    <div className="flex shrink-0 items-center gap-4 sm:w-40 sm:border-r sm:border-slate-200 sm:pr-6">
                                      <div className="text-center sm:w-24">
                                        <div className="text-lg font-black leading-none text-violet-600">{txnDateParts.month}</div>
                                        <div className="mt-1 text-5xl font-black leading-none text-slate-950">{txnDateParts.day}</div>
                                        <div className="mt-2 text-lg font-bold leading-none text-slate-500">{txnDateParts.year}</div>
                                      </div>
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className={`truncate text-lg font-black ${isInactivePayment ? "text-gray-700" : "text-slate-950"}`}>{txn.doctor || "Unassigned Doctor"}</h4>
                                      <p className="mt-1 truncate text-base font-medium text-slate-500">{txn.appointmentType || "Appointment Payment"}</p>
                                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-500">
                                        <span className="inline-flex items-center gap-2">
                                          <Calendar className="h-4 w-4 text-slate-600" />
                                          Appointment: {formatPatientLogDate(txn.appointmentDate, "N/A")}
                                        </span>
                                        <span className="inline-flex items-center gap-2">
                                          <CreditCard className="h-4 w-4 text-slate-600" />
                                          Payment Method: {txn.method || "N/A"}
                                        </span>
                                        <span className="inline-flex items-center gap-2">
                                          <FileText className="h-4 w-4 text-slate-600" />
                                          Ref No.: {transactionIdLabel}
                                        </span>
                                      </div>
                                      {txn.notes && (
                                        <p className="mt-3 text-sm font-medium italic text-slate-500">{txn.notes}</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
                                    <div className="sm:text-right">
                                      <div className="text-2xl font-black text-emerald-600">
                                        <span className={isInactivePayment ? "text-gray-600" : ""}>
                                          <CurrencyText value={formatPatientHistoryCurrency(txn.amount)} />
                                        </span>
                                      </div>
                                      <div className="mt-2">
                                        <PaymentTransactionStatusBadge display={paymentDisplay} />
                                      </div>
                                      <div className="mt-2 text-xs font-medium text-slate-400">Payment Date: {txnPaymentDate}</div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-12 w-12 rounded-lg border-slate-200 bg-white text-slate-700 shadow-md shadow-slate-200/60 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                                        onClick={() => handleOpenTransactionSnapshot(txn)}
                                      >
                                        <Eye className="h-5 w-5" />
                                        <span className="sr-only">View Appointment Snapshot</span>
                                      </Button>
                                      {!isDeletedPayment ? (
                                        <>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className={`h-12 w-12 rounded-lg border-slate-200 bg-white text-slate-700 shadow-md shadow-slate-200/60 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 ${editablePaymentId ? "" : "opacity-60"}`}
                                            title={editablePaymentId ? "Edit payment" : getPaymentEditUnavailableMessage(txn)}
                                            onClick={() => handleEditPaymentTransaction(txn)}
                                          >
                                            <Edit className="h-5 w-5" />
                                            <span className="sr-only">Edit Payment</span>
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className={`h-12 w-12 rounded-lg border-slate-200 bg-white text-red-600 shadow-md shadow-slate-200/60 hover:border-red-200 hover:bg-red-50 hover:text-red-700 ${editablePaymentId ? "" : "opacity-60"}`}
                                            title={editablePaymentId ? "Delete payment" : getPaymentEditUnavailableMessage(txn)}
                                            onClick={() => requestDeletePaymentTransaction(txn)}
                                          >
                                            <Trash2 className="h-5 w-5" />
                                            <span className="sr-only">Delete Payment</span>
                                          </Button>
                                        </>
                                      ) : isActualDeletedPaymentTransaction(txn) && restorablePaymentId ? (
                                        <Button
                                          variant="outline"
                                          className="h-12 rounded-lg border-emerald-200 bg-white px-4 text-sm font-black uppercase text-emerald-700 shadow-md shadow-slate-200/60 hover:bg-emerald-50"
                                          title="Restore payment"
                                          onClick={() => handleRestorePayment(restorablePaymentId, txn.appointmentId || getTransactionAppointmentId(txn))}
                                        >
                                          <RotateCcw className="mr-2 h-5 w-5" />
                                          Restore
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 py-12 text-center text-sm font-medium text-slate-500">
                        No payment transactions found for the selected filters.
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
          </div>
        </Tabs>
        <SelectScheduleModal
          open={Boolean(rescheduleAppointment)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) closeRescheduleModal();
          }}
          title="Reschedule Visit"
          description={rescheduleAppointmentLabel ? `${rescheduleAppointmentLabel} for ${patientDisplayName}` : patientDisplayName}
          appointmentLabel={rescheduleAppointmentLabel}
          doctorLabel={rescheduleDoctorName || "Unassigned"}
          selectedDate={rescheduleDate}
          selectedTime={rescheduleTime}
          selectedDuration={rescheduleDuration}
          onDurationChange={setRescheduleDuration}
          status={rescheduleStatus}
          statusOptions={APPOINTMENT_STATUSES}
          onStatusChange={setRescheduleStatus}
          onDateClick={() => setIsRescheduleDatePickerOpen(true)}
          onTimeClick={() => setIsRescheduleTimePickerOpen(true)}
          onSave={handleSaveReschedule}
          onCancel={() => closeRescheduleModal()}
          isSaving={isRescheduleSaving}
          canSave={Boolean(rescheduleDate && rescheduleTime.trim())}
        />
        <DatePickerModal
          open={isRescheduleDatePickerOpen}
          onOpenChange={setIsRescheduleDatePickerOpen}
          selectedDate={rescheduleDate}
          onDateSelect={setRescheduleDate}
          doctorName={rescheduleDoctorName}
          patientId={currentPatientId || undefined}
          selectedTime={rescheduleTime}
          duration={rescheduleDuration}
          dateSelectionMode="edit"
          title="Select New Date"
          subtitle={rescheduleAppointmentLabel || undefined}
          excludeAppointmentId={rescheduleAppointmentId || null}
          timeConflictMessage="That time is already booked on this date. Please select another date or time."
        />
        {rescheduleDate ? (
          <TimePickerModal
            open={isRescheduleTimePickerOpen}
            onOpenChange={setIsRescheduleTimePickerOpen}
            selectedDate={rescheduleDate}
            selectedTime={rescheduleTime}
            doctorName={rescheduleDoctorName}
            duration={rescheduleDuration}
            onTimeSelect={setRescheduleTime}
            onDateChange={setRescheduleDate}
            excludeAppointmentId={rescheduleAppointmentId || undefined}
            patientId={currentPatientId || null}
            dateSelectionMode="edit"
          />
        ) : null}
        <SelectTreatmentModal
          open={Boolean(updateTreatmentAppointment)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) closeUpdateTreatmentModal();
          }}
          title="Update Treatment"
          description={updateTreatmentAppointment ? `${updateTreatmentCurrentLabel || "Visit"} for ${patientDisplayName}` : patientDisplayName}
          treatments={activeTreatmentOptions}
          selectedTreatmentId={selectedVisitTreatmentId}
          currentTreatmentLabel={updateTreatmentCurrentLabel}
          customTreatmentName={customVisitTreatmentName}
          selectedPrice={visitTreatmentPrice}
          toothNumberEntries={visitTreatmentToothNumberEntries}
          treatmentSections={selectedVisitTreatmentSections ?? undefined}
          onCustomTreatmentNameChange={(nextValue, sectionIndex) => {
            const nextSections = (selectedVisitTreatmentSections && selectedVisitTreatmentSections.length > 0
              ? selectedVisitTreatmentSections
              : [{ selectedTreatmentId: selectedVisitTreatmentId, currentTreatmentLabel: updateTreatmentCurrentLabel, customTreatmentName: customVisitTreatmentName, selectedPrice: visitTreatmentPrice }]
            ).map((section, index) => index === (sectionIndex ?? 0) ? { ...section, customTreatmentName: nextValue } : section);
            setSelectedVisitTreatmentSections(nextSections);
            const firstSection = nextSections[0];
            setCustomVisitTreatmentName(firstSection.customTreatmentName || "");
          }}
          onSelectedPriceChange={(nextValue, sectionIndex) => {
            const nextSections = (selectedVisitTreatmentSections && selectedVisitTreatmentSections.length > 0
              ? selectedVisitTreatmentSections
              : [{ selectedTreatmentId: selectedVisitTreatmentId, currentTreatmentLabel: updateTreatmentCurrentLabel, customTreatmentName: customVisitTreatmentName, selectedPrice: visitTreatmentPrice }]
            ).map((section, index) => index === (sectionIndex ?? 0) ? { ...section, selectedPrice: nextValue } : section);
            setSelectedVisitTreatmentSections(nextSections);
            const firstSection = nextSections[0];
            setVisitTreatmentPrice(String(firstSection.selectedPrice ?? ""));
          }}
          onToothNumberEntriesChange={setVisitTreatmentToothNumberEntries}
          onTreatmentSectionsChange={setSelectedVisitTreatmentSections}
          onTreatmentSelect={(treatment, sectionIndex) => {
            const nextSections = (selectedVisitTreatmentSections && selectedVisitTreatmentSections.length > 0
              ? selectedVisitTreatmentSections
              : [{ selectedTreatmentId: selectedVisitTreatmentId, currentTreatmentLabel: updateTreatmentCurrentLabel, customTreatmentName: customVisitTreatmentName, selectedPrice: visitTreatmentPrice }]
            ).map((section, index) => index === (sectionIndex ?? 0)
              ? {
                  ...section,
                  selectedTreatmentId: treatment.id,
                  selectedPrice: String(Math.max(0, Number(treatment.price || section.selectedPrice || 0))),
                  customTreatmentName: treatment.id === OTHER_APPOINTMENT_TYPE_INDEX
                    ? String(section.customTreatmentName || updateTreatmentCurrentLabel || "").trim()
                    : "",
                }
              : section);
            setSelectedVisitTreatmentSections(nextSections);
            const firstSection = nextSections[0];
            setSelectedVisitTreatmentId(firstSection.selectedTreatmentId ?? null);
            setVisitTreatmentPrice(String(firstSection.selectedPrice ?? ""));
            if (treatment.id !== OTHER_APPOINTMENT_TYPE_INDEX) {
              setCustomVisitTreatmentName("");
            } else if (!customVisitTreatmentName.trim()) {
              setCustomVisitTreatmentName(updateTreatmentCurrentLabel);
            }
          }}
          allowAddTreatment={true}
          allowRemoveTreatment={true}
          onSave={handleSaveVisitTreatment}
          onCancel={() => closeUpdateTreatmentModal()}
          isSaving={isUpdatingVisitTreatment}
          canSave={canSaveVisitTreatment}
        />
        <AlertDialog
          open={Boolean(similarVisitTreatmentPrompt)}
          onOpenChange={(open) => {
            if (!open && !isUpdatingVisitTreatment) {
              setSimilarVisitTreatmentPrompt(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Similar Treatment Found</AlertDialogTitle>
              <AlertDialogDescription>
                {similarVisitTreatmentPrompt
                  ? `"${similarVisitTreatmentPrompt.input}" looks similar to "${similarVisitTreatmentPrompt.service.label}". Are you sure you want to save it as a custom treatment?`
                  : "This treatment looks similar to an existing service. Are you sure you want to save it?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isUpdatingVisitTreatment}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isUpdatingVisitTreatment}
                onClick={() => {
                  setSimilarVisitTreatmentPrompt(null);
                  void handleSaveVisitTreatment(true);
                }}
              >
                Add Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog open={Boolean(assignDoctorAppointment)} onOpenChange={(nextOpen) => !isAssigningVisitDoctor && !nextOpen && setAssignDoctorAppointment(null)}>
          <DialogContent
            showCloseButton={false}
            className="!fixed !bottom-0 !left-0 !top-auto !flex max-h-[88dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.5rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:w-[min(42rem,calc(100vw-2rem))] sm:max-w-2xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.5rem]"
          >
            <DialogHeader className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-3 shadow-sm sm:px-6">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 text-left">
                    <DialogTitle className="truncate text-xl font-black tracking-tight text-slate-950">{assignDoctorActionLabel}</DialogTitle>
                    <DialogDescription className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-500">
                      {assignDoctorAppointment ? `${String(assignDoctorAppointment.type || "Visit")} for ${patientDisplayName}` : "Choose a provider for this visit"}
                    </DialogDescription>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setAssignDoctorAppointment(null)} disabled={isAssigningVisitDoctor} className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close assign doctor">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-4 py-5 custom-scrollbar sm:px-6">
              <SelectDoctorModal className="mx-auto max-w-[38rem]" onDoctorAdded={() => void reloadDoctors()}>
                {isLoadingDoctors ? (
                  <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-100 bg-white text-sm font-bold text-slate-500 shadow-sm">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
                    Loading doctors
                  </div>
                ) : doctors.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
                    <p className="text-sm font-black text-slate-900">No doctors available</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Add a doctor record first, then assign this visit.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {doctors.map((doctor: any) => {
                      const doctorAvatar = resolveImageSource(doctor.profilePicture || doctor.profilePictureUrl || "");

                      return (
                        <button
                          key={doctor.id || doctor.name}
                          type="button"
                          onClick={() => handleAssignVisitDoctor(doctor)}
                          disabled={isAssigningVisitDoctor}
                          className="group flex min-h-[6.5rem] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <Avatar className="h-14 w-14 shrink-0 rounded-2xl border border-blue-50 shadow-sm">
                            {doctorAvatar ? <AvatarImage src={doctorAvatar} alt={doctor.name} className="object-cover" /> : null}
                            <AvatarFallback className="rounded-2xl bg-blue-50 text-sm font-black text-blue-700">
                              {getInitials(doctor.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black leading-tight text-slate-950">{doctor.name}</p>
                            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-slate-500">{doctor.specialization || doctor.role || "Dental specialist"}</p>
                          </div>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                            {isAssigningVisitDoctor ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </SelectDoctorModal>
            </div>
          </DialogContent>
        </Dialog>
        <PatientUnsavedChangesDialog
          open={isRecoveryDialogOpen}
          onOpenChange={setIsRecoveryDialogOpen}
          title="Recovered Unsaved Changes"
          description="The previous session ended before these changes were saved. Your changes are still here; save them now or keep editing."
          changes={visibleChangedFields}
          primaryLabel={isRecoverySaving ? "Saving..." : "Save Changes"}
          secondaryLabel="Discard Draft"
          cancelLabel="Keep Editing"
          onPrimary={handleSaveRecoveredDraft}
          onSecondary={handleDiscardRecoveredDraft}
          loading={isRecoverySaving}
        />
        <DeletePaymentDialog
          open={Boolean(pdPaymentToDelete)}
          onOpenChange={(open) => {
            if (!open && !pdConfirmLoading) setPdPaymentToDelete(null);
          }}
          loading={pdConfirmLoading}
          description="This will mark the payment as deleted and update the appointment balance. It can be restored later from deleted payment views."
          details={pdPaymentToDelete ? {
            amountLabel: formatPatientHistoryCurrency(pdPaymentToDelete.transaction.amount),
            patientName: pdPaymentToDelete.transaction.patientName,
            appointmentLabel: pdPaymentToDelete.transaction.appointmentType,
            dateLabel: formatPatientLogDate(
              (pdPaymentToDelete.transaction as any).paymentDate || pdPaymentToDelete.transaction.date,
              ""
            ),
            method: pdPaymentToDelete.transaction.method,
            reference: pdPaymentToDelete.transaction.transactionId || pdPaymentToDelete.transaction.id,
          } : null}
          onConfirm={confirmDeletePaymentTransaction}
        />
        <SignatureInputModal
          open={Boolean(consentSignatureModalTarget)}
          onOpenChange={(open) => {
            if (!open) setConsentSignatureModalTarget(null);
          }}
          value={
            consentSignatureModalTarget === "dentist"
              ? consentForm.dentistSignatureImage
              : consentForm.patientSignatureImage
          }
          title={consentSignatureModalTarget === "dentist" ? "Dentist Signature" : "Patient Signature"}
          description={
            consentSignatureModalTarget === "dentist"
              ? "Add the dentist signature for this consent form."
              : "Add the patient, parent, or guardian signature for this consent form."
          }
          signatureLabel={consentSignatureModalTarget === "dentist" ? "Dentist Signature" : "Patient / Parent / Guardian Signature"}
          disabled={isSavingConsent}
          onSave={(signatureImage) => {
            if (consentSignatureModalTarget === "dentist") {
              updateConsentField("dentistSignatureImage", signatureImage);
            } else {
              updateConsentField("patientSignatureImage", signatureImage);
            }
          }}
        />

        {/* Appointment Snapshot Dialog */}
        <AppointmentHistoryView
          open={isSnapshotOpen}
          onOpenChange={(open) => {
            setIsSnapshotOpen(open);
            if (!open) setSelectedPaymentSnapshot(null);
          }}
          appointmentSnapshot={selectedSnapshot}
          logDate={snapshotLogDate}
          onOpenAppointment={onOpenBookingModal ? handleOpenSnapshotAppointment : undefined}
          isAppointmentOpen={isSelectedSnapshotAppointmentOpen}
          isHistorical={selectedSnapshotIsHistorical}
          openedFromBookingModal={false}
          selectedPaymentSnapshot={selectedPaymentSnapshot}
          useCurrentAppointmentDetails
        />

        {/* Booking Appointment History Dialog */}
        <BookingAppointmentHistory
          open={isBookingHistoryOpen}
          onOpenChange={setIsBookingHistoryOpen}
          appointmentLogs={bookingHistoryLogs}
          paymentLogs={bookingPaymentLogs}
          appointmentToEdit={bookingHistoryAppointment}
          onViewSnapshot={(snapshot: any, isHistorical: boolean) => {
            // handleOpenSnapshot will extract _focusedPaymentSnapshot and set it appropriately
            handleOpenSnapshot(snapshot);
          }}
          triggerVariant="section"
          showTrigger={false}
        />

      </div>
    </div>
  );
});
PatientDetails.displayName = "PatientDetails";
