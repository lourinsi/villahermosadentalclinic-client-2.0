"use client";

import { Suspense, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import BookingModalWrapper from "@/components/BookingModalWrapper";
import { CalendarView } from "@/components/CalendarView";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { usePublicBookingCache } from "@/components/PublicBookingPanels";
import {
  cachePublicBookingAppointment,
  type PublicBookingAppointment,
} from "@/lib/publicBookingCache";

const PUBLIC_CALENDAR_STATUSES = ["reserved", "scheduled", "tbd"];

export default function PublicCalendarPage() {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<PublicBookingAppointment | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);
  const [defaultTime, setDefaultTime] = useState<string | undefined>(undefined);
  const { appointments, refresh } = usePublicBookingCache();
  const openBookingModal = (date?: Date, time?: string) => {
    setSelectedAppointment(null);
    setDefaultDate(date);
    setDefaultTime(time);
    setIsBookingModalOpen(true);
  };
  const openCachedAppointment = (appointment: PublicBookingAppointment) => {
    setSelectedAppointment(appointment);
    setDefaultDate(undefined);
    setDefaultTime(undefined);
    setIsBookingModalOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header
        onBookAppointment={() => openBookingModal()}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Public Appointment Calendar
            </h1>
            <Button
              onClick={() => openBookingModal()}
              className="gap-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Book Appointment
            </Button>
          </div>

          <Suspense fallback={<div>Loading calendar...</div>}>
            <CalendarView
              portal="public"
              defaultStatusFilter={PUBLIC_CALENDAR_STATUSES}
              appointmentsOverride={appointments as any}
              onCreateAppointment={openBookingModal}
              onOpenSnapshotAppointment={openCachedAppointment as any}
            />
          </Suspense>
        </div>
      </main>

      {isBookingModalOpen && (
        <BookingModalWrapper
          open={isBookingModalOpen}
          onOpenChange={(open) => {
            setIsBookingModalOpen(open);
            if (!open) {
              setSelectedAppointment(null);
              setDefaultDate(undefined);
              setDefaultTime(undefined);
            }
          }}
          title="Book Your Appointment"
          bookingMode="public"
          defaultDate={defaultDate}
          defaultTime={defaultTime}
          appointmentToEdit={selectedAppointment}
          onBooked={(appointment) => {
            if (appointment?.id) {
              cachePublicBookingAppointment(appointment as PublicBookingAppointment);
            }
            refresh();
            setSelectedAppointment(null);
          }}
          onDeleted={(appointment) => {
            if (appointment?.id) {
              cachePublicBookingAppointment(appointment as PublicBookingAppointment);
            }
            refresh();
            setSelectedAppointment(null);
          }}
        />
      )}

      <Footer />
    </div>
  );
}
