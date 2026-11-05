import { ApiError, apiGet, apiRequest } from "./client";
import type { QuestionBankInput, QuestionBankQuestion, QuestionBankType, QuestionDifficulty } from "../../types/question";

export type TeacherQuestion = QuestionBankQuestion & { version: number; lessonId: string; chapterId: string };
export type TeacherQuestionPage = {
  data: TeacherQuestion[];
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};
export type QuestionFilters = {
  page?: number;
  perPage?: number;
  q?: string;
  type?: QuestionBankType;
  difficulty?: QuestionDifficulty;
  lessonId?: string;
  chapterId?: string;
  sort?: "newest" | "lesson" | "difficulty";
};

function path(id: string) {
  return `/teacher/questions/${encodeURIComponent(id)}`;
}

async function withSafeServerError<T>(request: Promise<T>, message: string): Promise<T> {
  try {
    return await request;
  } catch (cause) {
    if (cause instanceof ApiError && cause.status !== undefined && cause.status >= 500) {
      throw new ApiError(message, cause.status);
    }
    throw cause;
  }
}

export function listTeacherQuestions(filters: QuestionFilters = {}): Promise<TeacherQuestionPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return withSafeServerError(apiGet<TeacherQuestionPage>(`/teacher/questions${params.size ? `?${params}` : ""}`), "Không thể tải ngân hàng câu hỏi. Vui lòng thử lại.");
}

export function getTeacherQuestion(id: string): Promise<TeacherQuestion> {
  return withSafeServerError(apiGet<{ data: TeacherQuestion }>(path(id)), "Không thể tải câu hỏi. Vui lòng thử lại.").then((response) => response.data);
}

// Only contract fields cross the wire. Legacy chapter, IDs, timestamps and ownership never do.
export function teacherQuestionPayload(input: QuestionBankInput) {
  const common = {
    type: input.type,
    lessonId: input.lessonId,
    difficulty: input.difficulty,
    content: input.content,
    ...(input.image ? { image: input.image } : {}),
    ...(input.explanation ? { explanation: input.explanation } : {}),
    showInLesson: input.showInLesson ?? false,
  };
  switch (input.type) {
    case "single_choice": return { ...common, options: input.options, correctOptionId: input.correctOptionId };
    case "multiple_choice": return { ...common, options: input.options, correctOptionIds: input.correctOptionIds };
    case "true_false": return { ...common, correctAnswer: input.correctAnswer };
    case "true_false_group": return { ...common, statements: input.statements };
    case "short_answer": return { ...common, correctAnswer: input.correctAnswer };
    case "essay_text": return { ...common, ...(input.rubricText ? { rubricText: input.rubricText } : {}) };
  }
}

export function createTeacherQuestion(input: QuestionBankInput): Promise<TeacherQuestion> {
  return withSafeServerError(apiRequest<{ data: TeacherQuestion }>("/teacher/questions", "POST", teacherQuestionPayload(input)), "Không thể lưu câu hỏi. Vui lòng thử lại.").then((response) => response.data);
}

export function updateTeacherQuestion(id: string, input: QuestionBankInput, expectedVersion: number): Promise<TeacherQuestion> {
  return withSafeServerError(apiRequest<{ data: TeacherQuestion }>(path(id), "PUT", { ...teacherQuestionPayload(input), expectedVersion }), "Không thể lưu câu hỏi. Vui lòng thử lại.").then((response) => response.data);
}

export function deleteTeacherQuestion(id: string, expectedVersion: number): Promise<void> {
  return withSafeServerError(apiRequest<void>(path(id), "DELETE", { expectedVersion }), "Không thể xóa câu hỏi. Vui lòng thử lại.");
}
