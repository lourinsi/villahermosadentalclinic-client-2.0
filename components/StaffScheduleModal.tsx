"use client";

import { useMemo } from "react";
import { Calendar, CalendarDays, Clock, Mail } from "lucide-react";
import type { Staff } from "@/lib/staff-types";
import type { Appointment } from "../hooks/useAppointments";
import { getDefaultAppointmentStatusColors } from "@/lib/status-colors";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { CalendarView } from "./CalendarView";
import { getStaffInitials } from "./sharedAddStaffLogic";
import { normalizeStaffValue } from "./staffModalOptions";

type StaffScheduleModalProps = {
  open: boolean;
  staff: Staff | null;
  scheduleDate: Date;
  appointments: Appointment[];
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAppointment: (appointment: Appointment) => void;
};

const dateKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const formatTime = (time?: string) => {
  if (!time) return "";
  const [hours, minutes = "00"] = time.split(":");
  const hour = Number(hours);
  if (!Number.isFinite(hour)) return time;
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const getAppointmentStatusClass = (status?: string) => {
  const colors = getDefaultAppointmentStatusColors(normalizeStaffValue(status));
  return `${colors.bgColor} ${colors.textColor}`;
};

export function StaffScheduleModal({
  open,
  staff,
  scheduleDate,
  appointments,
  isLoading,
  onOpenChange,
  onOpenAppointment,
}: StaffScheduleModalProps) {
  const sortedAppointments = useMemo(
    () =>
      [...appointments].sort((left, right) => {
        const dateCompare = left.date.localeCompare(right.date);
        if (dateCompare !== 0) return dateCompare;
        return (left.time || "").localeCompare(right.time || "");
      }),
    [appointments]
  );

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    const today = dateKey(now);
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    return sortedAppointments.filter((appointment) => {
      const status = normalizeStaffValue(appointment.status);
      if (status === "cancelled" || status === "completed") return false;
      if (appointment.date > today) return true;
      if (appointment.date < today) return false;
      return String(appointment.time || "00:00").slice(0, 5) >= currentTime;
    });
  }, [sortedAppointments]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[96dvh] w-[min(1180px,calc(100vw-0.75rem))] max-w-[calc(100vw-0.75rem)] flex-col overflow-hidden bg-gray-50 p-0 sm:max-h-[92vh] sm:max-w-[1180px]">
        <DialogHeader className="shrink-0 border-b bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <Avatar className="h-12 w-12 border-2 border-white shadow-sm sm:h-16 sm:w-16">
                {staff?.profilePicture ? (
                  <AvatarImage src={staff.profilePicture} alt={staff.name} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-blue-100 text-lg font-bold text-blue-700">
                  {getStaffInitials(staff?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 sm:text-xl">
                  <CalendarDays className="h-5 w-5 shrink-0 text-blue-600" />
                  <span className="truncate">{staff?.name ? `${staff.name}'s Schedule` : "Staff Schedule"}</span>
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Staff schedule details and appointment calendar.
                </DialogDescription>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {staff?.role ? <Badge variant="secondary">{staff.role}</Badge> : null}
                  {staff?.specialization ? <span>{staff.specialization}</span> : null}
                  {staff?.email ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {staff.email}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="self-start rounded-lg border bg-blue-50 px-4 py-3 text-sm md:self-auto">
              <p className="font-semibold text-blue-900">{appointments.length} appointments</p>
              <p className="text-blue-700">
                {scheduleDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
          <div className="space-y-4 sm:space-y-6">
            <div className="rounded-md bg-white p-2 shadow-sm sm:p-3 lg:p-4">
              <CalendarView
                key={staff?.id || staff?.name || "staff-schedule"}
                portal="doctor"
                defaultDoctorFilter={staff?.name ?? "all"}
                appointmentsOverride={appointments}
                isLoadingOverride={isLoading}
                onOpenAppointment={onOpenAppointment}
              />
            </div>

            <div className="rounded-md bg-white p-3 shadow-sm sm:p-4">
              <h4 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                <Calendar className="h-4 w-4" />
                Upcoming appointments ({upcomingAppointments.length})
              </h4>
              {upcomingAppointments.length === 0 ? (
                <p className="rounded-md border bg-white py-10 text-center text-sm text-muted-foreground">
                  No upcoming appointments scheduled
                </p>
              ) : (
                <div className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
                  {upcomingAppointments.map((appointment, index) => (
                    <button
                      key={appointment.id || `${appointment.date}-${appointment.time}-${index}`}
                      type="button"
                      onClick={() => onOpenAppointment(appointment)}
                      className="flex w-full items-center justify-between gap-4 rounded-md border bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="min-w-[54px] text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {new Date(`${appointment.date}T00:00:00`).getDate()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(`${appointment.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" })}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{appointment.patientName}</p>
                          <p className="text-sm text-muted-foreground">
                            <Clock className="mr-1 inline h-3 w-3" />
                            {formatTime(appointment.time)}
                            {appointment.duration ? ` - ${appointment.duration} min` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${getAppointmentStatusClass(appointment.status)} shrink-0`}>
                        {appointment.status || "scheduled"}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-white p-3 sm:p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
