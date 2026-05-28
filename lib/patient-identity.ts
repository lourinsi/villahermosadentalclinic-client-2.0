export type PatientIdentity = {
  id?: string | null;
  name?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  profilePicture?: string | null;
  profilePictureUrl?: string | null;
  photo?: string | null;
  avatar?: string | null;
};

export const getPatientDisplayName = (
  patient?: PatientIdentity | null,
  fallback?: unknown
) => {
  if (!patient) return String(fallback ?? "").trim();

  const composedName = [patient.firstName, patient.lastName]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");

  return (
    composedName ||
    String(patient.name || patient.fullName || patient.username || patient.email || patient.phone || patient.id || fallback || "").trim()
  );
};

export const getAppointmentPatientDisplayName = (
  appointment: any,
  patientRecord?: PatientIdentity | null
) => {
  const nestedPatient = appointment?.patient && typeof appointment.patient === "object"
    ? appointment.patient
    : null;

  return (
    getPatientDisplayName(patientRecord) ||
    getPatientDisplayName(nestedPatient) ||
    String(
      appointment?.patientName ||
        appointment?.patient_name ||
        [appointment?.patientFirstName, appointment?.patientLastName].filter(Boolean).join(" ") ||
        appointment?.patientId ||
        "No patient assigned"
    ).trim()
  );
};
