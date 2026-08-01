import defaultQuestionnaireQuestions from "@/data/questionnaire-questions.json";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";

export type QuestionnaireQuestion = {
  id: string;
  text: string;
  category?: string;
  sectionId?: string;
  isCustom?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export const QUESTIONNAIRE_SECTION_IDENTITIES: Record<string, string> = {
  general: "General Medical Information",
  allergies: "Allergies",
  medical_conditions: "Medical Conditions (History)",
  other: "Other Medical Details",
};

type QuestionnaireQuestionsPayload = {
  success?: boolean;
  data?: unknown;
  message?: string;
};

export type QuestionnaireQuestionsLoadResult = {
  questions: QuestionnaireQuestion[];
  isFallback: boolean;
  unavailableMessage?: string;
};

const LOCAL_CUSTOM_QUESTIONS_KEY = "villahermosa_custom_questionnaire_questions";

const normalizeText = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ");

const normalizeQuestion = (question: Partial<QuestionnaireQuestion>, fallbackId: string): QuestionnaireQuestion => ({
  id: normalizeText(question.id) || fallbackId,
  text: normalizeText(question.text),
  category: question.category ? normalizeText(question.category) : undefined,
  sectionId: question.sectionId ? normalizeText(question.sectionId) : (question.category ? normalizeText(question.category) : undefined),
  isCustom: Boolean(question.isCustom),
  isActive: question.isActive !== false,
  createdAt: question.createdAt,
  updatedAt: question.updatedAt,
});

const normalizeQuestions = (value: unknown): QuestionnaireQuestion[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .map((question, index) => normalizeQuestion(question || {}, `question_${index}`))
    .filter((question) => {
      if (!question.id || !question.text || seen.has(question.id)) return false;
      seen.add(question.id);
      return true;
    });
};

const fallbackQuestionnaireQuestions = normalizeQuestions(defaultQuestionnaireQuestions);

export function getStoredCustomQuestions(): QuestionnaireQuestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_QUESTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeQuestions(parsed);
  } catch {
    return [];
  }
}

export function saveStoredCustomQuestions(questions: QuestionnaireQuestion[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_CUSTOM_QUESTIONS_KEY, JSON.stringify(questions));
  } catch (e) {
    console.error("Failed to save custom questionnaire questions locally:", e);
  }
}

const readPayload = async (response: Response): Promise<QuestionnaireQuestionsPayload> => {
  const text = await response.text().catch(() => "");
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const isRouteNotFound = (response: Response, payload: QuestionnaireQuestionsPayload) =>
  response.status === 404 && /route not found|not found/i.test(payload.message || response.statusText || "");

export async function loadQuestionnaireQuestions({
  includeInactive = false,
  allowFallback = true,
}: {
  includeInactive?: boolean;
  allowFallback?: boolean;
} = {}): Promise<QuestionnaireQuestionsLoadResult> {
  const endpoint = includeInactive
    ? "/api/questionnaire-questions?includeInactive=true"
    : "/api/questionnaire-questions";

  let baseQuestions: QuestionnaireQuestion[] = [];
  let isFallback = false;
  let unavailableMessage: string | undefined;

  try {
    const response = await fetch(apiUrl(endpoint), {
      credentials: "include",
      headers: getAuthHeaders(),
    });
    const payload = await readPayload(response);

    if (response.ok && payload.success && Array.isArray(payload.data)) {
      baseQuestions = normalizeQuestions(payload.data);
      isFallback = false;
    } else if (allowFallback && isRouteNotFound(response, payload)) {
      baseQuestions = fallbackQuestionnaireQuestions;
      isFallback = true;
      unavailableMessage = "Questionnaire question management is not deployed on the current production API.";
    } else {
      baseQuestions = fallbackQuestionnaireQuestions;
      isFallback = true;
    }
  } catch {
    baseQuestions = fallbackQuestionnaireQuestions;
    isFallback = true;
  }

  // Merge with locally stored custom questions
  const customQuestions = getStoredCustomQuestions();
  const seenIds = new Set(baseQuestions.map((q) => q.id));
  const mergedQuestions = [...baseQuestions];

  for (const customQ of customQuestions) {
    if (!seenIds.has(customQ.id)) {
      mergedQuestions.push(customQ);
      seenIds.add(customQ.id);
    } else {
      const idx = mergedQuestions.findIndex((q) => q.id === customQ.id);
      if (idx !== -1) {
        mergedQuestions[idx] = { ...mergedQuestions[idx], ...customQ };
      }
    }
  }

  return {
    questions: mergedQuestions.filter((question) => includeInactive || question.isActive !== false),
    isFallback,
    unavailableMessage,
  };
}

export async function addCustomQuestion(newQuestionData: {
  text: string;
  category: string;
  sectionId?: string;
}): Promise<QuestionnaireQuestion> {
  const text = normalizeText(newQuestionData.text);
  const category = normalizeText(newQuestionData.category);
  const sectionId = normalizeText(newQuestionData.sectionId || category);

  const question: QuestionnaireQuestion = {
    id: `custom_question_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    text,
    category,
    sectionId,
    isCustom: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Try API POST if server endpoint exists
  try {
    const response = await fetch(apiUrl("/api/questionnaire-questions"), {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ text, category, sectionId, isCustom: true }),
    });
    const payload = await readPayload(response);
    if (response.ok && payload.success && payload.data && typeof payload.data === "object") {
      const serverQ = normalizeQuestion(payload.data as Partial<QuestionnaireQuestion>, question.id);
      serverQ.category = category;
      serverQ.sectionId = sectionId;
      serverQ.isCustom = true;
      const current = getStoredCustomQuestions();
      saveStoredCustomQuestions([...current, serverQ]);
      return serverQ;
    }
  } catch {
    // Ignore API errors, fallback to local storage
  }

  const current = getStoredCustomQuestions();
  saveStoredCustomQuestions([...current, question]);
  return question;
}

export async function deleteCustomQuestion(questionId: string): Promise<boolean> {
  // Try API DELETE if server endpoint exists
  try {
    await fetch(apiUrl(`/api/questionnaire-questions/${encodeURIComponent(questionId)}`), {
      method: "DELETE",
      credentials: "include",
      headers: getAuthHeaders(),
    });
  } catch {
    // Ignore API errors
  }

  const current = getStoredCustomQuestions();
  saveStoredCustomQuestions(current.filter((q) => q.id !== questionId));
  return true;
}
