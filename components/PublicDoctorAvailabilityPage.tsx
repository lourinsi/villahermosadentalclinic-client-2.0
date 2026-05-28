"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DoctorAvailabilityView } from "@/components/DoctorAvailabilityView";
import BookingModalWrapper from "@/components/BookingModalWrapper";
import {
  cachePublicBookingAppointment,
  type PublicBookingAppointment,
} from "@/lib/publicBookingCache";

export default function PublicDoctorAvailabilityPage({
  doctorName,
}: {
  doctorName: string;
}) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<PublicBookingAppointment | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [defaultTime, setDefaultTime] = useState<string | undefined>();

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

  const handleBooked = (appointment?: PublicBookingAppointment) => {
    if (appointment?.id) {
      cachePublicBookingAppointment(appointment);
    }
    setSelectedAppointment(null);
    setDefaultDate(undefined);
    setDefaultTime(undefined);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header onBookAppointment={() => openBookingModal()} />

      <main className="flex-1">
        <DoctorAvailabilityView
          doctorName={doctorName}
          portal="public"
          onBookSlot={(date, time) => openBookingModal(date, time)}
          onOpenAppointment={(appointment) =>
            openCachedAppointment(appointment as PublicBookingAppointment)
          }
        />
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
          doctorName={doctorName}
          defaultDate={defaultDate}
          defaultTime={defaultTime}
          appointmentToEdit={selectedAppointment}
          onBooked={handleBooked as any}
          onDeleted={handleBooked as any}
        />
      )}

      <Footer />
    </div>
  );
}
