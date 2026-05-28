"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DoctorsGrid } from "@/components/DoctorsGrid";
import BookingModalWrapper from "@/components/BookingModalWrapper";
import {
  cachePublicBookingAppointment,
  type PublicBookingAppointment,
} from "@/lib/publicBookingCache";

export default function PublicDoctorsPage() {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header onBookAppointment={() => setIsBookingModalOpen(true)} />

      <main className="flex-1">
        <DoctorsGrid portal="public" />
      </main>

      {isBookingModalOpen && (
        <BookingModalWrapper
          open={isBookingModalOpen}
          onOpenChange={setIsBookingModalOpen}
          title="Book Your Appointment"
          bookingMode="public"
          onBooked={(appointment) => {
            if (appointment?.id) {
              cachePublicBookingAppointment(appointment as PublicBookingAppointment);
            }
          }}
          onDeleted={(appointment) => {
            if (appointment?.id) {
              cachePublicBookingAppointment(appointment as PublicBookingAppointment);
            }
          }}
        />
      )}

      <Footer />
    </div>
  );
}
