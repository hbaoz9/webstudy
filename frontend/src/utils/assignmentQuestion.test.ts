import { describe, expect, it } from "vitest";

import {
  assignmentAnswerDraftKey,
  evaluateNumericAnswer,
  normalizeNumericAnswer,
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
});
