import { describe, expect, it } from "vitest";
import type { AssignmentV2, AssignmentSubmissionV2 } from "../types/assignment";
import { getAssignmentDeadlineState, getStudentAssignmentPhase, getStudentAssignmentRows } from "./studentAssignments";

const assignment: AssignmentV2 = {
  id: "a", title: "Test", classroomId: "c", status: "published", createdAt: "", updatedAt: "",
  dueAt: "2026-01-01T12:00:00.000Z",
  questions: [{ id: "q", type: "true_false", content: "Q", difficulty: "recognition", correctAnswer: true }],
};
const submission: AssignmentSubmissionV2 = {
  id: "s", assignmentId: "a", classroomId: "c", studentId: "student", answers: {},
  correctCount: 1, totalQuestions: 1, score: 10, submittedAt: "2026-01-01T11:00:00.000Z",
};
const before = Date.parse("2026-01-01T11:59:59.999Z");
const at = Date.parse("2026-01-01T12:00:00.000Z");

describe("student assignment state", () => {
  it("closes at the exact deadline and treats missing deadline or questions as unavailable", () => {
    expect(getAssignmentDeadlineState(assignment, before).expired).toBe(false);
    expect(getAssignmentDeadlineState(assignment, at).expired).toBe(true);
    expect(getStudentAssignmentPhase({ ...assignment, dueAt: undefined }, undefined, null, at)).toBe("unavailable");
    expect(getStudentAssignmentPhase({ ...assignment, questions: [] }, undefined, null, before)).toBe("unavailable");
  });
  it("keeps a submission or visible result after expiration", () => {
    expect(getStudentAssignmentPhase({ ...assignment, resultVisibility: "hidden" }, submission, null, at)).toBe("submitted");
    expect(getStudentAssignmentPhase(assignment, submission, null, at)).toBe("graded");
    expect(getStudentAssignmentPhase(assignment, undefined, null, at)).toBe("expired");
  });
  it("distinguishes a restored draft, draft error and untouched work", () => {
    expect(getStudentAssignmentPhase(assignment, undefined, null, before)).toBe("not_started");
    expect(getStudentAssignmentPhase(assignment, undefined, { status: "restored", answers: { q: { type: "true_false", answer: true } } }, before)).toBe("in_progress");
    expect(getStudentAssignmentPhase(assignment, undefined, { status: "error", answers: {} }, before)).toBe("draft_error");
  });
  it("filters unpublished, other classes and other students", () => {
    const rows = getStudentAssignmentRows([assignment, { ...assignment, id: "draft", status: "draft" }],
      [{ ...submission, studentId: "other" }], "student", new Set(["c"]), new Map(), before);
    expect(rows.map((row) => row.group)).toEqual(["todo"]);
    expect(getStudentAssignmentRows([assignment], [], "student", new Set(), new Map(), before)).toEqual([]);
  });
});
