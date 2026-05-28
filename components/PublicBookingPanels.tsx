"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Plus,
  ShoppingCart,
  Stethoscope,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PUBLIC_BOOKING_CACHE_EVENT,
  PublicBookingAppointment,
  deleteCachedPublicBookingAppointment,
  getCachedPublicBookingAppointments,
} from "@/lib/publicBookingCache";
import { getAppointmentTypeName } from "@/lib/appointment-types";
import {
  CART_APPOINTMENT_STATUS,
  formatAppointmentStatusLabel,
  isCartAppointmentStatus,
  normalizeAppointmentStatus,
} from "@/lib/appointment-status";
import { TIME_SLOTS, formatTimeTo12h } from "@/lib/time-slots";
import { AllAppointmentsView } from "@/components/AllAppointmentsView";
import {
  getDefaultAppointmentStatusColors,
  getStatusBorderColorClass,
  getStatusDotColorClass,
} from "@/lib/status-colors";

const formatDateKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const formatLongDate = (dateKey: string) =>
  parseDateKey(dateKey).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatCalendarLabel = (date: Date, viewMode: "month" | "week" | "day") => {
  if (viewMode === "day") {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  if (viewMode === "week") {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const sortAppointments = (appointments: PublicBookingAppointment[]) =>
  [...appointments].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
  );

const activePublicAppointments = (appointments: PublicBookingAppointment[]) =>
  sortAppointments(
    appointments.filter(
      (appointment) =>
        String(appointment.status || "").toLowerCase() !== "cancelled"
    )
  );

const formatDoctorName = (doctor?: string) => {
  if (!doctor) return "Doctor pending";
  return /^Dr\./i.test(doctor) ? doctor : `Dr. ${doctor}`;
};

const formatMoney = (amount?: number) =>
  `PHP ${(Number(amount) || 0).toLocaleString()}`;

const statusClass = (status?: string) => {
  const colors = getDefaultAppointmentStatusColors(status);
  return `${colors.bgColor} ${colors.textColor} ${getStatusBorderColorClass(colors.bgColor)}`;
};

const statusDotClass = (status?: string) => {
  return getStatusDotColorClass(getDefaultAppointmentStatusColors(status).bgColor);
};

const getWeekDays = (date: Date) => {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });
};

export function usePublicBookingCache() {
  const [appointments, setAppointments] = useState<PublicBookingAppointment[]>([]);

  const refresh = () => {
    setAppointments(getCachedPublicBookingAppointments());
  };

  useEffect(() => {
    refresh();
    window.addEventListener(PUBLIC_BOOKING_CACHE_EVENT, refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener(PUBLIC_BOOKING_CACHE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { appointments, refresh };
}

export function PublicAppointmentCard({
  appointment,
  onRemove,
}: {
  appointment: PublicBookingAppointment;
  onRemove?: (id: string) => void;
}) {
  const treatment = getAppointmentTypeName(
    appointment.type,
    appointment.customType
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900">{treatment}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
              {formatLongDate(appointment.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              {formatTimeTo12h(appointment.time)}
            </span>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 capitalize ${statusClass(appointment.status)}`}
        >
          {formatAppointmentStatusLabel(appointment.status || CART_APPOINTMENT_STATUS)}
        </Badge>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-3">
        <div className="inline-flex min-w-0 items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="truncate">{appointment.patientName}</span>
        </div>
        <div className="inline-flex min-w-0 items-center gap-2">
          <Stethoscope className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="truncate">{formatDoctorName(appointment.doctor)}</span>
        </div>
        <div className="font-semibold text-gray-900">
          {formatMoney(appointment.price)}
        </div>
      </div>

      {onRemove && (
        <div className="mt-4 flex justify-end border-t border-gray-100 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(appointment.id)}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

export function PublicCartPageContent({
  appointments,
  onChanged,
  onBookAppointment,
  onOpenAppointment,
}: {
  appointments: PublicBookingAppointment[];
  onChanged?: () => void;
  onBookAppointment?: () => void;
  onOpenAppointment?: (appointment: PublicBookingAppointment) => void;
}) {
  const cartAppointments = useMemo(
    () =>
      activePublicAppointments(appointments).filter(
        (appointment) => isCartAppointmentStatus(appointment.status)
      ),
    [appointments]
  );

  const handleRemove = (id: string) => {
    deleteCachedPublicBookingAppointment(id);
    onChanged?.();
    toast.success("Appointment removed from public cart");
  };

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b bg-white pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <ShoppingCart className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                Public Appointment Cart
              </CardTitle>
              <CardDescription>
                Cached landing-page bookings waiting for clinic confirmation.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => onBookAppointment?.()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Book Appointment
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {cartAppointments.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
            <ShoppingCart className="mb-4 h-16 w-16 text-gray-200" />
            <h3 className="text-xl font-semibold text-gray-900">
              Public cart is empty
            </h3>
            <p className="mt-2 max-w-sm text-muted-foreground">
              Book from the landing page to add cached appointment requests here.
            </p>
          </div>
        ) : (
          <div className="p-6">
            <AllAppointmentsView
              appointments={cartAppointments as any}
              isLoading={false}
              onDelete={handleRemove}
              onOpenAppointment={onOpenAppointment as any}
              isCart={true}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PublicCalendarBoard({
  appointments,
  onBookAppointment,
  onOpenAppointment,
}: {
  appointments: PublicBookingAppointment[];
  onBookAppointment?: (date?: Date, time?: string) => void;
  onOpenAppointment?: (appointment: PublicBookingAppointment) => void;
}) {
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const calendarAppointments = useMemo(
    () =>
      activePublicAppointments(appointments).filter((appointment) => {
        const status = normalizeAppointmentStatus(appointment.status);
        return status === "scheduled" || status === "reserved";
      }),
    [appointments]
  );

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, PublicBookingAppointment[]>();
    for (const appointment of calendarAppointments) {
      const next = map.get(appointment.date) || [];
      next.push(appointment);
      map.set(appointment.date, next);
    }

    for (const [dateKey, items] of map.entries()) {
      map.set(dateKey, sortAppointments(items));
    }

    return map;
  }, [calendarAppointments]);

  const getAppointmentsForDate = (date: Date) =>
    appointmentsByDate.get(formatDateKey(date)) || [];

  const navigateDate = (direction: "prev" | "next") => {
    setSelectedDate((current) => {
      const next = new Date(current);
      const amount = direction === "next" ? 1 : -1;

      if (viewMode === "day") next.setDate(current.getDate() + amount);
      if (viewMode === "week") next.setDate(current.getDate() + amount * 7);
      if (viewMode === "month") next.setMonth(current.getMonth() + amount);

      return next;
    });
  };

  const goToday = () => {
    setSelectedDate(new Date());
  };

  const renderAppointmentPill = (
    appointment: PublicBookingAppointment,
    compact = false
  ) => {
    const treatment = getAppointmentTypeName(
      appointment.type,
      appointment.customType
    );

    return (
      <div
        key={appointment.id}
        onClick={(event) => {
          event.stopPropagation();
          onOpenAppointment?.(appointment);
        }}
        className={`overflow-hidden rounded-md border-l-4 ${statusClass(
          appointment.status
        )} cursor-pointer bg-opacity-70 px-2 py-1 text-xs shadow-sm transition-shadow hover:shadow-md`}
      >
        <div className="truncate font-semibold">
          {formatTimeTo12h(appointment.time)} - {formatDoctorName(appointment.doctor)}
        </div>
        {!compact && (
          <div className="truncate opacity-80">
            {appointment.patientName} • {treatment}
          </div>
        )}
      </div>
    );
  };

  const renderMonthView = () => {
    const startOfMonth = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      1
    );
    const start = new Date(startOfMonth);
    start.setDate(startOfMonth.getDate() - startOfMonth.getDay());

    const days = Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });

    return (
      <div className="grid grid-cols-7 border-l border-t border-gray-200">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="border-b border-r border-gray-200 bg-gray-50 p-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500"
          >
            {day}
          </div>
        ))}
        {days.map((day) => {
          const dateKey = formatDateKey(day);
          const dayAppointments = getAppointmentsForDate(day);
          const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
          const isToday = dateKey === formatDateKey(new Date());

          return (
            <button
              type="button"
              key={dateKey}
              onClick={() => {
                setSelectedDate(day);
                setViewMode("day");
              }}
              className={`min-h-[120px] border-b border-r border-gray-200 p-2 text-left transition-colors hover:bg-gray-50 ${
                isCurrentMonth ? "bg-white" : "bg-gray-50/60 text-gray-400"
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday ? "bg-violet-600 text-white" : "text-gray-800"
                  }`}
                >
                  {day.getDate()}
                </span>
                {dayAppointments.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {dayAppointments.length}
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                {dayAppointments.slice(0, 3).map((appointment) =>
                  renderAppointmentPill(appointment, true)
                )}
                {dayAppointments.length > 3 && (
                  <div className="pl-1 text-[10px] font-medium text-gray-500">
                    + {dayAppointments.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const dayAppointments = getAppointmentsForDate(selectedDate);

    return (
      <div className="divide-y divide-gray-100">
        {TIME_SLOTS.map((timeSlot) => {
          const slotAppointments = dayAppointments.filter(
            (appointment) => appointment.time === timeSlot
          );

          return (
            <div
              key={timeSlot}
              className="group relative flex min-h-[64px] items-start"
            >
              <div className="sticky left-0 z-10 w-28 bg-white px-4 pt-2 text-sm font-medium text-muted-foreground">
                {formatTimeTo12h(timeSlot)}
              </div>
              <button
                type="button"
                onClick={() => onBookAppointment?.(selectedDate, timeSlot)}
                className="absolute inset-y-2 left-32 right-4 z-0 rounded-lg border-2 border-dashed border-transparent opacity-0 transition-all hover:border-violet-200 hover:bg-violet-50/60 group-hover:opacity-100"
                aria-label={`Book appointment at ${formatTimeTo12h(timeSlot)}`}
              >
                <Plus className="mx-auto h-5 w-5 text-violet-300" />
              </button>
              <div className="relative z-10 flex-1 space-y-2 py-2 pr-4">
                {slotAppointments.map((appointment) =>
                  renderAppointmentPill(appointment)
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays(selectedDate);

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          <div className="sticky top-0 z-10 flex border-b-2 border-gray-200 bg-white">
            <div className="w-20 shrink-0" />
            {weekDays.map((day) => {
              const isToday = formatDateKey(day) === formatDateKey(new Date());
              return (
                <div
                  key={formatDateKey(day)}
                  className="flex-1 border-l border-gray-100 py-3 text-center"
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div
                    className={`mt-1 text-lg font-bold ${
                      isToday ? "text-violet-600" : "text-gray-900"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {TIME_SLOTS.map((timeSlot) => (
            <div key={timeSlot} className="flex min-h-[80px] border-b border-gray-50">
              <div className="sticky left-0 z-10 w-20 shrink-0 bg-white pr-4 pt-2 text-right text-sm font-medium text-muted-foreground">
                {formatTimeTo12h(timeSlot)}
              </div>
              {weekDays.map((day) => {
                const slotAppointments = getAppointmentsForDate(day).filter(
                  (appointment) => appointment.time === timeSlot
                );

                return (
                  <div
                    key={`${formatDateKey(day)}-${timeSlot}`}
                    className="group relative min-h-[80px] flex-1 border-l border-gray-100 p-1"
                  >
                    <button
                      type="button"
                      onClick={() => onBookAppointment?.(day, timeSlot)}
                      className="absolute inset-0 z-0 flex items-center justify-center opacity-0 transition-all hover:bg-violet-50/60 group-hover:opacity-100"
                      aria-label={`Book appointment at ${formatTimeTo12h(timeSlot)}`}
                    >
                      <Plus className="h-5 w-5 text-violet-300" />
                    </button>
                    <div className="relative z-10 space-y-1">
                      {slotAppointments.map((appointment) =>
                        renderAppointmentPill(appointment, true)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const statusLegend = [
    "scheduled",
    CART_APPOINTMENT_STATUS,
    "reserved",
    "cancelled",
    "completed",
    "tbd",
  ];

  const sortedForList = sortAppointments(calendarAppointments);

  return (
    <div className="space-y-6">
      <Card className="border-none bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center rounded-lg border bg-gray-50 p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateDate("prev")}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateDate("next")}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                className="h-10 gap-2 px-4 font-semibold shadow-sm"
                onClick={goToday}
              >
                <CalendarDays className="h-4 w-4 text-violet-600" />
                <span>{formatCalendarLabel(selectedDate, viewMode)}</span>
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {(["month", "week", "day"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
                      viewMode === mode
                        ? "bg-violet-50 text-violet-600"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <Badge
                variant="secondary"
                className="flex h-10 items-center gap-2 rounded-lg border-violet-100 bg-violet-50 px-4 font-semibold text-violet-700"
              >
                <div className="h-2 w-2 rounded-full bg-violet-600" />
                {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} View
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-none bg-white shadow-xl">
        <CardHeader className="border-b bg-gray-50/50 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              {viewMode === "day" && <Clock className="h-5 w-5 text-violet-600" />}
              {viewMode === "week" && <CalendarDays className="h-5 w-5 text-violet-600" />}
              {viewMode === "month" && <CalendarDays className="h-5 w-5 text-violet-600" />}
              {viewMode === "day" ? "Schedule" : "Appointment Overview"}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-4">
              {statusLegend.map((status) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div className={`h-3 w-3 rounded-full ${statusDotClass(status)}`} />
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-gray-500">
                    {formatAppointmentStatusLabel(status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[700px] overflow-y-auto">
            {viewMode === "month" && renderMonthView()}
            {viewMode === "week" && renderWeekView()}
            {viewMode === "day" && renderDayView()}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none bg-white shadow-sm">
        <CardHeader className="border-b bg-white py-4">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 text-violet-600" />
            <CardTitle className="text-base font-bold">All Public Bookings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {sortedForList.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm font-medium text-gray-500">
              No public bookings found.
            </div>
          ) : (
            <AllAppointmentsView
              appointments={sortedForList as any}
              isLoading={false}
              onOpenAppointment={onOpenAppointment as any}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PublicCalendarPageContent({
  appointments,
  onBookAppointment,
  onOpenAppointment,
}: {
  appointments: PublicBookingAppointment[];
  onBookAppointment?: (date?: Date, time?: string) => void;
  onOpenAppointment?: (appointment: PublicBookingAppointment) => void;
}) {
  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b bg-white pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <CalendarDays className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                Public Appointment Calendar
              </CardTitle>
              <CardDescription>
                All landing-page bookings saved in the public cache.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => onBookAppointment?.()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Book Appointment
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <PublicCalendarBoard
          appointments={appointments}
          onBookAppointment={onBookAppointment}
          onOpenAppointment={onOpenAppointment}
        />
      </CardContent>
    </Card>
  );
}

export function PublicCartDialog({
  open,
  onOpenChange,
  appointments,
  onChanged,
  onBookAppointment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: PublicBookingAppointment[];
  onChanged?: () => void;
  onBookAppointment?: () => void;
}) {
  const cartAppointments = useMemo(
    () => activePublicAppointments(appointments).filter((appointment) => isCartAppointmentStatus(appointment.status)),
    [appointments]
  );

  const handleRemove = (id: string) => {
    deleteCachedPublicBookingAppointment(id);
    onChanged?.();
    toast.success("Appointment removed from public cart");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Public Cart</DialogTitle>
          <DialogDescription>
            Cached landing-page bookings waiting for clinic confirmation.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[68vh] overflow-y-auto pr-1">
          {cartAppointments.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <CalendarDays className="mb-3 h-12 w-12 text-gray-300" />
              <div className="font-semibold text-gray-900">No public cart bookings</div>
              <Button
                type="button"
                onClick={onBookAppointment}
                className="mt-5 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Book Appointment
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {cartAppointments.map((appointment) => (
                <PublicAppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PublicCalendarDialog({
  open,
  onOpenChange,
  appointments,
  onBookAppointment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: PublicBookingAppointment[];
  onBookAppointment?: () => void;
}) {
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const calendarAppointments = useMemo(
    () => activePublicAppointments(appointments),
    [appointments]
  );
  const selectedDateKey = formatDateKey(selectedDate);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, PublicBookingAppointment[]>();
    for (const appointment of calendarAppointments) {
      const next = map.get(appointment.date) || [];
      next.push(appointment);
      map.set(appointment.date, next);
    }

    for (const [dateKey, items] of map.entries()) {
      map.set(dateKey, sortAppointments(items));
    }

    return map;
  }, [calendarAppointments]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [monthDate]);

  const selectedAppointments = appointmentsByDate.get(selectedDateKey) || [];
  const monthLabel = monthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const moveMonth = (amount: number) => {
    setMonthDate((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + amount);
      return next;
    });
  };

  const goToday = () => {
    const today = new Date();
    setMonthDate(today);
    setSelectedDate(today);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Public Calendar</DialogTitle>
          <DialogDescription>
            Landing-page bookings saved in the public cache.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[74vh] gap-5 overflow-y-auto lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 p-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => moveMonth(-1)}
                  className="h-9 w-9"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => moveMonth(1)}
                  className="h-9 w-9"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm font-bold text-gray-900">{monthLabel}</div>
              <Button type="button" variant="outline" size="sm" onClick={goToday}>
                Today
              </Button>
            </div>

            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-center text-[11px] font-bold uppercase text-gray-500">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dateKey = formatDateKey(day);
                const dayAppointments = appointmentsByDate.get(dateKey) || [];
                const isSelected = dateKey === selectedDateKey;
                const isCurrentMonth = day.getMonth() === monthDate.getMonth();
                const isToday = dateKey === formatDateKey(new Date());

                return (
                  <button
                    type="button"
                    key={dateKey}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-20 border-b border-r border-gray-100 p-2 text-left transition-colors hover:bg-blue-50 ${
                      isSelected ? "bg-blue-50 ring-2 ring-inset ring-blue-500" : ""
                    } ${isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400"}`}
                  >
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                        isToday ? "bg-blue-600 text-white" : "text-gray-700"
                      }`}
                    >
                      {day.getDate()}
                    </div>
                    {dayAppointments.length > 0 && (
                      <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        {dayAppointments.length}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {formatLongDate(selectedDateKey)}
                </div>
                <div className="text-xs text-gray-500">
                  {selectedAppointments.length} booking
                  {selectedAppointments.length === 1 ? "" : "s"}
                </div>
              </div>
              <Button
                type="button"
                onClick={onBookAppointment}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Book
              </Button>
            </div>

            {selectedAppointments.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <CalendarDays className="mb-3 h-12 w-12 text-gray-300" />
                <div className="font-semibold text-gray-900">No bookings on this date</div>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedAppointments.map((appointment) => (
                  <PublicAppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
