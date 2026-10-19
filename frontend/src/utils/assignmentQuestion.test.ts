import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssignmentV2 } from "../types/assignment";
import {
  ASSIGNMENT_DRAFT_CHANGED, assignmentAnswerDraftKey, assignmentQuestionSignature,
  loadAssignmentAnswerDraft, saveAssignmentAnswerDraft,
} from "./assignmentQuestion";

const assignment: AssignmentV2 = {
  id: "assignment", title: "Test", classroomId: "class", status: "published", createdAt: "", updatedAt: "",
  questions: [{ id: "q", type: "true_false", content: "Question", difficulty: "recognition", correctAnswer: true }],
};
const answers = { q: { type: "true_false" as const, answer: true } };

function fakeWindow() {
  const data = new Map<string, string>();
  const dispatchEvent = vi.fn();
  const localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
  vi.stubGlobal("window", { localStorage, dispatchEvent });
  return { data, localStorage, dispatchEvent };
}

afterEach(() => vi.unstubAllGlobals());

describe("assignment answer draft storage", () => {
  it("restores only the matching student, assignment and question signature", () => {
    const { data } = fakeWindow();
    saveAssignmentAnswerDraft(assignment, "student-a", answers);
    expect(loadAssignmentAnswerDraft(assignment, "student-a")).toEqual({ answers, status: "restored" });
    expect(loadAssignmentAnswerDraft(assignment, "student-b").status).toBe("empty");
    expect(loadAssignmentAnswerDraft({ ...assignment, id: "another" }, "student-a").status).toBe("empty");
    expect(loadAssignmentAnswerDraft({ ...assignment, questions: [{ ...assignment.questions[0], content: "Changed" }] }, "student-a").status).toBe("changed");
    expect(data.has(assignmentAnswerDraftKey(assignment.id, "student-a"))).toBe(true);
  });
  it("does not overwrite an invalid draft or emit a change event when storage fails", () => {
    const { data, localStorage, dispatchEvent } = fakeWindow();
    data.set(assignmentAnswerDraftKey(assignment.id, "student"), "{invalid");
    expect(loadAssignmentAnswerDraft(assignment, "student").status).toBe("error");
    expect(data.get(assignmentAnswerDraftKey(assignment.id, "student"))).toBe("{invalid");
    localStorage.setItem = () => { throw new Error("quota"); };
    expect(() => saveAssignmentAnswerDraft(assignment, "student", answers)).toThrow("quota");
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
  it("notifies only after a successful save", () => {
    const { dispatchEvent } = fakeWindow();
    saveAssignmentAnswerDraft(assignment, "student", answers);
    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0][0].type).toBe(ASSIGNMENT_DRAFT_CHANGED);
    expect(assignmentQuestionSignature(assignment)).toBe(assignmentQuestionSignature({ ...assignment, title: "Renamed" }));
  });
});
