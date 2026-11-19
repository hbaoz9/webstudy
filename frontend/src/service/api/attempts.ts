import { apiGet, apiRequest } from "./client";
import type { QuestionImage } from "../../types/question";

type One<T> = { data: T };
export type Page<T> = { data: T[]; links: { next: string | null }; meta: { currentPage: number; lastPage?: number; total: number;
  pendingGrading?: number; inProgress?: number; graded?: number; scoresPublished?: boolean; answersPublished?: boolean } };

export type StudentDistribution = {
  id: string; classroomId: string; classroomName: string; title: string;
  opensAt: string; deadlineAt: string; status: "active" | "closed" | "cancelled";
  attemptAvailable: boolean;
};
export type Eligibility = {
  canStart: boolean; reasonCode: string | null; effectiveAttemptLimit: number;
  usedAttempts: number; remainingAttempts: number; effectiveDeadlineAt: string;
  effectiveRemainingSeconds: number; serverNow: string; canSaveAnswer: boolean; canSubmit: boolean;
};
export type PublicQuestion = {
  id: string; position: number;
  type: "single_choice" | "multiple_choice" | "true_false" | "true_false_group" | "short_answer" | "essay_text";
  maxPoints: string;
  content: { content: string; image?: QuestionImage; options?: { id: string; text: string }[]; statements?: { id: string; content: string }[] };
};
export type Answer = { optionId: string } | { optionIds: string[] } | { value: boolean | string } |
  { answersByStatementId: Record<string, boolean> } | { text: string } | null;
export type Attempt = {
  id: string; distributionId: string; revisionId: string; attemptNo: number;
  version: number;
  status: "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT" | "REVOKED" | "CANCELLED";
  gradingStatus: string; startedAt: string; expiresAt: string; finalizedAt: string | null;
  finalizationReason: string | null; serverNow: string;
  answers: Record<string, { answer: Answer; version: number; acceptedAt: string }>;
  questions?: PublicQuestion[];
};
export type StudentResult = {
  status: "PENDING_GRADING" | "PROVISIONAL" | "FINAL" | "PENDING_REGRADE" | "VOID";
  scoreVisible: boolean; answerVisible: boolean; aggregateScore: string | null;
  attemptScores?: { attemptId: string; attemptNo: number; gradingStatus: string; score: string | null }[];
  answers?: { questionId: string; invalidated: boolean; answerKey: Record<string, unknown> | null; explanation: string | null }[];
};
export type TeacherAttempt = Omit<Attempt, "questions"> & { studentId: number; studentName: string | null;
  autoScore: string | null; manualScore: string | null; totalScore: string | null;
  questions?: (PublicQuestion & { rubric?: { rubricText?: string } | null; explanation?: string | null })[];
  gradeItems?: { questionId: string; generation: number; points: string; source: string; feedback: string | null }[] };
export type TeacherAttemptSummary = { id: string | null; studentId: number; studentName: string | null; attemptNo: number; status: Attempt["status"] | "NOT_STARTED";
  gradingStatus: string; startedAt: string; expiresAt: string; finalizedAt: string | null;
  autoScore: string | null; manualScore: string | null; totalScore: string | null; version: number };
export type TeacherResult = { studentId: number; studentName: string | null;
  status: StudentResult["status"]; aggregateScore: string | null;
  activeGeneration: number; calculatedAt: string | null };
export type StudentException = { studentId: number; lateStartUntil: string | null;
  completionDeadlineAt: string | null; timeLimitSeconds: number | null; version: number };

const distributionPath = (id: string) => `/student/distributions/${encodeURIComponent(id)}`;
const attemptPath = (id: string) => `/student/attempts/${encodeURIComponent(id)}`;
const teacherDistributionPath = (id: string) => `/teacher/distributions/${encodeURIComponent(id)}`;
const teacherAttemptPath = (id: string) => `/teacher/attempts/${encodeURIComponent(id)}`;
const keyHeader = (key: string) => ({ "Idempotency-Key": key });

export const listStudentDistributions = (page = 1, classroomId?: string) => {
  const query = new URLSearchParams({ page: String(page) });
  if (classroomId) query.set("classroomId", classroomId);
  return apiGet<Page<StudentDistribution>>(`/student/distributions?${query}`);
};
export const listHistoricalDistributions = (page = 1, classroomId?: string) => {
  const query = new URLSearchParams({ page: String(page) });
  if (classroomId) query.set("classroomId", classroomId);
  return apiGet<Page<StudentDistribution>>(`/student/distributions/history?${query}`);
};
export const getStudentDistribution = (id: string) => apiGet<One<StudentDistribution>>(distributionPath(id)).then(r => r.data);
export const getEligibility = (id: string) => apiGet<One<Eligibility>>(`${distributionPath(id)}/eligibility`).then(r => r.data);
export const startAttempt = (id: string, key: string) => apiRequest<One<Attempt>>(`${distributionPath(id)}/attempts`, "POST", undefined, 10000, keyHeader(key)).then(r => r.data);
export const getAttempt = (id: string) => apiGet<One<Attempt>>(attemptPath(id)).then(r => r.data);
export const saveAttemptAnswer = (id: string, questionId: string, answer: Answer, expectedVersion: number, key: string) =>
  apiRequest<One<{ saved: boolean; acceptedAt: string; version: number; serverNow: string }>>(`${attemptPath(id)}/answers/${encodeURIComponent(questionId)}`,
    "PUT", { answer, expectedVersion }, 10000, keyHeader(key)).then(r => r.data);
export const submitAttempt = (id: string, key: string) => apiRequest<One<Attempt>>(`${attemptPath(id)}/submit`, "POST", undefined, 10000, keyHeader(key)).then(r => r.data);
export const listOwnAttempts = (id: string) => apiGet<Page<Attempt>>(`${distributionPath(id)}/attempts`);
export const getStudentResult = (id: string) => apiGet<One<StudentResult>>(`${distributionPath(id)}/result`).then(r => r.data);

export const listTeacherAttempts = (id: string, page = 1, q = "", status = "") => {
  const params = new URLSearchParams({ page: String(page) });
  if (q.trim()) params.set("q", q.trim());
  if (status) params.set("status", status);
  return apiGet<Page<TeacherAttemptSummary>>(`${teacherDistributionPath(id)}/attempts?${params}`);
};
export const listTeacherResults = (id: string, page = 1, q = "", status = "") => {
  const params = new URLSearchParams({ page: String(page) });
  if (q.trim()) params.set("q", q.trim());
  if (status) params.set("status", status);
  return apiGet<Page<TeacherResult>>(`${teacherDistributionPath(id)}/results?${params}`);
};
export const getTeacherAttempt = (id: string) => apiGet<One<TeacherAttempt>>(teacherAttemptPath(id)).then(r => r.data);
export const listStudentExceptions = (id: string, page = 1) => apiGet<Page<StudentException>>(`${teacherDistributionPath(id)}/exceptions?page=${page}`);
export const setStudentException = (id: string, studentId: number, input: Omit<StudentException, "studentId" | "version"> & { expectedVersion: number; reason: string }, key: string) =>
  apiRequest<One<StudentException>>(`${teacherDistributionPath(id)}/students/${studentId}/exception`, "PUT", input, 10000, keyHeader(key)).then(r => r.data);
export const grantAdditionalAttempts = (id: string, studentId: number, additionalAttempts: number, reason: string, key: string) =>
  apiRequest<One<unknown>>(`${teacherDistributionPath(id)}/students/${studentId}/additional-attempts`, "POST", { additionalAttempts, reason }, 10000, keyHeader(key)).then(r => r.data);
export const extendAttempt = (id: string, expiresAt: string, expectedVersion: number, reason: string, key: string) =>
  apiRequest<One<unknown>>(`${teacherAttemptPath(id)}/extend`, "POST", { expiresAt, expectedVersion, reason }, 10000, keyHeader(key)).then(r => r.data);
export const revokeAttempt = (id: string, expectedVersion: number, reason: string, key: string) =>
  apiRequest<One<unknown>>(`${teacherAttemptPath(id)}/revoke`, "POST", { expectedVersion, reason }, 10000, keyHeader(key)).then(r => r.data);
export const gradeEssay = (id: string, questionId: string, points: string, expectedVersion: number, feedback: string, key: string) =>
  apiRequest<One<unknown>>(`${teacherAttemptPath(id)}/essay-grades/${encodeURIComponent(questionId)}`, "PUT", { points, expectedVersion, feedback }, 10000, keyHeader(key)).then(r => r.data);
export const publishAttemptScores = (id: string, key: string) => apiRequest<One<unknown>>(`${teacherDistributionPath(id)}/publish-scores`, "POST", undefined, 10000, keyHeader(key)).then(r => r.data);
export const publishAttemptAnswers = (id: string, key: string) => apiRequest<One<unknown>>(`${teacherDistributionPath(id)}/publish-answers`, "POST", undefined, 10000, keyHeader(key)).then(r => r.data);
export const invalidateRevisionQuestion = (revisionId: string, questionId: string, reason: string, key: string) =>
  apiRequest<One<{ runId: string; status: string; generation: number }>>(`/teacher/revisions/${encodeURIComponent(revisionId)}/questions/${encodeURIComponent(questionId)}/invalidate`,
    "POST", { reason }, 10000, keyHeader(key)).then(r => r.data);
