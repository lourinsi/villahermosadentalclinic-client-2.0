import defaultQuestionnaireQuestions from "@/data/questionnaire-questions.json";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";

export type QuestionnaireQuestion = {
  id: string;
  text: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
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

const normalizeText = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ");

const normalizeQuestion = (question: Partial<QuestionnaireQuestion>, fallbackId: string): QuestionnaireQuestion => ({
  id: normalizeText(question.id) || fallbackId,
  text: normalizeText(question.text),
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
  const response = await fetch(apiUrl(endpoint), {
    credentials: "include",
    headers: getAuthHeaders(),
  });
  const payload = await readPayload(response);

  if (response.ok && payload.success && Array.isArray(payload.data)) {
    return {
      questions: normalizeQuestions(payload.data).filter((question) => includeInactive || question.isActive !== false),
      isFallback: false,
    };
  }

  if (allowFallback && isRouteNotFound(response, payload)) {
    return {
      questions: fallbackQuestionnaireQuestions.filter((question) => includeInactive || question.isActive !== false),
      isFallback: true,
      unavailableMessage: "Questionnaire question management is not deployed on the current production API.",
    };
  }

  throw new Error(payload.message || "Failed to load questionnaire questions");
}
