export interface Patient {
  id?: string;
  name: string;
  email: string;
  phone: string;
  alternateEmail?: string;
  alternatePhone?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  birthDate?: string;
  dob?: string;
  birthday?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  insurance?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalHistory?: string;
  treatmentPlan?: string;
  clinicalNotes?: string;
  allergies?: string;
  notes?: string;
  profilePicture?: string;
  parentId?: string;
  isPrimary?: boolean;
  relationship?: string;
  username?: string;
  dentalCharts?: { date: string; data: string; isEmpty: boolean }[];
  balance?: number | null;
  status?: "active" | "overdue" | "inactive" | string;
  profileCompletion?: "complete" | "incomplete" | string;
  profileCompletionMissing?: string[];
  lastVisit?: string;
  gender?: string | null;
  civilStatus?: string | null;
  age?: string | null;
  ethnicity?: string | null;
  religion?: string | null;
  nationality?: string | null;
  currentStreet?: string | null;
  currentBarangay?: string | null;
  currentProvince?: string | null;
  permanentStreet?: string | null;
  permanentBarangay?: string | null;
  permanentCity?: string | null;
  permanentProvince?: string | null;
  permanentZipCode?: string | null;
  landline?: string | null;
  emergencyFirstName?: string | null;
  emergencyLastName?: string | null;
  emergencyRelationship?: string | null;
  education?: string | null;
  occupation?: string | null;
  company?: string | null;
  companyAddress?: string | null;
  height?: string | null;
  versionHistory?: PatientVersionRecord[];
  patientSince?: string | Date;
  createdAt?: Date;
  updatedAt?: Date;
  deleted?: boolean;
  deletedAt?: Date;
}

export interface PatientVersionRecord {
  id: string;
  timestamp: string; // ISO 8601 string
  editorName: string;
  versionName?: string;
  summary: string;
  changedSections: ("info" | "medical" | "chart" | "questionnaire" | "consent")[];
  changedFieldsSummary?: string[];
  snapshot: {
    formData: Record<string, any>;
    questionnaireAnswers?: Record<string, any>;
    patientQuestionnaireData?: Record<string, any>;
    physicianInformation?: Record<string, any>;
    consentForm?: Record<string, any>;
    dentalCharts?: any[];
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  meta?: Record<string, unknown>;
  data?: T;
  error?: string;
}
