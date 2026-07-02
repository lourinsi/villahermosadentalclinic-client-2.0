"use client";

import { apiUrl } from "@/lib/api";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TIME_SLOTS, formatTimeTo12h } from "@/lib/time-slots";
import { formatDateToYYYYMMDD, formatWordyDate, cn } from "@/lib/utils";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Appointment } from "@/hooks/useAppointments";
import AppointmentHistoryView from "./AppointmentHistoryView";
import { isCartAppointmentStatus, isReservedAppointmentStatus } from "@/lib/appointment-status";
import { normalizeBookingDuration, type BookingCreationMode } from "./sharedBookingLogic";

interface TimePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  selectedTime: string;
  doctorName: string;
  duration?: string;
  onTimeSelect: (time: string) => void;
  onDateChange?: (date: Date) => void;
  excludeAppointmentId?: string;
  patientId?: string | null;
  dateSelectionMode?: BookingCreationMode;
  appointmentSource?: "server" | "cache";
  cachedAppointments?: Appointment[];
  selectionDisabled?: boolean;
}

const getAppointmentFetchOptions = (): RequestInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return { headers, credentials: "include" };
};

const normalizeDoctorName = (doctor?: string) =>
  String(doctor || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();

export function TimePickerModal({
  open,
  onOpenChange,
  selectedDate,
  selectedTime,
  doctorName,
  duration,
  onTimeSelect,
  onDateChange,
  excludeAppointmentId,
  patientId,
  dateSelectionMode = "standard",
  appointmentSource = "server",
  cachedAppointments = [],
  selectionDisabled = false,
}: TimePickerModalProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(new Date(selectedDate));
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const fetchAppointments = useCallback(async (dateToFetch: Date) => {
    if (!doctorName && !patientId) {
      setAppointments([]);
      return;
    }
    try {
      setIsLoading(true);
      const dateStr = formatDateToYYYYMMDD(dateToFetch);

      if (appointmentSource === "cache") {
        const doctorKey = normalizeDoctorName(doctorName);
        setAppointments(
          cachedAppointments.filter((appointment) => {
            if (appointment.date !== dateStr) return false;

            const sameDoctor =
              doctorKey && normalizeDoctorName(appointment.doctor) === doctorKey;
            const samePatient =
              patientId && String(appointment.patientId) === String(patientId);

            return Boolean(sameDoctor || samePatient);
          })
        );
        return;
      }

      const params = new URLSearchParams({
        startDate: dateStr,
        endDate: dateStr,
        includeUnpaid: "true",
      });

      if (doctorName) {
        params.set("doctor", doctorName);
      }
      
      if (patientId) {
        params.set("patientId", patientId);
        if (doctorName) {
          params.set("matchType", "or");
        }
      }

      const url = apiUrl(`/api/appointments?${params.toString()}`);
      
      const response = await fetch(url, getAppointmentFetchOptions());
      const result = await response.json();
      if (result.success) {
        setAppointments(result.data || []);
      } else {
        setAppointments([]);
      }
    } catch (error) {
      console.error("Failed to fetch appointments", error);
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  }, [doctorName, patientId, appointmentSource, cachedAppointments]);

  // When modal opens, sync viewDate with selectedDate and fetch appointments
  useEffect(() => {
    if (open) {
      const newViewDate = new Date(selectedDate);
      setViewDate(newViewDate);
      fetchAppointments(newViewDate);
    }
  }, [open, selectedDate, fetchAppointments]);

  // When selectedDate changes (from DatePickerModal), update viewDate and fetch new appointments
  useEffect(() => {
    if (open) {
      const dateStr = formatDateToYYYYMMDD(viewDate);
      const selectedDateStr = formatDateToYYYYMMDD(selectedDate);
      
      // Only update if they're different
      if (dateStr !== selectedDateStr) {
        setViewDate(new Date(selectedDate));
        fetchAppointments(selectedDate);
      }
    }
  }, [selectedDate, open, viewDate, fetchAppointments]);

  const startOfDay = (date: Date) => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(viewDate);
    newDate.setDate(viewDate.getDate() + (direction === 'next' ? 1 : -1));
    setViewDate(newDate);
    if (onDateChange && !selectionDisabled) {
      onDateChange(newDate);
    }
    fetchAppointments(newDate);
  };

  const slots = useMemo(() => {
    const dateStr = formatDateToYYYYMMDD(viewDate);
    const now = new Date();
    const todayStr = formatDateToYYYYMMDD(now);
    const isToday = dateStr === todayStr;
    const todayStart = startOfDay(now);
    const viewDateStart = startOfDay(viewDate);
    const isPastDate = !isToday && viewDateStart < todayStart;
    const isFutureDate = !isToday && viewDateStart > todayStart;
    
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const timeToMinutes = (time: string): number => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    
    const activeAppointments = appointments.filter(apt => 
      apt.status !== 'cancelled' && apt.id !== excludeAppointmentId
    );

    const patientDayAppointment = patientId
      ? activeAppointments.find((apt) => String(apt.patientId) === String(patientId)) || null
      : null;

    return TIME_SLOTS.map(slot => {
      const [hour, minute] = slot.split(':').map(Number);
      const isPastTime = isToday && (hour < currentHour || (hour === currentHour && minute <= currentMinute));
      const isFutureTime = isToday && (hour > currentHour || (hour === currentHour && minute > currentMinute));
      const isPast = isPastTime || isPastDate;
      const isFuture = isFutureTime || isFutureDate;
      
      const slotMinutes = timeToMinutes(slot);
      const slotEndMinutes = slotMinutes + normalizeBookingDuration(duration);
      
      let isBooked = false;
      let isTentative = false;
      let isPending = false;
      let isPatientConflict = false;
      let isPatientDayBlocked = false;
      let appointment: Appointment | null = null;

      for (const apt of activeAppointments) {
        const aptStart = timeToMinutes(apt.time);
        const aptEnd = aptStart + normalizeBookingDuration(apt.duration);
        
        if (slotMinutes < aptEnd && slotEndMinutes > aptStart) {
          const isDoctorConflict = apt.doctor === doctorName;
          const isPatientSpecificConflict = patientId && String(apt.patientId) === String(patientId);

          if (isDoctorConflict || isPatientSpecificConflict) {
            isBooked = true;
            appointment = appointment || apt;

            if (isReservedAppointmentStatus(apt.status)) {
              isTentative = true;
            } else if (isCartAppointmentStatus(apt.status)) {
              isPending = true;
            }

            if (isPatientSpecificConflict) {
              isPatientConflict = true;
            }
            
            break;
          }
        }
      }

      if (!isBooked && patientDayAppointment) {
        isPatientDayBlocked = true;
        appointment = patientDayAppointment;
      }

      const isSelected = selectedTime === slot && formatDateToYYYYMMDD(viewDate) === formatDateToYYYYMMDD(selectedDate);
      
      return {
        time: slot,
        isAvailable: !isBooked && !isPatientDayBlocked,
        isBooked,
        isTentative,
        isPending,
        isPatientConflict,
        isPatientDayBlocked,
        isPast,
        isFuture,
        isBlockedByDateMode: false,
        isSelected,
        appointment
      };
    });
  }, [appointments, viewDate, selectedDate, selectedTime, excludeAppointmentId, duration, doctorName, patientId]);

  const handleTimeSelect = (time: string) => {
    if (selectionDisabled) return;

    onTimeSelect(time);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-tour-id="booking-time-picker" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Time</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {/* Date Navigation Header */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => navigateDate('prev')}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            
            <p className="text-sm font-semibold text-gray-700 flex-1 text-center">
              {formatWordyDate(viewDate)}
            </p>
            
            <button
              onClick={() => navigateDate('next')}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          <p className="text-sm text-gray-600 text-center">
            {doctorName || (patientId ? "Checking patient availability" : "")}
          </p>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mb-2 opacity-40" />
              <span className="text-xs font-semibold">Loading times...</span>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-[400px] overflow-y-auto">
              {slots.map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => {
                    if (selectionDisabled || slot.isPatientDayBlocked) return;
                    if (slot.isAvailable) {
                      handleTimeSelect(slot.time);
                    } else if (slot.isBooked && slot.appointment) {
                      setSelectedAppointment(slot.appointment);
                      setSnapshotOpen(true);
                    }
                  }}
                  disabled={selectionDisabled || slot.isPatientDayBlocked}
                  className={cn(
                    "px-2 py-2 rounded-lg font-semibold text-xs transition-all border",
                    selectionDisabled
                      ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                    : slot.isPatientDayBlocked
                      ? "bg-yellow-50 text-amber-700 border-amber-200 cursor-not-allowed"
                    : slot.isSelected && slot.isAvailable
                      ? "bg-blue-600 text-white border-blue-700 shadow-md"
                      : slot.isAvailable && (!slot.isBooked || slot.isPending)
                      ? "bg-white text-gray-900 border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
                      : slot.isTentative
                      ? "bg-amber-50 text-amber-700 border-amber-200 cursor-pointer"
                      : "bg-red-50 text-red-700 border-red-200 cursor-pointer"
                  ) }
                  title={
                    selectionDisabled ? "Time selection is disabled during this tour step"
                    : slot.isPatientDayBlocked ? "Patient already has a booking on this day"
                    : slot.isTentative ? "Reserved (Click to view details)"
                    : slot.isBooked && !slot.isPending ? "Booked (Click to view details)"
                    : "Available"
                  }
                >
                  <div>{formatTimeTo12h(slot.time)}</div>
                  <div className="text-[8px] opacity-70">
                    {slot.isPatientDayBlocked ? "Blocked"
                    : slot.isTentative ? "Rsrvd"
                    : slot.isBooked && !slot.isPending ? "Booked"
                    : "Open"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>

      {selectedAppointment && (
        <AppointmentHistoryView
          open={snapshotOpen}
          onOpenChange={setSnapshotOpen}
          appointmentSnapshot={selectedAppointment}
          logDate={selectedAppointment.updatedAt || selectedAppointment.createdAt || new Date().toISOString()}
        />
      )}
    </Dialog>
  );
}
