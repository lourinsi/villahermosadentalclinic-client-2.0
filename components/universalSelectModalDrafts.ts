/**
 * Stable data contracts for the universal appointment selectors.
 *
 * Each modal owns its temporary form state and emits one draft on Save. Pages
 * should adapt an appointment to/from these drafts at their boundary instead
 * of wiring every field in a selector individually.
 */

export type TreatmentSelectionSection = {
  selectedTreatmentId?: number | null;
  currentTreatmentLabel?: string;
  customTreatmentName?: string;
  selectedPrice?: string | number;
};

export type TreatmentSelectionDraft = {
  sections: TreatmentSelectionSection[];
  toothNumberEntries: string[];
  manualPrice: string;
  discount: string;
  treatmentNotes: string;
};

export type PatientSelectionDraft<TPatient = unknown> = {
  patient: TPatient | null;
};

export type DoctorSelectionDraft<TDoctor = unknown> = {
  doctor: TDoctor | null;
};

export type ScheduleSelectionDraft = {
  selectedDate: Date | string | null;
  selectedTime: string;
  selectedDuration: string;
  status?: string;
};
