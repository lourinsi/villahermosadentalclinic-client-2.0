import { apiUrl } from "@/lib/api";
import { normalizeAppointmentStatus } from "@/lib/appointment-status";
import { useState, useEffect } from "react";
import { RecentTransaction } from "../lib/finance-types";

export interface Appointment {
  id: string;
  patientName: string;
  patientId: string;
  email?: string;
  phone?: string;
  patientFirstName?: string;
  patientLastName?: string;
  patientEmail?: string;
  patientPhone?: string;
  date: string;
  time: string;
  type: number;
  customType?: string;
  price?: number;
  discount?: number;
  doctor: string;
  doctorId?: string;
  doctorName?: string;
  duration?: number;
  notes: string;
  treatmentNotes?: string;
  serviceType?: string;
  // Status is flexible to accept any value from the backend JSON configuration
  status: string;
  cancellationReason?: string; // Reason why appointment was cancelled
  paymentStatus?: "paid" | "unpaid" | "overdue" | "half-paid" | "over-paid";
  paymentMethod?: string;
  balance?: number;
  totalPaid?: number;
  // recurrence fields removed (backend no longer supports recurring appointments)
  patientDateOfBirth?: string;
  patientDob?: string;
  patientBirthDate?: string;
  patientBirthday?: string;
  patientProfile?: string;
  patientProfilePicture?: string;
  doctorProfile?: string;
  doctorProfilePicture?: string;
  patient?: {
    id?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    profilePicture?: string;
    profilePictureUrl?: string;
  };
  transactions?: RecentTransaction[];
  createdAt?: string;
  updatedAt?: string;
}

const API_URL = apiUrl("/api/appointments");

export interface AppointmentFilters {
  startDate?: string;
  endDate?: string;
  search?: string;
  doctor?: string;
  patientId?: string;
  parentId?: string;
  type?: string;
  status?: string;
  anonymize?: boolean;
  includeUnpaid?: boolean;
}

interface UseAppointmentsOptions {
  enabled?: boolean;
}

export const useAppointments = (
  refreshTrigger?: number,
  filters?: AppointmentFilters,
  options?: UseAppointmentsOptions
) => {
  const enabled = options?.enabled ?? true;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);

  // Load appointments from backend on mount and when refreshTrigger or filters change
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadAppointments = async () => {
      try {
        setIsLoading(true);
        const queryParams = new URLSearchParams();
        if (filters?.startDate) queryParams.append("startDate", filters.startDate);
        if (filters?.endDate) queryParams.append("endDate", filters.endDate);
        if (filters?.search) queryParams.append("search", filters.search);
        if (filters?.doctor) queryParams.append("doctor", filters.doctor);
        if (filters?.patientId) queryParams.append("patientId", filters.patientId);
        if (filters?.parentId) queryParams.append("parentId", filters.parentId);
        if (filters?.type) queryParams.append("type", filters.type);
        if (filters?.status) queryParams.append("status", filters.status);
        if (filters?.anonymize) queryParams.append("anonymize", "true");
        if (filters?.includeUnpaid) queryParams.append("includeUnpaid", "true");

        const url = queryParams.toString() ? `${API_URL}?${queryParams.toString()}` : API_URL;
        
        // Get auth token from localStorage
        const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        const response = await fetch(url, { headers, credentials: "include" });
        const result = await response.json();
        if (isMounted && result.success && result.data) {
          setAppointments(
            result.data.map((appointment: Appointment) => ({
              ...appointment,
              status: normalizeAppointmentStatus(appointment.status),
            }))
          );
        }
      } catch (error) {
        console.error("Error loading appointments from backend:", error);
        // Fallback to empty list if backend is unavailable
        if (isMounted) setAppointments([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadAppointments();

    return () => {
      isMounted = false;
    };
  }, [enabled, refreshTrigger, filters?.startDate, filters?.endDate, filters?.search, filters?.doctor, filters?.type, filters?.status, filters?.patientId, filters?.parentId, filters?.anonymize, filters?.includeUnpaid]);

  const addAppointment = async (appointment: Omit<Appointment, "id" | "createdAt">) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(API_URL, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(appointment),
      });
      const result = await response.json();
      if (result.success && result.data) {
        const newAppointment = {
          ...result.data,
          status: normalizeAppointmentStatus(result.data.status),
        };
        setAppointments([...appointments, newAppointment]);
        return newAppointment;
      }
      throw new Error(result.message || "Failed to add appointment");
    } catch (error) {
      console.error("Error adding appointment:", error);
      throw error;
    }
  };

  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(updates),
      });
      const result = await response.json();
      if (result.success && result.data) {
        const normalizedResult = {
          ...result.data,
          status: normalizeAppointmentStatus(result.data.status),
        };
        const updated = appointments.map((apt) =>
          apt.id === id ? { ...apt, ...normalizedResult } : apt
        );
        setAppointments(updated);
        return normalizedResult;
      }
      throw new Error(result.message || "Failed to update appointment");
    } catch (error) {
      console.error("Error updating appointment:", error);
      throw error;
    }
  };

  const deleteAppointment = async (id: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
      const result = await response.json();
      if (result.success) {
        const updated = appointments.filter((apt) => apt.id !== id);
        setAppointments(updated);
      } else {
        throw new Error(result.message || "Failed to delete appointment");
      }
    } catch (error) {
      console.error("Error deleting appointment:", error);
      throw error;
    }
  };

  const getAppointmentsByDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return appointments.filter((apt) => apt.date === dateStr);
  };

  const getUpcomingAppointments = (doctor?: string) => {
    const today = new Date().toISOString().split("T")[0];
    return appointments
      .filter((apt) => {
        const matchesDate = apt.date >= today;
        const matchesDoctor = !doctor || apt.doctor === doctor;
        return matchesDate && matchesDoctor;
      })
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return a.time.localeCompare(b.time);
      });
  };

  return {
    appointments,
    isLoading,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    getAppointmentsByDate,
    getUpcomingAppointments,
  };
};
