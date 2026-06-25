"use client";

import { apiUrl } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useAuth } from "@/hooks/useAuth";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
import { toast } from "sonner";
import { useDoctors } from "../hooks/useDoctors";
import { TIME_SLOTS, formatTimeTo12h } from "../lib/time-slots";
import { formatDateToYYYYMMDD } from "../lib/utils";
import { APPOINTMENT_TYPES } from "../lib/appointment-types";
import { Appointment } from "@/hooks/useAppointments";
import { DoctorCalendar } from "./DoctorCalendar";
import { ALLOWED_BOOKING_DURATIONS, normalizeBookingDuration } from "./sharedBookingLogic";
import { isCartAppointmentStatus, isReservedAppointmentStatus } from "@/lib/appointment-status";

type ScheduleFieldErrors = Partial<Record<"patientName" | "date" | "time" | "type" | "customType" | "doctor", string>>;

export function ScheduleAppointmentModal() {
  const {
    isScheduleModalOpen,
    closeScheduleModal,
    newAppointmentPatientName,
    newAppointmentPatientId,
    addAppointment,
    refreshAppointments,
    refreshTrigger,
    appointments
  } = useAppointmentModal();
  const { user } = useAuth();
  const { effectiveRole } = useAdminViewMode();

  const [dateAppointments, setDateAppointments] = useState<Appointment[]>([]);
  const [isLoadingDateAppointments, setIsLoadingDateAppointments] = useState(false);

  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateError, setDateError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ScheduleFieldErrors>({});
  const { doctors, isLoadingDoctors, reloadDoctors } = useDoctors(undefined, { enabled: isScheduleModalOpen });
  const errorClassName = "border-red-500 bg-red-50 focus:ring-red-500 focus-visible:ring-red-500";

  const [formData, setFormData] = useState({
    date: "",
    time: "",
    duration: "30",
    type: -1,
    customType: "",
    doctor: user?.role === "doctor" ? user.username : "",
    notes: "",
    patientName: newAppointmentPatientName || "",
    patientId: String(newAppointmentPatientId || "")
  });

  // New state: show a compact slot picker first for doctors
  const [showSlotPicker, setShowSlotPicker] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  const clearFieldError = (field: keyof ScheduleFieldErrors) => {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  // Update formData when patientName or patientId props change
  useEffect(() => {
    if (newAppointmentPatientName || newAppointmentPatientId) {
      setFormData(prev => ({
        ...prev,
        patientName: newAppointmentPatientName || prev.patientName,
        patientId: String(newAppointmentPatientId || ""),
        type: -1 // Reset type when patient changes
      }));
    }
  }, [newAppointmentPatientName, newAppointmentPatientId, isScheduleModalOpen]);

  useEffect(() => {
    if (isScheduleModalOpen) {
      reloadDoctors();
      setFieldErrors({});
      
      // Update doctor if logged in as doctor
      if (user?.role === "doctor") {
        setFormData(prev => ({ ...prev, doctor: user.username }));
      }

      // If the user is a doctor or admin, show the slot picker first
      if (effectiveRole === "doctor" || effectiveRole === "admin") {
        setShowSlotPicker(true);
      } else {
        setShowSlotPicker(false);
      }
    }
  }, [effectiveRole, isScheduleModalOpen, reloadDoctors, user]);

  // Fetch all appointments for the selected date to check for clinic-wide conflicts
  // This bypasses view filters to ensure global conflict detection
  useEffect(() => {
    const fetchDateAppointments = async () => {
      if (!formData.date || !isScheduleModalOpen) {
        setDateAppointments([]);
        return;
      }
      setIsLoadingDateAppointments(true);
      try {
        const response = await fetch(apiUrl(`/api/appointments?startDate=${formData.date}&endDate=${formData.date}`));
        const result = await response.json();
        if (result.success) {
          setDateAppointments(result.data || []);
        }
      } catch (error) {
        console.error("Error fetching appointments for date:", error);
      } finally {
        setIsLoadingDateAppointments(false);
      }
    };

    fetchDateAppointments();
  }, [formData.date, isScheduleModalOpen]);

  const isSlotBusy = useCallback((time: string, duration: number) => {
    if (!formData.date || !dateAppointments) return false;
    
    const [hours, minutes] = time.split(':').map(Number);
    const newStart = hours * 60 + minutes;
    const newEnd = newStart + duration;

    return dateAppointments.some(apt => {
      if (apt.status === 'cancelled' || isCartAppointmentStatus(apt.status)) return false;
      
      const [aptHours, aptMinutes] = apt.time.split(':').map(Number);
      const aptStart = aptHours * 60 + aptMinutes;
      const aptDuration = normalizeBookingDuration(apt.duration);
      const aptEnd = aptStart + aptDuration;

      return (newStart < aptEnd) && (newEnd > aptStart);
    });
  }, [formData.date, dateAppointments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("=== SCHEDULE APPOINTMENT SUBMIT ===");
    console.log("Current formData:", formData);
    console.log("PatientName prop:", newAppointmentPatientName);
    console.log("PatientId prop:", newAppointmentPatientId);

    const errors: ScheduleFieldErrors = {};
    if (!formData.patientName) errors.patientName = "Select a patient.";
    if (!formData.date) errors.date = "Choose a date.";
    if (!formData.time) errors.time = "Choose a time.";
    if (formData.type === -1) errors.type = "Choose an appointment type.";
    if (formData.type === APPOINTMENT_TYPES.length - 1 && !formData.customType.trim()) {
      errors.customType = "Enter the custom appointment type.";
    }
    if (!formData.doctor) errors.doctor = "Choose a doctor.";

    if (Object.keys(errors).length > 0) {
      console.error("Validation failed - missing required fields:", {
        patientName: formData.patientName,
        date: formData.date,
        time: formData.time,
        type: formData.type,
        doctor: formData.doctor
      });
      setFieldErrors(errors);
      toast.error("Please complete all required fields");
      return;
    }

    setFieldErrors({});

    // Check if date has error
    if (dateError) {
      toast.error(dateError);
      return;
    }

    // Relaxed validation: Check if appointment date is in the past
    const selectedDate = new Date(`${formData.date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      console.error("Validation failed - appointment is in a past date");
      toast.error(`Cannot schedule appointment for a past date.`);
      return;
    }

    setIsLoading(true);
    console.log("Starting appointment creation...");

    try {
      const appointmentData = {
        patientName: String(formData.patientName),
        patientId: String(formData.patientId),
        date: formData.date,
        time: formData.time,
        duration: normalizeBookingDuration(formData.duration),
        type: formData.type,
        customType: formData.customType,
        doctor: formData.doctor,
        notes: formData.notes,
        status: "scheduled" as const
      };
      console.log("Appointment data being sent:", appointmentData);
      
      const result = await addAppointment(appointmentData);
      console.log("Appointment created successfully:", result);
      
      toast.success("Appointment scheduled successfully!");
      console.log("Calling refreshAppointments...");
      refreshAppointments();
      
      console.log("Closing modal and resetting form...");
      closeScheduleModal();
      setFieldErrors({});
      setFormData({
        date: "",
        time: "",
        duration: "30",
        type: -1,
        customType: "",
        doctor: "",
        notes: "",
        patientName: newAppointmentPatientName || "",
        patientId: String(newAppointmentPatientId || "")
      });
    } catch (err) {
      console.error("Error scheduling appointment:", err);
      console.error("Error details:", {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : 'No stack trace'
      });
      const errorMessage = err instanceof Error ? err.message : "Failed to schedule appointment";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isScheduleModalOpen} onOpenChange={closeScheduleModal}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {newAppointmentPatientName ? `Schedule Appointment - ${newAppointmentPatientName}` : "Schedule New Appointment"}
          </DialogTitle>
        </DialogHeader>
        
        {/* If doctor or admin, first show a compact date + available slots picker. Once a slot is chosen, show the full form. */}
        {(effectiveRole === "doctor" || effectiveRole === "admin") && showSlotPicker ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-transparent">
              <div className="p-4 bg-white rounded-l-[1rem] border border-gray-50 shadow-sm">
                <DoctorCalendar
                  selectedDate={formData.date ? new Date(formData.date) : new Date()}
                  onSelect={(date) => date && setFormData(prev => ({ ...prev, date: formatDateToYYYYMMDD(date) }))}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </div>

              <div className="p-4 bg-white rounded-r-[1rem] border border-gray-50 shadow-sm">
                {/* <div className="mb-3">
                  <div className="font-semibold">{formData.date || new Date().toLocaleDateString('en-CA')}</div>
                </div> */}

                <div className="max-h-64 overflow-auto space-y-2">
                  {TIME_SLOTS.map(slot => {
                    const busy = formData.date ? isSlotBusy(slot, normalizeBookingDuration(formData.duration)) : false;

                    // Determine if the slot is in the past relative to selected date
                    const dateStr = formData.date || formatDateToYYYYMMDD(new Date());
                    const todayStr = formatDateToYYYYMMDD(new Date());
                    const isPastDate = dateStr < todayStr;

                    let isPastTime = false;
                    if (!isPastDate && dateStr === todayStr) {
                      const [sh, sm] = slot.split(":").map(Number);
                      const now = new Date();
                      const nowMinutes = now.getHours() * 60 + now.getMinutes();
                      const slotMinutes = sh * 60 + sm;
                      isPastTime = slotMinutes <= nowMinutes;
                    }

                    const isPast = isPastDate || isPastTime;

                    // Check appointments for this date to know if it's booked or reserved
                    const isBooked = dateAppointments.some(apt => apt.time === slot && apt.status !== 'cancelled' && apt.paymentStatus !== 'unpaid');
                    const isTentative = dateAppointments.some(apt => apt.time === slot && isReservedAppointmentStatus(apt.status));

                    const disabled = isPast || busy || isBooked || isTentative;

                    const statusLabel = isPast ? 'Passed' : (isBooked ? 'Booked' : (isTentative ? 'Reserved' : (busy ? 'Occupied' : 'Open')));

                    const btnClass = isPast
                      ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed text-gray-400'
                      : isBooked
                      ? 'bg-red-50 border-red-100 opacity-90 cursor-not-allowed text-gray-700'
                      : isTentative
                      ? 'bg-amber-50 border-amber-100 cursor-not-allowed text-amber-700'
                      : busy
                      ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed text-gray-700'
                      : 'bg-white hover:shadow-sm border border-gray-100';

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (!disabled) {
                            setFormData(prev => ({ ...prev, time: slot }));
                            setSelectedSlot(slot);
                            setShowSlotPicker(false);
                          }
                        }}
                        className={`w-full text-left p-3 rounded-xl border ${btnClass}`}>
                        <div className="flex items-center justify-between">
                          <div className={`${isPast ? 'text-gray-400' : 'font-medium text-gray-900'}`}>{formatTimeTo12h(slot)}</div>
                          <div className={`text-xs font-semibold ${statusLabel === 'Open' ? 'text-emerald-600' : statusLabel === 'Passed' ? 'text-gray-400' : statusLabel === 'Booked' ? 'text-red-600' : statusLabel === 'Reserved' ? 'text-amber-700' : 'text-gray-500'}`}>
                            {statusLabel}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="cancel" type="button" onClick={() => { closeScheduleModal(); setShowSlotPicker(false); }}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => setShowSlotPicker(false)} disabled={!selectedSlot && !formData.time}>
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Selection (only show if no patient is pre-selected) */}
          {!newAppointmentPatientName && (
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select
                value={String(formData.patientId) || ""}
                onValueChange={(value) => {
                  const found = patients.find(p => p.id === value);
                  if (found) {
                    setFormData(prev => ({ ...prev, patientId: found.id, patientName: found.name }));
                    clearFieldError("patientName");
                  }
                }}
              >
                <SelectTrigger className={fieldErrors.patientName ? errorClassName : undefined} aria-invalid={Boolean(fieldErrors.patientName)}>
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.length > 0 ? (
                    patients.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-gray-500">No patients available</div>
                  )}
                </SelectContent>
              </Select>
              {fieldErrors.patientName ? <p className="text-xs font-medium text-red-600">{fieldErrors.patientName}</p> : null}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                className={(fieldErrors.date || dateError) ? errorClassName : undefined}
                aria-invalid={Boolean(fieldErrors.date || dateError)}
                onChange={(e) => {
                  const selectedDate = new Date(`${e.target.value}T00:00:00`);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  if (selectedDate < today) {
                    setDateError("Cannot select a past date");
                  } else {
                    setDateError("");
                  }
                  
                  setFormData(prev => ({ ...prev, date: e.target.value }));
                  clearFieldError("date");
                }}
                min={formatDateToYYYYMMDD(new Date())}
                required
              />
              {fieldErrors.date ? <p className="text-xs font-medium text-red-600">{fieldErrors.date}</p> : null}
              {dateError && <p className="text-red-500 text-sm">{dateError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Select
                value={formData.time ? TIME_SLOTS.indexOf(formData.time).toString() : ""}
                onValueChange={(value) => {
                  const index = parseInt(value);
                  if (index >= 0) {
                    setFormData(prev => ({ ...prev, time: TIME_SLOTS[index] }));
                    clearFieldError("time");
                  }
                }}
              >
                <SelectTrigger id="time" className={fieldErrors.time ? errorClassName : undefined} aria-invalid={Boolean(fieldErrors.time)}>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot, index) => {
                    const busy = isSlotBusy(slot, normalizeBookingDuration(formData.duration));
                    return (
                      <SelectItem key={slot} value={index.toString()} disabled={busy}>
                        {formatTimeTo12h(slot)} {busy && "(Occupied)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {fieldErrors.time ? <p className="text-xs font-medium text-red-600">{fieldErrors.time}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Duration</Label>
            <Select
              value={formData.duration}
              onValueChange={(value) => setFormData(prev => ({ ...prev, duration: String(normalizeBookingDuration(value)) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {ALLOWED_BOOKING_DURATIONS.map((mins) => {
                  const busy = formData.time ? isSlotBusy(formData.time, mins) : false;
                  return (
                    <SelectItem key={mins} value={String(mins)} disabled={busy}>
                      {mins >= 60 ? `${mins / 60} hour${mins / 60 > 1 ? 's' : ''}` : `${mins} minutes`} {busy && "(Conflict)"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Appointment Type</Label>
            <Select
              value={formData.type === -1 ? "" : formData.type.toString()}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, type: parseInt(value), customType: "" }));
                clearFieldError("type");
                clearFieldError("customType");
              }}
            >
              <SelectTrigger className={fieldErrors.type ? errorClassName : undefined} aria-invalid={Boolean(fieldErrors.type)}>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.map((type, index) => (
                  <SelectItem key={index} value={index.toString()}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.type ? <p className="text-xs font-medium text-red-600">{fieldErrors.type}</p> : null}
          </div>

          {formData.type === APPOINTMENT_TYPES.length - 1 && (
            <div className="space-y-2">
              <Label>Please Specify Type</Label>
              <Input
                placeholder="Enter custom appointment type"
                value={formData.customType}
                className={fieldErrors.customType ? errorClassName : undefined}
                aria-invalid={Boolean(fieldErrors.customType)}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, customType: e.target.value }));
                  clearFieldError("customType");
                }}
                required
              />
              {fieldErrors.customType ? <p className="text-xs font-medium text-red-600">{fieldErrors.customType}</p> : null}
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Doctor</Label>
            <Select
              value={formData.doctor}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, doctor: value }));
                clearFieldError("doctor");
              }}
              disabled={isLoadingDoctors || user?.role === "doctor"}
            >
              <SelectTrigger className={fieldErrors.doctor ? errorClassName : undefined} aria-invalid={Boolean(fieldErrors.doctor)}>
                <SelectValue placeholder={isLoadingDoctors ? "Loading doctors..." : doctors.length === 0 ? "No doctors available" : user?.role === "doctor" ? `${user.username}` : "Select doctor"} />
              </SelectTrigger>
              <SelectContent>
                {isLoadingDoctors ? (
                  <div className="p-2 text-sm text-gray-500">Loading doctors...</div>
                ) : user?.role === "doctor" ? (
                  <SelectItem value={user.username}>{user.username}</SelectItem>
                ) : doctors.length > 0 ? (
                  doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.name}>
                      {doctor.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-gray-500">No doctors available</div>
                )}
              </SelectContent>
            </Select>
            {fieldErrors.doctor ? <p className="text-xs font-medium text-red-600">{fieldErrors.doctor}</p> : null}
          </div>
          
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Additional notes for the appointment..."
              value={formData.notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="cancel" type="button" onClick={() => closeScheduleModal()} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="brand" type="submit" disabled={isLoading}>
              {isLoading ? "Scheduling..." : "Schedule Appointment"}
            </Button>
          </div>
         </form>
        )}
       </DialogContent>
     </Dialog>
   );
 }
