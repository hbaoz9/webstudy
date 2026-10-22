import { describe, expect, it } from "vitest";

import { evaluateAssignmentAnswer, hasAssignmentDraftAnswers } from "./assignmentQuestion";

describe("student assignment work", () => {
  it("grades supported choice and true/false question shapes", () => {
    const single = {
      id: "q1", type: "single_choice", content: "Chọn đáp án", difficulty: "easy",
      options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "b",
    } as const;
    expect(evaluateAssignmentAnswer(single as never, {
      type: "single_choice", selectedOptionId: "b",
    })).toBe("correct");

    const group = {
      id: "q2", type: "true_false_group", content: "Xét các ý", difficulty: "medium",
      statements: [{ id: "s1", content: "Ý 1", correctAnswer: true }],
    } as const;
    expect(evaluateAssignmentAnswer(group as never, {
      type: "true_false_group", answersByStatementId: { s1: false },
    })).toBe("incorrect");
  });

  it("detects whether a recoverable draft contains an answer", () => {
    expect(hasAssignmentDraftAnswers({})).toBe(false);
    expect(hasAssignmentDraftAnswers({ q1: { type: "short_answer", value: "  " } })).toBe(false);
    expect(hasAssignmentDraftAnswers({ q1: { type: "short_answer", value: "10" } })).toBe(true);
  });
});
