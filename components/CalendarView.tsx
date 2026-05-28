"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  CalendarRange, 
  Trash2, 
  Clock,
  X,
  DollarSign,
  ListFilter
} from "lucide-react";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useAppointmentStatuses } from "@/hooks/useAppointmentStatuses";
import { Appointment, AppointmentFilters } from "../hooks/useAppointments";
import { Badge } from "./ui/badge";

import { useDoctors } from "../hooks/useDoctors";
import { useAuth } from "@/hooks/useAuth";
import { TIME_SLOTS, formatTimeTo12h } from "../lib/time-slots";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { APPOINTMENT_TYPES, getAppointmentTypeName } from "../lib/appointment-types";
import { parseBackendDateToLocal, formatDateToYYYYMMDD } from "../lib/utils";
import { AllAppointmentsView } from "./AllAppointmentsView";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import CalendarPopover from "./CalendarPopover";
import AppointmentHistoryView from "./AppointmentHistoryView";

import ViewMode from "./viewMode";
import { useRouter, useSearchParams } from 'next/navigation';
import { isReservedAppointmentStatus, normalizeAppointmentStatus } from "@/lib/appointment-status";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import {
  getAppointmentCalendarStatusColors,
  getPaymentStatusBadgeClassName,
  getStatusBorderColorClass,
  getStatusSoftBgColorClass,
} from "@/lib/status-colors";

// Map numeric keys to readable UI labels using APPOINTMENT_STATUSES
// This will be moved inside the component since we need the hook
const getStatusLabelHelper = (key: number, statuses: any[]): string => {
  const status = statuses.find(s => s.key === key);
  return status?.label || String(key);
};

// Status filter defaults - will be supplemented by backend statuses
const DEFAULT_STATUS_FILTERS = ["all", "scheduled", "completed"];

type CalendarPortal = 'admin' | 'doctor' | 'patient' | 'public';

interface CalendarViewProps {
  portal?: CalendarPortal;
  defaultStatusFilter?: string[];
  defaultDoctorFilter?: string;
  appointmentsOverride?: Appointment[];
  isLoadingOverride?: boolean;
  onCreateAppointment?: (date?: Date, time?: string, doctorName?: string) => void;
  onOpenAppointment?: (appointment: Appointment) => void;
  onOpenSnapshotAppointment?: (appointment: Appointment) => void;
}

export function CalendarView({
  portal = 'admin',
  defaultStatusFilter,
  defaultDoctorFilter,
  appointmentsOverride,
  isLoadingOverride,
  onCreateAppointment,
  onOpenAppointment,
  onOpenSnapshotAppointment,
}: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();
  const [selectedDoctor, setSelectedDoctor] = useState(defaultDoctorFilter || "all");
  const [selectedType, setSelectedType] = useState("all");
  // For patient portal, use defaultStatusFilter if provided, otherwise default to my-calendar
  const [selectedStatus, setSelectedStatus] = useState(defaultStatusFilter ? defaultStatusFilter[0] : (portal === 'patient' ? "scheduled" : "my-calendar"));
  const statusFilterList = defaultStatusFilter || [];
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  
  const { statuses: APPOINTMENT_STATUSES } = useAppointmentStatuses();
  
  // Define getStatusLabel inside the component so it can use the hook
  const getStatusLabel = (key: number): string => getStatusLabelHelper(key, APPOINTMENT_STATUSES);
  const { 
    openCreateModal, 
    appointments, 
    deleteAppointment, 
    refreshAppointments, 
    openEditModal,
    isEditModalOpen,
    selectedAppointment
  } = useAppointmentModal();
  const displayedAppointments = appointmentsOverride ?? appointments;
  const usesExternalAppointments = appointmentsOverride !== undefined;
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
  } = useNotificationAppointmentSnapshot(displayedAppointments);
  

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const { doctors, isLoadingDoctors } = useDoctors(undefined, { publicBooking: portal === 'public' });

  // Check if a given date (and optional time) is in the past relative to now
  const isPastDateTime = useCallback((date?: Date, time?: string) => {
    if (!date) return false;
    const now = new Date();

    // Compare date-only if no time provided
    if (!time) {
      const check = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return check.getTime() < today.getTime();
    }

    const [hours, minutes] = time.split(':').map(Number);
    const checkDt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
    return checkDt.getTime() < now.getTime();
  }, []);

  const handleCreateAppointment = useCallback(
    (date?: Date, time?: string, doctorName?: string) => {
      // For public portal, prevent creating appointments in the past
      if (portal === 'public' && isPastDateTime(date, time)) {
        return;
      }

      if (onCreateAppointment) {
        onCreateAppointment(date, time, doctorName);
        return;
      }

      openCreateModal(date, time, doctorName);
    },
    [onCreateAppointment, openCreateModal, portal, isPastDateTime]
  );

  const handleOpenAppointment = useCallback(
    (appointment: Appointment) => {
      if (onOpenAppointment) {
        onOpenAppointment(appointment);
        return;
      }

      handleViewAppointment(appointment);
    },
    [onOpenAppointment, handleViewAppointment]
  );
  const handleOpenSnapshotAppointment = useCallback((appointmentId: string, appointmentSnapshot?: any) => {
    const appointment =
      displayedAppointments.find((item) => String(item.id) === String(appointmentId)) ||
      appointmentSnapshot;
    setIsAppointmentHistoryOpen(false);
    resetAppointmentSnapshot();
    if (!appointment) return;

    if (onOpenSnapshotAppointment) {
      onOpenSnapshotAppointment(appointment);
      return;
    }

    openEditModal(appointment);
  }, [displayedAppointments, onOpenSnapshotAppointment, openEditModal, resetAppointmentSnapshot, setIsAppointmentHistoryOpen]);
  const isSnapshotAppointmentOpen = Boolean(
    isEditModalOpen &&
    appointmentSnapshotId &&
    selectedAppointment?.id &&
    String(selectedAppointment.id) === String(appointmentSnapshotId)
  );
  
  // For doctor portal, automatically filter to logged-in doctor
  useEffect(() => {
    if (portal === 'doctor' && user) {
      setSelectedDoctor(user.username);
    }
  }, [portal, user]);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const doctorId = searchParams.get("doctor");
    if (doctorId) {
      setSelectedDoctor(doctorId);
    }
  }, [searchParams]);

  // Normalize statuses and exclude cancelled appointments from the calendar
  const filteredAppointments = useMemo(() => {
    let statusesToFilter = statusFilterList.length > 0 ? statusFilterList : [selectedStatus];
    
    // Handle "My Calendar" filter - shows scheduled, reserved, completed, and TBD appointments
    if (statusesToFilter.includes("my-calendar")) {
      statusesToFilter = ["scheduled", "reserved", "completed", "tbd"];
    }
    
    let filtered = displayedAppointments
      .map((a) => ({ ...a, status: normalizeAppointmentStatus(a.status) }))
      .filter((a) => a.status !== 'cancelled')
      .filter((a) => statusesToFilter.map(normalizeAppointmentStatus).includes(a.status));
    
    // For patient portal, only show appointments for the logged-in patient
    if (portal === 'patient' && user && (user as any).patientId) {
      filtered = filtered.filter((a) => String(a.patientId) === String((user as any).patientId));
    }
    
    return filtered;
  }, [displayedAppointments, selectedStatus, statusFilterList, portal, user]);

  const getViewRange = useCallback((date: Date) => {
    const start = new Date(date);
    const end = new Date(date);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (viewMode === 'day') {
      return { start, end };
    }

    if (viewMode === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return { start: weekStart, end: weekEnd };
    }

    if (viewMode === 'month') {
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      return { start: monthStart, end: monthEnd };
    }

    if (viewMode === 'custom' && dateRange?.from && dateRange?.to) {
      const start = new Date(dateRange.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.to);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    return { start, end };
  }, [viewMode, dateRange]);

  useEffect(() => {
    if (usesExternalAppointments) {
      setIsLoadingView(false);
      return;
    }

    // If we're in the custom view but the user hasn't selected both a start and end date,
    // don't fetch yet. This prevents an immediate refresh when the custom picker is opened
    // or when only the start date has been picked.
    if (viewMode === 'custom' && !(dateRange?.from && dateRange?.to)) {
      return;
    }

    const { start, end } = getViewRange(selectedDate);
    const filters: AppointmentFilters = {};

    if (searchTerm) {
      filters.search = searchTerm;
    } else {
      let fetchStartStr = "";
      let fetchEndStr = "";

      if (viewMode === 'custom' && dateRange?.from && dateRange?.to) {
        fetchStartStr = formatDateToYYYYMMDD(dateRange.from);
        fetchEndStr = formatDateToYYYYMMDD(dateRange.to);
      } else if (viewMode !== 'all') {
        const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
        const monthEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        fetchStartStr = formatDateToYYYYMMDD(monthStart);
        fetchEndStr = formatDateToYYYYMMDD(monthEnd);
      }

      filters.startDate = fetchStartStr;
      filters.endDate = fetchEndStr;
    }

    // Always apply other filters
    filters.doctor = selectedDoctor;
    filters.type = selectedType;
    // Don't send status to backend - we'll filter on the client side
    // Only send a single status for admin/doctor portals
    if (portal === 'patient' || portal === 'public' || statusFilterList.length === 0) {
      // For patient/public or when no specific status filter, fetch all and filter client-side
      filters.status = 'all';
    } else {
      // For admin/doctor with single status filter
      filters.status = selectedStatus;
    }

    setIsLoadingView(true);
    refreshAppointments(filters);
    const timer = setTimeout(() => setIsLoadingView(false), 500);
    return () => clearTimeout(timer);
  // Only re-run when relevant values change. For custom view we only care about
  // changes to the actual start/end dates (not the whole range object reference).
  }, [viewMode, selectedDate, searchTerm, dateRange?.from, dateRange?.to, selectedDoctor, selectedType, selectedStatus, defaultStatusFilter, getViewRange, refreshAppointments, portal, usesExternalAppointments]);

  const timeSlots = TIME_SLOTS;

  const formatTime = formatTimeTo12h;

  const formatDateLabel = (date: Date) => {
    if (viewMode === "day") {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } else if (viewMode === "week") {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (viewMode === "month") {
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (viewMode === "all") {
      return "All Appointments";
    } else {
      if (dateRange?.from && dateRange?.to) {
        return `${dateRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${dateRange.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      return "Select Range";
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'day') {
      newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (viewMode === 'month') {
      newDate.setMonth(selectedDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'custom' && dateRange?.from && dateRange?.to) {
      const diffTime = Math.abs(dateRange.to.getTime() - dateRange.from.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const shift = direction === 'next' ? diffDays : -diffDays;
      
      const newFrom = new Date(dateRange.from);
      newFrom.setDate(newFrom.getDate() + shift);
      const newTo = new Date(dateRange.to);
      newTo.setDate(newTo.getDate() + shift);
      
      setDateRange({ from: newFrom, to: newTo });
      return;
    }
    setSelectedDate(newDate);
  };

  const getWeekDays = (date: Date) => {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = formatDateToYYYYMMDD(date);
    // Filtering is now done by the backend, we just need to filter by date for the calendar views
    return filteredAppointments.filter(apt => apt.date === dateStr);
  };

  const getColorForType = (type: string) => {
    return getAppointmentCalendarStatusColors(type, APPOINTMENT_STATUSES);
  };

  // NOTE: Convert time string to minutes since midnight for easier comparison
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // NOTE: Check if two appointments overlap
  const appointmentsOverlap = (apt1: Appointment, apt2: Appointment): boolean => {
    const start1 = timeToMinutes(apt1.time);
    const end1 = start1 + (apt1.duration || 30);
    const start2 = timeToMinutes(apt2.time);
    const end2 = start2 + (apt2.duration || 30);
    
    return start1 < end2 && start2 < end1;
  };

  // NOTE: Organize appointments into columns to handle overlaps
  const organizeAppointmentsIntoColumns = (appointments: Appointment[]) => {
    if (appointments.length === 0) return { columns: [], appointmentColumns: new Map<string, number>(), maxOverlappingAt: new Map<string, number>() };
    
    // Sort appointments by start time, then by duration (longer first)
    const sorted = [...appointments].sort((a, b) => {
      const timeCompare = timeToMinutes(a.time) - timeToMinutes(b.time);
      if (timeCompare !== 0) return timeCompare;
      return (b.duration || 30) - (a.duration || 30);
    });

    const columns: Appointment[][] = [];
    const appointmentColumns = new Map<string, number>(); // appointmentId -> columnIndex
    
    sorted.forEach((apt: Appointment) => {
      let columnIndex = 0;
      while (columnIndex < columns.length) {
        const hasOverlap = columns[columnIndex].some(existingApt => 
          appointmentsOverlap(apt, existingApt)
        );
        if (!hasOverlap) break;
        columnIndex++;
      }
      
      if (columnIndex === columns.length) {
        columns.push([]);
      }
      
      columns[columnIndex].push(apt);
      appointmentColumns.set(apt.id, columnIndex);
    });

    const maxOverlappingAt = new Map<string, number>();
    
    // Group appointments into clusters of overlapping ones
    const clusters: Appointment[][] = [];
    sorted.forEach((apt: Appointment) => {
      let addedToCluster = false;
      for (const cluster of clusters) {
        if (cluster.some(c => appointmentsOverlap(apt, c))) {
          cluster.push(apt);
          addedToCluster = true;
          break;
        }
      }
      if (!addedToCluster) {
        clusters.push([apt]);
      }
    });

    clusters.forEach(cluster => {
      const maxCol = Math.max(...cluster.map(a => appointmentColumns.get(a.id) ?? 0)) + 1;
      cluster.forEach(a => {
        maxOverlappingAt.set(a.id, maxCol);
      });
    });

    return { columns, appointmentColumns, maxOverlappingAt };
  };

  const calculateAppointmentStyle = (duration: number = 60) => {
  const slotHeight = 64; // pixels per 30-minute slot (match patient view density)
    const slotsOccupied = duration / 30;
    return {
      height: `${slotHeight * slotsOccupied - 4}px`
    };
  };

  const renderDayView = () => {
    const dayAppointments = getAppointmentsForDate(selectedDate);
    const { appointmentColumns, maxOverlappingAt } = organizeAppointmentsIntoColumns(dayAppointments);

    // Calculate occupied time segments for the entire day (minute by minute)
    // This will help determine if a 30-minute slot is covered by any appointment duration.
const isMinuteOccupied: boolean[] = new Array(24 * 60).fill(false);
    dayAppointments.forEach((apt: Appointment) => {
      const startTimeMinutes = timeToMinutes(apt.time);
      const duration = apt.duration || 30; // Default to 30 mins
      const endTimeMinutes = startTimeMinutes + duration;

      for (let m = startTimeMinutes; m < endTimeMinutes; m++) {
        if (m >= 0 && m < isMinuteOccupied.length) {
          isMinuteOccupied[m] = true;
        }
      }
    });

    // Function to check if a 30-minute timeSlot is covered by an appointment
    const isSlotCovered = (timeSlot: string): boolean => {
      const slotStartMinutes = timeToMinutes(timeSlot);
      // Check if any minute within this 30-minute slot is occupied
      for (let m = slotStartMinutes; m < slotStartMinutes + 30; m++) {
        if (isMinuteOccupied[m]) {
          return true;
        }
      }
      return false;
    };

    return (
        <div className="space-y-0 relative">
    {timeSlots.map((timeSlot) => {
            const appointmentsStartingAtSlot = dayAppointments.filter((apt: Appointment) => apt.time === timeSlot);
            const currentSlotIsCovered = isSlotCovered(timeSlot); // Check if the 30-min slot is covered
            const isSlotPast = isPastDateTime(selectedDate, timeSlot);

            return (
              <div key={timeSlot} className="flex items-start min-h-[64px] border-b border-gray-100 relative group">
                {/* Plus button for occupied slots - upper right */}
                {!currentSlotIsCovered && !(portal === 'public' && isSlotPast) && (
                  /* Wide position for empty slots: centered in the main area */
                  <div
                    className="absolute inset-y-2 left-32 right-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10 hover:bg-violet-50/50 rounded-xl border-2 border-dashed border-transparent hover:border-violet-200/50 group/plus"
                    onClick={() => handleCreateAppointment(selectedDate, timeSlot, selectedDoctor !== 'all' ? selectedDoctor : undefined)}
                  >
                    <Plus className="h-6 w-6 text-violet-300 transition-colors group-hover/plus:text-violet-600" />
                  </div>
                )}

                {/* Time Label */}
              <div className="w-28 pl-4 pt-2 text-sm text-muted-foreground font-medium sticky left-0 bg-white z-10 pointer-events-none">
                <div>{formatTime(timeSlot)}</div>
                {/* Plus button for occupied slots - underneath time */}
                {currentSlotIsCovered && !(portal === 'public' && isSlotPast) && (
                  <div className="mt-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-auto">
                    <button
                      className="bg-white p-1 rounded-md shadow-sm hover:bg-violet-50/50 hover:border-violet-200 border border-transparent cursor-pointer flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateAppointment(selectedDate, timeSlot);
                      }}
                      aria-label={`Add appointment at ${timeSlot}`}
                    >
                      <Plus className="h-4 w-4 text-violet-300 group-hover:text-violet-600" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 relative min-h-[64px]">
                {/* Appointments starting at this slot */}
                {appointmentsStartingAtSlot.map((appointment: Appointment) => {
                  const columnIndex = appointmentColumns.get(appointment.id) ?? 0;
                  const totalColumns = maxOverlappingAt.get(appointment.id) ?? 1;
                  const typeName = getAppointmentTypeName(appointment.type, appointment.customType);
                  const colors = getColorForType(appointment.status);
                  const showPatient = selectedDoctor !== 'all';
                  
                  const width = `${100 / totalColumns}%`;
                  const left = `${(columnIndex * 100) / totalColumns}%`;
                  
                  return (
                    <div
                      key={appointment.id}
                      className={`absolute top-0 ${colors?.bg} ${colors?.text} ${colors?.border} border-l-4 rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-pointer z-20 overflow-hidden ${
                        isReservedAppointmentStatus(appointment.status) ? "border-dashed opacity-90" : 
                        normalizeAppointmentStatus(appointment.status) === "to-pay" ? "border-double border-orange-400" : ""
                      }`}
                      style={{
                        ...calculateAppointmentStyle(appointment.duration),
                        width: `calc(${width} - 4px)`,
                        left: `calc(${left} + 2px)`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAppointment(appointment);
                      }}
                    >
                      <div className="flex flex-col h-full">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <Avatar className="h-10 w-10 border border-gray-100">
                              {(() => {
                                // Show patient picture when doctor filter is applied, doctor picture when showing all doctors
                                if (showPatient) {
                                  return <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${appointment.patientName}`} alt={appointment.patientName} />;
                                } else {
                                  const doc = doctors.find(d => String(d.name) === String(appointment.doctor) || String(d.id) === String(appointment.doctor));
                                  const src = doc?.profilePicture || appointment.doctorProfile || `https://api.dicebear.com/7.x/avataaars/svg?seed=${appointment.doctor}`;
                                  return <AvatarImage src={src} alt={appointment.doctor} />;
                                }
                              })()}
                              <AvatarFallback>{showPatient ? String(appointment.patientName || '').substring(0,2).toUpperCase() : String(appointment.doctor || '').substring(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate pr-2 flex items-center gap-2">
                              {showPatient ? appointment.patientName : `Dr. ${appointment.doctor}`}
                              {appointment.paymentStatus === 'unpaid' && (
                                <Badge className={`${getPaymentStatusBadgeClassName(appointment.paymentStatus)} text-[8px] h-3 px-1 uppercase font-black`}>Unpaid</Badge>
                              )}
                            </div>
                            <div className="text-xs opacity-90 truncate">
                              {typeName} • {appointment.duration || 30}min
                            </div>
                            <div className="text-xs opacity-80 mt-1 truncate flex items-center gap-2">
                              <div className="text-[12px] font-medium">{showPatient ? '' : appointment.patientName}</div>
                            </div>
                          </div>
                        </div>
                        {appointment.price != null && (
                          <div className="text-xs font-medium mt-auto pt-1">
                            ${appointment.price.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays(selectedDate);

    // Pre-calculate layout for each day
    const dayLayouts = weekDays.map(day => {
      const dayAppointments = getAppointmentsForDate(day);
      const layout = organizeAppointmentsIntoColumns(dayAppointments);
      
      // Calculate occupied minutes
      const isMinuteOccupied = new Array(24 * 60).fill(false);
      dayAppointments.forEach(apt => {
        const startTimeMinutes = timeToMinutes(apt.time);
        const duration = apt.duration || 30;
        const endTimeMinutes = startTimeMinutes + duration;
        for (let m = startTimeMinutes; m < endTimeMinutes; m++) {
            if (m >= 0 && m < isMinuteOccupied.length) isMinuteOccupied[m] = true;
        }
      });

      return { day, appointments: dayAppointments, layout, isMinuteOccupied };
    });
    
    return (
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          <div className="flex border-b-2 border-gray-200 sticky top-0 bg-white z-10">
            <div className="w-20 flex-shrink-0"></div>
            {weekDays.map((day, idx) => (
              <div key={idx} className="flex-1 text-center py-3 border-l border-gray-100">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-bold mt-1 ${
                  day.toDateString() === new Date().toDateString() 
                    ? 'text-violet-600' 
                    : 'text-gray-900'
                }`}>
                  {day.getDate()}
                </div>
              </div>
            ))}
          </div>

          <div className="relative">
            {timeSlots.map((timeSlot) => (
              <div key={timeSlot} className="flex min-h-[80px] border-b border-gray-50">
                <div className="w-20 flex-shrink-0 pt-2 pr-4 text-right text-sm font-medium text-muted-foreground sticky left-0 bg-white z-10">
                  {formatTime(timeSlot)}
                </div>
                {weekDays.map((day, idx) => {
                  const { layout, isMinuteOccupied, appointments } = dayLayouts[idx];
                  const appointmentsForSlot = appointments.filter(apt => apt.time === timeSlot);
                  const { appointmentColumns, maxOverlappingAt } = layout;

                  const slotStartMinutes = timeToMinutes(timeSlot);
                  let currentSlotIsCovered = false;
                  for (let m = slotStartMinutes; m < slotStartMinutes + 30; m++) {
                      if (isMinuteOccupied[m]) {
                          currentSlotIsCovered = true;
                          break;
                      }
                  }
                  const isSlotPast = isPastDateTime(day, timeSlot);

                  return (
                  <div 
                    key={idx} 
                    className="flex-1 border-l border-gray-100 relative min-h-[80px] group"
                  >
                    {/* Plus button for occupied slots - upper right */}
                    {currentSlotIsCovered && !(portal === 'public' && isSlotPast) && (
                      <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-all z-30">
                        <button
                          className=" "
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateAppointment(day, timeSlot);
                          }}
                          aria-label={`Add appointment at ${timeSlot}`}
                        >
                          <Plus className="h-4 w-4 text-violet-300 group-hover:text-violet-600" />
                        </button>
                      </div>
                    )}

                    {/* Centered plus button for empty slots */}
                    {!currentSlotIsCovered && !(portal === 'public' && isSlotPast) && (
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10 hover:bg-violet-50/50 flex items-center justify-center"
                        onClick={() => handleCreateAppointment(day, timeSlot)}
                      >
                        <Plus className="h-5 w-5 text-violet-300" />
                      </div>
                    )}

                      <div className="relative w-full h-full">

                        {appointmentsForSlot.map((appointment: Appointment) => {
                          const columnIndex = appointmentColumns.get(appointment.id) ?? 0;
                          const totalColumns = maxOverlappingAt.get(appointment.id) ?? 1;
                          const typeName = getAppointmentTypeName(appointment.type, appointment.customType);
                          const colors = getColorForType(appointment.status);
                          const showPatient = selectedDoctor !== 'all';
                          
                          const width = `${100 / totalColumns}%`;
                          const left = `${(columnIndex * 100) / totalColumns}%`;

                          return (
                            <div 
                              key={appointment.id}
                              className={`absolute top-0 ${colors?.bg} ${colors?.text} ${colors?.border} border-l-4 rounded-lg p-2 shadow-sm hover:shadow-md transition-all cursor-pointer z-20 overflow-hidden text-xs ${
                                isReservedAppointmentStatus(appointment.status) ? "border-dashed opacity-90" : 
                                normalizeAppointmentStatus(appointment.status) === "to-pay" ? "border-double border-orange-400" : ""
                              }`}
                              style={{
                                ...calculateAppointmentStyle(appointment.duration),
                                width: `calc(${width} - 4px)`,
                                left: `calc(${left} + 2px)`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAppointment(appointment);
                              }}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2 truncate pr-1">
                                  <div className="flex-shrink-0">
                                    <Avatar className="h-7 w-7 border border-gray-100">
                                      {(() => {
                                        if (showPatient) {
                                          return <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${appointment.patientName}`} alt={appointment.patientName} />;
                                        } else {
                                          const doc = doctors.find(d => String(d.name) === String(appointment.doctor) || String(d.id) === String(appointment.doctor));
                                          const src = doc?.profilePicture || (appointment as any).doctorProfile || `https://api.dicebear.com/7.x/avataaars/svg?seed=${appointment.doctor}`;
                                          return <AvatarImage src={src} alt={appointment.doctor} />;
                                        }
                                      })()}
                                      <AvatarFallback>{showPatient ? String(appointment.patientName || '').substring(0,2).toUpperCase() : String(appointment.doctor || '').substring(0,2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                  </div>
                                  <div className="font-semibold truncate flex items-center gap-1">
                                    {showPatient ? appointment.patientName : `Dr. ${appointment.doctor}`}
                                    {isReservedAppointmentStatus(appointment.status) && (
                                      <Badge variant="outline" className="text-[7px] h-2.5 px-0.5 bg-yellow-100 border-yellow-300 text-yellow-700 leading-none">R</Badge>
                                    )}
                                    {normalizeAppointmentStatus(appointment.status) === "to-pay" && (
                                      <Badge variant="outline" className="text-[7px] h-2.5 px-0.5 bg-orange-100 border-orange-300 text-orange-700 leading-none">P</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="truncate opacity-90">{typeName}</div>
                              <div className="truncate opacity-75 mt-0.5">{showPatient ? '' : appointment.patientName}</div>
                              {appointment.price != null && <div className="mt-1 font-medium">${appointment.price.toFixed(2)}</div>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay();
    const daysInMonth = endOfMonth.getDate();
    
    const prevMonthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 0).getDate();
    
    const days = [];
    // Previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthEnd - i, currentMonth: false, date: new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, prevMonthEnd - i) });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, currentMonth: true, date: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i) });
    }
    // Next month days
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      days.push({ day: i, currentMonth: false, date: new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, i) });
    }

    return (
      <div className="grid grid-cols-7 border-t border-l border-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-3 text-center text-xs font-bold text-gray-500 bg-gray-50 border-r border-b border-gray-200 uppercase tracking-wider">
            {day}
          </div>
        ))}
        {days.map((item, idx) => {
          const dayAppointments = getAppointmentsForDate(item.date);
          const sortedDayAppointments = [...dayAppointments].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
          const isToday = item.date.toDateString() === new Date().toDateString();
          const isPastDay = isPastDateTime(item.date);

          return (
            <div
              key={idx}
              className={`min-h-[120px] p-2 border-r border-b border-gray-200 transition-colors ${
                item.currentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 text-gray-400'
              } ${portal === 'public' && isPastDay ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
              onClick={() => {
                if (portal === 'public' && isPastDay) return;
                setSelectedDate(item.date);
                setViewMode("day");
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-sm font-semibold p-1 rounded-full w-7 h-7 flex items-center justify-center ${
                  isToday ? 'bg-violet-600 text-white' : ''
                }`}>
                  {item.day}
                </span>
                {dayAppointments.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {dayAppointments.length}
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                {sortedDayAppointments.slice(0, 3).map((apt: Appointment) => {
                  const typeName = getAppointmentTypeName(apt.type, apt.customType);
                  const colors = getColorForType(apt.status);
                  const showPatient = selectedDoctor !== 'all';
                  
                  let avatarSrc = '';
                  let fallback = '';
                  if (showPatient) {
                    avatarSrc = `https://api.dicebear.com/7.x/avataaars/svg?seed=${apt.patientName}`;
                    fallback = String(apt.patientName || '').substring(0,2).toUpperCase();
                  } else {
                    const doc = doctors.find(d => String(d.name) === String(apt.doctor) || String(d.id) === String(apt.doctor));
                    avatarSrc = doc?.profilePicture || (apt as any).doctorProfile || `https://api.dicebear.com/7.x/avataaars/svg?seed=${apt.doctor}`;
                    fallback = String(apt.doctor || '').substring(0,2).toUpperCase();
                  }
                  
                  return (
                    <div
                      key={apt.id}
                      className={`text-[10px] p-1 rounded truncate border-l-2 ${colors.bg} ${colors.text} ${colors.border} ${isReservedAppointmentStatus(apt.status) ? "border-dashed opacity-80" : normalizeAppointmentStatus(apt.status) === "to-pay" ? "border-orange-400" : ""} flex items-center gap-2 cursor-pointer hover:shadow-sm transition-all`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAppointment(apt);
                      }}
                    >
                      <Avatar className="h-5 w-5 border border-gray-100 flex-shrink-0">
                        <AvatarImage src={avatarSrc} alt={showPatient ? apt.patientName : apt.doctor} />
                        <AvatarFallback>{fallback}</AvatarFallback>
                      </Avatar>
                      <div className="truncate">
                        {showPatient ? apt.patientName : `${apt.time} • Dr. ${apt.doctor}`}
                        {isReservedAppointmentStatus(apt.status) && " (R)"}
                        {normalizeAppointmentStatus(apt.status) === "to-pay" && " (P)"}
                      </div>
                    </div>
                  )
                })}
                {dayAppointments.length > 3 && (
                  <div className="text-[10px] text-muted-foreground pl-1 font-medium cursor-pointer hover:text-muted-foreground/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDate(item.date);
                      setViewMode("day");
                    }}
                  >
                    + {dayAppointments.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCustomView = () => {
    // Client-side filtering is removed, appointments are pre-filtered
    const sortedAppointments = [...filteredAppointments].filter((a) => {
      if (searchTerm) return true; // If searching, show all matching search results
      if (!dateRange?.from || !dateRange?.to) return false;
      const d = parseBackendDateToLocal(a.date);
      // Strip time for pure date comparison
      const checkDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());
      const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate());
      return checkDate >= fromDate && checkDate <= toDate;
    }).sort((a, b) => parseBackendDateToLocal(a.date).getTime() - parseBackendDateToLocal(b.date).getTime());
    
    return (
      <div className="space-y-4 p-4">
        {sortedAppointments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-gray-50 rounded-lg border-2 border-dashed">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No appointments found for the selected filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedAppointments.map((apt: Appointment) => {
              const typeName = getAppointmentTypeName(apt.type, apt.customType);
              const colors = getColorForType(apt.status);
              return (
                <Card key={apt.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => { 
                  handleOpenAppointment(apt);
                }}>
                  <div className={`h-1 ${colors.bg.replace('bg-', 'bg-').split(' ')[0]}`} />
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-lg">{apt.patientName}</div>
                      <Badge className={`${colors.bg} ${colors.text} border-none`}>{typeName}</Badge>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        <span>{parseBackendDateToLocal(apt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {apt.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{apt.duration || 60} minutes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{apt.doctor}</span>
                      </div>
                      {apt.price != null && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          <span>${apt.price.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-none bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center bg-gray-50 rounded-lg p-1 border ${viewMode === 'all' ? 'opacity-50 pointer-events-none' : ''}`}>
                <Button variant="ghost" size="sm" onClick={() => navigateDate('prev')} className="h-8 w-8 p-0" disabled={viewMode === 'all'}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigateDate('next')} className="h-8 w-8 p-0" disabled={viewMode === 'all'}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-10 gap-2 font-semibold shadow-sm px-4">
                    <CalendarRange className="h-4 w-4 text-violet-600" />
                    <span>{formatDateLabel(selectedDate)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 shadow-2xl border-none rounded-2xl" align="start">
                  <CalendarPopover 
                    viewMode={viewMode}
                    setViewMode={(mode: any) => {
                      setSearchTerm("");
                      setViewMode(mode);
                    }}
                    selectedDate={selectedDate}
                    setSelectedDate={(date) => {
                      setSearchTerm("");
                      setSelectedDate(date);
                    }}
                    dateRange={dateRange}
                    setDateRange={(range) => {
                      setSearchTerm("");
                      setDateRange(range);
                    }}
                    onClose={() => setShowDatePicker(false)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {/* Filters - visible only for admin/doctor */}
              {(portal === 'admin' || portal === 'doctor') && (
                <div className="flex items-center space-x-3">
                  {portal === 'admin' && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                        <SelectTrigger className="w-[180px] h-10 shadow-sm">
                          <SelectValue placeholder={isLoadingDoctors ? "Loading..." : "Filter by doctor"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Doctors</SelectItem>
                          {doctors.map((doctor) => (
                            <SelectItem key={doctor.id} value={doctor.name}>{doctor.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {(portal === 'admin' || portal === 'doctor') && (
                    <div className="flex items-center gap-2">
                      <ListFilter className="h-4 w-4 text-gray-400" />
                      <Select value={selectedType} onValueChange={setSelectedType}>
                        <SelectTrigger className="w-[180px] h-10 shadow-sm">
                          <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {APPOINTMENT_TYPES.map((type, index) => (
                            <SelectItem key={index} value={String(index)}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {(portal === 'admin' || portal === 'doctor') && (
                    <div className="flex items-center gap-2">
                      <ListFilter className="h-4 w-4 text-gray-400" />
                      <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger className="w-[180px] h-10 shadow-sm">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="my-calendar">My Calendar</SelectItem>
                          {APPOINTMENT_STATUSES.map((status) => (
                            <SelectItem key={status.key} value={status.value} className="capitalize">{status.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* View Mode Buttons and Status Badge - always on right */}
              <div className="flex items-center gap-3" data-tour-id="calendar-view-toggle">
                <div className="flex items-center gap-2">
                  {(['month','week','day'] as const).map((mode) => (
                    <button
                      key={mode}
                      data-tour-id={`calendar-view-${mode}`}
                      onClick={() => setViewMode(mode)}
                      className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${viewMode === mode ? 'text-violet-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-violet-100 h-10 px-4 rounded-lg font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-600 animate-pulse" />
                  {searchTerm !== "" ? "Search Results" : (viewMode === "day" ? "Day View" : viewMode === "week" ? "Week View" : viewMode === "month" ? "Month View" : viewMode === "custom" ? "Custom Range" : "All Appointments")}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xl border-none overflow-hidden bg-white">
        <CardHeader className="border-b bg-gray-50/50 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              {viewMode === "day" && <Clock className="h-5 w-5 text-violet-600" />}
              {viewMode === "week" && <CalendarRange className="h-5 w-5 text-violet-600" />}
              {viewMode === "month" && <CalendarIcon className="h-5 w-5 text-violet-600" />}
              {viewMode === "custom" && <Search className="h-5 w-5 text-violet-600" />}
              {searchTerm !== "" ? "Search Results" : (viewMode === "day" ? "Schedule" : "Appointment Overview")}
            </CardTitle>
            <div className="flex items-center gap-4 flex-wrap">
              {APPOINTMENT_STATUSES.map((status) => {
                const bgColor = getStatusSoftBgColorClass(status.bgColor);
                const borderColor = getStatusBorderColorClass(status.bgColor);
                return (
                  <div key={status.value} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${bgColor} border ${borderColor}`} />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{status.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[700px] overflow-y-auto">
            {(isLoadingOverride ?? isLoadingView) ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
                <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading schedule...</p>
              </div>
            ) : (
              <>
                {searchTerm !== "" ? renderCustomView() : (
                  <>
                    {viewMode === "day" && renderDayView()}
                    {viewMode === "week" && renderWeekView()}
                    {viewMode === "month" && renderMonthView()}
                    {viewMode === "custom" && (
                      (dateRange?.from && dateRange?.to) ? renderCustomView() : (
                        <div className="p-8 text-center text-muted-foreground">
                          <div className="text-lg font-bold mb-2">Select a start and end date</div>
                          <div className="text-sm">Choose both a start and end date from the date picker (calendar icon) to view appointments for a custom range.</div>
                        </div>
                      )
                    )}
                    {viewMode === "all" && (
                      <div className="p-4">
                        <AllAppointmentsView appointments={filteredAppointments} isLoading={isLoadingView} onOpenAppointment={handleOpenAppointment} />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Appointment</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-8 w-8" />
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this appointment? This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="px-8">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              className="px-8"
              onClick={() => {
                if (appointmentToDelete) {
                  deleteAppointment(appointmentToDelete);
                  setIsDeleteDialogOpen(false);
                  setAppointmentToDelete(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    </div>
  );
}

// Missing icon used in the snippet for custom view
function Users({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
