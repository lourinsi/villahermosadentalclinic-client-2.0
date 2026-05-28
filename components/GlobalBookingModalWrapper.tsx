"use client";

import BookingModalWrapper from "./BookingModalWrapper";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";

/**
 * GlobalBookingModalWrapper
 * 
 * Connects BookingModal to the appointment modal context for patient booking flow.
 * This wrapper makes BookingModal available globally for all users (patients/admins).
 */
export function GlobalBookingModalWrapper() {
  const {
    isPatientBookingModalOpen,
    closePatientBookingModal,
    isCreateModalOpen,
    closeCreateModal,
    newAppointmentDate,
    newAppointmentTime,
    newAppointmentDoctorName,
    newAppointmentCreationMode,
  } = useAppointmentModal();

  // Open modal for either patient-specific booking flow or the generic create flow
  const shouldOpen = Boolean(isPatientBookingModalOpen || isCreateModalOpen);
  if (!shouldOpen) return null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isPatientBookingModalOpen) closePatientBookingModal();
      if (isCreateModalOpen) closeCreateModal();
    }
  };

  return (
    <BookingModalWrapper
      open={shouldOpen}
      onOpenChange={handleOpenChange}
      defaultDate={newAppointmentDate}
      defaultTime={newAppointmentTime}
      doctorName={newAppointmentDoctorName}
      appointmentCreationMode={isCreateModalOpen ? newAppointmentCreationMode : undefined}
    />
  );
}
