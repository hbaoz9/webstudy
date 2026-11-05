import { apiGet, apiRequest } from "./client";
import type { QuestionImage } from "../../types/question";

export type RevisionQuestion = {
  id: string; sourceQuestionId: string; sourceQuestionVersion: number; position: number;
  type: string; difficulty: string; lessonId: string;
  publicContent: { content: string; image?: QuestionImage; options?: { id: string; text: string }[]; statements?: { id: string; content: string }[] };
  answerKey: Record<string, unknown> | null; rubric: Record<string, unknown> | null;
  explanation: string | null; maxPoints: string; gradingPolicy: string;
};
export type AssessmentRevision = {
  id: string; assessmentId: string; revisionNo: number; status: "draft" | "published";
  title: string; instructions: string | null; sourceRevisionId: string | null;
  version: number; totalPoints: string; publishedAt: string | null; questions: RevisionQuestion[] | null;
};
export type Assessment = {
  id: string; title: string; version: number; createdAt: string; updatedAt: string;
  revisions: AssessmentRevision[] | null;
};
export type AssessmentPage = { data: Assessment[]; links: { next: string | null }; meta: { currentPage: number; lastPage: number; total: number } };
type One<T> = { data: T };
const assessmentPath = (id: string) => `/teacher/assessments/${encodeURIComponent(id)}`;
const revisionPath = (id: string) => `/teacher/revisions/${encodeURIComponent(id)}`;

export const listAssessments = (page = 1) => apiGet<AssessmentPage>(`/teacher/assessments?page=${page}`);
export const getAssessment = (id: string) => apiGet<One<Assessment>>(assessmentPath(id)).then(r => r.data);
export const createAssessment = (title: string, instructions: string) => apiRequest<One<Assessment>>("/teacher/assessments", "POST", { title, instructions }).then(r => r.data);
export const updateAssessment = (id: string, title: string, expectedVersion: number) => apiRequest<One<Assessment>>(assessmentPath(id), "PATCH", { title, expectedVersion }).then(r => r.data);
export const deleteAssessment = (id: string, expectedVersion: number) => apiRequest<void>(assessmentPath(id), "DELETE", { expectedVersion });
export const listRevisions = (id: string) => apiGet<{ data: AssessmentRevision[] }>(`${assessmentPath(id)}/revisions`).then(r => r.data);
export const createRevision = (id: string, basedOnRevisionId?: string) => apiRequest<One<AssessmentRevision>>(`${assessmentPath(id)}/revisions`, "POST", basedOnRevisionId ? { basedOnRevisionId } : {}).then(r => r.data);
export const getRevision = (id: string) => apiGet<One<AssessmentRevision>>(revisionPath(id)).then(r => r.data);
export type DraftQuestion = { revisionQuestionId: string; maxPoints: string } | { sourceQuestionId: string; sourceQuestionVersion: number; maxPoints: string };
export const saveDraft = (id: string, expectedVersion: number, title: string, instructions: string, questions: DraftQuestion[]) =>
  apiRequest<One<AssessmentRevision>>(`${revisionPath(id)}/draft`, "PUT", { expectedVersion, title, instructions, questions }).then(r => r.data);
export const publishRevision = (id: string, expectedVersion: number, key: string) =>
  apiRequest<One<AssessmentRevision>>(`${revisionPath(id)}/publish`, "POST", { expectedVersion }, 10000, { "Idempotency-Key": key }).then(r => r.data);
