"use client";

import { apiUrl } from "@/lib/api";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { buildModalMemoryKey, usePersistentModalMemory } from "@/hooks/usePersistentModalMemory";
import { CheckCircle2, UserPlus, X } from "lucide-react";
import {
  createCachedPublicBookingPatient,
  getCachedPublicBookingPatients,
} from "@/lib/publicBookingCache";

type ExistingPatientOption = {
  id?: string | number;
  firstName?: string;
  lastName?: string;
  name?: string;
};

type SimilarPatientMatch = {
  patient: ExistingPatientOption;
  displayName: string;
  isExact: boolean;
  score: number;
};

type AddPatientModalMemory = {
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
  };
  showSummary: boolean;
};

const normalizeNamePart = (value?: string | null) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const getDisplayPatientName = (patient: ExistingPatientOption) =>
  patient.name ||
  [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim() ||
  "Existing patient";

const getPatientNameParts = (patient: ExistingPatientOption) => {
  const firstName = String(patient.firstName || "").trim();
  const lastName = String(patient.lastName || "").trim();

  if (firstName || lastName) {
    return { firstName, lastName };
  }

  const nameParts = getDisplayPatientName(patient).trim().split(/\s+/);
  return {
    firstName: nameParts[0] || "",
    lastName: nameParts.slice(1).join(" "),
  };
};

const getEditDistance = (first: string, second: string) => {
  if (first === second) return 0;
  if (!first) return second.length;
  if (!second) return first.length;

  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  const current = Array(second.length + 1).fill(0);

  for (let i = 1; i <= first.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= second.length; j += 1) {
      const substitutionCost = first[i - 1] === second[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[second.length];
};

const getNameSimilarity = (first: string, second: string) => {
  const maxLength = Math.max(first.length, second.length);
  if (maxLength === 0) return 0;
  return 1 - getEditDistance(first, second) / maxLength;
};

const isCloseNamePart = (first: string, second: string) => {
  if (!first || !second) return false;
  if (first === second) return true;

  const maxLength = Math.max(first.length, second.length);
  if (maxLength <= 2) return false;

  const distance = getEditDistance(first, second);
  if (maxLength <= 4) return distance <= 1;

  return distance <= 2 || getNameSimilarity(first, second) >= 0.78;
};

const findSimilarPatientMatch = (
  formData: { firstName: string; lastName: string },
  patients: ExistingPatientOption[]
): SimilarPatientMatch | null => {
  const firstName = normalizeNamePart(formData.firstName);
  const lastName = normalizeNamePart(formData.lastName);
  if (!firstName || !lastName) return null;

  const fullName = `${firstName}${lastName}`;

  const matches = patients
    .map((patient): SimilarPatientMatch | null => {
      const patientNameParts = getPatientNameParts(patient);
      const patientFirstName = normalizeNamePart(patientNameParts.firstName);
      const patientLastName = normalizeNamePart(patientNameParts.lastName);
      if (!patientFirstName || !patientLastName) return null;

      const patientFullName = `${patientFirstName}${patientLastName}`;
      const firstSimilarity = getNameSimilarity(firstName, patientFirstName);
      const lastSimilarity = getNameSimilarity(lastName, patientLastName);
      const fullSimilarity = getNameSimilarity(fullName, patientFullName);
      const fullDistance = getEditDistance(fullName, patientFullName);
      const allowedFullDistance = fullName.length <= 8 ? 1 : fullName.length <= 14 ? 2 : 3;
      const isExact = firstName === patientFirstName && lastName === patientLastName;
      const isClose =
        isExact ||
        (isCloseNamePart(firstName, patientFirstName) && isCloseNamePart(lastName, patientLastName)) ||
        fullDistance <= allowedFullDistance ||
        (firstSimilarity >= 0.78 && lastSimilarity >= 0.78 && fullSimilarity >= 0.84);

      if (!isClose) return null;

      return {
        patient,
        displayName: getDisplayPatientName(patient),
        isExact,
        score: (firstSimilarity + lastSimilarity + fullSimilarity) / 3,
      };
    })
    .filter((match): match is SimilarPatientMatch => Boolean(match))
    .sort((a, b) => Number(b.isExact) - Number(a.isExact) || b.score - a.score);

  return matches[0] || null;
};

export function AddPatientModal() {
  const {
    isAddPatientModalOpen,
    closeAddPatientModal,
    refreshPatients,
    notifyPatientAdded,
    addPatientModalMode,
  } = useAppointmentModal();

  const [isLoading, setIsLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [existingPatients, setExistingPatients] = useState<ExistingPatientOption[]>([]);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
  });

  const firstNameRef = useRef<HTMLInputElement | null>(null);
  const modalMemoryPausedRef = useRef(false);
  const similarPatientMatch = useMemo(
    () => findSimilarPatientMatch(formData, existingPatients),
    [existingPatients, formData]
  );

  useEffect(() => {
    if (isAddPatientModalOpen) {
      modalMemoryPausedRef.current = false;
    }
  }, [isAddPatientModalOpen]);

  const addPatientMemoryKey = useMemo(
    () => buildModalMemoryKey("add-patient-modal", addPatientModalMode),
    [addPatientModalMode]
  );

  const restoreAddPatientMemory = useCallback((memory: AddPatientModalMemory) => {
    if (memory.formData) {
      setFormData({
        firstName: memory.formData.firstName || "",
        lastName: memory.formData.lastName || "",
        email: memory.formData.email || "",
        phone: memory.formData.phone || "",
        dateOfBirth: memory.formData.dateOfBirth || "",
      });
    }
    setShowSummary(Boolean(memory.showSummary));
  }, []);

  const isAddPatientMemoryPaused = useCallback(() => modalMemoryPausedRef.current, []);

  const clearAddPatientMemory = usePersistentModalMemory({
    key: addPatientMemoryKey,
    open: isAddPatientModalOpen,
    value: { formData, showSummary },
    restore: restoreAddPatientMemory,
    isPaused: isAddPatientMemoryPaused,
  });

  const clearCompletedAddPatientDraft = useCallback(() => {
    modalMemoryPausedRef.current = true;
    clearAddPatientMemory();
  }, [clearAddPatientMemory]);

  // Focus on first name when modal opens
  useEffect(() => {
    if (isAddPatientModalOpen && !showSummary) {
      setTimeout(() => {
        firstNameRef.current?.focus();
      }, 50);
    }
  }, [isAddPatientModalOpen, showSummary]);

  useEffect(() => {
    if (!isAddPatientModalOpen) return;

    let cancelled = false;
    setExistingPatients([]);

    const loadExistingPatients = async () => {
      if (addPatientModalMode === "publicBooking") {
        if (!cancelled) {
          setExistingPatients(getCachedPublicBookingPatients());
        }
        return;
      }

      try {
        const response = await fetch(apiUrl("/api/patients?limit=1000"), {
          credentials: "include",
        });
        const result = await response.json().catch(() => ({}));

        if (!cancelled) {
          setExistingPatients(response.ok && result?.success && Array.isArray(result.data) ? result.data : []);
        }
      } catch (error) {
        console.warn("Could not load existing patients for duplicate check:", error);
        if (!cancelled) setExistingPatients([]);
      }
    };

    loadExistingPatients();

    return () => {
      cancelled = true;
    };
  }, [addPatientModalMode, isAddPatientModalOpen]);

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      toast.error("Please enter first name");
      return false;
    }
    if (!formData.lastName.trim()) {
      toast.error("Please enter last name");
      return false;
    }
    if (!formData.phone.trim()) {
      toast.error("Please enter phone number");
      return false;
    }
    return true;
  };

  const handleReview = () => {
    if (validateForm()) {
      setShowSummary(true);
      if (similarPatientMatch) {
        toast.warning(`This name looks similar to ${similarPatientMatch.displayName}.`);
      }
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const patientData = {
        ...formData,
        createdAt: new Date().toISOString(),
      };
      const isPublicBookingPatient = addPatientModalMode === "publicBooking";

      if (isPublicBookingPatient) {
        const publicPatient = createCachedPublicBookingPatient(patientData);
        toast.success("Patient added to public booking cache!");
        notifyPatientAdded(publicPatient);
        clearCompletedAddPatientDraft();
        closeAddPatientModal();
        setShowSummary(false);
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          dateOfBirth: "",
        });
        return;
      }

      const response = await fetch(
        apiUrl("/api/patients"),
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patientData),
        }
      );
      const result = await response.json();

      if (result.success) {
        toast.success("Patient added successfully!");
        if (result.data) {
          notifyPatientAdded(result.data);
        } else {
          refreshPatients();
        }
        clearCompletedAddPatientDraft();
        closeAddPatientModal();
        setShowSummary(false);
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          dateOfBirth: "",
        });
      } else {
        toast.error(result.message || "Failed to add patient");
      }
    } catch (error) {
      console.error("Error adding patient:", error);
      toast.error("Error connecting to server. Make sure the backend is running on port 3001.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    closeAddPatientModal();
  };

  return (
    <Dialog open={isAddPatientModalOpen} onOpenChange={handleCancel}>
      <DialogContent
        data-tour-id="add-patient-modal"
        showCloseButton={false}
        className="!fixed !bottom-0 !left-0 !top-auto !flex h-auto max-h-[72dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-md sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.75rem]"
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-3 shadow-sm">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <UserPlus className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="truncate text-xl font-black tracking-tight text-slate-950">
                  Add New Patient
                </DialogTitle>
                <p className="mt-0.5 text-xs font-bold text-slate-500">Create a quick patient record.</p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={handleCancel} disabled={isLoading} className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close add patient modal">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Form View with Popover Overlay */}
        <div className="relative min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5 custom-scrollbar">
          <form 
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleReview();
              }
            }} 
            className={`space-y-4 transition-all ${showSummary ? 'opacity-30 pointer-events-none' : ''}`}
          >
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">First Name *</Label>
              <Input 
                ref={firstNameRef}
                data-tour-id="add-patient-first-name"
                value={formData.firstName} 
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))} 
                placeholder="Enter first name"
                required 
                className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Last Name *</Label>
              <Input 
                data-tour-id="add-patient-last-name"
                value={formData.lastName} 
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))} 
                placeholder="Enter last name"
                required 
                className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Phone Number *</Label>
              <Input 
                type="tel"
                data-tour-id="add-patient-phone"
                value={formData.phone} 
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} 
                placeholder="Enter phone number"
                required 
                className="h-12 rounded-xl border-slate-200 bg-white font-semibold shadow-sm"
              />
            </div>

            <div className="sticky bottom-0 -mx-5 mt-5 flex gap-3 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-sm">
              <Button 
                variant="outline" 
                type="button" 
                onClick={handleCancel} 
                disabled={isLoading}
                className="h-11 flex-1 rounded-full font-bold"
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                data-tour-id="add-patient-review"
                onClick={handleReview} 
                disabled={isLoading}
                className="h-11 flex-1 rounded-full bg-blue-600 font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700"
              >
                Review
              </Button>
            </div>
          </form>

          {/* Summary Popover Overlay */}
          {showSummary && (
            <div className="absolute inset-0 z-50 flex flex-col overflow-y-auto rounded-2xl border border-blue-100 bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-black text-gray-900">Confirm Patient Information</h3>
              </div>
              
              <div className="mb-5 grid gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-400">Full Name</div>
                  <div className="mt-1 font-black text-gray-900">{formData.firstName} {formData.lastName}</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-400">Phone</div>
                  <div className="mt-1 font-black text-gray-900">{formData.phone}</div>
                </div>
              </div>

              <div className="mb-5 flex-1 space-y-3 border-b border-slate-100 pb-4">
                <p className="text-sm text-muted-foreground">
                  Additional patient information can be updated later after creation.
                </p>

                {similarPatientMatch && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                    {similarPatientMatch.isExact ? (
                      <>
                        This looks like an existing patient: <span className="font-black">{similarPatientMatch.displayName}</span>.
                        Continue only if this is a different patient.
                      </>
                    ) : (
                      <>
                        The name seems similar to <span className="font-black">{similarPatientMatch.displayName}</span>.
                        Are you sure you want to continue?
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline"
                  type="button" 
                  data-tour-id="add-patient-summary-back"
                  onClick={() => setShowSummary(false)} 
                  disabled={isLoading}
                  className="h-11 rounded-full font-bold"
                >
                  Back
                </Button>
                <Button 
                  type="button" 
                  data-tour-id="add-patient-confirm"
                  onClick={handleSubmit} 
                  disabled={isLoading}
                  className="h-11 rounded-full bg-blue-600 font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700"
                >
                  {isLoading ? "Adding..." : "Confirm & Add"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
