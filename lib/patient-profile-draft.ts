export const PATIENT_PROFILE_DRAFT_STORAGE_KEY = "villahermosa.patientProfileDraft.v1";

const PATIENT_PROFILE_DRAFT_PATH_PREFIXES = ["/receptionist/patients/", "/admin/patients/"];

const isPatientProfileDraftPath = (path: string) =>
  PATIENT_PROFILE_DRAFT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));

export type PatientProfileDraft = {
  version: 1;
  patientId: string;
  patientName: string;
  path: string;
  updatedAt: string;
  activeTab: string;
  formData: Record<string, any>;
  originalLoadedData: Record<string, any>;
  questionnaireAnswers: Record<string, boolean>;
  savedQuestionnaireAnswers: Record<string, boolean>;
  patientQuestionnaireData: Record<string, any>;
  questionnaireQuestions: Array<{
    id: string;
    text: string;
    isActive?: boolean;
  }>;
  consentForm?: Record<string, any>;
  savedConsentForm?: Record<string, any>;
};

export const parsePatientProfileDraft = (raw: string | null): PatientProfileDraft | null => {
  if (!raw) return null;

  try {
    const draft = JSON.parse(raw) as Partial<PatientProfileDraft>;
    const draftPath = typeof draft.path === "string" ? draft.path : "";
    if (
      draft?.version !== 1 ||
      !draft.patientId ||
      !isPatientProfileDraftPath(draftPath)
    ) {
      return null;
    }

    return {
      version: 1,
      patientId: String(draft.patientId),
      patientName: String(draft.patientName || "Patient"),
      path: draftPath,
      updatedAt: String(draft.updatedAt || new Date().toISOString()),
      activeTab: String(draft.activeTab || "info"),
      formData: draft.formData && typeof draft.formData === "object" ? draft.formData : {},
      originalLoadedData: draft.originalLoadedData && typeof draft.originalLoadedData === "object" ? draft.originalLoadedData : {},
      questionnaireAnswers:
        draft.questionnaireAnswers && typeof draft.questionnaireAnswers === "object"
          ? draft.questionnaireAnswers
          : {},
      savedQuestionnaireAnswers:
        draft.savedQuestionnaireAnswers && typeof draft.savedQuestionnaireAnswers === "object"
          ? draft.savedQuestionnaireAnswers
          : {},
      patientQuestionnaireData:
        draft.patientQuestionnaireData && typeof draft.patientQuestionnaireData === "object"
          ? draft.patientQuestionnaireData
          : {},
      consentForm:
        draft.consentForm && typeof draft.consentForm === "object"
          ? draft.consentForm
          : undefined,
      savedConsentForm:
        draft.savedConsentForm && typeof draft.savedConsentForm === "object"
          ? draft.savedConsentForm
          : undefined,
      questionnaireQuestions: Array.isArray(draft.questionnaireQuestions)
        ? draft.questionnaireQuestions
            .filter((question) => question?.id && question?.text)
            .map((question) => ({
              id: String(question.id),
              text: String(question.text),
              isActive: question.isActive,
            }))
        : [],
    };
  } catch {
    return null;
  }
};

export const readPatientProfileDraft = () => {
  if (typeof window === "undefined") return null;
  return parsePatientProfileDraft(window.localStorage.getItem(PATIENT_PROFILE_DRAFT_STORAGE_KEY));
};

export const writePatientProfileDraft = (draft: PatientProfileDraft) => {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(PATIENT_PROFILE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch (error) {
    console.warn("[PATIENT PROFILE DRAFT] Failed to persist draft:", error);
    return false;
  }
};

export const clearPatientProfileDraft = (patientId?: string) => {
  if (typeof window === "undefined") return;

  if (patientId) {
    const draft = readPatientProfileDraft();
    if (draft && draft.patientId !== patientId) return;
  }

  window.localStorage.removeItem(PATIENT_PROFILE_DRAFT_STORAGE_KEY);
};
