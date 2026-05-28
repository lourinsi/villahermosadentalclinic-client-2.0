"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import BookingModalWrapper from "@/components/BookingModalWrapper";
import {
  PublicCartPageContent,
  usePublicBookingCache,
} from "@/components/PublicBookingPanels";
import type { PublicBookingAppointment } from "@/lib/publicBookingCache";

export default function PublicCartPage() {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<PublicBookingAppointment | null>(null);
  const { appointments, refresh } = usePublicBookingCache();
  const openBookingModal = () => {
    setSelectedAppointment(null);
    setIsBookingModalOpen(true);
  };
  const openCachedAppointment = (appointment: PublicBookingAppointment) => {
    setSelectedAppointment(appointment);
    setIsBookingModalOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header onBookAppointment={openBookingModal} />

      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <PublicCartPageContent
            appointments={appointments}
            onChanged={refresh}
            onBookAppointment={openBookingModal}
            onOpenAppointment={openCachedAppointment}
          />
        </div>
      </main>

      {isBookingModalOpen && (
        <BookingModalWrapper
          open={isBookingModalOpen}
          onOpenChange={(open) => {
            setIsBookingModalOpen(open);
            if (!open) setSelectedAppointment(null);
          }}
          title="Book Your Appointment"
          bookingMode="public"
          appointmentToEdit={selectedAppointment}
          onBooked={() => {
            refresh();
            setSelectedAppointment(null);
          }}
          onDeleted={() => {
            refresh();
            setSelectedAppointment(null);
          }}
        />
      )}

      <Footer />
    </div>
  );
}
