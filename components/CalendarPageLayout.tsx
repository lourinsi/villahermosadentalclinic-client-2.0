"use client";

import { Button } from "./ui/button";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useAuth } from "@/hooks/useAuth";
import { CalendarView } from "./CalendarView";
import { Suspense } from "react";
import { isCartAppointmentStatus } from "@/lib/appointment-status";

interface CalendarPageLayoutProps {
  portal: "admin" | "doctor" | "patient";
  doctorName?: string;
  defaultStatusFilter?: string[];
}

export function CalendarPageLayout({ portal, doctorName, defaultStatusFilter }: CalendarPageLayoutProps) {
  const { openCreateModal, appointments, refreshAppointments } = useAppointmentModal();
  const { user } = useAuth();
  const router = useRouter();

  // Find next available time slot for doctor
  const getNextAvailableSlot = () => {
    const now = new Date();
    const doctorName = user?.username;
    if (!doctorName) return { date: new Date(), time: undefined };

    // Start checking from tomorrow at 8:00 AM
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(8, 0, 0, 0);

    // Search for next 30 days
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(nextDay);
      checkDate.setDate(checkDate.getDate() + i);

      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (checkDate.getDay() === 0 || checkDate.getDay() === 6) continue;

      // Check each hour from 8 AM to 5 PM
      for (let hour = 8; hour < 17; hour++) {
        for (let min of [0, 30]) {
          const testTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
          const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

          // Check if this slot is available (no conflicting appointments)
          const hasConflict = appointments.some(apt => {
            const aptDoctorNorm = (apt.doctor || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();
            const doctorNorm = doctorName.replace(/^Dr\.\s+/i, "").toLowerCase().trim();
            
            if (aptDoctorNorm !== doctorNorm || apt.date !== dateStr) return false;
            if (isCartAppointmentStatus(apt.status)) return false;

            const [aptHour, aptMin] = apt.time.split(':').map(Number);
            const aptDuration = apt.duration || 30;
            const aptStart = new Date(checkDate);
            aptStart.setHours(aptHour, aptMin);
            const aptEnd = new Date(aptStart);
            aptEnd.setMinutes(aptEnd.getMinutes() + aptDuration);

            const testStart = new Date(checkDate);
            testStart.setHours(hour, min);
            const testEnd = new Date(testStart);
            testEnd.setMinutes(testEnd.getMinutes() + 30);

            return testStart < aptEnd && testEnd > aptStart;
          });

          if (!hasConflict) {
            return { date: checkDate, time: testTime };
          }
        }
      }
    }

    return { date: new Date(), time: undefined };
  };

  // Determine title, button text, and button action based on portal
  const getTitleAndAction = () => {
    switch (portal) {
      case "admin":
        return {
          title: "Appointment Calendar",
          buttonText: "New Appointment",
          buttonColor: "bg-violet-600 hover:bg-violet-700",
          onClick: () => openCreateModal(new Date()),
        };
      case "doctor": {
        const { date, time } = getNextAvailableSlot();
        return {
          title: "My Schedule",
          buttonText: "New Appointment",
          buttonColor: "bg-violet-600 hover:bg-violet-700",
          onClick: () => openCreateModal(date, time, user?.username),
        };
      }
      case "patient":
        return {
          title: "My Appointments",
          buttonText: "Book Appointment",
          buttonColor: "bg-blue-600 hover:bg-blue-700",
          onClick: () => router.push("/patient/doctors"),
        };
      default:
        return {
          title: "Calendar",
          buttonText: "New",
          buttonColor: "bg-gray-600 hover:bg-gray-700",
          onClick: () => {},
        };
    }
  };

  const { title, buttonText, buttonColor, onClick } = getTitleAndAction();

  return (
    <div data-tour-id={`${portal}-calendar-page`} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button 
            onClick={onClick}
            data-tour-id={`${portal}-calendar-new-appointment`}
            className={`text-white gap-2 rounded-xl ${buttonColor}`}
          >
            <Plus className="h-4 w-4" />
            {buttonText}
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <Suspense fallback={<div>Loading calendar...</div>}>
        <CalendarView 
          portal={portal} 
          defaultDoctorFilter={doctorName}
          defaultStatusFilter={defaultStatusFilter}
        />
      </Suspense>
    </div>
  );
}
