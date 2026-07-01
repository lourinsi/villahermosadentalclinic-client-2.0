import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import { fetchSnapshotFromLogs } from "@/lib/appointmentSnapshots";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CompactNotesField } from "@/components/CompactNotesField";
import { useAuth } from "@/hooks/useAuth";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import { useAppointmentTypeOptions } from "@/hooks/useAppointmentTypeOptions";
import { useAppointmentStatuses, AppointmentStatusOption } from "@/hooks/useAppointmentStatuses";
import { usePaymentStatuses, PaymentStatusOption } from "@/hooks/usePaymentStatuses";
import { Calendar as CalendarIcon, Clock, Award, Loader2, CreditCard, Banknote, Stethoscope, ChevronLeft, AlertCircle, Plus } from "lucide-react";
import { formatDateToYYYYMMDD } from "@/lib/utils";
import { formatTimeTo12h, TIME_SLOTS } from "@/lib/time-slots";
import { APPOINTMENT_PRICES, getAppointmentTypeName } from "@/lib/appointmentTypes";
import { toast } from 'sonner';
import useSharedBookingLogic, {
  ALLOWED_BOOKING_DURATIONS,
  DEFAULT_APPOINTMENT_TYPE_DURATIONS as appointmentTypeDurations,
  PAST_APPOINTMENT_STATUS_VALUES,
  findNextAvailableBookingSlot,
  findNextAvailableRepeatSlot,
  formatBookingDateKey,
  formatBookingDoctorName as formatDoctorName,
  formatBookingHistoryStatusLabel,
  getBookingAppointmentTypeIndex as getAppointmentTypeIndex,
  getBookingAppointmentStatusConfig,
  getBookingAutoPreselectConfig,
  getBookingActor,
  getBookingCancellationConfig,
  getBookingConflictWarnings,
  getBookingHistoryPaymentStatusChange,
  getBookingHistoryNotes,
  getBookingCreateDate,
  getBookingCreateTime,
  getBookingDefaultDate,
  getBookingDefaultScheduleAction,
  useBookingPaymentPrefill,
  getBookingDefaultTime,
  getBookingEditDate,
  getBookingEditTime,
  getDefaultBookingPaymentDate,
  normalizeBookingPaymentDate,
  isFutureBookingPaymentDate,
  formatBookingPaymentDateLabel,
  getBookingTreatmentNotesValue,
  getBookingPaymentStatusConfig,
  getBookingStatusLabel,
  CART_APPOINTMENT_STATUS,
  buildBookingTreatmentNotesPayload,
  getProjectedBookingStatus,
  getProjectedPaymentStatus,
  isCartAppointmentStatus,
  isPastAppointmentSchedule,
  isSignificantBookingPaymentStatus,
  normalizeBookingDoctorName as normalizeDoctorName,
  normalizeBookingDuration,
  normalizePastAppointmentStatus,
  parseLocalDateOnly,
  shouldShowBookingHistoryLog,
  toBookingPatientOption as toPatientOption,
} from './sharedBookingLogic';
import AppointmentHistoryView from "./AppointmentHistoryView";
import { DatePickerModal } from "./DatePickerModal";
import { TimePickerModal } from "./TimePickerModal";
import { ConfirmAppointmentModal } from "./ConfirmAppointmentModal";
import ApproveRejectDialog from "./ApproveRejectDialog";
import { useDoctors } from "@/hooks/useDoctors";
import { cachePublicBookingAppointment, cachePublicBookingPatient, createPublicBookingAppointment, getCachedPublicBlockingAppointments, getCachedPublicBookingPatients } from "@/lib/publicBookingCache";
import type { BookingCreationMode, BookingMode } from "./sharedBookingLogic";

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultTime?: string;
  doctorName?: string; // doctor's display name
  defaultPatientId?: string;
  onBooked?: (apt?: any) => void;
  appointmentToEdit?: any; // optional appointment object to edit
  title?: string; // optional override for dialog title
  bookingMode?: BookingMode;
  appointmentCreationMode?: BookingCreationMode;
}

type BookingHistoryBadge = {
  label: string;
  tone: "appointment" | "payment" | "amount";
};

const getBookingHistoryAmount = (log: any) => Number(log?.amount || 0);

const isBookingInitialHistoryLog = (log: any) =>
  !log?.previousState?.id || log?.previousState?.status === "none";

const getBookingHistoryBadges = (log: any): BookingHistoryBadge[] => {
  const badges: BookingHistoryBadge[] = [];
  const paymentStatusChange = getBookingHistoryPaymentStatusChange(log);
  const appointmentStatus = log?.newState?.status || log?.previousState?.status || (isBookingInitialHistoryLog(log) ? "new" : "");

  if (appointmentStatus) {
    badges.push({
      label: formatBookingHistoryStatusLabel(appointmentStatus),
      tone: "appointment",
    });
  }

  const paymentStatus = paymentStatusChange.nextStatus || log?.paymentStatus;
  if (isSignificantBookingPaymentStatus(paymentStatus)) {
    badges.push({
      label: formatBookingHistoryStatusLabel(paymentStatus),
      tone: "payment",
    });
  }

  const amount = getBookingHistoryAmount(log);
  if (amount > 0) {
    badges.push({
      label: `PHP ${amount.toLocaleString()}`,
      tone: "amount",
    });
  }

  return badges;
};

const getBookingHistoryBadgeClass = (tone: BookingHistoryBadge["tone"]) => {
  if (tone === "payment") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (tone === "amount") return "bg-green-50 text-green-700 border-green-200";
  return "bg-gray-100 text-gray-600 border-gray-300";
};

const getBookingHistoryBriefDetail = (log: any, userRole?: string) => {
  const paymentStatusChange = getBookingHistoryPaymentStatusChange(log);
  const amount = getBookingHistoryAmount(log);
  const scheduleChanged = Boolean(
    (log?.newState?.date && log.newState.date !== log?.previousState?.date) ||
    (log?.newState?.time && log.newState.time !== log?.previousState?.time)
  );
  const doctorChanged = Boolean(
    log?.newState?.doctor && normalizeDoctorName(log.newState.doctor) !== normalizeDoctorName(log?.previousState?.doctor)
  );
  const statusChanged = Boolean(log?.newState?.status && log.newState.status !== log?.previousState?.status);

  if (log?.logType === "payment") {
    if (amount > 0) return "Payment recorded";
    if (paymentStatusChange.changed) return "Payment status updated";
    return "Payment updated";
  }

  if (isBookingInitialHistoryLog(log)) {
    if (amount > 0) return "Payment recorded";
    if (userRole === "patient") return "Appointment record created";
    return `Appointment created by ${log?.changedByName || log?.changedBy || "Staff"}`;
  }

  const details: string[] = [];
  if (scheduleChanged) details.push("Schedule changed");
  if (doctorChanged) details.push("Doctor changed");
  const treatmentChanged = Boolean(
    (log?.newState?.type && log.previousState && String(log.newState.type) !== String(log.previousState.type)) ||
    (log?.newState?.customType && log.previousState && String(log.newState.customType) !== String(log.previousState.customType))
  );
  if (treatmentChanged) details.push("Treatment changed");

  // patient change detection
  const prev = log?.previousState;
  const next = log?.newState;
  const isPatientChange = (() => {
    if (!prev || !next) return false;
    const resolvePatient = (s: any) => {
      if (!s) return "";
      if (typeof s.patient === "string") return s.patient;
      if (s.patient?.id) return String(s.patient.id);
      if (s.patient?.name) return String(s.patient.name);
      if (s.patientId) return String(s.patientId);
      if (s.patientName) return String(s.patientName || s.patient_name);
      const first = s.patientFirstName || s.patient?.firstName;
      const last = s.patientLastName || s.patient?.lastName;
      if (first || last) return [first, last].filter(Boolean).join(" ");
      return "";
    };

    const pPrev = String(resolvePatient(prev) || "").trim();
    const pNext = String(resolvePatient(next) || "").trim();
    return Boolean(pPrev && pNext && pPrev !== pNext);
  })();
  if (isPatientChange) details.push("Patient Changed");

  // price change detection
  const prevPrice = prev ? Number(prev.price ?? prev.amount ?? 0) : null;
  const nextPrice = next ? Number(next.price ?? next.amount ?? 0) : null;
  const priceChanged = prevPrice !== null && nextPrice !== null && Number(prevPrice) !== Number(nextPrice);
  if (priceChanged) details.push("Price changed");

  if (statusChanged) details.push("Appointment status updated");
  if (paymentStatusChange.changed) details.push("Payment status updated");
  if (amount > 0) details.push("Payment recorded");

  if (details.length > 0) return details.slice(0, 5).join(" - ");
  if (userRole === "patient") return "Appointment details updated";
  if (userRole === "patient") return "Appointment details updated";
  return `Appointment updated by ${log?.changedByName || log?.changedBy || "Staff"}`;
};

const getBookingHistoryPaymentDateLabel = (log: any) => {
  if (getBookingHistoryAmount(log) <= 0) return "";

  const paymentDate = normalizeBookingPaymentDate(
    log?.paymentDate ||
    log?.newState?.paymentDate ||
    log?.previousState?.paymentDate
  );

  return formatBookingPaymentDateLabel(paymentDate);
};

export default function BookingModal({ open, onOpenChange, defaultDate, defaultTime, doctorName, defaultPatientId, onBooked, appointmentToEdit, title, bookingMode = "standard", appointmentCreationMode = "standard" }: BookingModalProps) {
  const { user } = useAuth();
  const { effectiveRole } = useAdminViewMode();
  const { doctors } = useDoctors(undefined, { publicBooking: bookingMode === "public" });
  const { addAppointment, updateAppointment, deleteAppointment, isPaymentFlow, openAddPatientModal, lastAddedPatient, lastAddedPatientAt } = useAppointmentModal();
  const { statuses: appointmentStatuses } = useAppointmentStatuses();
  const { statuses: paymentStatuses } = usePaymentStatuses();
  const { options: serviceOptions } = useAppointmentTypeOptions(open);

  const [patients, setPatients] = useState<any[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>(doctorName || "");
  const [appointmentType, setAppointmentType] = useState<string>("");
  const [customAppointmentTypeName, setCustomAppointmentTypeName] = useState<string>("");
  const [duration, setDuration] = useState<string>("30");
  const [discount, setDiscount] = useState<string>("0");
  const [customPrice, setCustomPrice] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");
  const [treatmentNotes, setTreatmentNotes] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(getBookingDefaultDate(defaultDate));
  const [selectedTime, setSelectedTime] = useState<string>(defaultTime ?? "");
  const [isBooking, setIsBooking] = useState(false);
  const [appointmentLogs, setAppointmentLogs] = useState<any[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<any[]>([]);
  const [durationConflict, setDurationConflict] = useState<string>("");

  // New states for two-step flow
  const [modalStep, setModalStep] = useState<"details" | "payment">("details");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [amountToPay, setAmountToPay] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(getDefaultBookingPaymentDate());
  const [overpayPulse, setOverpayPulse] = useState(false);
  const [appointmentStatus, setAppointmentStatus] = useState<string>("scheduled");
  const [paymentStatus, setPaymentStatus] = useState<string>("unpaid");
  const [statusChangedByUser, setStatusChangedByUser] = useState<number>(0);
  const [paymentStatusChangedByUser, setPaymentStatusChangedByUser] = useState<number>(0);
  const [repeatOption, setRepeatOption] = useState<string>("do-not-repeat");
  const [customRepeatDate, setCustomRepeatDate] = useState<string>("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isConfirmSummaryOpen, setIsConfirmSummaryOpen] = useState(false);
  const [snapshotToView, setSnapshotToView] = useState<any>(null);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotIsHistorical, setSnapshotIsHistorical] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [dailyAppointments, setDailyAppointments] = useState<any[]>([]);
  const [patientConflict, setPatientConflict] = useState("");
  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);
  const lastHandledAddedPatientAtRef = useRef<number | null>(null);
  const appliedDefaultScheduleKeyRef = useRef<string | null>(null);
  const servicePriceByName = useMemo(() => {
    const prices: Record<string, number> = { ...APPOINTMENT_PRICES };
    serviceOptions.forEach((service) => {
      prices[service.label] = Number(service.price) || 0;
    });
    return prices;
  }, [serviceOptions]);
  const serviceDurationByName = useMemo(() => {
    const durations: Record<string, number> = { ...appointmentTypeDurations };
    serviceOptions.forEach((service) => {
      durations[service.label] = Number(service.duration) || 30;
    });
    return durations;
  }, [serviceOptions]);

  // If a default patient id is provided (e.g., from PatientsView schedule button), preselect it
  useEffect(() => {
    if (appointmentToEdit) return;
    if (defaultPatientId) {
      setSelectedPatient(String(defaultPatientId));
      return;
    }
    // fallback to first patient when patients load
    if (!selectedPatient && patients && patients.length > 0) {
      setSelectedPatient(patients[0].id);
    }
  }, [appointmentToEdit, defaultPatientId, patients, selectedPatient]);

  // Log all available statuses when modal opens
  useEffect(() => {
    if (open && appointmentStatuses && appointmentStatuses.length > 0) {
      console.log('[BookingModal] Available appointment statuses:', appointmentStatuses.map(s => s.value));
    }
  }, [open, appointmentStatuses]);

  useEffect(() => {
    if (!open) {
      appliedDefaultScheduleKeyRef.current = null;
    }
  }, [open]);

  const {
    isPublicBookingMode,
    isStaffBookingMode,
    isPatientLevelBookingMode,
    canCreatePatients,
    canManagePricing,
    canManageStatuses,
    canManagePaymentStatuses,
    isDoctorSelectionLocked,
  } = getBookingActor({
    userRole: effectiveRole,
    bookingMode,
    isEditing: Boolean(appointmentToEdit),
  });
  const publicBlockingAppointments = useMemo(
    () => (isPublicBookingMode ? getCachedPublicBlockingAppointments() : []),
    [
      isPublicBookingMode,
      open,
      selectedDate,
      selectedTime,
      selectedPatient,
      selectedDoctor,
      appointmentToEdit?.id,
    ]
  );

  // Fetch all appointments for the day to check conflicts across all doctors and patients
  useEffect(() => {
    if (!open || !selectedDate) return;
    
    const fetchDailyAppointments = async () => {
      try {
        const dateStr = formatDateToYYYYMMDD(selectedDate);
        if (isPublicBookingMode) {
          const filtered = publicBlockingAppointments.filter(
            (apt: any) =>
              apt.date === dateStr && String(apt.id) !== String(appointmentToEdit?.id || "")
          );
          setDailyAppointments(filtered);
          setPatientAppointments(
            selectedPatient
              ? filtered.filter((apt: any) => String(apt.patientId) === String(selectedPatient))
              : []
          );
          return;
        }

        const res = await fetch(
          apiUrl(`/api/appointments?startDate=${dateStr}&endDate=${dateStr}`),
          { credentials: 'include' }
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            // Exclude cancelled appointments and current appointment being edited
            const filtered = (json.data || []).filter((apt: any) => 
              apt.status !== 'cancelled' && apt.id !== appointmentToEdit?.id
            );
            
            // Group appointments by doctor and status for detailed logging
            const byDoctor: Record<string, any[]> = {};
            const byStatus: Record<string, any[]> = {};
            
            filtered.forEach((apt: any) => {
              // Group by doctor
              if (!byDoctor[apt.doctor]) byDoctor[apt.doctor] = [];
              byDoctor[apt.doctor].push(apt);
              
              // Group by status
              if (!byStatus[apt.status]) byStatus[apt.status] = [];
              byStatus[apt.status].push(apt);
            });
            
            // Log comprehensive schedule information
            console.log('[BookingModal] 📅 DAILY SCHEDULE - ALL APPOINTMENTS:', {
              date: dateStr,
              formattedDate: selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
              totalAppointments: filtered.length,
              
              // Summary by status
              summary: {
                scheduled: byStatus['scheduled']?.length || 0,
                reserved: byStatus['reserved']?.length || 0,
                cart: byStatus[CART_APPOINTMENT_STATUS]?.length || byStatus['pending']?.length || 0,
                completed: byStatus['completed']?.length || 0,
              },
              
              // Detailed breakdown by doctor
              byDoctor: Object.keys(byDoctor).sort().map(doctor => ({
                doctor,
                appointments: byDoctor[doctor].map((apt: any) => ({
                  time: apt.time,
                  duration: `${apt.duration} mins`,
                  endTime: (() => {
                    const [h, m] = (apt.time || '00:00').split(':').map(Number);
                    const end = new Date(selectedDate);
                    end.setHours(h, m + apt.duration, 0, 0);
                    return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                  })(),
                  status: apt.status,
                  patient: apt.patientName,
                  patientId: apt.patientId
                }))
              })),
              
              // Alternative view: all appointments in chronological order
              chronological: filtered
                .sort((a: any, b: any) => {
                  const aTime = a.time.split(':').map(Number);
                  const bTime = b.time.split(':').map(Number);
                  return (aTime[0] * 60 + aTime[1]) - (bTime[0] * 60 + bTime[1]);
                })
                .map((apt: any) => ({
                  time: apt.time,
                  duration: `${apt.duration} mins`,
                  status: apt.status,
                  doctor: apt.doctor,
                  patient: apt.patientName
                }))
            });
            
            setDailyAppointments(filtered);
            
            // Also filter for current patient if one is selected
            if (selectedPatient) {
              const pAppts = filtered.filter((apt: any) => String(apt.patientId) === String(selectedPatient));
              setPatientAppointments(pAppts);
            } else {
              setPatientAppointments([]);
            }
          }
        }
      } catch (err) {
        console.warn("[BookingModal] Could not fetch daily appointments:", err);
      }
    };
    
    fetchDailyAppointments();
  }, [open, selectedDate, selectedPatient, appointmentToEdit?.id, isPublicBookingMode, publicBlockingAppointments]);

  // Read-only for patient viewing their own booked/reserved appointment: only notes editable
  const { isCancelled, canCancelAppointment } = getBookingCancellationConfig({
    appointmentToEdit,
    appointmentStatus,
  });
  const isPatientReadonly = Boolean(appointmentToEdit && user?.role === 'patient');
  const isEditMode = Boolean(appointmentToEdit);
  const isPastAppointmentMode = appointmentCreationMode === "past" && !appointmentToEdit;
  const statusRestrictionDate = selectedDate ?? appointmentToEdit?.date;
  const statusRestrictionTime = selectedTime || appointmentToEdit?.time;
  const isPastStatusRestricted = isPastAppointmentMode || isPastAppointmentSchedule(statusRestrictionDate, statusRestrictionTime);
  const isPublicCachedAppointment = isPublicBookingMode && Boolean(appointmentToEdit?.isPublicCache);
  const canDeleteCancelledAppointment = Boolean(
    appointmentToEdit &&
    isCancelled &&
    !isPatientLevelBookingMode &&
    !isPublicCachedAppointment
  );
  const getLocalPublicAppointmentLogs = useCallback(() => {
    if (!isPublicCachedAppointment || !appointmentToEdit?.id) return [];

    return [
      {
        id: `local_public_log_${appointmentToEdit.id}`,
        appointmentId: appointmentToEdit.id,
        previousState: { status: "none", paymentStatus: "none", price: 0, balance: 0, totalPaid: 0 },
        newState: appointmentToEdit,
        changedBy: "public",
        changedByName: appointmentToEdit.patientName || "Public Patient",
        changedAt: appointmentToEdit.createdAt || appointmentToEdit.cachedAt || appointmentToEdit.updatedAt || new Date().toISOString(),
        changeType: "update",
        amount: appointmentToEdit.totalPaid || 0,
        notes: appointmentToEdit.notes,
      },
    ];
  }, [appointmentToEdit, isPublicCachedAppointment]);

  const getLocalPublicPaymentLogs = useCallback(() => {
    const amount = Number(appointmentToEdit?.totalPaid || 0);
    if (!isPublicCachedAppointment || !appointmentToEdit?.id || amount <= 0) return [];

    return [
      {
        id: `local_public_payment_${appointmentToEdit.id}`,
        appointmentId: appointmentToEdit.id,
        amount,
        paymentDate: appointmentToEdit.paymentDate,
        paymentMethod: appointmentToEdit.paymentMethod || "payment",
        paymentStatus: appointmentToEdit.paymentStatus || "unpaid",
        changedBy: "public",
        changedByName: appointmentToEdit.patientName || "Public Patient",
        changedAt: appointmentToEdit.createdAt || appointmentToEdit.cachedAt || appointmentToEdit.updatedAt || new Date().toISOString(),
        previousBalance: appointmentToEdit.price || 0,
        newBalance: appointmentToEdit.balance || 0,
      },
    ];
  }, [appointmentToEdit, isPublicCachedAppointment]);
  const canEditAppointmentStatus = canManageStatuses && !isPatientReadonly;
  const visibleAppointmentStatuses = useMemo(
    () => (appointmentStatuses || []).filter((status) =>
      effectiveRole === "admin" || String(status.value || "").toLowerCase().trim() !== "deleted"
    ),
    [appointmentStatuses, effectiveRole]
  );
  const { appointmentStatusOptions } = getBookingAppointmentStatusConfig<AppointmentStatusOption>({
    appointmentStatus,
    existingStatus: appointmentToEdit?.status,
    isPastStatusRestricted,
    canManageStatuses,
    statusOptions: visibleAppointmentStatuses,
  });
  const getAppointmentStatusOption = (statusValue: string) =>
    appointmentStatusOptions.find((status) => status.value === statusValue);
  const { paymentStatusOptions } = getBookingPaymentStatusConfig<PaymentStatusOption>({
    paymentStatus,
    existingStatus: appointmentToEdit?.paymentStatus,
    statusOptions: paymentStatuses,
  });
  const getPaymentStatusOption = (statusValue: string) =>
    paymentStatusOptions.find((status) => status.value === statusValue);

  useEffect(() => {
    if (!open || appointmentToEdit || !canCreatePatients || !lastAddedPatient || !lastAddedPatientAt) return;
    if (lastHandledAddedPatientAtRef.current === lastAddedPatientAt) return;

    const patientOption = toPatientOption(lastAddedPatient);
    if (isPublicBookingMode) {
      cachePublicBookingPatient(patientOption);
    }
    setPatients(prev => {
      const filtered = prev.filter((patient: any) => String(patient.id) !== String(patientOption.id));
      return [patientOption, ...filtered];
    });
    setSelectedPatient(patientOption.id);
    lastHandledAddedPatientAtRef.current = lastAddedPatientAt;
  }, [open, appointmentToEdit, canCreatePatients, isPublicBookingMode, lastAddedPatient, lastAddedPatientAt]);

  // Fetch logs when appointment is being edited
  useEffect(() => {
    // Fetch logs for any appointment being edited, including public-cached ones.
    if (open && appointmentToEdit?.id) {
      console.log(`[BookingModal] 🔍 FETCHING LOGS for appointment: ${appointmentToEdit.id}`);
      const fetchLogs = async () => {
        // Add a small delay to ensure backend has finished saving before fetching
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          let url = apiUrl(`/api/appointments/${appointmentToEdit.id}/logs`);
          const publicToken = (appointmentToEdit as any).publicToken || (appointmentToEdit as any).publicAccessToken;
          if (publicToken) url = `${url}?publicToken=${encodeURIComponent(String(publicToken))}`;
          const res = await fetch(url, { credentials: 'include' });
          if (res.ok) {
            const json = await res.json();
            console.log(`[BookingModal] ✅ LOGS FETCHED:`, { 
              count: json.data?.length, 
              logs: json.data 
            });
            if (json.success) {
              const logs = json.data || [];
              setAppointmentLogs(logs.length > 0 ? logs : getLocalPublicAppointmentLogs());
            }
          } else if (res.status === 404) {
            // 404 is expected if logs endpoint doesn't exist or no logs available yet
            console.log(`[BookingModal] ℹ️ No logs available for this appointment`);
            setAppointmentLogs(getLocalPublicAppointmentLogs());
          } else {
            console.warn(`[BookingModal] ⚠️ Failed to fetch logs with status:`, res.status);
            setAppointmentLogs(getLocalPublicAppointmentLogs());
          }
        } catch (err) {
          console.warn("[BookingModal] ⚠️ Could not fetch appointment logs:", err);
          setAppointmentLogs(getLocalPublicAppointmentLogs());
        }
      };
      fetchLogs();
    } else if (!open) {
      setAppointmentLogs([]);
    }
  }, [open, appointmentToEdit, isPublicCachedAppointment, getLocalPublicAppointmentLogs]);

  // Fetch payment logs when appointment is being edited
  useEffect(() => {
    // Fetch payment logs for any appointment being edited, including public-cached ones.
    if (open && appointmentToEdit?.id) {
      const fetchPaymentLogs = async () => {
        // Add a small delay to ensure backend has finished saving before fetching
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          let url = apiUrl(`/api/appointments/${appointmentToEdit.id}/payments`);
          const publicToken = (appointmentToEdit as any).publicToken || (appointmentToEdit as any).publicAccessToken;
          if (publicToken) url = `${url}?publicToken=${encodeURIComponent(String(publicToken))}`;
          const res = await fetch(url, { credentials: 'include' });
          if (res.ok) {
            const json = await res.json();
            if (json.success) {
              const logs = json.data || [];
              setPaymentLogs(logs.length > 0 ? logs : getLocalPublicPaymentLogs());
            }
          } else {
            setPaymentLogs(getLocalPublicPaymentLogs());
          }
        } catch (err) {
          console.warn("[BookingModal] ⚠️ Could not fetch payment logs:", err);
          setPaymentLogs(getLocalPublicPaymentLogs());
        }
      };
      fetchPaymentLogs();
    } else if (!open) {
      setPaymentLogs([]);
    }
  }, [open, appointmentToEdit, isPublicCachedAppointment, getLocalPublicPaymentLogs]);

  // Check if a time + duration combination overlaps with existing appointments for selected doctor
  const checkDurationConflict = useCallback((time: string, durationMins: number): boolean => {
    if (!time || !selectedDate || !selectedDoctor) return false;

    const [hours, minutes] = time.split(':').map(Number);
    const slotStartDate = new Date(selectedDate);
    slotStartDate.setHours(hours, minutes, 0, 0);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMins * 60000);

    // Normalize doctor name for more robust matching (remove "Dr. " prefix and case-insensitive)
    const normalizeName = (name: string) => (name || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();
    const targetDoctor = normalizeName(selectedDoctor);

    // Filter daily appointments for the selected doctor - exclude cart items as they can be overridden
    const doctorAppts = dailyAppointments.filter(apt => 
      normalizeName(apt.doctor) === targetDoctor && 
      !isCartAppointmentStatus(apt.status)
    );
    
    for (const apt of doctorAppts) {
      // Parse the appointment date - it might be YYYY-MM-DD format
      let aptStart: Date;
      if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
        const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
        aptStart = new Date(apt.date);
        aptStart.setHours(aptHours, aptMinutes, 0, 0);
      } else {
        aptStart = new Date(apt.date);
      }
      
      const aptDurationMins = normalizeBookingDuration(apt.duration);
      const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);

      // Check if times overlap
      if (slotStartDate < aptEnd && slotEndDate > aptStart) {
        return true;
      }
    }

    return false;
  }, [selectedDate, selectedDoctor, dailyAppointments]);

  // Get conflict info for a specific duration
  const getDurationConflictInfo = useCallback((durationMins: number): { hasConflict: boolean; conflictTime?: string } => {
    if (!selectedTime || !selectedDate || !selectedDoctor) return { hasConflict: false };
    
    const hasConflict = checkDurationConflict(selectedTime, durationMins);
    if (!hasConflict) return { hasConflict: false };

    // Find the conflicting appointment time
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const slotStartDate = new Date(selectedDate);
    slotStartDate.setHours(hours, minutes, 0, 0);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMins * 60000);

    const normalizeName = (name: string) => (name || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();
    const targetDoctor = normalizeName(selectedDoctor);
    const doctorAppts = dailyAppointments.filter(apt => 
      normalizeName(apt.doctor) === targetDoctor && 
      !isCartAppointmentStatus(apt.status)
    );

    for (const apt of doctorAppts) {
      let aptStart: Date;
      if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
        const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
        aptStart = new Date(apt.date);
        aptStart.setHours(aptHours, aptMinutes, 0, 0);
      } else {
        aptStart = new Date(apt.date);
      }
      
      const aptDurationMins = normalizeBookingDuration(apt.duration);
      const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);
      
      if (slotStartDate < aptEnd && slotEndDate > aptStart) {
        return { 
          hasConflict: true, 
          conflictTime: `${String(aptStart.getHours()).padStart(2, '0')}:${String(aptStart.getMinutes()).padStart(2, '0')}` 
        };
      }
    }

    return { hasConflict: true };
  }, [selectedTime, selectedDate, selectedDoctor, dailyAppointments, checkDurationConflict]);

  // Check if a specific duration option is available (no conflict)
  const isDurationAvailable = useCallback((durationMins: number): boolean => {
    if (!selectedTime) return true;
    return !checkDurationConflict(selectedTime, durationMins);
  }, [selectedTime, checkDurationConflict]);

  // Update conflict status when duration changes
  useEffect(() => {
    if (!selectedTime || !selectedDoctor) {
      setDurationConflict("");
      return;
    }

    const durationMins = normalizeBookingDuration(duration);
    const conflict = getDurationConflictInfo(durationMins);
    
    if (conflict.hasConflict) {
      setDurationConflict(`Conflicts with appointment at ${conflict.conflictTime || 'this time'}`);
    } else {
      setDurationConflict("");
    }

    // Log available durations when time is set
    const availableDurations = ALLOWED_BOOKING_DURATIONS.filter(dur => isDurationAvailable(dur));
    const unavailableDurations = ALLOWED_BOOKING_DURATIONS.filter(dur => !isDurationAvailable(dur));
    
    console.log('[BookingModal] ⏱️ DURATION AVAILABILITY AT TIME:', {
      doctor: selectedDoctor,
      date: selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      selectedTime: selectedTime,
      currentDuration: `${durationMins} mins`,
      availableDurations: availableDurations.length > 0 ? availableDurations.map(d => `${d} mins`) : '❌ NONE',
      unavailableDurations: unavailableDurations.length > 0 ? unavailableDurations.map(d => `${d} mins`) : 'None',
      
      // DEBUG: Show all doctor appointments being checked
      debugDoctorAppts: dailyAppointments
        .filter(apt => (apt.doctor || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim() === (selectedDoctor || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim())
        .map(apt => ({ time: apt.time, duration: apt.duration, status: apt.status, patient: apt.patientName })),
      
      // Show which appointments are blocking each unavailable duration
      blockedBy: unavailableDurations.length > 0 ? unavailableDurations.map(dur => {
        const [hours, minutes] = selectedTime.split(':').map(Number);
        const slotStart = new Date(selectedDate);
        slotStart.setHours(hours, minutes, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + dur * 60000);
        
        const normalizeName = (name: string) => (name || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();
        const targetDoctor = normalizeName(selectedDoctor);
    const doctorAppts = dailyAppointments.filter(apt => 
      normalizeName(apt.doctor) === targetDoctor && 
      !isCartAppointmentStatus(apt.status)
    );
        
        const blockingAppts = doctorAppts.filter((apt: any) => {
          let aptStart: Date;
          if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
            const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
            aptStart = new Date(apt.date);
            aptStart.setHours(aptHours, aptMinutes, 0, 0);
          } else {
            aptStart = new Date(apt.date);
          }
          const aptDurationMins = normalizeBookingDuration(apt.duration);
          const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);
          return slotStart < aptEnd && slotEnd > aptStart;
        });
        
        return {
          duration: `${dur} mins`,
          blocked: blockingAppts.length > 0,
          blockingAppointments: blockingAppts.map((apt: any) => ({
            time: apt.time,
            duration: `${apt.duration} mins`,
            status: apt.status,
            patient: apt.patientName
          }))
        };
      }) : []
    });
  }, [duration, selectedTime, getDurationConflictInfo, isDurationAvailable, selectedDoctor, selectedDate, dailyAppointments]);

  // Check if patient has a conflicting appointment at the selected time
  const checkPatientConflict = useCallback((time: string, durationMins: number): boolean => {
    if (!time || !selectedDate) return false;

    const [hours, minutes] = time.split(':').map(Number);
    const slotStartDate = new Date(selectedDate);
    slotStartDate.setHours(hours, minutes, 0, 0);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMins * 60000);

    for (const apt of patientAppointments) {
      let aptStart: Date;
      if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
        const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
        aptStart = new Date(apt.date);
        aptStart.setHours(aptHours, aptMinutes, 0, 0);
      } else {
        aptStart = new Date(apt.date);
      }
      
      const aptDurationMins = normalizeBookingDuration(apt.duration);
      const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);

      // Check if times overlap
      if (slotStartDate < aptEnd && slotEndDate > aptStart) {
        return true;
      }
    }

    return false;
  }, [selectedDate, patientAppointments]);

  // Get conflict info for patient
  const getPatientConflictInfo = useCallback(() => {
    if (!selectedTime || !selectedDate || !selectedPatient) return { hasConflict: false };

    if (patientAppointments.length > 0) {
      return {
        hasConflict: true,
        conflictMessage: 'Selected patient already has an appointment on this date. Only one appointment is allowed per patient per day.',
      };
    }
    
    const durationMins = normalizeBookingDuration(duration);
    const hasConflict = checkPatientConflict(selectedTime, durationMins);
    if (!hasConflict) return { hasConflict: false };

    // Find the conflicting appointment
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const slotStartDate = new Date(selectedDate);
    slotStartDate.setHours(hours, minutes, 0, 0);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMins * 60000);

    for (const apt of patientAppointments) {
      let aptStart: Date;
      if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
        const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
        aptStart = new Date(apt.date);
        aptStart.setHours(aptHours, aptMinutes, 0, 0);
      } else {
        aptStart = new Date(apt.date);
      }
      
      const aptDurationMins = normalizeBookingDuration(apt.duration);
      const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);
      
      if (slotStartDate < aptEnd && slotEndDate > aptStart) {
        return { 
          hasConflict: true, 
          conflictTime: `${String(aptStart.getHours()).padStart(2, '0')}:${String(aptStart.getMinutes()).padStart(2, '0')}`,
          conflictDoctor: apt.doctor || 'Another Doctor'
        };
      }
    }

    return { hasConflict: true };
  }, [selectedTime, selectedDate, duration, checkPatientConflict, patientAppointments]);

  // Update conflict status when patient, time, or duration changes
  useEffect(() => {
    if (!selectedTime || !selectedPatient) {
      setPatientConflict("");
      return;
    }

    // Get the selected patient's name
    const selectedPatientObj = patients.find(p => String(p.id) === String(selectedPatient));
    const selectedPatientName = selectedPatientObj?.name || 'Patient';

    const conflict = getPatientConflictInfo();
    
    if (conflict.hasConflict) {
      if (conflict.conflictMessage) {
        setPatientConflict(conflict.conflictMessage);
      } else {
        setPatientConflict(`${selectedPatientName} has appointment with ${conflict.conflictDoctor} at ${conflict.conflictTime}`);
      }
    } else {
      setPatientConflict("");
    }
  }, [selectedPatient, selectedTime, duration, patients, getPatientConflictInfo]);

  // Compute which patients have conflicts for the selected time/duration/date
  const computePatientConflicts = useCallback((): Set<string> => {
    if (!selectedTime || !selectedDate) return new Set();
    
    const durationMins = normalizeBookingDuration(duration);
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const slotStartDate = new Date(selectedDate);
    slotStartDate.setHours(hours, minutes, 0, 0);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMins * 60000);

    const conflictingPatientIds = new Set<string>();

    // For each appointment in dailyAppointments, check if it overlaps with our selected time slot
    for (const apt of dailyAppointments) {
      if (isCartAppointmentStatus(apt.status)) continue;
      let aptStart: Date;
      if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
        const [aptHours, aptMinutes] = (apt.time || '00:00').split(':').map(Number);
        aptStart = new Date(apt.date);
        aptStart.setHours(aptHours, aptMinutes, 0, 0);
      } else {
        aptStart = new Date(apt.date);
      }
      
      const aptDurationMins = normalizeBookingDuration(apt.duration);
      const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);
      
      if (slotStartDate < aptEnd && slotEndDate > aptStart) {
        if (apt.patientId) {
          conflictingPatientIds.add(String(apt.patientId));
        }
      }
    }

    return conflictingPatientIds;
  }, [selectedTime, selectedDate, duration, dailyAppointments]);

  const patientConflictSet = useMemo(() => computePatientConflicts(), [computePatientConflicts]);

  // Update duration when appointment type changes - always reset to default when type changes
  useEffect(() => {
    if (!appointmentType) {
      setDuration("");
      return;
    }
    // Always set default duration when appointment type changes
    const defaultDur = normalizeBookingDuration(serviceDurationByName[appointmentType]);
    setDuration(String(defaultDur));
  }, [appointmentType, serviceDurationByName]);

  useEffect(() => {
    setSelectedDate(getBookingDefaultDate(defaultDate));
  }, [defaultDate]);

  useEffect(() => {
    setSelectedTime(getBookingDefaultTime(defaultTime));
  }, [defaultTime]);

  // Debug: log incoming default patient id when prop changes
  useEffect(() => {
    if (defaultPatientId) {
      console.log('[BookingModal] 🔔 defaultPatientId prop received:', defaultPatientId);
    } else {
      console.log('[BookingModal] 🔔 no defaultPatientId provided');
    }
  }, [defaultPatientId]);

  // Sync doctorName prop to selectedDoctor state when it changes
  useEffect(() => {
    if (doctorName) {
      setSelectedDoctor(doctorName);
    }
  }, [doctorName]);

  // Auto-preselect first doctor for non-doctor portals when modal opens
  // BUT: Skip if doctorName was explicitly passed (e.g., from DoctorAvailabilityView)
  useEffect(() => {
    if (!open) return;

    // If a specific doctorName prop was provided, honor it
    if (doctorName) {
      console.log('[BookingModal] 📋 Using doctorName prop for preselection');
      setSelectedDoctor(doctorName);
      return;
    }

    // If the logged-in user is a doctor, preselect them as the doctor for the booking
    if (user?.role === 'doctor') {
      const docName = (user as any)?.username || (user as any)?.name || '';
      if (docName) {
        console.log('[BookingModal] 🩺 Preselecting logged-in doctor:', docName);
        setSelectedDoctor(docName);
      }
      return;
    }

    // Only auto-preselect if no doctor is currently selected
    if (selectedDoctor) return;

    // Only auto-preselect if editing an appointment (use doctor from appointment)
    if (appointmentToEdit?.doctor) return;

    // Auto-preselect first available doctor (only when NO doctorName prop passed)
    if (doctors && doctors.length > 0) {
      console.log('[BookingModal] 🏥 Auto-selecting first available doctor');
      setSelectedDoctor(doctors[0].name);
    }
  }, [open, user?.role, user?.username, doctors, selectedDoctor, appointmentToEdit?.doctor, doctorName]);

  // Determine which doctors should be visible/selectable.
  // For doctor users, prefer showing only the logged-in doctor's record if it exists.
  const visibleDoctors = (() => {
    if (user?.role === 'doctor') {
      const docKey = (user as any)?.username || (user as any)?.name || '';
      const filtered = (doctors || []).filter((d: any) => normalizeDoctorName(d.name) === normalizeDoctorName(docKey));
      return filtered.length > 0 ? filtered : (doctors || []);
    }
    return doctors || [];
  })();

  // Run auto-preselection logic. Once a date/time exists, schedule is authoritative:
  // doctor selection may surface conflicts, but it must not jump to another slot.
  const runAutoPreselect = useCallback(async (patientId?: string) => {
    const autoPreselect = getBookingAutoPreselectConfig({
      isEditing: Boolean(appointmentToEdit),
      defaultDate,
      defaultTime,
      selectedTime,
      appointmentType,
      selectedDoctor,
      selectedPatient,
      defaultPatientId,
      patientId,
      appointmentTypeDurations: serviceDurationByName,
    });

    if (autoPreselect.type === "skip") return;

    if (!appointmentType) setAppointmentType(autoPreselect.defaultAppointmentType);

    if (autoPreselect.type === "preserve_schedule") return;

    if (autoPreselect.type === "wait_for_doctor") {
      console.log('[BookingModal] Waiting for doctor to be selected before auto-preselect...');
      return;
    }

    if (isPublicBookingMode) {
      return;
    }

    const nextSlot = await findNextAvailableBookingSlot({
      startDate: new Date(),
      doctorToCheck: autoPreselect.doctorToSearch,
      durationToCheck: autoPreselect.durationToSearch,
      patientToCheck: autoPreselect.patientToSearch,
      timeSlots: TIME_SLOTS,
    });

    if (nextSlot) {
      setSelectedDate(nextSlot.date);
      setSelectedTime(nextSlot.time);
      console.log('[BookingModal] Auto-preselected slot:', { date: formatDateToYYYYMMDD(nextSlot.date), time: nextSlot.time });
    }
  }, [appointmentToEdit, defaultDate, defaultTime, appointmentType, selectedDoctor, selectedPatient, defaultPatientId, selectedTime, isPublicBookingMode, serviceDurationByName]);

  const runAutoPreselectRef = useRef(runAutoPreselect);

  useEffect(() => {
    runAutoPreselectRef.current = runAutoPreselect;
  }, [runAutoPreselect]);

  // Auto-preselect date, time, and appointment type for all portals
  useEffect(() => {
    const defaultScheduleAction = getBookingDefaultScheduleAction({
      open,
      isEditing: Boolean(appointmentToEdit),
      defaultDate,
      defaultTime,
      doctorName,
      appliedScheduleKey: appliedDefaultScheduleKeyRef.current,
    });

    if (defaultScheduleAction.type === "apply") {
      if (defaultScheduleAction.source === "doctor_availability") {
        console.log('[BookingModal] 📍 DoctorAvailabilityView context detected');
        console.log('[BookingModal] ℹ️ Pre-filled with: date=' + formatDateToYYYYMMDD(defaultScheduleAction.date) + ', time=' + defaultScheduleAction.time + ', doctor=' + defaultScheduleAction.doctorName);
      } else {
        console.log('[BookingModal] 📍 Using explicitly passed date/time:', {
          date: formatDateToYYYYMMDD(defaultScheduleAction.date),
          time: defaultScheduleAction.time,
          source: 'clicked_slot'
        });
      }

      if (!appointmentType) setAppointmentType("Routine Cleaning");

      if (defaultScheduleAction.shouldApplySchedule) {
        setSelectedDate(defaultScheduleAction.date);
        setSelectedTime(defaultScheduleAction.time);
        appliedDefaultScheduleKeyRef.current = defaultScheduleAction.scheduleKey;
      }
      return;
    }

    if (!open || appointmentToEdit) return; // Only for new appointments, not editing

    // CASE 3: New appointment modal (no defaults at all)
    if (selectedTime) return;

    // Preselect first appointment type
    if (!appointmentType) {
      console.log('[BookingModal] 📋 Preselecting appointment type: Routine Cleaning');
      setAppointmentType("Routine Cleaning");
    }
    
    runAutoPreselect();
  }, [open, appointmentToEdit, defaultDate, defaultTime, doctorName, selectedTime, runAutoPreselect, appointmentType]);

  // Price calculations - handle custom types
  // finalPrice is the base price (before discount) - used in payment calculations
  const basePrice = appointmentType === "Other" ? Number(customPrice) : (servicePriceByName[appointmentType] || 0);
  const finalPrice = Number(customPrice) > 0 ? Number(customPrice) : basePrice;

  // Log appointment type changes with price
  useEffect(() => {
    if (appointmentType) {
      const basePriceLog = servicePriceByName[appointmentType] || 0;
      console.log(`[BookingModal] Appointment Type Changed:`, {
        event: 'appointmentTypeChanged',
        type: appointmentType,
        basePrice: basePriceLog,
        duration: duration,
        userRole: user?.role,
        timestamp: new Date().toISOString()
      });
      // Reset custom price when appointment type changes (unless in edit mode)
      if (!isEditMode) {
        setCustomPrice("0");
      }
    }
  }, [appointmentType, user?.role, duration, isEditMode, servicePriceByName]);

  useEffect(() => {
    if (!open) return;
    // fetch patients based on role - rely on server-side filtering for patient role
    const fetchPatients = async () => {
      setIsLoadingPatients(true);
      try {
        if (isPublicBookingMode) {
          const cachedPatients = getCachedPublicBookingPatients().map(toPatientOption);
          setPatients(cachedPatients);

          if (cachedPatients.length > 0) {
            const foundDefault = defaultPatientId
              ? cachedPatients.find((p: any) => String(p.id) === String(defaultPatientId))
              : null;
            setSelectedPatient((current) => current || foundDefault?.id || cachedPatients[0].id);
          }

          setIsLoadingPatients(false);
          return;
        }

        const fetchOpts: RequestInit = { credentials: 'include' };
        
        // Always fetch from /api/patients - server will filter based on requester role
        const res = await fetch(apiUrl(`/api/patients?limit=1000`), fetchOpts);
        
        if (!res.ok) {
          console.error('BookingModal: fetch failed', { status: res.status, statusText: res.statusText });
          setIsLoadingPatients(false);
          return;
        }
        
        const json = await res.json();
        console.log('BookingModal: fetch response', { success: json?.success, dataCount: json?.data?.length, user: { username: user?.username, role: user?.role } });
        
        if (json?.success && Array.isArray(json.data)) {
          let list = json.data.map(toPatientOption);
          const editPatientId = appointmentToEdit?.patientId ? String(appointmentToEdit.patientId) : "";

          if (editPatientId && !list.some((p: any) => String(p.id) === editPatientId)) {
            try {
              const patientRes = await fetch(apiUrl(`/api/patients/${encodeURIComponent(editPatientId)}`), fetchOpts);
              const patientJson = await patientRes.json();
              if (patientJson?.success && patientJson.data) {
                list = [toPatientOption(patientJson.data), ...list];
              }
            } catch (patientErr) {
              console.warn('[BookingModal] Failed to fetch appointment patient; using appointment snapshot:', patientErr);
            }

            if (!list.some((p: any) => String(p.id) === editPatientId)) {
              list = [
                toPatientOption({
                  id: editPatientId,
                  name: appointmentToEdit.patientName || 'Patient',
                }),
                ...list,
              ];
            }
          }
          console.log('BookingModal: patients loaded', { 
            count: list.length, 
            source: user?.role === 'patient' ? 'server-filtered' : 'admin-fetch',
            allIds: list.slice(0, 3).map((p: any) => ({ id: p.id, type: typeof p.id, name: p.name }))
          });
          try { window.dispatchEvent(new CustomEvent('bookingmodal:patients', { detail: { source: user?.role === 'patient' ? 'server-filtered' : 'admin-fetch', count: list.length, patients: list } })); } catch {}
          setPatients(list);
          // Edit/view mode must always use the appointment patient, never the default/first patient.
          let chosenPatientId: string | undefined = undefined;
          if (editPatientId) {
            chosenPatientId = editPatientId;
          } else if (defaultPatientId) {
            const found = list.find((p: any) => String(p.id) === String(defaultPatientId));
            if (found) chosenPatientId = String(defaultPatientId);
            else if (list.length > 0) chosenPatientId = list[0].id;
          } else if (list.length > 0) {
            chosenPatientId = list[0].id;
          }

          if (chosenPatientId) {
            setSelectedPatient(chosenPatientId);
            if (!appointmentToEdit) {
              // Revalidate once the patient is known so patient conflicts affect preselection.
              runAutoPreselectRef.current(chosenPatientId).catch((err) => {
                console.warn('[BookingModal] Failed to validate schedule after patient load:', err);
              });
            }
          }
        } else {
          console.warn('BookingModal: empty or failed response', json);
          setPatients([]);
        }
      } catch (err) {
        console.error('Failed to fetch patients for booking modal', err);
        setPatients([]);
      } finally {
        setIsLoadingPatients(false);
      }
    };

    fetchPatients();
  }, [open, user, defaultPatientId, appointmentToEdit, isPublicBookingMode]);

  // When an appointment is provided for editing, prefill the form
  useEffect(() => {
    if (appointmentToEdit) {
      console.log('[BookingModal] 📂 OPENING APPOINTMENT FOR EDITING:', {
        appointmentId: appointmentToEdit.id,
        patientName: appointmentToEdit.patientName,
        currentStatus: appointmentToEdit.status,
        currentPaymentStatus: appointmentToEdit.paymentStatus,
        totalPaid: appointmentToEdit.totalPaid,
        balance: appointmentToEdit.balance,
        logsCount: appointmentLogs.length,
        paymentLogsCount: paymentLogs.length,
        timestamp: new Date().toISOString()
      });

      setSelectedPatient(String(appointmentToEdit.patientId || appointmentToEdit.patientId));
      // Use getAppointmentTypeName to convert type index to string name
      // This handles both standard types (0-5) and custom type (6 with customType)
      const typeName = getAppointmentTypeName(appointmentToEdit.type, appointmentToEdit.customType);
      console.log('[BookingModal Edit] Converted appointment type:', {
        type: appointmentToEdit.type,
        customType: appointmentToEdit.customType,
        convertedTypeName: typeName
      });

      // If it's a custom type (type 6), set appointmentType to "Other"
      // This ensures the Select matches "Other" and custom fields are shown
      if (appointmentToEdit.type === 6) {
        setAppointmentType("Other");
        setCustomAppointmentTypeName(appointmentToEdit.customType || "");
      } else {
        setAppointmentType(typeName);
      }
      
      // Always set the stored price (whether custom or standard type)
      setCustomPrice(String(appointmentToEdit.price || 0));
      setDuration(String(normalizeBookingDuration(appointmentToEdit.duration)));
      // Prefill discount if it exists in the appointment (from discount field)
      setDiscount(String(appointmentToEdit.discount || 0));
  // For both editing and creating via the BookingModal we intentionally
  // clear the notes field so the modal opens with an empty notes input.
  // Notes from history remain visible in the AppointmentHistoryView below,
  // but they are not auto-copied into the editable notes field.
  setNotes('');
      setTreatmentNotes(getBookingTreatmentNotesValue(appointmentToEdit));
      setSelectedDate(getBookingEditDate({ appointmentDate: appointmentToEdit.date, defaultDate }));
      setSelectedTime(getBookingEditTime({ appointmentTime: appointmentToEdit.time, defaultTime }));
      // Set doctor from the appointment
      if (appointmentToEdit.doctor) {
        setSelectedDoctor(appointmentToEdit.doctor);
      }
      // For editing, initialize payment amount to empty so user enters NEW payment amount
      setAmountToPay('0');
      setPaymentDate(getDefaultBookingPaymentDate());
      setAppointmentStatus(appointmentToEdit.status || 'scheduled');
      setPaymentStatus(appointmentToEdit.paymentStatus || 'unpaid');
      setPaymentMethod(appointmentToEdit.paymentMethod || '');
      // Reset the flag when opening for edit
      setStatusChangedByUser(0);
      setPaymentStatusChangedByUser(0);
      // Set the modal step based on isPaymentFlow flag or if we are editing
      // Only skip to payment step if explicitly marked as payment flow (e.g., "Pay Now" click)
      // or if we are viewing/editing an existing appointment
      setModalStep(isPaymentFlow || appointmentToEdit ? 'payment' : 'details');
      setIsRescheduling(false);
    } else {
      // Reset form when creating new appointment
      // If a defaultPatientId was provided (e.g., user clicked Schedule on a patient), prefer it
      setSelectedPatient(defaultPatientId ? String(defaultPatientId) : '');
      setAppointmentType('');
      setCustomAppointmentTypeName('');
      setDuration('30');
      setDiscount('0');
      setCustomPrice('0');
      setNotes('');
      setTreatmentNotes('');
      setSelectedDate(getBookingCreateDate({ defaultDate, isPastAppointmentMode }));
      setSelectedTime(getBookingCreateTime(defaultTime));
      setAmountToPay('0');
      setPaymentDate(getDefaultBookingPaymentDate());
      setAppointmentStatus(isPastAppointmentMode ? 'tbd' : 'scheduled');
      setPaymentStatus('unpaid');
      setPaymentMethod('');
      // Reset the flag when opening for new appointment
      setStatusChangedByUser(0);
      setPaymentStatusChangedByUser(0);
      setModalStep('details');
    }
  }, [open, appointmentToEdit, defaultDate, defaultTime, defaultPatientId, isPastAppointmentMode]);

  // Derived display values for schedule block
  const displayDoctor = formatDoctorName(selectedDoctor || appointmentToEdit?.doctor || doctorName);
  
  // Calculate remaining balance for display in payment step
  const previouslyPaidAmount = appointmentToEdit?.totalPaid !== undefined 
    ? appointmentToEdit.totalPaid 
    : (appointmentToEdit?.price !== undefined && appointmentToEdit?.balance !== undefined)
      ? Math.max(0, appointmentToEdit.price - appointmentToEdit.balance)
      : 0;
  const discountedPrice = Math.max(0, finalPrice - Number(discount));
  const remainingBalance = Math.max(0, discountedPrice - previouslyPaidAmount);
  const paymentAmountNow = paymentMethod === "Pay at Clinic" ? 0 : (parseFloat(amountToPay) || 0);
  const isOverpay = paymentMethod !== "Pay at Clinic" && paymentAmountNow > remainingBalance;
  const bookingConflictWarnings = getBookingConflictWarnings({
    durationConflict,
    patientConflict,
    duration,
  });
  const bookingConflictTitle = bookingConflictWarnings.map(w => w.message).join('\n');

  useBookingPaymentPrefill({
    open,
    modalStep,
    amountToPay,
    remainingBalance,
    setAmountToPay,
  });

  const { handleNextStep } = useSharedBookingLogic({
    modalStep,
    flow: 'details-payment',
    selectedPatient,
    selectedDate,
    selectedTime,
    appointmentType,
    customAppointmentTypeName,
    selectedDoctor,
    setModalStep: (step) => setModalStep(step as "details" | "payment"),
    setIsConfirmSummaryOpen,
    toast,
    durationConflict,
    patientConflict,
    patientDateConflict: patientAppointments.length > 0 && selectedPatient ? `${selectedPatient} already has an appointment on this date. Only one appointment is allowed per patient per day.` : undefined,
    allowConflictSummary: true,
    scheduleMode: isPastAppointmentMode ? 'past' : 'standard',
  });

  // Handler for status changes that sets the flag
  const handleStatusChange = (newStatus: string) => {
    if (isPastStatusRestricted && !PAST_APPOINTMENT_STATUS_VALUES.includes(newStatus as typeof PAST_APPOINTMENT_STATUS_VALUES[number])) {
      toast.error("Past appointments can only be Cancelled, Completed, or TBD.");
      return;
    }

    if (canManageStatuses && isCartAppointmentStatus(newStatus)) {
      toast.error("Add to Cart is reserved for patient carts.");
      return;
    }
    setAppointmentStatus(newStatus);
    setStatusChangedByUser(1);
  };

  const handlePaymentStatusChange = (newStatus: string) => {
    setPaymentStatus(newStatus as any);
    setPaymentStatusChangedByUser(1);
  };

  // First step: validate details and move to payment
  const handleConfirmBooking = async () => {
    setIsBooking(true);
    try {
      handleNextStep();
    } catch (err) {
      console.error('Booking: details error', err);
    } finally {
      setIsBooking(false);
    }
  };

  const validatePaymentDateForAmount = (amount: number) => {
    if (amount <= 0) return true;

    const normalizedDate = normalizeBookingPaymentDate(paymentDate);
    if (!normalizedDate) {
      toast.error("Please choose the date the payment was made.");
      return false;
    }

    if (isFutureBookingPaymentDate(normalizedDate)) {
      toast.error("Payment date cannot be in the future.");
      return false;
    }

    if (normalizedDate !== paymentDate) setPaymentDate(normalizedDate);
    return true;
  };

  // Second step: show summary confirmation before saving
  const handleConfirmPayment = async () => {
    // Prevent overpayment: do not proceed if entered amount exceeds remaining balance
    const amountRaw = amountToPay.trim() === '' ? '0' : amountToPay;
    const amount = paymentMethod === "Pay at Clinic" ? 0 : (parseFloat(amountRaw) || 0);
    if (amount > remainingBalance) {
      toast.error(`Amount exceeds remaining balance. Maximum allowed: ₱${remainingBalance.toLocaleString()}`);
      return;
    }

    if (!validatePaymentDateForAmount(amount)) return;

    handleNextStep();
  };

  // Calculate what the final status will be for display in summary
  const getProjectedStatus = () => {
    if (isPastStatusRestricted) {
      return normalizePastAppointmentStatus(appointmentStatus || appointmentToEdit?.status);
    }

    const amountPaidRaw = amountToPay.trim() === '' ? '0' : amountToPay;
    const amountPaid = parseFloat(amountPaidRaw) || 0;

    return getProjectedBookingStatus({
      userRole: effectiveRole,
      bookingMode,
      isEditing: Boolean(appointmentToEdit),
      statusChangedByUser: statusChangedByUser === 1,
      selectedStatus: appointmentStatus,
      existingStatus: appointmentToEdit?.status,
      amountPaid,
      previouslyPaidAmount,
      totalPrice: discountedPrice,
    });
  };

  // Calculate what the final payment status will be for display in summary
  const getFinalPaymentStatus = () => {
    const amountPaidRaw = amountToPay.trim() === '' ? '0' : amountToPay;
    const amountPaid = paymentMethod === "Pay at Clinic" ? 0 : (parseFloat(amountPaidRaw) || 0);

    return getProjectedPaymentStatus({
      paymentMethod,
      statusChangedByUser: paymentStatusChangedByUser === 1,
      selectedStatus: paymentStatus,
      existingStatus: appointmentToEdit?.paymentStatus,
      amountPaid,
      previouslyPaidAmount,
      totalPrice: discountedPrice,
    });
  };

  // Calculate the FINAL appointment status
  const getFinalAppointmentStatus = () => {
    return getProjectedStatus();
  };

  const getRepeatTargetDate = (repeatPayload?: { repeatOption: string; customRepeatDate?: string }) => {
    const repeatOptionValue = repeatPayload?.repeatOption || "do-not-repeat";
    if (repeatOptionValue === "do-not-repeat") return null;

    const baseDate = new Date(selectedDate);
    const target = new Date(baseDate);

    switch (repeatOptionValue) {
      case "next-week":
        target.setDate(baseDate.getDate() + 7);
        return target;
      case "next-month":
        target.setMonth(baseDate.getMonth() + 1);
        return target;
      case "3-months":
        target.setMonth(baseDate.getMonth() + 3);
        return target;
      case "custom":
        if (!repeatPayload?.customRepeatDate) return null;
        const parsed = new Date(repeatPayload.customRepeatDate);
        return isNaN(parsed.getTime()) ? null : parsed;
      default:
        return null;
    }
  };

  const getFollowUpLogNotes = (followUpTargetDate: Date) => {
    return `Follow-up appointment created for ${followUpTargetDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}.`;
  };

  const buildRepeatAppointmentNotes = (baseNotes: string, sourceDate: Date, nextDate: Date) => {
    const repeatDateLabel = nextDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    const repeatNote = `Repeats on ${repeatDateLabel}`;
    const trimmed = String(baseNotes || "").trim();
    return trimmed ? `${trimmed}\n${repeatNote}` : repeatNote;
  };

  const buildFollowUpAppointmentNotes = (baseNotes: string, sourceDate: Date, sourceDateForLabel: Date) => {
    const sourceDateLabel = sourceDateForLabel.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    const followUpNote = `Created as a repeating schedule from ${sourceDateLabel}`;
    const trimmed = String(baseNotes || "").trim();
    return trimmed ? `${trimmed}\n${followUpNote}` : followUpNote;
  };

  const saveFollowUpAppointment = async ({
    followUpDate,
    followUpStatus,
    targetDoctor,
    targetPatientRecord,
    bookingDuration: followUpDuration,
    treatmentNotesUpdate: followUpTreatmentNotesUpdate,
  }: {
    followUpDate: Date;
    followUpStatus: string;
    targetDoctor: string;
    targetPatientRecord?: any;
    bookingDuration: number;
    treatmentNotesUpdate: any;
  }) => {
    const followUpDateStr = formatDateToYYYYMMDD(followUpDate);
    const followUpPayload: any = {
      patientId: selectedPatient,
      patientName: targetPatientRecord?.name || selectedPatient,
      doctor: targetDoctor || "",
      date: followUpDateStr,
      time: selectedTime,
      type: getAppointmentTypeIndex(appointmentType),
      customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
      duration: followUpDuration,
      price: finalPrice,
      discount: Number(discount) || 0,
      notes: buildFollowUpAppointmentNotes(notes, selectedDate, followUpDate),
      ...followUpTreatmentNotesUpdate,
      status: followUpStatus as any,
      paymentStatus: "unpaid",
      paymentMethod: "",
      totalPaid: 0,
      balance: discountedPrice,
      logNotes: getFollowUpLogNotes(followUpDate),
    };

    try {
      if (isPublicBookingMode) {
        if (isCartAppointmentStatus(followUpStatus)) {
          await createPublicBookingAppointment(followUpPayload);
        } else {
          const resp = await fetch(apiUrl("/api/appointments/public-book"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              firstName: targetPatientRecord?.firstName || "",
              lastName: targetPatientRecord?.lastName || "",
              email: targetPatientRecord?.email || "",
              phone: targetPatientRecord?.phone || "",
              patientId: targetPatientRecord?.id,
              ...followUpPayload,
            }),
          });
          const json = await resp.json();
          if (!resp.ok || !json.success) {
            throw new Error(json?.message || "Failed to create follow-up appointment");
          }
        }
      } else {
        await addAppointment(followUpPayload);
      }
      toast.success("Follow-up appointment saved successfully.");
    } catch (repeatError) {
      console.error("Failed to save follow-up appointment:", repeatError);
      toast.error("Could not save the follow-up appointment. Please try again.");
    }
  };

  // Final step: save after confirmation
  const handleConfirmSummary = async (repeatPayload?: { repeatOption: string; customRepeatDate?: string }) => {
    if (!selectedPatient || !appointmentType) return;
    
    const repeatTargetDate = getRepeatTargetDate(repeatPayload);
    
    // Log the current state and history logs before submitting
    console.log('[BookingModal] 🚀 SUBMITTING APPOINTMENT:', {
      mode: appointmentToEdit ? 'EDIT' : 'CREATE',
      appointmentId: appointmentToEdit?.id,
      patientId: selectedPatient,
      type: appointmentType,
      date: formatDateToYYYYMMDD(selectedDate),
      time: selectedTime,
      price: finalPrice,
      treatmentNotes,
      payment: {
        amountToPay,
        method: paymentMethod,
        previouslyPaid: previouslyPaidAmount,
        remaining: remainingBalance,
      },
      historyLogs: appointmentLogs,
      timestamp: new Date().toISOString(),
    });

    setIsBooking(true);
    setIsConfirmSummaryOpen(false);
    try {
      const dateStr = formatDateToYYYYMMDD(selectedDate);
      const bookingDuration = normalizeBookingDuration(duration);
      const treatmentNotesUpdate = buildBookingTreatmentNotesPayload(treatmentNotes);
      const originalAppointmentNotes = repeatTargetDate
        ? buildRepeatAppointmentNotes(notes, selectedDate, repeatTargetDate)
        : notes;
      
      // Handle "Pay at Clinic" - set amount to pay as 0
      let amountPaidRaw = amountToPay.trim() === '' ? '0' : amountToPay;
      if (paymentMethod === "Pay at Clinic") {
        amountPaidRaw = '0';
      }
      const amountPaid = parseFloat(amountPaidRaw) || 0;

      // Final validation: prevent overpayment
      if (amountPaid > remainingBalance) {
        toast.error(`Amount exceeds remaining balance. Maximum allowed: ₱${remainingBalance.toLocaleString()}`);
        setIsBooking(false);
        return;
      }

      const paymentDatePayload = amountPaid > 0 ? normalizeBookingPaymentDate(paymentDate) : "";
      if (!validatePaymentDateForAmount(amountPaid) || (amountPaid > 0 && !paymentDatePayload)) {
        setIsBooking(false);
        return;
      }

      console.log('[BookingModal Payment] Payment confirmation:', {
        amountToPay,
        amountPaidRaw,
        amountPaid,
        paymentMethod,
        paymentDate: paymentDatePayload || undefined,
        finalPrice,
        parsing: {
          trimmed: amountToPay.trim(),
          parseFloat: parseFloat(amountPaidRaw),
        }
      });

      if (appointmentToEdit) {
        // update existing appointment
        // If editing, ADD the new payment to existing totalPaid (only if amountPaid > 0)
        const previouslyPaid = appointmentToEdit.totalPaid || 0;
        const newTotalPaid = amountPaid > 0 ? previouslyPaid + amountPaid : previouslyPaid;
        const newBalance = Math.max(0, discountedPrice - newTotalPaid);

        console.log('[BookingModal Payment] Updating appointment:', {
          appointmentId: appointmentToEdit.id,
          previouslyPaid,
          newPayment: amountPaid,
          newTotalPaid,
          newBalance,
        });

        // Determine payment status
        const updatePaymentStatus = getFinalPaymentStatus();
        
        // Determine appointment status using the new function that includes override logic
        const updateAppointmentStatus = getFinalAppointmentStatus();

        const selectedPatientRecord = patients.find(p => String(p.id) === String(selectedPatient));
        const updated = isPublicCachedAppointment
          ? cachePublicBookingAppointment({
              ...appointmentToEdit,
              patientId: selectedPatient,
              patientName: selectedPatientRecord?.name || appointmentToEdit.patientName || selectedPatient,
              publicPatient: selectedPatientRecord || appointmentToEdit.publicPatient,
              doctor: selectedDoctor || appointmentToEdit.doctor || doctorName || '',
              date: dateStr,
              time: selectedTime,
              type: getAppointmentTypeIndex(appointmentType),
              customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
              duration: bookingDuration,
              price: finalPrice,
              discount: Number(discount) || 0,
              notes: originalAppointmentNotes,
              ...treatmentNotesUpdate,
              status: updateAppointmentStatus as any,
              paymentStatus: updatePaymentStatus as any,
              paymentMethod,
              totalPaid: newTotalPaid,
              paymentDate: paymentDatePayload || undefined,
              balance: newBalance,
              updatedAt: new Date().toISOString(),
              isPublicCache: true,
            } as any)
          : await updateAppointment(appointmentToEdit.id, {
              patientId: selectedPatient,
              patientName: selectedPatientRecord?.name || selectedPatient,
              doctor: selectedDoctor || appointmentToEdit.doctor || doctorName || '',
              date: dateStr,
              time: selectedTime,
              type: getAppointmentTypeIndex(appointmentType),
              customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
              duration: bookingDuration,
              price: finalPrice,
              discount: Number(discount) || 0,
              notes: originalAppointmentNotes,
              ...treatmentNotesUpdate,
              status: updateAppointmentStatus as any,
              paymentStatus: updatePaymentStatus as any,
              paymentMethod,
              totalPaid: newTotalPaid,
              paymentDate: paymentDatePayload || undefined,
              balance: newBalance,
            } as any);

        // Log the updated appointment details
        console.log('[BookingModal Payment] ✅ APPOINTMENT UPDATED SUCCESSFULLY:', {
          appointmentId: updated?.id,
          patientName: updated?.patientName,
          service: updated?.customType,
          scheduleDate: updated?.date,
          scheduleTime: updated?.time,
          totalPrice: updated?.price,
          paymentDetails: {
            previouslyPaid,
            newPayment: amountPaid,
            totalPaid: updated?.totalPaid,
            balance: updated?.balance,
            paymentStatus: updated?.paymentStatus,
          },
          appointmentStatus: updated?.status,
          timestamp: new Date().toISOString(),
        });

        if (amountPaid > 0) {
          toast.success(`Payment of ₱${amountPaid.toLocaleString()} recorded successfully!`);
        } else if (paymentMethod === "Pay at Clinic") {
          toast.success(`Appointment set to pay at clinic!`);
        } else {
          toast.success(`Appointment updated successfully!`);
        }
        try { window.dispatchEvent(new CustomEvent('appointments:updated', { detail: { appointment: updated } })); } catch {}
        if (onBooked) onBooked(updated);

        if (repeatTargetDate) {
          const resolvedRepeatSlot = await findNextAvailableRepeatSlot({
            startDate: repeatTargetDate,
            doctorToCheck: selectedDoctor || appointmentToEdit.doctor || doctorName || "",
            durationToCheck: bookingDuration,
            patientToCheck: selectedPatient,
            timeToCheck: selectedTime,
            availabilityMode: isPublicBookingMode ? "public" : "authenticated",
            localBlockingAppointments: isPublicBookingMode ? publicBlockingAppointments : [],
          });

          if (resolvedRepeatSlot) {
            const followUpDate = resolvedRepeatSlot.date;
            if (followUpDate.getTime() !== repeatTargetDate.getTime()) {
              toast.success(`Follow-up appointment moved to ${followUpDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} because the originally requested follow-up date was unavailable.`);
            }

            const followUpStatus = isCartAppointmentStatus(updateAppointmentStatus) ? updateAppointmentStatus : "scheduled";
            await saveFollowUpAppointment({
              followUpDate,
              followUpStatus,
              targetDoctor: selectedDoctor || appointmentToEdit.doctor || doctorName || "",
              targetPatientRecord: selectedPatientRecord,
              bookingDuration,
              treatmentNotesUpdate,
            });
          }
        }

        // close modal after updating
        onOpenChange(false);
      } else {
        // create new appointment
        // Determine payment status
        const paymentStatus = getFinalPaymentStatus();
        
        // Determine appointment status using the new function that includes override logic
        const autoStatus = getFinalAppointmentStatus();

        console.log('[BookingModal Payment] Calculated status:', { paymentStatus, autoStatus, amountPaid, finalPrice, discountedPrice });

        const newBalance = Math.max(0, discountedPrice - amountPaid);

        console.log('[BookingModal Payment] Creating new appointment:', {
          selectedPatient,
          appointmentType,
          amountPaid,
          finalPrice,
          newBalance,
          autoStatus,
          paymentStatus,
          paymentMethod,
        });

        const selectedPatientRecord = patients.find(p => String(p.id) === String(selectedPatient));
        let newApt: any = null;
        if (isPublicBookingMode) {
          // Public bookings which remain cart items are treated as local cache entries.
          // But appointments with a non-cart status should be persisted to the backend.
          if (isCartAppointmentStatus(autoStatus)) {
            newApt = await createPublicBookingAppointment({
              patient: selectedPatientRecord || { id: selectedPatient, name: selectedPatient },
              date: dateStr,
              time: selectedTime,
              duration: bookingDuration,
              type: getAppointmentTypeIndex(appointmentType),
              customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
              doctor: selectedDoctor || "",
              notes: originalAppointmentNotes,
              ...treatmentNotesUpdate,
              price: finalPrice,
              discount: Number(discount) || 0,
              status: autoStatus as any,
              paymentStatus: paymentStatus as any,
              paymentMethod,
              totalPaid: amountPaid,
              paymentDate: paymentDatePayload || undefined,
              balance: newBalance,
            } as any);
          } else {
            // Persist to backend using public booking endpoint. Fallback to cache on failure.
            try {
              const patientName = selectedPatientRecord?.name || String(selectedPatient || "");
              const nameParts = String(patientName).trim().split(/\s+/);
              const firstName = selectedPatientRecord?.firstName || nameParts[0] || "Patient";
              const lastName = selectedPatientRecord?.lastName || nameParts.slice(1).join(" ") || "";
              const payload: any = {
                firstName,
                lastName,
                email: selectedPatientRecord?.email || "",
                phone: selectedPatientRecord?.phone || "",
                patientId: selectedPatientRecord?.id,
                date: dateStr,
                time: selectedTime,
                duration: bookingDuration,
                type: getAppointmentTypeIndex(appointmentType),
                customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
                doctor: selectedDoctor || "",
                notes: originalAppointmentNotes,
                ...treatmentNotesUpdate,
                // Include status/payment info so the public endpoint can persist non-cart bookings
                status: autoStatus,
                paymentStatus: paymentStatus,
                totalPaid: amountPaid,
                paymentMethod,
                paymentDate: paymentDatePayload || undefined,
                price: finalPrice,
                discount: Number(discount) || 0,
              };

              const resp = await fetch(apiUrl("/api/appointments/public-book"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = await resp.json();
              if (resp.ok && json.success) {
                const serverAppointment = json.data;
                const publicPatient = selectedPatientRecord
                  ? cachePublicBookingPatient({
                      ...selectedPatientRecord,
                      id: serverAppointment.patientId || selectedPatientRecord.id,
                      name: serverAppointment.patientName || selectedPatientRecord.name,
                    })
                  : undefined;
                newApt =
                  cachePublicBookingAppointment({
                    ...serverAppointment,
                    publicPatient: publicPatient || selectedPatientRecord,
                  } as any) || serverAppointment;
              } else {
                console.warn("Public booking endpoint returned error, falling back to cache:", json);
                toast.error(json?.message || "Could not save booking to server; saved locally instead.");
                newApt = await createPublicBookingAppointment({
                  patient: selectedPatientRecord || { id: selectedPatient, name: selectedPatient },
                  date: dateStr,
                  time: selectedTime,
                  duration: bookingDuration,
                  type: getAppointmentTypeIndex(appointmentType),
                  customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
                  doctor: selectedDoctor || '',
                  notes: originalAppointmentNotes,
                  ...treatmentNotesUpdate,
                  price: finalPrice,
                  discount: Number(discount) || 0,
                  status: autoStatus as any,
                  paymentStatus: paymentStatus as any,
                  paymentMethod,
                  totalPaid: amountPaid,
                  paymentDate: paymentDatePayload || undefined,
                  balance: newBalance,
                } as any);
              }
            } catch (err) {
              console.error("Public booking error, falling back to cache:", err);
              toast.error("Could not save booking to server; saved locally instead.");
              newApt = await createPublicBookingAppointment({
                patient: selectedPatientRecord || { id: selectedPatient, name: selectedPatient },
                date: dateStr,
                time: selectedTime,
                duration: bookingDuration,
                type: getAppointmentTypeIndex(appointmentType),
                customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
                doctor: selectedDoctor || '',
                notes: originalAppointmentNotes,
                ...treatmentNotesUpdate,
                price: finalPrice,
                discount: Number(discount) || 0,
                status: autoStatus as any,
                paymentStatus: paymentStatus as any,
                paymentMethod,
                totalPaid: amountPaid,
                paymentDate: paymentDatePayload || undefined,
                balance: newBalance,
              } as any);
            }
          }
        } else {
          newApt = await addAppointment({
            patientId: selectedPatient,
            patientName: selectedPatientRecord?.name || selectedPatient,
            doctor: selectedDoctor || '',
            date: dateStr,
            time: selectedTime,
            type: getAppointmentTypeIndex(appointmentType),
            customType: appointmentType === "Other" ? customAppointmentTypeName : undefined,
            duration: bookingDuration,
            price: finalPrice,
            discount: Number(discount) || 0,
            notes: originalAppointmentNotes,
            ...treatmentNotesUpdate,
            status: autoStatus as any,
            paymentStatus: paymentStatus as any,
            paymentMethod,
            totalPaid: amountPaid,
            paymentDate: paymentDatePayload || undefined,
            balance: newBalance,
          } as any);
        }

        if (repeatTargetDate) {
          const resolvedRepeatSlot = await findNextAvailableRepeatSlot({
            startDate: repeatTargetDate,
            doctorToCheck: selectedDoctor || "",
            durationToCheck: bookingDuration,
            patientToCheck: selectedPatient,
            timeToCheck: selectedTime,
            availabilityMode: isPublicBookingMode ? "public" : "authenticated",
            localBlockingAppointments: isPublicBookingMode ? publicBlockingAppointments : [],
          });

          if (resolvedRepeatSlot) {
            const followUpDate = resolvedRepeatSlot.date;
            if (followUpDate.getTime() !== repeatTargetDate.getTime()) {
              toast.success(`Follow-up appointment moved to ${followUpDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} because the originally requested follow-up date was unavailable.`);
            }

            const followUpStatus = isCartAppointmentStatus(autoStatus) ? autoStatus as any : "scheduled";
            await saveFollowUpAppointment({
              followUpDate,
              followUpStatus,
              targetDoctor: selectedDoctor || "",
              targetPatientRecord: selectedPatientRecord,
              bookingDuration,
              treatmentNotesUpdate,
            });
          }
        }

        // Auto-cancel any overlapping cart appointments for the same doctor
        if (newApt && dailyAppointments.length > 0) {
          const timeToMinutes = (time: string): number => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
          };

          const newSlotStart = timeToMinutes(selectedTime);
          const newSlotEnd = newSlotStart + bookingDuration;

          const pendingToCancel = dailyAppointments.filter((apt: any) => {
            // Only cancel cart appointments
            if (!isCartAppointmentStatus(apt.status)) return false;
            // For the same doctor - use selectedDoctor (the actually selected doctor), not the prop
            const currentDocNormalized = (selectedDoctor || '').replace(/^Dr\.\s+/i, "").toLowerCase();
            const aptDocNormalized = apt.doctor.replace(/^Dr\.\s+/i, "").toLowerCase();
            if (aptDocNormalized !== currentDocNormalized) return false;
            // On the same date
            if (apt.date !== dateStr) return false;
            // That overlap with the new appointment
            const aptStart = timeToMinutes(apt.time);
            const aptEnd = aptStart + normalizeBookingDuration(apt.duration);
            return newSlotStart < aptEnd && newSlotEnd > aptStart;
          });

          // Cancel all overlapping cart appointments
          for (const pendingApt of pendingToCancel) {
            await updateAppointment(pendingApt.id, {
              ...pendingApt,
              status: 'cancelled',
            });
            console.log('[BookingModal] Auto-cancelled overlapping cart appointment:', {
              pendingId: pendingApt.id,
              pendingPatient: pendingApt.patientName,
              newAppointmentId: newApt.id,
              reason: 'Overlapping time slot',
            });
          }
        }

        // Log the new appointment details
        console.log('[BookingModal Payment] ✅ APPOINTMENT CREATED SUCCESSFULLY:', {
          appointmentId: newApt?.id,
          patientName: newApt?.patientName,
          service: newApt?.customType,
          scheduleDate: newApt?.date,
          scheduleTime: newApt?.time,
          totalPrice: newApt?.price,
          paymentDetails: {
            amountPaid: newApt?.totalPaid,
            balance: newApt?.balance,
            paymentStatus: newApt?.paymentStatus,
          },
          appointmentStatus: newApt?.status,
          timestamp: new Date().toISOString(),
        });

        if (paymentMethod === "Pay at Clinic") {
          toast.success(`Appointment created (Pay at Clinic)!`);
        } else if (amountPaid > 0) {
          toast.success(`Appointment booked with payment of ₱${amountPaid.toLocaleString()}!`);
        } else {
          toast.success(`Appointment booked successfully!`);
        }
        try { window.dispatchEvent(new CustomEvent('appointments:updated', { detail: { appointment: newApt } })); } catch {}
        if (onBooked) onBooked(newApt);
        // close modal after creating
        onOpenChange(false);
      }

      setModalStep('details');
      setAmountToPay('0');
      setPaymentDate(getDefaultBookingPaymentDate());
    } catch (err) {
      console.error('Booking payment error:', err);
    } finally {
      setIsBooking(false);
    }
  };

  // Cancel handler (previously named handleDelete) — preserve behavior but use clearer name
  const handleCancel = async () => {
    if (!appointmentToEdit) return;
    setIsBooking(true);
    try {
      if (canDeleteCancelledAppointment) {
        await deleteAppointment(appointmentToEdit.id);
        const deletedAppointment = {
          ...appointmentToEdit,
          status: "deleted",
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        try {
          window.dispatchEvent(new CustomEvent('appointments:updated', {
            detail: { appointment: deletedAppointment, appointmentId: appointmentToEdit.id, newStatus: 'deleted' },
          }));
        } catch {}
        if (onBooked) onBooked(deletedAppointment);
        toast?.success?.('Appointment marked as deleted');
        onOpenChange(false);
        return;
      }

      // Update status to cancelled instead of deleting
      const updated = isPublicCachedAppointment
        ? cachePublicBookingAppointment({
            ...appointmentToEdit,
            status: 'cancelled',
            updatedAt: new Date().toISOString(),
            isPublicCache: true,
          } as any)
        : await updateAppointment(appointmentToEdit.id, {
            status: 'cancelled',
          } as any);
      try { window.dispatchEvent(new CustomEvent('appointments:updated', { detail: { appointment: updated, appointmentId: appointmentToEdit.id, newStatus: 'cancelled' } })); } catch {}
      if (onBooked) onBooked(updated);
      toast?.success?.('Appointment marked as cancelled');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to cancel appointment', err);
      toast?.error?.('Failed to cancel appointment');
    } finally {
      setIsBooking(false);
    }
  };

  const handleClose = () => {
    setModalStep("details");
    setIsRescheduling(false);
    setAmountToPay("0");
    setPaymentDate(getDefaultBookingPaymentDate());
    setCustomAppointmentTypeName("");
    setCustomPrice("0");
    onOpenChange(false);
  };

  const viewCurrentAppointment = async (appointmentId?: string) => {
    if (!appointmentId) return;
    setIsSnapshotModalOpen(true);
    setSnapshotToView(null);
    setSnapshotIsHistorical(false);
    setSnapshotIsHistorical(false);
    try {
      // Try to fetch the current live appointment
      const res = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}`), {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.message || "Failed to fetch current appointment");
        return;
      }

      const live = payload?.data ?? null;
      setSnapshotToView(live);
    } catch (err) {
      console.error("Failed to load current appointment", err);
      toast.error("Failed to load current appointment");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(true); }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between mb-4">
              {/* Calendar icon on step 1, Back button on step 2 */}
              {modalStep === 'details' && (
                <CalendarIcon className="h-6 w-6 text-blue-600" />
              )}
              {modalStep === 'payment' && (
                <button
                  onClick={() => setModalStep('details')}
                  disabled={isBooking}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Go back"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
              )}

              <DialogTitle className="flex items-center gap-2 text-2xl font-bold flex-1 text-center">
                {title ? title : (
                  modalStep === 'details'
                    ? (appointmentToEdit
                        ? (isPatientReadonly ? 'View Appointment' : 'Edit Appointment')
                        : 'Appointment Details')
                    : 'Payment Summary'
                )}
              </DialogTitle>

                {/* Step indicators - hidden if cancelled and patient role */}
                {!(isCancelled && user?.role === 'patient') && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setModalStep('details')}
                      disabled={isBooking}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 shadow-sm ${
                        modalStep === "details"
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] ${modalStep === "details" ? "bg-white text-blue-600" : "bg-gray-400 text-white"}`}>1</div>
                      Details
                    </button>
                    <button
                      onClick={() => setModalStep('payment')}
                      disabled={isBooking || !selectedPatient || !appointmentType || !duration}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 shadow-sm ${
                        modalStep === "payment"
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : !selectedPatient || !appointmentType || !duration
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] ${modalStep === "payment" ? "bg-white text-blue-600" : "bg-gray-400 text-white"}`}>2</div>
                      Payment
                    </button>
                  </div>
                )}
            </div>
            <DialogDescription>
              {modalStep === 'details' ? 'Complete the following information to book your appointment' : 'Review and confirm appointment details and payment'}
            </DialogDescription>
          </DialogHeader>

          {modalStep === 'details' ? (
            <>
              <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar py-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-sm font-bold text-gray-700">Who is this appointment for?</Label>
                        {canCreatePatients && !isPatientReadonly && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openAddPatientModal({ publicBooking: isPublicBookingMode })}
                            className="h-8 gap-1.5 rounded-lg text-xs font-semibold"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            New patient
                          </Button>
                        )}
                      </div>
                      <Select value={selectedPatient} onValueChange={setSelectedPatient} disabled={isLoadingPatients || isPatientReadonly}>
                        <SelectTrigger className={`h-11 rounded-lg transition-colors ${
                          patientConflict
                            ? 'border-red-500 bg-red-50 hover:bg-red-50'
                            : 'border-gray-200'
                        }`}>
                          <SelectValue placeholder={isLoadingPatients ? 'Loading...' : 'Select patient'} />
                        </SelectTrigger>
                        <SelectContent>
                          {patients.map(p => {
                            const hasConflict = patientConflictSet.has(p.id);
                            const conflictAppts = dailyAppointments.filter((apt: any) => String(apt.patientId) === String(p.id));
                            const conflictInfo = conflictAppts.length > 0 && hasConflict 
                              ? { 
                                  doctor: conflictAppts[0]?.doctor || 'Another Doctor',
                                  time: conflictAppts[0]?.time
                                }
                              : null;
                            return (
                              <SelectItem 
                                key={p.id}
                                value={p.id} 
                                disabled={hasConflict}
                                className={hasConflict ? 'opacity-50 cursor-not-allowed' : ''}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{p.name}</span>
                                  {hasConflict && (
                                    <div title={conflictInfo ? `Patient has appointment with ${conflictInfo.doctor} at ${conflictInfo.time}` : 'Has conflict'}>
                                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                    </div>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {patientConflict && (
                        <div className="flex items-center gap-2 text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-lg">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>{patientConflict}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-gray-700">Appointment Type</Label>
                      <Select value={appointmentType} onValueChange={setAppointmentType} disabled={isPatientReadonly}>
                        <SelectTrigger className="h-11 rounded-lg border-gray-200">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceOptions
                            .filter((service) => service.isActive !== false)
                            .map((service) => (
                              <SelectItem key={service.id} value={service.label}>
                                {service.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {appointmentType === "Other" && (
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-gray-700">Custom Appointment Type Name *</Label>
                        <Input 
                          type="text"
                          value={customAppointmentTypeName} 
                          onChange={(e: any) => setCustomAppointmentTypeName(e.target.value)} 
                          placeholder="e.g., Denture Fitting, Implant Consultation" 
                          className="h-11 rounded-lg border-gray-200" 
                          disabled={isPatientReadonly}
                        />
                      </div>
                    )}

                    {/* Price - Moved here with appointment type styling */}
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-gray-700">Price</Label>
                      <div className="h-11 rounded-lg border border-gray-200 bg-white px-3 py-2.5 flex items-center">
                        <span className="text-gray-400 text-sm font-bold mr-2">₱</span>
                        {canManagePricing ? (
                          <Input 
                            type="number" 
                            min="0" 
                            step="1" 
                            value={Number(customPrice) > 0 ? customPrice : basePrice} 
                            onChange={(e: any) => {
                              const newPrice = parseFloat(e.target.value) || 0;
                              setCustomPrice(String(newPrice));
                            }} 
                            placeholder="Enter price"
                            className="h-full px-2 rounded-lg border-0 text-sm w-full font-bold text-blue-600 focus:ring-1 focus:ring-blue-500 focus:outline-none" 
                            disabled={isPatientReadonly || isEditMode}
                          />
                        ) : (
                          <span className="text-sm font-bold text-blue-700 flex-1">{basePrice.toLocaleString()}</span>
                        )}
                      </div>
                    </div>

                    {/* Discount Input */}
                    {canManagePricing && (
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-gray-700">Discount</Label>
                      <div className="h-11 rounded-lg border border-gray-200 bg-white px-3 py-2.5 flex items-center">
                        <span className="text-gray-400 text-sm font-bold mr-2">₱</span>
                        <Input 
                          type="number" 
                          min="0" 
                          step="1" 
                          value={discount} 
                          onChange={(e: any) => setDiscount(e.target.value)} 
                          placeholder="Enter discount amount"
                          className="h-full px-2 rounded-lg border-0 text-sm w-full font-bold text-orange-600 focus:ring-1 focus:ring-orange-500 focus:outline-none" 
                          disabled={isPatientReadonly || isEditMode}
                        />
                      </div>
                      {Number(discount) > 0 && (
                        <div className="flex items-center gap-2 text-xs text-orange-600 font-semibold">
                          <span>💰 Savings: ₱{Number(discount).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    )}

                    {/* Final Price Display with Strikethrough if Discounted */}
                    {Number(discount) > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-gray-700">Final Price</Label>
                        <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Original:</span>
                            <span className="text-base font-bold text-gray-400 line-through">₱{finalPrice.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2 text-lg">
                            <span className="font-bold text-gray-700">Now:</span>
                            <span className="text-2xl font-black text-green-600">₱{Math.max(0, finalPrice - Number(discount)).toLocaleString()}</span>
                            <span className="text-xs font-bold bg-green-200 text-green-800 px-2 py-0.5 rounded-full">SAVE {((Number(discount) / finalPrice) * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <CompactNotesField
                      id="booking-treatment-notes"
                      label="Treatment Notes"
                      placeholder="Add treatment-specific notes..."
                      value={treatmentNotes}
                      onChange={setTreatmentNotes}
                      disabled={isPatientReadonly}
                      textareaClassName="min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold text-gray-700">Selected Schedule</Label>
                    </div>

                    <div className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm space-y-3">
                      {/* Date - Clickable Button */}
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <CalendarIcon className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-bold text-gray-600 uppercase">Date</span>
                        </div>
                        <button
                          onClick={() => setIsDatePickerOpen(true)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
                          disabled={isPatientReadonly || !selectedDoctor}
                        >
                          {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </button>
                      </div>

                      {/* Time - Clickable Button */}
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-bold text-gray-600 uppercase">Time</span>
                        </div>
                        <button
                          onClick={() => setIsTimePickerOpen(true)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
                          disabled={isPatientReadonly || !selectedDoctor}
                        >
                          {selectedTime ? formatTimeTo12h(selectedTime) : '—'}
                        </button>
                      </div>

                      {/* Doctor - Select Dropdown (hidden for logged-in doctors) */}
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <Stethoscope className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-bold text-gray-600 uppercase">Doctor</span>
                        </div>
                        {isDoctorSelectionLocked ? (
                          <span className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900">
                            {displayDoctor}
                          </span>
                        ) : (
                          <Select value={selectedDoctor} onValueChange={(newDoctor) => {
                            setSelectedDoctor(newDoctor);
                          }}>
                            <SelectTrigger className="h-9 w-auto rounded-lg border-gray-300 text-sm font-semibold px-3 bg-white hover:bg-gray-50 transition-colors">
                              <SelectValue placeholder="Select doctor" />
                            </SelectTrigger>
                            <SelectContent>
                              {visibleDoctors.map((doc: any) => (
                                <SelectItem key={doc.id} value={doc.name}>
                                  {doc.name.replace(/^Dr\.\s+/i, "Dr. ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Duration - Integrated in schedule card */}
                      <div className="pb-3 border-b border-gray-100">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-bold text-gray-600 uppercase">Duration</span>
                          </div>
                          <Select value={duration} onValueChange={(value) => setDuration(String(normalizeBookingDuration(value)))} disabled={isPatientReadonly}>
                            <SelectTrigger className={`h-9 w-auto rounded-lg text-sm font-semibold px-3 transition-colors ${
                              durationConflict 
                                ? 'border-red-500 bg-red-50 hover:bg-red-50 text-red-700' 
                                : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-900'
                            }`}>
                              <SelectValue>
                                {duration ? `${duration} Mins` : 'Select Duration'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {ALLOWED_BOOKING_DURATIONS.map(dur => {
                                const hasConflict = !isDurationAvailable(dur);
                                return (
                                  <SelectItem 
                                    key={dur}
                                    value={String(dur)} 
                                    disabled={hasConflict}
                                    className={hasConflict ? 'opacity-50 cursor-not-allowed' : ''}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span>{dur} Mins</span>
                                      {hasConflict && (
                                        <div title={`Conflicts with another appointment`}>
                                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                        </div>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        {durationConflict && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-lg">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <span>{durationConflict}</span>
                          </div>
                        )}
                      </div>

                      {/* Status - aligned with duration control */}
                      <div className="flex items-center justify-between gap-3 pt-2">
                        <div className="flex items-center gap-3">
                          <Award className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-bold text-gray-600 uppercase">Status</span>
                        </div>
                        {canEditAppointmentStatus ? (
                          <Select value={getFinalAppointmentStatus()} onValueChange={handleStatusChange} disabled={appointmentStatusOptions.length === 0}>
                            <SelectTrigger className="h-9 w-auto rounded-lg border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {appointmentStatusOptions.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900">
                            {getBookingStatusLabel(getFinalAppointmentStatus(), appointmentStatusOptions)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <CompactNotesField
                  id="booking-notes"
                  label={isPatientLevelBookingMode ? 'My Notes' : 'Notes (Optional)'}
                  placeholder={isPatientLevelBookingMode ? "Add any notes for your dentist here..." : "Any details you'd like to add..."}
                  value={notes}
                  onChange={setNotes}
                  disabled={isPatientReadonly && isCancelled}
                />

                {/* Appointment History Logs */}
                {isEditMode && (appointmentLogs.length > 0 || paymentLogs.length > 0) && (
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold text-blue-800 flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Appointment History
                      </Label>
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Logs</span>
                    </div>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                      {(() => {
                        // Merge and deduplicate: if an appointment log exists for the same time as a payment log,
                        // we prefer the appointment log because it can show BOTH status and payment.
                        const allCombinedLogs = [
                          ...appointmentLogs.map(l => ({ ...l, logType: 'appointment' as const })),
                          ...paymentLogs.map(l => ({ ...l, logType: 'payment' as const, changedAt: l.changedAt }))
                        ];

                        // Simple deduplication logic: if two logs happen within 2 seconds of each other 
                        // and one is appointment while other is payment, we'll favor the appointment one
                        // but only if we can merge the amount into it.
                        const sorted = allCombinedLogs.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
                        
                        const filteredLogs: typeof sorted = [];
                        for (let i = 0; i < sorted.length; i++) {
                          const current = sorted[i];
                          const prev = filteredLogs[filteredLogs.length - 1];
                          
                          if (prev && 
                              Math.abs(new Date(current.changedAt).getTime() - new Date(prev.changedAt).getTime()) < 3000 &&
                              ((current.logType === 'payment' && prev.logType === 'appointment') || 
                               (current.logType === 'appointment' && prev.logType === 'payment'))) {
                            
                            // MERGE LOGIC: ensure the combined log has the higher amount
                            const currentAmount = (current as any).amount || 0;
                            const prevAmount = (prev as any).amount || 0;
                            const maxAmount = Math.max(currentAmount, prevAmount);

                            if (prev.logType === 'appointment') {
                              (prev as any).amount = maxAmount;
                              // Ensure current also has maxAmount in case logic continues
                              (current as any).amount = maxAmount;
                              // If current was a payment log, it might have extra info
                              if (current.logType === 'payment') {
                                (prev as any).paymentMethod = (current as any).paymentMethod;
                                (prev as any).newBalance = (current as any).newBalance;
                                (prev as any).paymentStatus = (current as any).paymentStatus || (prev as any).paymentStatus;
                              }
                              continue;
                            } else if (current.logType === 'appointment') {
                              (current as any).amount = maxAmount;
                              // Ensure prev also has maxAmount in case logic continues
                              (prev as any).amount = maxAmount;
                              // Replace the previous payment log with this richer appointment log
                              filteredLogs[filteredLogs.length - 1] = current;
                              continue;
                            }
                          }
                          filteredLogs.push(current);
                        }

                        return filteredLogs.filter(shouldShowBookingHistoryLog).map((log, index) => {
                          const paidAmount = getBookingHistoryAmount(log);
                          const isInitialCreation = isBookingInitialHistoryLog(log);
                          const badges = getBookingHistoryBadges(log);
                          const historyNotes = getBookingHistoryNotes(log);
                          const paymentDateLabel = getBookingHistoryPaymentDateLabel(log);

                          return (
                            <div key={log.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-[11px] space-y-1.5 shadow-sm">
                              <div className="flex justify-between items-start gap-2 text-gray-500 font-medium">
                                <span className="flex items-center gap-1.5 opacity-80">
                                  <Clock className="h-3 w-3" />
                                  <span className="flex flex-col">
                                    <span>{new Date(log.changedAt).toLocaleString('en-PH', { 
                                      month: 'numeric', 
                                      day: 'numeric', 
                                      year: 'numeric', 
                                      hour: '2-digit', 
                                      minute: '2-digit',
                                      second: '2-digit'
                                    })}</span>
                                    {(log as any).changedByName && (
                                      <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                                        by {(log as any).changedByName}
                                      </span>
                                    )}
                                  </span>
                                </span>
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  {badges.map((badge) => (
                                    <span
                                      key={`${badge.tone}-${badge.label}`}
                                      className={`px-2 py-0.5 rounded-md uppercase font-black text-[9px] tracking-tight border ${getBookingHistoryBadgeClass(badge.tone)}`}
                                    >
                                      {badge.label}
                                    </span>
                                  ))}
                                  <button 
                                    onClick={() => {
                                      // Get historical snapshot
                                      const historicalData = (log.logType === 'appointment' && log.newState && Object.keys(log.newState).length > 3)
                                        ? { ...appointmentToEdit, ...log.newState, amount: log.amount, paymentStatus: log.paymentStatus || log.newState?.paymentStatus, previousState: log.previousState, newState: log.newState, changeType: log.changeType, logType: log.logType, changedAt: log.changedAt, changedByName: (log as any).changedByName }
                                        : { ...appointmentToEdit, ...log.previousState, amount: log.amount, paymentStatus: log.paymentStatus || log.newState?.paymentStatus || log.previousState?.paymentStatus, previousState: log.previousState, newState: log.newState, changeType: log.changeType, logType: log.logType, changedAt: log.changedAt, changedByName: (log as any).changedByName };
                                      
                                      setSnapshotToView(historicalData);
                                      setSnapshotIsHistorical(index !== 0);
                                      setIsSnapshotModalOpen(true);
                                    }}
                                    className="p-1 hover:bg-white rounded-md border border-transparent hover:border-gray-200 transition-colors text-gray-400 hover:text-blue-600"
                                    title="View snapshot"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                  </button>
                                </div>
                              </div>
                              <div className="text-gray-800 leading-relaxed font-medium">
                                {log.logType === 'payment' ? (
                                  <div className="space-y-0.5">
                                    <p>{getBookingHistoryBriefDetail(log, effectiveRole)}</p>
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    <p className="mb-1 text-[10px] text-gray-600">
                                      {getBookingHistoryBriefDetail(log, effectiveRole)}
                                    </p>
                                  </div>
                                )}
                                {historyNotes && (
                                  <p className="mt-1 truncate text-[10px] font-semibold text-gray-500" title={historyNotes}>
                                    Notes: {historyNotes}
                                  </p>
                                )}
                                {paymentDateLabel && (
                                  <p className="mt-1 text-[10px] font-semibold text-gray-500">
                                    Payment date: {paymentDateLabel}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex gap-3 pt-6 border-t">
                {/* destructive cancel for all users when editing an appointment */}
                {(canCancelAppointment || canDeleteCancelledAppointment) && (
                  <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} disabled={isBooking} className="h-11 px-4 rounded-lg mr-auto">
                    {isBooking ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CalendarIcon className="h-4 w-4 mr-2" />
                    )}
                    {isBooking ? 'Processing...' : canDeleteCancelledAppointment ? 'Delete Appointment' : 'Cancel Appointment'}
                  </Button>
                )}
                
                {(isCancelled && user?.role === 'patient') ? (
                  <Button 
                    onClick={handleClose} 
                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 h-11 px-8 rounded-lg ml-auto font-bold border border-gray-200"
                  >
                    Close
                  </Button>
                ) : (
                  <Button 
                    onClick={handleConfirmBooking} 
                    disabled={isBooking || !appointmentType || !selectedPatient} 
                    title={bookingConflictTitle}
                    className={`gap-2 h-11 px-8 rounded-lg shadow-lg ${
                      "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Next: Payment'}
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar py-2">
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Service:</span>
                    <span className="font-medium">{appointmentType === "Other" ? customAppointmentTypeName : appointmentType || 'Other'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Date:</span>
                    <span className="font-medium">{selectedDate.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Time:</span>
                    <span className="font-medium">{selectedTime ? formatTimeTo12h(selectedTime) : '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Duration:</span>
                    <span className="inline-flex items-center gap-2 font-medium">
                      {duration} mins
                      {durationConflict && (
                        <span title={bookingConflictWarnings.find(w => w.type === 'duration')?.message || durationConflict} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                          <AlertCircle className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </span>
                  </div>
                  {bookingConflictWarnings.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                      <span title={bookingConflictTitle} className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 align-middle">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </span>
                      This appointment has a scheduling conflict. Hover the warning icon for details.
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="font-bold">Total Price:</span>
                    {Number(discount) > 0 ? (
                      <span className="font-bold text-lg text-gray-400 line-through">₱{finalPrice.toLocaleString()}</span>
                    ) : (
                      <span className="font-bold text-lg text-gray-900">₱{finalPrice.toLocaleString()}</span>
                    )}
                  </div>
                  {Number(discount) > 0 && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Discount:</span>
                        <span className="text-sm font-semibold text-orange-600">-₱{Number(discount).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="font-bold">Final Price:</span>
                        <span className="font-bold text-lg text-green-600">₱{Math.max(0, finalPrice - Number(discount)).toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {appointmentToEdit && previouslyPaidAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Already Paid:</span>
                      <span className="text-sm font-semibold text-green-600">₱{previouslyPaidAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {isEditMode && (
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Remaining Balance:</span>
                      <span className="font-bold text-lg text-blue-600">₱{remainingBalance.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.8fr)]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="paymentAmount" className="text-sm font-semibold">Amount to Pay Now</Label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAmountToPay(String(remainingBalance))}
                        disabled={paymentMethod === "Pay at Clinic" || remainingBalance <= 0}
                        className="h-8 rounded-full px-3 text-xs font-bold"
                      >
                        Pay Full
                      </Button>
                    </div>
                    <Input
                      id="paymentAmount"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={amountToPay}
                      onChange={(e: any) => setAmountToPay(e.target.value)}
                      max={remainingBalance}
                      className="font-bold text-lg h-12"
                      disabled={paymentMethod === "Pay at Clinic"}
                    />
                    <p className="text-[10px] text-gray-500">{paymentMethod === "Pay at Clinic" ? "Amount will be paid at the clinic" : `Remaining balance: ₱${remainingBalance.toLocaleString()}`}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bookingPaymentDate" className="text-sm font-semibold">Payment Date</Label>
                    <Input
                      id="bookingPaymentDate"
                      type="date"
                      value={paymentDate}
                      max={getDefaultBookingPaymentDate()}
                      onChange={(e: any) => setPaymentDate(e.target.value)}
                      disabled={paymentMethod === "Pay at Clinic"}
                      className="h-12 font-semibold"
                    />
                    <p className="text-[10px] text-gray-500">
                      {paymentMethod === "Pay at Clinic"
                        ? "Recorded once payment is made."
                        : formatBookingPaymentDateLabel(paymentDate) || "Choose actual payment date."}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Select Payment Method</h3>
                  <div className={`grid gap-2 ${isStaffBookingMode ? "grid-cols-4" : "grid-cols-3"}`}>
                    <Button
                      variant="outline"
                      className={`h-20 flex flex-col items-center justify-center gap-1 border-2 ${paymentMethod === "GCash" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-200"}`}
                      onClick={() => setPaymentMethod("GCash")}
                    >
                      <span className="font-black text-blue-700 italic text-lg">GCash</span>
                    </Button>
                    <Button
                      variant="outline"
                      className={`h-20 flex flex-col items-center justify-center gap-1 border-2 ${paymentMethod === "Card" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-200"}`}
                      onClick={() => setPaymentMethod("Card")}
                    >
                      <CreditCard className={`h-6 w-6 ${paymentMethod === "Card" ? "text-blue-600" : "text-gray-600"}`} />
                      <span className={`text-[10px] font-bold uppercase ${paymentMethod === "Card" ? "text-blue-700" : "text-gray-500"}`}>Card</span>
                    </Button>
                    {isStaffBookingMode && (
                      <Button
                        variant="outline"
                        className={`h-20 flex flex-col items-center justify-center gap-1 border-2 ${paymentMethod === "Cash" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-200"}`}
                        onClick={() => setPaymentMethod("Cash")}
                      >
                        <Banknote className={`h-6 w-6 ${paymentMethod === "Cash" ? "text-blue-600" : "text-gray-600"}`} />
                        <span className={`text-[10px] font-bold uppercase text-center leading-tight ${paymentMethod === "Cash" ? "text-blue-700" : "text-gray-500"}`}>Cash</span>
                      </Button>
                    )}
                    {/* <Button
                      variant="outline"
                      className={`h-20 flex flex-col items-center justify-center gap-1 border-2 ${paymentMethod === "Pay at Clinic" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-200"}`}
                      onClick={() => { setPaymentMethod("Pay at Clinic"); setAmountToPay("0"); }}
                    >
                      <Banknote className={`h-6 w-6 ${paymentMethod === "Pay at Clinic" ? "text-blue-600" : "text-gray-600"}`} />
                      <span className={`text-[10px] font-bold uppercase text-center leading-tight ${paymentMethod === "Pay at Clinic" ? "text-blue-700" : "text-gray-500"}`}>Pay at Clinic</span>
                    </Button> */}
                  </div>
                </div>

                {isEditMode && canEditAppointmentStatus && (
                  <div className="space-y-2">
                    <Label htmlFor="appointmentStatus" className="text-sm font-semibold">Appointment Status</Label>
                    <Select value={getFinalAppointmentStatus()} onValueChange={handleStatusChange} disabled={appointmentStatusOptions.length === 0}>
                      <SelectTrigger id="appointmentStatus">
                        <SelectValue placeholder="Select appointment status" />
                      </SelectTrigger>
                      <SelectContent>
                        {appointmentStatusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Payment Status Display - read-only unless admin can manage payment statuses */}
                {isEditMode && (
                  <div className="space-y-2">
                    <Label htmlFor="paymentStatus" className="text-sm font-semibold">Payment Status</Label>
                    {!canManagePaymentStatuses ? (
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Status:</span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          getPaymentStatusOption(getFinalPaymentStatus())?.bgColor || 'bg-gray-100'
                        } ${
                          getPaymentStatusOption(getFinalPaymentStatus())?.textColor || 'text-gray-700'
                        }`}>
                          {getBookingStatusLabel(getFinalPaymentStatus(), paymentStatusOptions)}
                        </span>
                      </div>
                    ) : (
                      <Select value={getFinalPaymentStatus()} onValueChange={handlePaymentStatusChange}>
                        <SelectTrigger id="paymentStatus">
                          <SelectValue placeholder="Select payment status" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentStatusOptions.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="flex gap-3 pt-6 border-t">
                {(canCancelAppointment || canDeleteCancelledAppointment) && (
                  <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} disabled={isBooking} className="h-11 px-4 rounded-lg mr-auto">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {isBooking ? 'Processing...' : canDeleteCancelledAppointment ? 'Delete Appointment' : 'Cancel Appointment'}
                  </Button>
                )}
                
                <Button
                  className={`bg-green-600 hover:bg-green-700 text-white gap-2 h-11 px-8 rounded-lg shadow-lg shadow-green-100 ${isOverpay ? 'opacity-80 cursor-pointer' : ''} ${overpayPulse ? 'ring-2 ring-red-400 animate-pulse' : ''}`}
                  onClick={() => {
                    if (isBooking) return;
                    if (isOverpay) {
                      toast.error(`Amount exceeds remaining balance. Maximum allowed: ₱${remainingBalance.toLocaleString()}`);
                      setOverpayPulse(true);
                      setTimeout(() => setOverpayPulse(false), 700);
                      return;
                    }

                    handleConfirmPayment();
                  }}
                  aria-disabled={isOverpay}
                  disabled={isBooking}
                >
                  {isBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Booking'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <ApproveRejectDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        mode="cancel"
        appointment={appointmentToEdit}
        isProcessing={isBooking}
        title={canDeleteCancelledAppointment ? "Delete Appointment?" : undefined}
        description={
          canDeleteCancelledAppointment
            ? "You will be deleting this appointment permanently from receptionist views. Only an admin can return it back. Are you sure?"
            : undefined
        }
        confirmLabel={canDeleteCancelledAppointment ? "Yes, Delete" : undefined}
        onConfirm={async () => {
          setIsDeleteDialogOpen(false);
          await handleCancel();
        }}
      />

      {/* Summary confirmation dialog */}
      <ConfirmAppointmentModal
        open={isConfirmSummaryOpen}
        onOpenChange={setIsConfirmSummaryOpen}
        onConfirm={handleConfirmSummary}
        isBooking={isBooking}
        patientName={patients.find((p) => p.id === selectedPatient)?.name || String(selectedPatient)}
        doctorName={displayDoctor}
        appointmentType={appointmentType}
        customAppointmentTypeName={customAppointmentTypeName}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        duration={duration}
        treatmentNotes={treatmentNotes}
        notes={notes}
        onNotesChange={setNotes}
        durationConflict={durationConflict}
        bookingConflictWarnings={bookingConflictWarnings}
        appointmentStatus={getFinalAppointmentStatus()}
        appointmentStatusOptions={appointmentStatusOptions}
        onAppointmentStatusChange={handleStatusChange}
        canEditAppointmentStatus={canEditAppointmentStatus}
        paymentStatus={getFinalPaymentStatus()}
        paymentStatusOptions={paymentStatusOptions}
        onPaymentStatusChange={() => {}}
        canManagePaymentStatuses={false}
        finalPrice={finalPrice}
        discount={Number(discount) || 0}
        discountedPrice={discountedPrice}
        previouslyPaidAmount={previouslyPaidAmount}
        paymentAmountNow={paymentAmountNow}
        paymentDate={paymentDate}
        repeatOption={repeatOption}
        customRepeatDate={customRepeatDate}
        onRepeatOptionChange={setRepeatOption}
        onCustomRepeatDateChange={setCustomRepeatDate}
        patientId={selectedPatient}

        getPersonInitials={(name?: string) => {
          const initials = String(name || "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase();
          return initials || "?";
        }}
        getDoctorInitials={(name: string) => {
          return (name || "")
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0])
            .join("")
            .toUpperCase() || "?";
        }}
        getBookingStatusLabel={getBookingStatusLabel}
        getAppointmentStatusOption={getAppointmentStatusOption}
        getPaymentStatusOption={getPaymentStatusOption}
        formatTimeTo12h={formatTimeTo12h}
        isPatientReadonly={isPatientReadonly}
        isCancelled={isCancelled}
        isPatientLevelBookingMode={isPatientLevelBookingMode}
        isCartAppointmentStatus={isCartAppointmentStatus}
        userRole={effectiveRole}
      />

      {/* Historical Snapshot View-only Modal */}
      <AppointmentHistoryView
        open={isSnapshotModalOpen}
        onOpenChange={(val) => {
          setIsSnapshotModalOpen(val);
          if (!val) {
            setSnapshotToView(null);
            setSnapshotIsHistorical(false);
          }
        }}
        appointmentSnapshot={snapshotToView}
        logDate={snapshotToView?.changedAt || new Date().toISOString()}
        onViewCurrent={viewCurrentAppointment}
        isHistorical={snapshotIsHistorical}
        openedFromBookingModal={true}
      />

      {/* Date Picker Modal */}
      <DatePickerModal
        open={isDatePickerOpen}
        onOpenChange={setIsDatePickerOpen}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        doctorName={selectedDoctor}
        patientId={selectedPatient}
        selectedTime={selectedTime}
        duration={duration}
        dateSelectionMode={isEditMode ? "edit" : isPastAppointmentMode ? "past" : "standard"}
        appointmentSource={isPublicBookingMode ? "cache" : "server"}
        cachedAppointments={publicBlockingAppointments as any}
      />

      {/* Time Picker Modal */}
      <TimePickerModal
        open={isTimePickerOpen}
        onOpenChange={setIsTimePickerOpen}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        doctorName={selectedDoctor}
        duration={duration}
        onTimeSelect={setSelectedTime}
        onDateChange={setSelectedDate}
        excludeAppointmentId={appointmentToEdit?.id}
        patientId={selectedPatient}
        dateSelectionMode={isEditMode ? "edit" : isPastAppointmentMode ? "past" : "standard"}
        appointmentSource={isPublicBookingMode ? "cache" : "server"}
        cachedAppointments={publicBlockingAppointments as any}
      />
    </>
   );
 }
