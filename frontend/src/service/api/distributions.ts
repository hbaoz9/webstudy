import { apiGet, apiRequest } from "./client";

export type Distribution = {
  id: string; batchId: string; classroomId: string; classroomName: string;
  revisionId: string; assessmentTitle: string;
  status: "scheduled" | "open" | "expired" | "closed" | "cancelled";
  lifecycleStatus: "active" | "closed" | "cancelled";
  opensAt: string; deadlineAt: string; timeLimitSeconds: number;
  maxAttempts: number; deadlinePolicy: "HARD_DEADLINE" | "FINISH_STARTED_ATTEMPT";
  scorePolicy?: "HIGHEST" | "LATEST" | "AVERAGE";
  scoreReleaseMode?: "AFTER_ATTEMPT_GRADED" | "AFTER_DISTRIBUTION_ENDED_AND_GRADED" | "MANUAL";
  answerReleaseMode?: "AFTER_DISTRIBUTION_ENDED_WITH_TEACHER_PERMISSION" | "MANUAL" | "NEVER";
  version: number; closedAt: string | null; cancelledAt: string | null; createdAt: string;
};
export type DistributionPage = {
  data: Distribution[];
  links: { next: string | null };
  meta: { currentPage: number; lastPage: number; total: number };
};
export type DistributionInput = {
  revisionId: string; classroomIds: string[]; opensAt: string | null;
  deadlineAt: string; timeLimitSeconds: number; maxAttempts: number;
  deadlinePolicy: Distribution["deadlinePolicy"];
  overlapConfirmationToken?: string | null;
};
export type DistributionPreview = {
  eligible: boolean; revision: { id: string; title: string; questionCount: number; totalPoints: string };
  classrooms: { id: string; name: string }[];
  overlaps: { id: string; classroomId: string; opensAt: string; deadlineAt: string }[];
  overlapConfirmationToken: string | null; creationEnabled: boolean;
};
export type DistributionEvent = {
  id: string; type: "created" | "closed" | "cancelled";
  actorId: number; reason: string | null; createdAt: string;
};
type One<T> = { data: T };
const path = (id: string) => `/teacher/distributions/${encodeURIComponent(id)}`;

export const previewDistribution = (input: DistributionInput) =>
  apiRequest<One<DistributionPreview>>("/teacher/distributions/preview", "POST", input).then(r => r.data);
export const createDistributions = (input: DistributionInput, key: string) =>
  apiRequest<One<{ batchId: string; distributions: Distribution[] }>>("/teacher/distributions/batches", "POST", input, 10000, { "Idempotency-Key": key }).then(r => r.data);
export const listDistributions = (page = 1, classroomId?: string, assessmentId?: string) => {
  const params = new URLSearchParams({ page: String(page) });
  if (classroomId) params.set("classroomId", classroomId);
  if (assessmentId) params.set("assessmentId", assessmentId);
  return apiGet<DistributionPage>(`/teacher/distributions?${params}`).then(r => r);
};
export const getDistribution = (id: string) => apiGet<One<Distribution>>(path(id)).then(r => r.data);
export const listDistributionEvents = (id: string, page = 1) =>
  apiGet<{ data: DistributionEvent[]; meta: { lastPage: number } }>(`${path(id)}/events?page=${page}`);
export const closeDistribution = (id: string, expectedVersion: number, key: string, reason = "") =>
  apiRequest<One<Distribution>>(`${path(id)}/close`, "POST", { expectedVersion, reason }, 10000, { "Idempotency-Key": key }).then(r => r.data);
export const cancelDistribution = (id: string, expectedVersion: number, reason: string, key: string) =>
  apiRequest<One<Distribution>>(`${path(id)}/cancel`, "POST", { expectedVersion, reason }, 10000, { "Idempotency-Key": key }).then(r => r.data);

export type StudentNotification = { id: string; distributionId: string; type: "distribution_cancelled";
  title: string; body: string; createdAt: string; readAt: string | null };
export const listStudentNotifications = (page = 1) =>
  apiGet<{ data: StudentNotification[]; meta: { lastPage: number } }>(`/student/notifications?page=${page}`);
export const markStudentNotificationRead = (id: string) =>
  apiRequest<One<StudentNotification>>(`/student/notifications/${encodeURIComponent(id)}/read`, "POST").then(r => r.data);
