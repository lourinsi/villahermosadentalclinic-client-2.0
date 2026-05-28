"use client";

import { apiUrl } from "@/lib/api";

import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from "react";
import { BookingCreationMode, isPastAppointmentDate } from "@/components/sharedBookingLogic";
import { useAppointments, Appointment, AppointmentFilters } from "./useAppointments";

interface AppointmentModalContextType {
  isCreateModalOpen: boolean;
  isScheduleModalOpen: boolean;
  isPatientBookingModalOpen: boolean;
  isAddPatientModalOpen: boolean;
  isEditModalOpen: boolean;
  isPatientFieldReadOnly: boolean;
  isPaymentFlow: boolean;
  selectedAppointment: Appointment | null;
  newAppointmentDate?: Date;
  newAppointmentTime?: string;
  newAppointmentPatientName?: string;
  newAppointmentPatientId?: string;
  newAppointmentDoctorName?: string;
  newAppointmentServiceType?: string;
  newAppointmentCreationMode?: BookingCreationMode;
  openCreateModal: (date?: Date, time?: string, doctorName?: string) => void;
  closeCreateModal: () => void;
  openScheduleModal: (patientName?: string, patientId?: string) => void;
  closeScheduleModal: () => void;
  openPatientBookingModal: (date?: Date, time?: string, doctorName?: string, serviceType?: string) => void;
  closePatientBookingModal: () => void;
  openAddPatientModal: (options?: { publicBooking?: boolean }) => void;
  closeAddPatientModal: () => void;
  addPatientModalMode: "standard" | "publicBooking";
  openEditModal: (appointment: Appointment, isPatientReadOnly?: boolean, isPaymentFlow?: boolean) => void;
  openEditModalById: (id: string, isPatientReadOnly?: boolean, isPaymentFlow?: boolean) => Promise<void>;
  closeEditModal: () => void;
  refreshAppointments: (filters?: AppointmentFilters) => void;
  refreshPatients: () => void;
  refreshFinanceData: () => void;
  lastAddedPatient: any | null;
  lastAddedPatientAt: number | null;
  notifyPatientAdded: (patient: any) => void;
  refreshTrigger: number;
  appointments: Appointment[];
  isLoading: boolean;
  addAppointment: (appointment: Omit<Appointment, "id" | "createdAt">) => Promise<Appointment>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<Appointment>;
  deleteAppointment: (id: string) => Promise<void>;
}

const AppointmentModalContext = createContext<AppointmentModalContextType | undefined>(undefined);

export const AppointmentModalProvider = ({ children }: { children: ReactNode }) => {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [isPatientBookingModalOpen, setPatientBookingModalOpen] = useState(false);
  const [isAddPatientModalOpen, setAddPatientModalOpen] = useState(false);
  const [addPatientModalMode, setAddPatientModalMode] = useState<"standard" | "publicBooking">("standard");
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isPatientFieldReadOnly, setPatientFieldReadOnly] = useState(false);
  const [isPaymentFlow, setIsPaymentFlow] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastAddedPatient, setLastAddedPatient] = useState<any | null>(null);
  const [lastAddedPatientAt, setLastAddedPatientAt] = useState<number | null>(null);
  const [hasRequestedAppointments, setHasRequestedAppointments] = useState(false);

  const [newAppointmentDate, setNewAppointmentDate] = useState<Date>();
  const [newAppointmentTime, setNewAppointmentTime] = useState<string>();
  const [newAppointmentPatientName, setNewAppointmentPatientName] = useState<string>();
  const [newAppointmentPatientId, setNewAppointmentPatientId] = useState<string>();
  const [newAppointmentDoctorName, setNewAppointmentDoctorName] = useState<string>();
  const [newAppointmentServiceType, setNewAppointmentServiceType] = useState<string>();
  const [newAppointmentCreationMode, setNewAppointmentCreationMode] = useState<BookingCreationMode>(
    "standard"
  );

  const [filters, setFilters] = useState<AppointmentFilters | undefined>(undefined);

  const { appointments, isLoading, addAppointment, updateAppointment, deleteAppointment } = useAppointments(
    refreshTrigger,
    filters,
    { enabled: hasRequestedAppointments }
  );

  const refreshAppointments = useCallback((newFilters?: AppointmentFilters) => {
    setHasRequestedAppointments(true);
    setFilters((currentFilters) => newFilters === undefined ? currentFilters : newFilters);
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const refreshPatients = useCallback(() => setRefreshTrigger(prev => prev + 1), []);
  const refreshFinanceData = useCallback(() => setRefreshTrigger(prev => prev + 1), []);
  const notifyPatientAdded = useCallback((patient: any) => {
    setLastAddedPatient(patient);
    setLastAddedPatientAt(Date.now());
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const openCreateModal = useCallback((date?: Date, time?: string, doctorName?: string) => {
    setNewAppointmentDate(date);
    setNewAppointmentTime(time);
    setNewAppointmentDoctorName(doctorName ?? "");
    // If a date is provided and it's a past date, open the modal in 'past' creation mode.
    try {
      const creationMode: BookingCreationMode = isPastAppointmentDate(date) ? "past" : "standard";
      setNewAppointmentCreationMode(creationMode);
    } catch (err) {
      setNewAppointmentCreationMode("standard");
    }
    setCreateModalOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setCreateModalOpen(false);
    setNewAppointmentCreationMode("standard");
  }, []);

  const openScheduleModal = useCallback((patientName?: string, patientId?: string) => {
    setNewAppointmentPatientName(patientName);
    setNewAppointmentPatientId(patientId);
    setScheduleModalOpen(true);
  }, []);

  const closeScheduleModal = useCallback(() => setScheduleModalOpen(false), []);

  // openPatientBookingModal should open the create appointment modal for patients
  // without performing any redirects. It sets the selected date/time/doctor
  // then opens the modal.
  // 
  // Status logic for patient bookings:
  // - If NO payment: status = "add-to-cart" (patient cart item)
  // - If PARTIAL payment: status = "reserved" (no time limit, awaits doctor approval)
  // - If FULL payment: status = "scheduled" (confirmed)
  const openPatientBookingModal = (date?: Date | null, time?: string, doctor?: string) => {
    try {
      if (date !== undefined) setNewAppointmentDate(date ?? undefined);
      if (time !== undefined) setNewAppointmentTime(time ?? "");
      if (doctor !== undefined) setNewAppointmentDoctorName(doctor ?? "");

      // Open the specific patient booking modal instead of the generic create modal
      setPatientBookingModalOpen(true);
    } catch (err) {
      // fallback
      setPatientBookingModalOpen(true);
    }
  };

  const closePatientBookingModal = useCallback(() => setPatientBookingModalOpen(false), []);

  const openAddPatientModal = useCallback((options?: { publicBooking?: boolean }) => {
    setAddPatientModalMode(options?.publicBooking ? "publicBooking" : "standard");
    setAddPatientModalOpen(true);
  }, []);
  const closeAddPatientModal = useCallback(() => setAddPatientModalOpen(false), []);
  
  const openEditModal = useCallback((appointment: Appointment, isPatientReadOnly: boolean = false, isPaymentFlowMode: boolean = false) => {
    setSelectedAppointment(appointment);
    setPatientFieldReadOnly(isPatientReadOnly);
    setIsPaymentFlow(isPaymentFlowMode);
    setEditModalOpen(true);
  }, []);

  const openEditModalById = useCallback(async (id: string, isPatientReadOnly: boolean = false, isPaymentFlowMode: boolean = false) => {
    // 1. Try to find in existing appointments
    const existing = appointments.find(a => String(a.id) === String(id));
    if (existing) {
      console.log(`[useAppointmentModal] Found appointment ${id} in local state.`);
      openEditModal(existing, isPatientReadOnly, isPaymentFlowMode);
      return;
    }

    // 2. If not found, fetch from API
    console.log(`[useAppointmentModal] Appointment ${id} not found in local state. Fetching from API...`);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl(`/api/appointments/${id}`), { 
        headers,
        credentials: "include" 
      });
      
      const result = await response.json();
      if (result.success && result.data) {
        console.log(`[useAppointmentModal] Successfully fetched appointment ${id} from API.`);
        openEditModal(result.data, isPatientReadOnly, isPaymentFlowMode);
      } else {
        console.error(`[useAppointmentModal] Failed to fetch appointment ${id}:`, result.message);
        throw new Error(result.message || "Appointment not found");
      }
    } catch (error) {
      console.error(`[useAppointmentModal] Error fetching appointment ${id}:`, error);
      throw error;
    }
  }, [appointments, openEditModal]);

  const closeEditModal = useCallback(() => {
    setEditModalOpen(false);
    setSelectedAppointment(null);
    setPatientFieldReadOnly(false);
    setIsPaymentFlow(false);
  }, []);

  const value = useMemo(() => ({
    isCreateModalOpen,
    isScheduleModalOpen,
    isPatientBookingModalOpen,
    isAddPatientModalOpen,
    isEditModalOpen,
    isPatientFieldReadOnly,
    isPaymentFlow,
    selectedAppointment,
    newAppointmentDate,
    newAppointmentTime,
    newAppointmentPatientName,
    newAppointmentPatientId,
    newAppointmentDoctorName,
    newAppointmentCreationMode,
    newAppointmentServiceType,
    openCreateModal,
    closeCreateModal,
    openScheduleModal,
    closeScheduleModal,
    openPatientBookingModal,
    closePatientBookingModal,
    openAddPatientModal,
    closeAddPatientModal,
    addPatientModalMode,
    openEditModal,
    openEditModalById,
    closeEditModal,
    refreshAppointments,
    refreshPatients,
    refreshFinanceData,
    lastAddedPatient,
    lastAddedPatientAt,
    notifyPatientAdded,
    refreshTrigger,
    appointments,
    isLoading,
    addAppointment,
    updateAppointment,
    deleteAppointment,
  }), [
    isCreateModalOpen,
    isScheduleModalOpen,
    isPatientBookingModalOpen,
    isAddPatientModalOpen,
    isEditModalOpen,
    isPatientFieldReadOnly,
    isPaymentFlow,
    selectedAppointment,
    newAppointmentDate,
    newAppointmentTime,
    newAppointmentPatientName,
    newAppointmentPatientId,
    newAppointmentDoctorName,
    newAppointmentCreationMode,
    newAppointmentServiceType,
    openCreateModal,
    closeCreateModal,
    openScheduleModal,
    closeScheduleModal,
    openPatientBookingModal,
    closePatientBookingModal,
    openAddPatientModal,
    closeAddPatientModal,
    addPatientModalMode,
    openEditModal,
    openEditModalById,
    closeEditModal,
    refreshAppointments,
    refreshPatients,
    refreshFinanceData,
    lastAddedPatient,
    lastAddedPatientAt,
    notifyPatientAdded,
    refreshTrigger,
    appointments,
    isLoading,
    addAppointment,
    updateAppointment,
    deleteAppointment,
  ]);

  return (
    <AppointmentModalContext.Provider value={value}>
      {children}
    </AppointmentModalContext.Provider>
  );
};

export const useAppointmentModal = () => {
  const context = useContext(AppointmentModalContext);
  if (context === undefined) {
    throw new Error("useAppointmentModal must be used within an AppointmentModalProvider");
  }
  return context;
};
