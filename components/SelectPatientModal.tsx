"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { Loader2, Plus, Stethoscope, X } from "lucide-react";
import { toast } from "sonner";

import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toBookingPatientOption } from "./sharedBookingLogic";
import type { PatientSelectionDraft } from "./universalSelectModalDrafts";

export type PatientSelectOption = {
  id: string;
  name: string;
  [key: string]: any;
};

type SelectPatientModalProps = {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  selectedPatientId?: string;
  selectedPatientName?: string;
  canCreatePatients?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** Preferred scalable API: one selected-patient draft emitted on Save. */
  draft?: PatientSelectionDraft<PatientSelectOption>;
  onSaveDraft?: (draft: PatientSelectionDraft<PatientSelectOption>) => void | Promise<void>;
  onConfirm?: (patient: PatientSelectOption) => void | Promise<void>;
};

export function SelectPatientModal({
  children,
  open,
  onOpenChange,
  selectedPatientId,
  selectedPatientName,
  canCreatePatients = true,
  title = "Select Patient",
  description = "Who is this appointment for?",
  confirmLabel = "Save Patient",
  draft,
  onSaveDraft,
  onConfirm,
}: SelectPatientModalProps) {
  const isStandalone = typeof open === "boolean" && typeof onOpenChange === "function";
  const { openAddPatientModal, lastAddedPatient, lastAddedPatientAt } = useAppointmentModal();
  const [patients, setPatients] = useState<PatientSelectOption[]>([]);
  const [selectedPatient, setSelectedPatient] = useState(() => String(draft?.patient?.id || selectedPatientId || ""));
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const lastHandledAddedPatientAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isStandalone || !open) return;

    let mounted = true;

    const loadPatients = async () => {
      setIsLoadingPatients(true);
      try {
        const response = await fetch(apiUrl("/api/patients?limit=1000"), {
          credentials: "include",
          headers: getAuthHeaders(),
        });
        const result = await response.json().catch(() => null);

        if (!mounted) return;

        if (response.ok && result?.success && Array.isArray(result.data)) {
          let list = result.data.map(toBookingPatientOption);

          if (selectedPatientId && !list.some((patient: PatientSelectOption) => String(patient.id) === String(selectedPatientId))) {
            list = [
              toBookingPatientOption({
                id: selectedPatientId,
                name: selectedPatientName || "Current patient",
              }),
              ...list,
            ];
          }

          setPatients(list);
          setSelectedPatient((current) => current || selectedPatientId || list[0]?.id || "");
        } else {
          setPatients([]);
          if (selectedPatientId) {
            setPatients([
              toBookingPatientOption({
                id: selectedPatientId,
                name: selectedPatientName || "Current patient",
              }),
            ]);
            setSelectedPatient(selectedPatientId);
          }
        }
      } catch (error) {
        console.error("[SelectPatientModal] Failed to load patients:", error);
        toast.error("Failed to load patients");
        if (mounted && selectedPatientId) {
          setPatients([
            toBookingPatientOption({
              id: selectedPatientId,
              name: selectedPatientName || "Current patient",
            }),
          ]);
          setSelectedPatient(selectedPatientId);
        }
      } finally {
        if (mounted) setIsLoadingPatients(false);
      }
    };

    loadPatients();

    return () => {
      mounted = false;
    };
  }, [isStandalone, open, selectedPatientId, selectedPatientName]);

  useEffect(() => {
    if (!open || !draft) return;
    setSelectedPatient(String(draft.patient?.id || ""));
  }, [open, draft]);

  useEffect(() => {
    if (!isStandalone || !open || !lastAddedPatient || !lastAddedPatientAt) return;
    if (lastHandledAddedPatientAtRef.current === lastAddedPatientAt) return;

    const patientOption = toBookingPatientOption(lastAddedPatient);
    setPatients((current) => {
      const filtered = current.filter((patient) => String(patient.id) !== String(patientOption.id));
      return [patientOption, ...filtered];
    });
    setSelectedPatient(patientOption.id);
    lastHandledAddedPatientAtRef.current = lastAddedPatientAt;
  }, [isStandalone, lastAddedPatient, lastAddedPatientAt, open]);

  if (!isStandalone) {
    return (
      <div data-tour-id="booking-patient-step" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        {children}
      </div>
    );
  }

  const selectedPatientRecord = patients.find((patient) => String(patient.id) === String(selectedPatient));
  const canSave = Boolean(selectedPatientRecord && !isSaving && !isLoadingPatients);

  const handleConfirm = async () => {
    if (!selectedPatientRecord) {
      toast.error("Please select a patient");
      return;
    }

    setIsSaving(true);
    try {
      if (onSaveDraft) {
        await onSaveDraft({ patient: selectedPatientRecord });
      } else {
        await onConfirm?.(selectedPatientRecord);
      }
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-1.25rem)] sm:w-full sm:max-w-[560px] overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-0 shadow-2xl"
      >
        <DialogHeader className="border-b border-gray-100 px-5 pb-5 pt-5 text-left sm:px-7 sm:pt-7">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-blue-600 text-white shadow-xl shadow-blue-100 ring-4 ring-blue-50">
              <Stethoscope className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-2xl font-black tracking-tight text-gray-900">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm font-bold text-gray-400">
                {description}
              </DialogDescription>
            </div>
            {canCreatePatients ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-tour-id="booking-new-patient"
                disabled={isSaving}
                onClick={() => openAddPatientModal()}
                className="hidden h-12 shrink-0 gap-2 rounded-2xl border-2 px-5 text-[11px] font-black uppercase tracking-widest shadow-sm transition-all hover:border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
              >
                <Plus className="h-4 w-4" />
                New patient
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="h-10 w-10 shrink-0 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close select patient"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 px-5 py-6 sm:px-7">
          {canCreatePatients ? (
            <Button
              type="button"
              variant="outline"
              data-tour-id="booking-new-patient"
              disabled={isSaving}
              onClick={() => openAddPatientModal()}
              className="h-12 w-full gap-2 rounded-2xl border-2 text-[11px] font-black uppercase tracking-widest shadow-sm transition-all hover:border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:hidden"
            >
              <Plus className="h-4 w-4" />
              New patient
            </Button>
          ) : null}

          <Select value={selectedPatient} onValueChange={setSelectedPatient} disabled={isLoadingPatients || isSaving}>
            <SelectTrigger
              data-tour-id="booking-patient-select"
              className="h-20 rounded-[2rem] border-2 border-gray-100 bg-white px-8 text-lg font-bold shadow-sm transition-all hover:border-blue-200"
            >
              <SelectValue placeholder={isLoadingPatients ? "Loading patients..." : "Search or choose a patient"} />
            </SelectTrigger>
            <SelectContent data-tour-id="booking-patient-options" className="rounded-2xl border-none shadow-2xl">
              {patients.length > 0 ? (
                patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id} className="mx-2 my-1 rounded-xl">
                    {patient.name}
                  </SelectItem>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-sm font-bold text-gray-400">
                  {isLoadingPatients ? "Loading patients..." : "No patients found"}
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="gap-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:px-7">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="h-12 flex-1 rounded-2xl border-gray-200 bg-white text-sm font-black text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canSave}
            className="h-12 flex-1 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
