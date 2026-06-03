"use client";

import { apiUrl } from "@/lib/api";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import React from "react";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateToYYYYMMDD } from "@/lib/utils";
import { Appointment } from "@/hooks/useAppointments";
import { isCartAppointmentStatus } from "@/lib/appointment-status";
import { normalizeBookingDuration, parseLocalDateOnly, type BookingCreationMode } from "./sharedBookingLogic";

interface DatePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | string | null;
  onDateSelect: (date: Date) => void;
  doctorName?: string;
  patientId?: string;
  selectedTime?: string;
  duration?: string;
  dateSelectionMode?: BookingCreationMode;
  appointmentSource?: "server" | "cache";
  cachedAppointments?: Appointment[];
  selectionDisabled?: boolean;
  minDate?: Date | string | null;
  title?: string;
  subtitle?: string;
  disableDatesWithTimeConflict?: boolean;
  timeConflictMessage?: string;
  excludeAppointmentId?: string | null;
}

const normalizeDateInput = (value?: Date | string | null): Date => {
  if (!value) return new Date();
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value;
  }

  const parsed = parseLocalDateOnly(value) || new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

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

export function DatePickerModal({ 
  open, 
  onOpenChange, 
  selectedDate, 
  onDateSelect, 
  doctorName, 
  patientId,
  selectedTime,
  duration,
  dateSelectionMode = "standard",
  appointmentSource = "server",
  cachedAppointments = [],
  selectionDisabled = false,
  minDate,
  title = "Select Date",
  subtitle,
  disableDatesWithTimeConflict = false,
  timeConflictMessage = "That time and day is already booked. Please select another time or day.",
  excludeAppointmentId,
}: DatePickerModalProps) {
  const [viewDate, setViewDate] = useState<Date>(() => normalizeDateInput(selectedDate));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showTimeConflictAlert, setShowTimeConflictAlert] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string>("");
  const normalizedMinDate = React.useMemo(() => {
    if (!minDate) return null;
    const date = normalizeDateInput(minDate);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }, [minDate]);

  useEffect(() => {
    if (!open) return;
    setViewDate(normalizeDateInput(selectedDate));
    setShowTimeConflictAlert(false);
    setConflictMessage("");
  }, [open, selectedDate]);

  const isBeforeMinDate = (date: Date) => {
    if (!normalizedMinDate) return false;
    const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return candidate.getTime() < normalizedMinDate.getTime();
  };

  // Check if the selected time has a conflict on the given date
  const checkTimeConflict = (date: Date): boolean => {
    if (!selectedTime || !duration) return false;

    const dateStr = formatDateToYYYYMMDD(date);
    const durationMins = normalizeBookingDuration(duration);
    
    // Parse selected time to get slot start (format: "HH:MM")
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const slotStartDate = new Date(date);
    slotStartDate.setHours(hours, minutes, 0, 0);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMins * 60000);

    // Check for overlap with any appointment on that date
    const dayAppointments = appointments.filter(apt => {
      const aptDate = parseLocalDateOnly(apt.date) || new Date(apt.date);
      const aptDateStr = formatDateToYYYYMMDD(aptDate);
      return aptDateStr === dateStr
        && (!excludeAppointmentId || String(apt.id) !== String(excludeAppointmentId))
        && apt.status !== 'cancelled'
        && !isCartAppointmentStatus(apt.status);
    });

    for (const apt of dayAppointments) {
      const [aptHours, aptMinutes] = apt.time.split(':').map(Number);
      const aptStart = new Date(date);
      aptStart.setHours(aptHours, aptMinutes, 0, 0);
      const aptDurationMins = normalizeBookingDuration(apt.duration);
      const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);

      // Check if times overlap
      if (slotStartDate < aptEnd && slotEndDate > aptStart) {
        return true;
      }
    }

    return false;
  };

  const handleDateSelect = (date: Date) => {
    if (selectionDisabled) return;
    if (isBeforeMinDate(date)) {
      setConflictMessage("Choose a date after the original appointment date.");
      setShowTimeConflictAlert(true);
      return;
    }

    // If a time is selected, check if it's available on the new date
    if (selectedTime && duration) {
      const hasConflict = checkTimeConflict(date);
      if (hasConflict) {
        setConflictMessage(timeConflictMessage);
        setShowTimeConflictAlert(true);
        return;
      }
    }
    
    onDateSelect(date);
    onOpenChange(false);
  };

  // Fetch appointments for the entire month being viewed
  useEffect(() => {
    if (!open || (!doctorName && !patientId)) return;

    const fetchMonthAppointments = async () => {
      try {
        if (appointmentSource === "cache") {
          const doctorKey = normalizeDoctorName(doctorName);
          setAppointments(
            cachedAppointments.filter((appointment) => {
              const matchesDoctor = !doctorKey || normalizeDoctorName(appointment.doctor) === doctorKey;
              const matchesPatient = !patientId || String(appointment.patientId) === String(patientId);
              return matchesDoctor && matchesPatient;
            })
          );
          return;
        }

        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        
        // Fetch for entire month
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const startDateStr = formatDateToYYYYMMDD(firstDay);
        const endDateStr = formatDateToYYYYMMDD(lastDay);

        const params = new URLSearchParams({
          startDate: startDateStr,
          endDate: endDateStr,
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
      }
    };

    fetchMonthAppointments();
  }, [open, viewDate, doctorName, patientId, appointmentSource, cachedAppointments]);

  const daysInMonth = React.useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    
    const calendarDays = [];
    // Previous month filler
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(null);
    }
    // Current month days
    for (let i = 1; i <= days; i++) {
      calendarDays.push(new Date(year, month, i));
    }
    return calendarDays;
  }, [viewDate]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(viewDate);
    newDate.setMonth(viewDate.getMonth() + (direction === 'next' ? 1 : -1));
    newDate.setDate(1);
    setViewDate(newDate);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    const normalizedSelectedDate = normalizeDateInput(selectedDate);
    return date.getDate() === normalizedSelectedDate.getDate() &&
      date.getMonth() === normalizedSelectedDate.getMonth() &&
      date.getFullYear() === normalizedSelectedDate.getFullYear();
  };

  const isDisabled = selectionDisabled;

  // Check if a day has any available slots
  const getDayStatus = (date: Date) => {
    const dateStr = formatDateToYYYYMMDD(date);
    const dayAppointments = appointments.filter(apt => {
      const aptDate = parseLocalDateOnly(apt.date) || new Date(apt.date);
      const aptDateStr = formatDateToYYYYMMDD(aptDate);
      return aptDateStr === dateStr
        && (!excludeAppointmentId || String(apt.id) !== String(excludeAppointmentId))
        && apt.status !== 'cancelled'
        && !isCartAppointmentStatus(apt.status);
    });

    // Assuming 8 AM - 5 PM with 30-min slots = 18 slots per day
    // If all slots are booked, mark as fully booked
    const totalSlots = 18;
    const bookedSlots = dayAppointments.length;
    
    if (bookedSlots >= totalSlots) {
      return 'fully-booked';
    } else if (bookedSlots > 0) {
      return 'has-bookings';
    }
    return 'available';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-tour-id="booking-date-picker" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <p className="text-sm font-medium text-gray-500">{subtitle}</p> : null}
        </DialogHeader>
        
        <div className="flex justify-center py-4">
          <div className="w-full">
            {/* Conflict Alert */}
            {showTimeConflictAlert && (
              <div className="mb-4 flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-900">{conflictMessage}</p>
                  <button 
                    onClick={() => setShowTimeConflictAlert(false)}
                    className="mt-2 text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6 px-1">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
              <h2 className="font-bold text-gray-900">
                {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => navigateMonth('next')}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
              >
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </button>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-100" />
                <span className="text-gray-600">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-100" />
                <span className="text-gray-600">Has Bookings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-100" />
                <span className="text-gray-600">Fully Booked</span>
              </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'M', 'T', 'W', 'Th', 'F', 'S'].map(day => (
                <div key={day} className="text-center text-[10px] font-bold text-gray-400 uppercase py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {daysInMonth.map((date, i) => {
                if (!date) return <div key={`empty-${i}`} className="aspect-square" />;

                const active = isSelected(date);
                const today = isToday(date);
                const dayStatus = getDayStatus(date);
                const isFullyBooked = dayStatus === 'fully-booked';
                const isTooEarly = isBeforeMinDate(date);
                const hasTimeConflict = Boolean(selectedTime && duration && checkTimeConflict(date));
                const isTimeConflictDisabled = disableDatesWithTimeConflict && hasTimeConflict;
                const isDisabled = selectionDisabled || isTooEarly || isTimeConflictDisabled;

                return (
                  <button
                    key={date.toISOString()}
                    disabled={isDisabled || isFullyBooked}
                    onClick={() => !isDisabled && !isFullyBooked && handleDateSelect(date)}
                    className={cn(
                      "aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all border",
                      selectionDisabled || isTooEarly
                        ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                        : isTimeConflictDisabled
                        ? "bg-red-50 text-red-400 border-red-200 cursor-not-allowed hover:bg-red-50"
                        : isFullyBooked
                        ? "bg-red-50 text-red-400 border-red-200 cursor-not-allowed hover:bg-red-50"
                        : active
                        ? "bg-blue-600 text-white border-blue-700 shadow-lg scale-110"
                        : today
                        ? "bg-emerald-100 text-emerald-700 border-emerald-300 font-bold hover:bg-emerald-200"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
                    )}
                    title={
                      selectionDisabled ? "Date selection is disabled during this tour step"
                      : isTooEarly ? "Too early"
                      : disableDatesWithTimeConflict && hasTimeConflict ? "Original time is already booked"
                      : isFullyBooked ? "Fully booked"
                      : dayStatus === 'has-bookings' ? "Has Bookings"
                      : "Available"
                    }
                  >
                    <div className="flex flex-col items-center">
                      <span>{date.getDate()}</span>
                      {dayStatus === 'fully-booked' && (
                        <span className="text-[8px] font-bold">FULL</span>
                      )}
                      {dayStatus === 'has-bookings' && (
                        <span className="text-[8px]">◐</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
