import type { AssignmentV2, AssignmentSubmissionV2 } from "../types/assignment";
import { getAssignmentResultVisibility, type AssignmentAnswerDraftRead, hasAssignmentDraftAnswers } from "./assignmentQuestion";

export type StudentAssignmentGroup = "todo" | "submitted" | "graded" | "closed";
export type StudentAssignmentPhase = "unavailable" | "expired" | "not_started" | "in_progress" | "draft_error" | "submitted" | "graded";

export function getAssignmentDeadlineState(assignment: AssignmentV2, now: number) {
  const deadline = Date.parse(assignment.dueAt ?? "");
  const unavailable = !Number.isFinite(deadline) || assignment.questions.length === 0;
  return { deadline, unavailable, expired: !unavailable && now >= deadline };
}

export function getStudentAssignmentPhase(
  assignment: AssignmentV2,
  submission: AssignmentSubmissionV2 | undefined,
  draft: AssignmentAnswerDraftRead | null | undefined,
  now: number,
): StudentAssignmentPhase {
  if (submission) return getAssignmentResultVisibility(assignment) === "hidden" ? "submitted" : "graded";
  const { unavailable, expired } = getAssignmentDeadlineState(assignment, now);
  if (unavailable) return "unavailable";
  if (expired) return "expired";
  if (draft?.status === "error") return "draft_error";
  return draft?.status === "restored" && hasAssignmentDraftAnswers(draft.answers) ? "in_progress" : "not_started";
}

export function getStudentAssignmentRows(
  assignments: AssignmentV2[],
  submissions: AssignmentSubmissionV2[],
  studentId: string,
  activeClassIds: ReadonlySet<string>,
  drafts: ReadonlyMap<string, AssignmentAnswerDraftRead | null>,
  now: number,
) {
  return assignments.filter((assignment) =>
    assignment.status === "published" && activeClassIds.has(assignment.classroomId),
  ).map((assignment) => {
    const submission = submissions.find((item) => item.assignmentId === assignment.id && item.studentId === studentId);
    const draft = drafts.get(assignment.id);
    const { deadline, unavailable, expired } = getAssignmentDeadlineState(assignment, now);
    const phase = getStudentAssignmentPhase(assignment, submission, draft, now);
    const group: StudentAssignmentGroup = phase === "graded" || phase === "submitted" ? phase
      : phase === "expired" || phase === "unavailable" ? "closed" : "todo";
    return { assignment, submission, deadline, unavailable, expired, phase, group, started: phase === "in_progress" };
  });
}
