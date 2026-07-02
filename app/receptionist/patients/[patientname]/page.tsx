"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { PatientProfile, PatientDetailsRef, Patient } from "@/components/PatientProfile";
import BookingModalWrapper from "@/components/BookingModalWrapper";
import PatientUnsavedChangesDialog, { getVisiblePatientChanges } from "@/components/PatientUnsavedChangesDialog";
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
  const [isUnsavedExitDialogOpen, setIsUnsavedExitDialogOpen] = useState(false);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const [isSavingBeforeExit, setIsSavingBeforeExit] = useState(false);
  const isModifiedRef = useRef(isModified);
  const allowNavigationRef = useRef(false);
  const browserBackGuardArmedRef = useRef(false);
  const profileHrefRef = useRef("");

  useEffect(() => {
    isModifiedRef.current = isModified;
  }, [isModified]);

  const getChangedFields = React.useCallback(
    () => getVisiblePatientChanges(detailsRef.current?.changedFields || {}),
    []
  );

  const hasUnsavedChanges = React.useCallback(() => {
    return isModifiedRef.current && Object.keys(getChangedFields()).length > 0;
  }, [getChangedFields]);

  const openUnsavedExitDialog = React.useCallback((href: string) => {
    setPendingNavigationHref(href);
    setIsUnsavedExitDialogOpen(true);
  }, []);

  const requestNavigation = React.useCallback((href: string) => {
    if (hasUnsavedChanges()) {
      openUnsavedExitDialog(href);
      return;
    }

    allowNavigationRef.current = true;
    router.push(href);
  }, [hasUnsavedChanges, openUnsavedExitDialog, router]);

  const continuePendingNavigation = React.useCallback(() => {
    const href = pendingNavigationHref || "/receptionist/patients";
    allowNavigationRef.current = true;
    setIsUnsavedExitDialogOpen(false);
    setPendingNavigationHref(null);
    router.push(href);
  }, [pendingNavigationHref, router]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!hasUnsavedChanges() || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;

      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const nextHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (nextHref === currentHref) return;

      event.preventDefault();
      event.stopPropagation();
      openUnsavedExitDialog(nextHref);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [hasUnsavedChanges, openUnsavedExitDialog]);

  useEffect(() => {
    profileHrefRef.current = window.location.pathname + window.location.search + window.location.hash;
  }, [patientName]);

  useEffect(() => {
    if (isModified && !browserBackGuardArmedRef.current) {
      window.history.pushState({ ...window.history.state, patientProfileUnsavedGuard: true }, "", window.location.href);
      browserBackGuardArmedRef.current = true;
    }

    if (!isModified) {
      browserBackGuardArmedRef.current = false;
    }
  }, [isModified]);

  useEffect(() => {
    const handlePopState = () => {
      if (allowNavigationRef.current || !hasUnsavedChanges()) return;

      window.history.pushState(
        { patientProfileUnsavedGuard: true },
        "",
        profileHrefRef.current || `/receptionist/patients/${encodeURIComponent(patientName)}`
      );
      browserBackGuardArmedRef.current = true;
      openUnsavedExitDialog("/receptionist/patients");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasUnsavedChanges, openUnsavedExitDialog, patientName]);

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

  const handleSaveAndLeave = async () => {
    setIsSavingBeforeExit(true);
    try {
      const saved = await detailsRef.current?.save();
      if (saved) continuePendingNavigation();
    } finally {
      setIsSavingBeforeExit(false);
    }
  };

  const handleLeaveWithoutSaving = () => {
    detailsRef.current?.discardDraft();
    setIsModified(false);
    continuePendingNavigation();
  };

  const handleKeepEditing = () => {
    setPendingNavigationHref(null);
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
        onBackToPatients={() => requestNavigation("/receptionist/patients")}
        openBookingAppointmentId={bookingModalOpen ? selectedAppointmentToEdit?.id : null}
        onOpenBookingModal={(appointment: Appointment) => {
          setSelectedAppointmentToEdit(appointment);
          setBookingModalOpen(true);
        }}
      />

      <PatientUnsavedChangesDialog
        open={isUnsavedExitDialogOpen}
        onOpenChange={setIsUnsavedExitDialogOpen}
        title="Unsaved Patient Changes"
        description="You have unsaved changes. Review them before leaving this patient profile."
        changes={getChangedFields()}
        primaryLabel={isSavingBeforeExit ? "Saving..." : "Save & Leave"}
        secondaryLabel="Leave Without Saving"
        cancelLabel="Keep Editing"
        onPrimary={handleSaveAndLeave}
        onSecondary={handleLeaveWithoutSaving}
        onCancel={handleKeepEditing}
        loading={isSavingBeforeExit}
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
