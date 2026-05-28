"use client";

import { apiUrl } from "@/lib/api";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { createCachedPublicBookingPatient } from "@/lib/publicBookingCache";

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
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
  });

  const firstNameRef = useRef<HTMLInputElement | null>(null);

  // Focus on first name when modal opens
  useEffect(() => {
    if (isAddPatientModalOpen && !showSummary) {
      setTimeout(() => {
        firstNameRef.current?.focus();
      }, 50);
    }
  }, [isAddPatientModalOpen, showSummary]);

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
            <div className="absolute inset-0 bg-white rounded-lg shadow-xl border border-blue-200 p-6 flex flex-col z-50">
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

              <p className="text-sm text-muted-foreground mb-6 pb-4 border-b">
                Additional patient information can be updated later after creation.
              </p>

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
