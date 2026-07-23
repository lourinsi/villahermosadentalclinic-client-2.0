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
    isEditModalOpen,
    closeEditModal,
    selectedAppointment,
    newAppointmentDate,
    newAppointmentTime,
    newAppointmentPatientId,
    newAppointmentDoctorName,
    newAppointmentCreationMode,
  } = useAppointmentModal();

  // Open modal for patient-specific booking flow, generic create flow, or edit flow
  const shouldOpen = Boolean(isPatientBookingModalOpen || isCreateModalOpen || isEditModalOpen);
  if (!shouldOpen) return null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isPatientBookingModalOpen) closePatientBookingModal();
      if (isCreateModalOpen) closeCreateModal();
      if (isEditModalOpen) closeEditModal();
    }
  };

  return (
    <BookingModalWrapper
      open={shouldOpen}
      onOpenChange={handleOpenChange}
      appointmentToEdit={isEditModalOpen ? (selectedAppointment || undefined) : undefined}
      defaultDate={newAppointmentDate}
      defaultTime={newAppointmentTime}
      defaultPatientId={isCreateModalOpen ? newAppointmentPatientId : undefined}
      doctorName={newAppointmentDoctorName}
      appointmentCreationMode={newAppointmentCreationMode}
    />
  );
}
