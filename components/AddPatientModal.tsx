"use client";

import { apiUrl } from "@/lib/api";

import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
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
  const similarPatientMatch = useMemo(
    () => findSimilarPatientMatch(formData, existingPatients),
    [existingPatients, formData]
  );

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
    if (!formData.email.trim()) {
      toast.error("Please enter email");
      return false;
    }
    if (!formData.phone.trim()) {
      toast.error("Please enter phone number");
      return false;
    }
    if (!formData.dateOfBirth) {
      toast.error("Please enter date of birth");
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
    setShowSummary(false);
    closeAddPatientModal();
  };

  return (
    <Dialog open={isAddPatientModalOpen} onOpenChange={handleCancel}>
      <DialogContent data-tour-id="add-patient-modal" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Patient</DialogTitle>
        </DialogHeader>

        {/* Form View with Popover Overlay */}
        <div className="relative">
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
              <Label>First Name *</Label>
              <Input 
                ref={firstNameRef}
                data-tour-id="add-patient-first-name"
                value={formData.firstName} 
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))} 
                placeholder="Enter first name"
                required 
              />
            </div>

            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input 
                data-tour-id="add-patient-last-name"
                value={formData.lastName} 
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))} 
                placeholder="Enter last name"
                required 
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input 
                type="email"
                data-tour-id="add-patient-email"
                value={formData.email} 
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} 
                placeholder="Enter email"
                required 
              />
            </div>

            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input 
                type="tel"
                data-tour-id="add-patient-phone"
                value={formData.phone} 
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} 
                placeholder="Enter phone number"
                required 
              />
            </div>

            <div className="space-y-2">
              <Label>Date of Birth *</Label>
              <Input 
                type="date"
                data-tour-id="add-patient-date-of-birth"
                value={formData.dateOfBirth} 
                onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))} 
                required 
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                type="button" 
                onClick={handleCancel} 
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                data-tour-id="add-patient-review"
                onClick={handleReview} 
                disabled={isLoading}
              >
                Review
              </Button>
            </div>
          </form>

          {/* Summary Popover Overlay */}
          {showSummary && (
            <div className="absolute inset-0 z-50 flex flex-col overflow-y-auto rounded-lg border border-blue-200 bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Patient Information</h3>
              
              <div className="space-y-3 mb-6 flex-1">
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">Full Name</div>
                  <div className="font-medium text-gray-900">{formData.firstName} {formData.lastName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">Email</div>
                  <div className="font-medium text-gray-900">{formData.email}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">Phone</div>
                  <div className="font-medium text-gray-900">{formData.phone}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">Date of Birth</div>
                  <div className="font-medium text-gray-900">{formData.dateOfBirth}</div>
                </div>
              </div>

              <div className="mb-6 space-y-3 border-b pb-4">
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

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline"
                  type="button" 
                  data-tour-id="add-patient-summary-back"
                  onClick={() => setShowSummary(false)} 
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button 
                  type="button" 
                  data-tour-id="add-patient-confirm"
                  onClick={handleSubmit} 
                  disabled={isLoading}
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
