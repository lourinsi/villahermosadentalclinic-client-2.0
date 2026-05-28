"use client";

import { apiUrl } from "@/lib/api";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDoctors } from "@/hooks/useDoctors";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useAuth } from "@/hooks/useAuth";
import { Appointment } from "@/hooks/useAppointments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DoctorCalendar } from "@/components/DoctorCalendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Loader2, 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Award, 
  Mail,
  Eye,
} from "lucide-react";
import { TIME_SLOTS } from "@/lib/time-slots";
import { formatDateToYYYYMMDD } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ViewMode from "@/components/viewMode";
import { toast } from "sonner";
import { getCachedPublicBlockingAppointments } from "@/lib/publicBookingCache";
import { isCartAppointmentStatus, isReservedAppointmentStatus } from "@/lib/appointment-status";
import AppointmentHistoryView from "@/components/AppointmentHistoryView";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { findDoctorForValue, formatDoctorDisplayName, normalizeDoctorIdentity } from "@/lib/doctor-identity";

interface DoctorAvailabilityViewProps {
  doctorName: string;
  portal: "admin" | "patient" | "public";
  onBookSlot?: (date?: Date, time?: string, doctorName?: string) => void;
  onOpenAppointment?: (appointment: Appointment) => void;
}

export function DoctorAvailabilityView({
  doctorName,
  portal,
  onBookSlot,
  onOpenAppointment,
}: DoctorAvailabilityViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { doctors, isLoadingDoctors } = useDoctors(undefined, { publicBooking: portal === "public" });
  const { updateAppointment, openEditModal, openPatientBookingModal, isEditModalOpen, selectedAppointment } = useAppointmentModal();
  
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
  } = useNotificationAppointmentSnapshot(appointments);

  const doctor = useMemo(() => {
    return findDoctorForValue(doctors, doctorName);
  }, [doctors, doctorName]);
  const resolvedDoctorName = String(doctor?.name || doctorName || "").trim();
  const resolvedDoctorLabel = formatDoctorDisplayName(resolvedDoctorName);

  const doctorsListPath = portal === "admin" ? "/admin/doctors" : portal === "patient" ? "/patient/doctors" : "/doctors";

  const isSameDoctor = useCallback((value?: string) => {
    const matchedDoctor = findDoctorForValue(doctors, value);
    if (doctor?.id && matchedDoctor?.id) return String(doctor.id) === String(matchedDoctor.id);
    return normalizeDoctorIdentity(value) === normalizeDoctorIdentity(resolvedDoctorName);
  }, [doctor?.id, doctors, resolvedDoctorName]);

  const handleBookSlot = useCallback((date?: Date, time?: string) => {
    if (onBookSlot) {
      onBookSlot(date, time, resolvedDoctorName);
      return;
    }

    openPatientBookingModal(date, time, resolvedDoctorName);
  }, [resolvedDoctorName, onBookSlot, openPatientBookingModal]);
  const handleOpenSnapshotAppointment = useCallback((appointmentId: string) => {
    const appointment = appointments.find((item) => String(item.id) === String(appointmentId));
    setIsAppointmentHistoryOpen(false);
    resetAppointmentSnapshot();
    if (appointment) openEditModal(appointment, portal === "patient");
  }, [appointments, openEditModal, portal, resetAppointmentSnapshot, setIsAppointmentHistoryOpen]);
  const isSnapshotAppointmentOpen = Boolean(
    isEditModalOpen &&
    appointmentSnapshotId &&
    selectedAppointment?.id &&
    String(selectedAppointment.id) === String(appointmentSnapshotId)
  );

  const isOwnAppointment = useCallback((apt: Appointment | undefined): boolean => {
    if (!apt) return false;

    if (portal === "public") {
      return Boolean((apt as any).isPublicCache);
    }

    if (portal === "patient" && user?.patientId) {
      return String(apt.patientId) === String(user.patientId);
    }

    return false;
  }, [portal, user?.patientId]);

  const dateRange = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);

    if (viewMode === "day") {
      return { start: formatDateToYYYYMMDD(start), end: formatDateToYYYYMMDD(end) };
    } else if (viewMode === "week") {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      end.setDate(end.getDate() + (6 - day));
      return { start: formatDateToYYYYMMDD(start), end: formatDateToYYYYMMDD(end) };
    } else {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      return { start: formatDateToYYYYMMDD(start), end: formatDateToYYYYMMDD(end) };
    }
  }, [selectedDate, viewMode]);

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!doctorName) return;
      try {
        setIsLoadingAvailability(true);
        const doctorQuery = resolvedDoctorName || doctorName;
        
        let url = portal === "public"
          ? apiUrl(`/api/appointments/public-availability?doctor=${encodeURIComponent(doctorQuery)}&startDate=${dateRange.start}&endDate=${dateRange.end}`)
          : apiUrl(`/api/appointments?doctor=${encodeURIComponent(doctorQuery)}&startDate=${dateRange.start}&endDate=${dateRange.end}&includeUnpaid=true`);
        
        // If we have a patientId (logged in patient), include it in the query with OR logic
        // This will return appointments for THIS doctor OR for THIS patient (any doctor)
        if (portal !== "public" && user?.patientId) {
          url += `&patientId=${user.patientId}&parentId=${user.patientId}&matchType=or`;
        }

        const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token && portal !== "public") {
          headers.Authorization = `Bearer ${token}`;
        }
        const response = await fetch(url, { headers, credentials: "include" });
        const result = response.ok ? await response.json() : { success: false, data: [] };
        const serverAppointments = result.success ? result.data || [] : [];
        const publicCacheAppointments = portal === "public"
          ? getCachedPublicBlockingAppointments().filter((appointment) => {
              if (appointment.date < dateRange.start || appointment.date > dateRange.end) return false;
              return isSameDoctor(appointment.doctor);
            })
          : [];

        if (result.success || portal === "public") {
          setAppointments([...serverAppointments, ...publicCacheAppointments] as Appointment[]);
        }
      } catch (error) {
        console.error("Failed to fetch doctor appointments", error);
        if (portal === "public") {
          setAppointments(
            getCachedPublicBlockingAppointments().filter((appointment) => {
              if (appointment.date < dateRange.start || appointment.date > dateRange.end) return false;
              return isSameDoctor(appointment.doctor);
            }) as Appointment[]
          );
        }
      } finally {
        setIsLoadingAvailability(false);
      }
    };

    fetchAppointments();

    const handler = (e: Event) => {
      try {
        fetchAppointments();
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener('appointments:updated', handler as EventListener);
    return () => {
      window.removeEventListener('appointments:updated', handler as EventListener);
    };
  }, [dateRange, doctorName, isSameDoctor, portal, resolvedDoctorName, user]);

  const getDaySlots = useCallback((date: Date) => {
    const dateStr = formatDateToYYYYMMDD(date);
    // For display purposes: show own cancelled appointments for reference
    // For availability: exclude all cancelled appointments (they don't block slots)
    const dayAppointmentsForDisplay = appointments.filter(apt => {
      if (apt.date !== dateStr) return false;
      // Only show own cancelled appointments for visual reference
      if (user && apt.patientId === user.patientId && apt.status === 'cancelled') return true;
      // For actual blocking: exclude cancelled entirely, only show active appointments
      return apt.status !== 'cancelled';
    });
    
    // For checking actual availability (blocked slots)
    // Cart appointments do NOT block availability - they can be overridden
    // Only scheduled, reserved, and completed block availability
    const dayAppointmentsForAvailability = dayAppointmentsForDisplay.filter(apt => 
      apt.status !== 'cancelled' && !isCartAppointmentStatus(apt.status)
    );
    
    const now = new Date();
    const todayStr = formatDateToYYYYMMDD(now);
    const isToday = dateStr === todayStr;
    const isPastDate = !isToday && date < new Date(now.setHours(0, 0, 0, 0));
    
    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes();
    
    const timeToMinutes = (time: string): number => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    
    return TIME_SLOTS.map(slot => {
      const [hour, minute] = slot.split(':').map(Number);
      const isPastTime = isToday && (hour < currentHour || (hour === currentHour && minute <= currentMinute));
      const isPast = isPastTime || isPastDate;
      
      const slotMinutes = timeToMinutes(slot);
      const slotEndMinutes = slotMinutes + 30;
      
      let isBooked = false;
      let isTentative = false;
      let isCancelled = false;
      let isOtherDoctor = false;
      let slotAppointment: Appointment | undefined;
      let cancelledAppointment: Appointment | undefined;
      let pendingAppointments: Appointment[] = [];
      
      // Collect cart appointments that overlap this slot (they don't block, but we'll show the count)
      for (const apt of dayAppointmentsForDisplay.filter(a => isCartAppointmentStatus(a.status))) {
        const aptStart = timeToMinutes(apt.time);
        const aptEnd = aptStart + (apt.duration || 30);
        
        if (slotMinutes < aptEnd && slotEndMinutes > aptStart) {
          pendingAppointments.push(apt);
        }
      }
      
      const overlappingAppointments = dayAppointmentsForAvailability.filter((apt) => {
        const aptStart = timeToMinutes(apt.time);
        const aptEnd = aptStart + (apt.duration || 30);
        return slotMinutes < aptEnd && slotEndMinutes > aptStart;
      });

      const ownOverlappingAppointment = overlappingAppointments.find(isOwnAppointment);
      const blockingAppointment = ownOverlappingAppointment || overlappingAppointments[0];
      
      if (blockingAppointment) {
        isBooked = true;
        slotAppointment = blockingAppointment;

        if (!isSameDoctor(blockingAppointment.doctor)) {
          isOtherDoctor = true;
        }

        if (
          isReservedAppointmentStatus(blockingAppointment.status) ||
          blockingAppointment.paymentStatus === 'half-paid'
        ) {
          isTentative = true;
        }
      }

      // Only check for cancelled appointments IF the slot is not already booked/blocked
      // This allows showing the "CANCELLED" state only when the slot is otherwise open
      if (!isBooked) {
        for (const apt of dayAppointmentsForDisplay.filter(a => a.status === 'cancelled')) {
          const aptStart = timeToMinutes(apt.time);
          const aptEnd = aptStart + (apt.duration || 30);
          
          if (slotMinutes < aptEnd && slotEndMinutes > aptStart) {
            isCancelled = true;
            cancelledAppointment = apt;
            break;
          }
        }
      }
      
      return {
        time: slot,
        isAvailable: !isBooked && !isPast,
        isBooked,
        isTentative,
        isCancelled,
        isOtherDoctor,
        isPast,
        pendingAppointments,
        isOwnAppointment: isOwnAppointment(slotAppointment || cancelledAppointment),
        appointment: slotAppointment || cancelledAppointment
      };
    });
  }, [appointments, isOwnAppointment, isSameDoctor, user]);

  const handleSlotClick = async (slot: any) => {
    // If slot is available (including slots with cart appointments that can be overridden),
    // always open the booking modal
    if (slot.isAvailable) {
      handleBookSlot(selectedDate, slot.time);
    } else if (!slot.isAvailable && slot.isBooked && slot.appointment) {
      if (slot.isOwnAppointment) {
        if (portal === "public") {
          onOpenAppointment?.(slot.appointment);
          return;
        }

        if (portal === "patient") {
          if (slot.appointment.paymentStatus === 'paid' && slot.appointment.status !== 'scheduled') {
            setIsProcessing(true);
            try {
              await updateAppointment(slot.appointment.id, { ...slot.appointment, status: 'scheduled' });
              window.dispatchEvent(new CustomEvent('appointments:updated'));
            } catch (err) {
              console.error('Failed to auto-update appointment status', err);
            } finally {
              setIsProcessing(false);
            }
          }
          handleViewAppointment(slot.appointment);
          return;
        }
      }

      if (portal === "public") {
        toast.error("This slot is unavailable");
        return;
      }

      // Only open edit modal for actually booked/blocked slots (not cart)
      if (portal === "patient") {
        // Patient can only view their own appointments
        if (isOwnAppointment(slot.appointment)) {
          if (slot.appointment.paymentStatus === 'paid' && slot.appointment.status !== 'scheduled') {
            setIsProcessing(true);
            try {
              await updateAppointment(slot.appointment.id, { ...slot.appointment, status: 'scheduled' });
              window.dispatchEvent(new CustomEvent('appointments:updated'));
            } catch (err) {
              console.error('Failed to auto-update appointment status', err);
            } finally {
              setIsProcessing(false);
            }
          }
          handleViewAppointment(slot.appointment);
        } else {
          toast.error("This appointment belongs to another patient");
        }
      } else {
        // Admin can view all appointments
        handleViewAppointment(slot.appointment);
      }
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'day') {
      newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(selectedDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  const renderDayView = () => {
    const slots = getDaySlots(selectedDate);
    const isPastDate = selectedDate < new Date(new Date().setHours(0, 0, 0, 0));
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 bg-white rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-r border-gray-50">
          <DoctorCalendar
            selectedDate={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          />
        </div>
        
        <div className="p-6 flex flex-col bg-gray-50/30">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
            {isPastDate ? (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-40">
                <CalendarIcon className="h-12 w-12 text-gray-300 mb-4" />
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Past Date</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => handleSlotClick(slot)}
                    disabled={slot.isPast}
                    className={`p-3 rounded-lg font-medium text-sm transition-all ${
                      slot.isPast
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : slot.isAvailable
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer'
                        : slot.isOtherDoctor
                        ? 'bg-blue-700 text-white cursor-pointer'
                        : slot.isTentative
                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 cursor-pointer'
                        : 'bg-emerald-700 text-white cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{slot.time}</span>
                      <div className="flex items-center gap-1">
                        <Badge 
                          variant="secondary" 
                          className={`text-[10px] font-bold ${
                            slot.isPast ? 'bg-gray-200 text-gray-600' :
                            slot.isAvailable ? 'bg-emerald-100 text-emerald-700' :
                            slot.isOtherDoctor ? 'bg-blue-100 text-blue-700' :
                            slot.isTentative ? 'bg-yellow-100 text-yellow-700' :
                            'bg-emerald-600 text-white'
                          }`}
                        >
                          {slot.isPast ? 'PASSED' : 
                            (slot.isAvailable ? 'OPEN' : 
                            (slot.isOtherDoctor ? 'OTHER APPOINTMENT' : 
                            (slot.isTentative ? 'RESERVED' : 'BOOKED')))}
                        </Badge>
                        {slot.isAvailable && slot.pendingAppointments.length > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold cursor-pointer hover:bg-emerald-700 transition-colors">
                                  {slot.pendingAppointments.length}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="space-y-2">
                                  <p className="font-semibold text-sm">Cart Appointments:</p>
                                  {slot.pendingAppointments.map((apt, idx) => (
                                    <div key={idx} className="text-xs border-t border-emerald-700 pt-1 flex items-center justify-between">
                                      <div>
                                        <p className="font-medium">{apt.patientName}</p>
                                        <p className="text-emerald-200">{apt.time} - {apt.duration} min</p>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewAppointment(apt);
                                        }}
                                        className="ml-2 p-1 hover:bg-emerald-600 rounded transition-colors"
                                        title="View appointment"
                                      >
                                        <Eye size={14} className="text-emerald-200" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getWeekDates = useCallback(() => {
    const start = new Date(selectedDate);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [selectedDate]);

  const renderWeekView = () => {
    const weekDates = getWeekDates();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const maxSlotsDisplay = 4;

    return (
      <div className="bg-white rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <div className="grid gap-4 p-6" style={{ gridTemplateColumns: 'repeat(7, minmax(160px, 1fr))' }}>
            {weekDates.map((date) => {
              const slots = getDaySlots(date);
              const isPastDate = date < now;
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
              
              const openSlots = slots.filter(s => s.isAvailable && !s.isPast);
              const displaySlots = openSlots.slice(0, maxSlotsDisplay);
              const hasMore = openSlots.length > maxSlotsDisplay;

              return (
                <div key={dateStr} className="flex flex-col border border-gray-100 rounded-lg overflow-hidden">
                  <div className={`p-3 text-center font-semibold text-sm border-b ${
                    isPastDate ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-blue-50 text-blue-700 border-blue-100'
                  }`}>
                    <div className="font-bold">{dayStr}</div>
                    <div className="text-xs">{dateStr}</div>
                  </div>
                  
                  <div className="flex-1 flex flex-col bg-gray-50/50">
                    {isPastDate ? (
                      <div className="flex-1 flex items-center justify-center p-4">
                        <span className="text-[10px] text-gray-400 font-semibold">PAST DATE</span>
                      </div>
                    ) : openSlots.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center p-4">
                        <span className="text-[10px] text-gray-400 font-semibold">NO OPEN SLOTS</span>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <div className="space-y-1 p-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                          {displaySlots.map((slot) => (
                            <button
                              key={slot.time}
                              onClick={() => {
                              handleBookSlot(date, slot.time);
                            }}
                              className="w-full px-2 py-1 rounded text-[10px] font-bold transition-all text-center bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer"
                            >
                              {slot.time}
                            </button>
                          ))}
                        </div>
                        {hasMore && (
                          <button
                            onClick={() => {
                              setSelectedDate(date);
                              setViewMode('day');
                            }}
                            className="mt-2 mx-2 mb-2 py-1.5 rounded-lg text-[9px] font-bold uppercase bg-blue-600 text-white hover:bg-blue-700 transition-all"
                          >
                            View More
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const getMonthDates = useCallback(() => {
    const start = new Date(selectedDate);
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    
    const dates = [];
    const startDay = start.getDay();
    
    // Add previous month's dates
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(start);
      date.setDate(start.getDate() - (i + 1));
      dates.push({ date, isCurrentMonth: false });
    }
    
    // Add current month's dates
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      dates.push({ date: new Date(date), isCurrentMonth: true });
    }
    
    // Add next month's dates
    const remaining = 42 - dates.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(end);
      date.setDate(end.getDate() + i);
      dates.push({ date, isCurrentMonth: false });
    }
    
    return dates;
  }, [selectedDate]);

  const renderMonthView = () => {
    const monthDates = getMonthDates();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const monthStr = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const weekDayHeaders = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const maxSlotsDisplay = 3;

    return (
      <div className="bg-white rounded-xl overflow-hidden shadow-sm">
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">{monthStr}</h3>
          
          <div className="grid grid-cols-7 gap-2 mb-4">
            {weekDayHeaders.map((day) => (
              <div key={day} className="text-center font-bold text-xs text-gray-600 py-2 bg-gray-50 rounded">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {monthDates.map((dayObj, idx) => {
              const { date, isCurrentMonth } = dayObj;
              const isPastDate = date < now;
              const dateStr = formatDateToYYYYMMDD(date);
              const dayNum = date.getDate();
              const slots = getDaySlots(date);
              
              const openSlots = slots.filter(s => s.isAvailable && !s.isPast);
              const displaySlots = openSlots.slice(0, maxSlotsDisplay);
              const hasMore = openSlots.length > maxSlotsDisplay;
              const isSelected = formatDateToYYYYMMDD(date) === formatDateToYYYYMMDD(selectedDate);

              return (
                <div
                  key={idx}
                  className={`min-h-[160px] p-2 rounded-lg font-medium text-sm transition-all flex flex-col ${
                    !isCurrentMonth
                      ? 'bg-gray-50 text-gray-300 cursor-default'
                      : isPastDate
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-50 border-2 border-blue-600 text-gray-900'
                      : 'bg-white border border-gray-200 text-gray-700'
                  }`}
                >
                  <div className="font-bold text-right text-sm mb-1">{dayNum}</div>
                  
                  {isCurrentMonth && !isPastDate && openSlots.length > 0 && (
                    <div className="flex-1 flex flex-col space-y-0.5 text-left overflow-hidden">
                      {displaySlots.map((slot, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            handleBookSlot(date, slot.time);
                          }}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded truncate bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all text-left"
                        >
                          {slot.time}
                        </button>
                      ))}
                      {hasMore && (
                        <button
                          onClick={() => {
                            setSelectedDate(date);
                            setViewMode('day');
                          }}
                          className="text-[8px] font-bold text-blue-600 px-1.5 pt-1 border-t border-gray-200 hover:text-blue-700"
                        >
                          +{openSlots.length - maxSlotsDisplay} more
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (isLoadingDoctors) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!doctor && !isLoadingDoctors) {
    return (
      <div className="p-8 text-center bg-gray-50 min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-gray-900">Doctor not found</h2>
        <Button 
          onClick={() => router.push(doctorsListPath)} 
          className="mt-4 bg-blue-600"
        >
          Back to Doctors
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => router.push(doctorsListPath)}
              className="rounded-xl border-gray-200 shadow-sm bg-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-black text-gray-900 leading-none">Book with {resolvedDoctorLabel || "Doctor"}</h1>
              <p className="text-sm text-gray-500 mt-1 font-medium">{doctor?.specialization} Specialist</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
              <Button variant="ghost" size="icon" onClick={() => navigateDate('prev')} className="h-9 w-9 rounded-xl hover:bg-gray-100">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                className="px-3 h-9 text-xs font-black uppercase tracking-tighter hover:bg-gray-100"
                onClick={() => setSelectedDate(new Date())}
              >
                Today
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigateDate('next')} className="h-9 w-9 rounded-xl hover:bg-gray-100">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
              <Button 
                variant={viewMode === 'day' ? 'default' : 'ghost'} 
                className="h-9 px-3 text-xs font-bold uppercase rounded-xl"
                onClick={() => setViewMode('day')}
              >
                Day
              </Button>
              <Button 
                variant={viewMode === 'week' ? 'default' : 'ghost'} 
                className="h-9 px-3 text-xs font-bold uppercase rounded-xl"
                onClick={() => setViewMode('week')}
              >
                Week
              </Button>
              <Button 
                variant={viewMode === 'month' ? 'default' : 'ghost'} 
                className="h-9 px-3 text-xs font-bold uppercase rounded-xl"
                onClick={() => setViewMode('month')}
              >
                Month
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Doctor Card */}
          <div className="lg:col-span-3">
            <Card className="border-none shadow-2xl shadow-blue-900/5 overflow-hidden rounded-[2rem] bg-white sticky top-8">
              <div className="relative h-48 bg-gradient-to-b from-blue-500 to-blue-600">
                {doctor?.profilePicture && (
                  <Avatar className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 h-24 w-24 border-4 border-white shadow-xl">
                    <AvatarImage src={doctor.profilePicture} alt={resolvedDoctorName || "Doctor"} className="object-cover" />
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xl font-bold">
                      {resolvedDoctorName.charAt(0) || "D"}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
              <CardContent className="p-6 space-y-6 pt-16">
                <div>
                  <h2 className="text-xl font-black text-gray-900">{resolvedDoctorName || "Doctor"}</h2>
                  <p className="text-sm text-gray-500 font-medium">{doctor?.specialization}</p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Award className="h-4 w-4 text-blue-600" />
                    <span className="text-gray-600">{doctor?.role || doctor?.specialization || 'Dentist'}</span>
                  </div>
                  {doctor?.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <span className="text-gray-600 truncate">{doctor.email}</span>
                    </div>
                  )}
                </div>

                {doctor?.bio && (
                  <p className="text-xs text-gray-500 italic">{doctor.bio}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main View Area */}
          <div className="lg:col-span-9 space-y-6">
            {isLoadingAvailability ? (
              <div className="min-h-[500px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {viewMode === 'day' && renderDayView()}
                {viewMode === 'week' && renderWeekView()}
                {viewMode === 'month' && renderMonthView()}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-6 mt-8 px-6 py-4 bg-white rounded-3xl shadow-sm border border-gray-100 w-fit">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-600" />
                <span className="text-xs font-medium text-gray-600">BOOKED SLOT</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-yellow-400 border border-yellow-200" />
                <span className="text-xs font-medium text-gray-600">RESERVED SLOT</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-gray-600">OPEN SLOT</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-400" />
                <span className="text-xs font-medium text-gray-600">PASSED SLOT</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
      `}</style>
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
      />
    </div>
  );
}
