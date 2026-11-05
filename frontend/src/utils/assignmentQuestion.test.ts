import { describe, expect, it } from "vitest";

import {
  assignmentAnswerDraftKey,
  evaluateNumericAnswer,
  normalizeNumericAnswer,
  toAssignmentQuestionV2,
} from "./assignmentQuestion";

describe("assignment answer primitives", () => {
  it("normalizes decimal separators, signs and insignificant zeroes", () => {
    expect(normalizeNumericAnswer(" +0012,500 ")).toBe("12.5");
    expect(normalizeNumericAnswer("-0.00")).toBe("0");
    expect(normalizeNumericAnswer("1,2,3")).toBeNull();
  });

  it("distinguishes unanswered, invalid, correct and incorrect numeric answers", () => {
    expect(evaluateNumericAnswer("12.5", "")).toBe("unanswered");
    expect(evaluateNumericAnswer("12.5", "abc")).toBe("invalid");
    expect(evaluateNumericAnswer("12.5", "12,500")).toBe("correct");
    expect(evaluateNumericAnswer("12.5", "12.6")).toBe("incorrect");
  });

  it("scopes draft keys by student and assignment", () => {
    expect(assignmentAnswerDraftKey("bai 1", "hs/01"))
      .toBe("webstudy-assignment-answer-draft-v1:hs%2F01:bai%201");
  });

  it("copies server UUID questions into an independent assignment snapshot", () => {
    const bank = { id: "server-uuid", type: "single_choice" as const, content: "Original", difficulty: "recognition" as const,
      lessonId: "geo10-kn-b07", createdAt: "2026-11-05", updatedAt: "2026-11-05",
      options: [{ id: "option-a", text: "Original option" }, { id: "option-b", text: "Other" }], correctOptionId: "option-a" };
    const saved = toAssignmentQuestionV2(bank);
    bank.content = "Edited in bank";
    bank.options[0].text = "Edited option";
    expect(saved).toMatchObject({ id: "server-uuid", content: "Original", options: [{ id: "option-a", text: "Original option" }, { id: "option-b", text: "Other" }] });
    expect(saved).not.toBe(bank);
  });

  it("preserves a legacy local question ID without rewriting it as a server UUID", () => {
    const legacy = { id: "local-old-id", type: "true_false" as const, content: "Old question", difficulty: "recognition" as const,
      createdAt: "2025-01-01", updatedAt: "2025-01-01", correctAnswer: true };
    expect(toAssignmentQuestionV2(legacy)).toMatchObject({ id: "local-old-id", content: "Old question", correctAnswer: true });
  });
});
