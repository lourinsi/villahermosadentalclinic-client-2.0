"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { PatientProfile, PatientDetailsRef, Patient } from "@/components/PatientProfile";
import BookingModalWrapper from "@/components/BookingModalWrapper";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { Appointment } from "@/hooks/useAppointments";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";

const normalizePatientName = (patient: Patient) =>
  (patient.name || `${patient.firstName || ""} ${patient.lastName || ""}`).trim();

export default function ReceptionistPatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const patientName = decodeURIComponent(params.patientname as string);
  const detailsRef = useRef<PatientDetailsRef | null>(null);
  const { refreshPatients, newAppointmentCreationMode } = useAppointmentModal();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModified, setIsModified] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedAppointmentToEdit, setSelectedAppointmentToEdit] = useState<Appointment | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadPatient = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          apiUrl(`/api/patients?page=1&limit=20&search=${encodeURIComponent(patientName)}&status=all`),
          { headers: getAuthHeaders(), credentials: "include" }
        );
        const result = await response.json().catch(() => null);
        const patients = Array.isArray(result?.data) ? result.data as Patient[] : [];
        const normalizedRouteName = patientName.trim().toLowerCase();
        const exactMatch = patients.find((item) => normalizePatientName(item).toLowerCase() === normalizedRouteName);
        const resolvedPatient = exactMatch || patients[0] || null;

        if (mounted) {
          setPatient(resolvedPatient);
          setIsModified(false);
        }
      } catch (error) {
        console.error("[PATIENT PROFILE] Failed to load patient:", error);
        if (mounted) {
          setPatient(null);
          toast.error("Failed to load patient profile");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadPatient();
    return () => {
      mounted = false;
    };
  }, [patientName]);

  const handleConfirmDeletePatient = async () => {
    if (!patient?.id) {
      toast.error("Missing patient id");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(apiUrl(`/api/patients/${patient.id}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Patient deleted successfully");
        setIsDeleteDialogOpen(false);
        refreshPatients();
        router.push("/receptionist/patients");
        return;
      }

      const json = await response.json().catch(() => null);
      toast.error(json?.message || "Failed to delete patient");
    } catch (error) {
      console.error("[DELETE PATIENT] Error:", error);
      toast.error("Error deleting patient");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-lg bg-white text-sm font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
        Loading patient profile...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-lg bg-white text-center shadow-sm ring-1 ring-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient not found</h1>
          <p className="mt-1 text-sm text-slate-500">No patient matched "{patientName}".</p>
        </div>
        <Button variant="brand" onClick={() => router.push("/receptionist/patients")}>
          Back to Patients
        </Button>
      </div>
    );
  }

  return (
    <>
      <PatientProfile
        patient={patient}
        detailsRef={detailsRef}
        onDeletePatient={() => setIsDeleteDialogOpen(true)}
        isModified={isModified}
        setIsModified={setIsModified}
        openBookingAppointmentId={bookingModalOpen ? selectedAppointmentToEdit?.id : null}
        onOpenBookingModal={(appointment: Appointment) => {
          setSelectedAppointmentToEdit(appointment);
          setBookingModalOpen(true);
        }}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Patient</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete {normalizePatientName(patient)}? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeletePatient} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {bookingModalOpen && (
        <BookingModalWrapper
          open={bookingModalOpen}
          onOpenChange={setBookingModalOpen}
          defaultPatientId={patient.id ? String(patient.id) : undefined}
          appointmentToEdit={selectedAppointmentToEdit}
          onBooked={() => {
            setSelectedAppointmentToEdit(null);
            refreshPatients();
          }}
          onDeleted={() => {
            setSelectedAppointmentToEdit(null);
            refreshPatients();
          }}
          appointmentCreationMode={newAppointmentCreationMode}
        />
      )}
    </>
  );
}
