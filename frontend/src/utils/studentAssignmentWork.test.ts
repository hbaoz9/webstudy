import { describe, expect, it } from "vitest";
import type { AssignmentQuestionV2 } from "../types/assignment";
import { formatAssignmentCountdown, getFirstIncompleteQuestionIndex, isAssignmentDeadlineExpired } from "./studentAssignmentWork";

const questions: AssignmentQuestionV2[] = [
  { id: "first", type: "true_false", content: "First", difficulty: "recognition", correctAnswer: true },
  { id: "second", type: "short_answer", content: "Second", difficulty: "recognition", correctAnswer: "2" },
];

describe("assignment work decisions", () => {
  it("checks the first unanswered or invalid answer while accepting wrong but complete answers", () => {
    expect(getFirstIncompleteQuestionIndex(questions, {})).toBe(0);
    expect(getFirstIncompleteQuestionIndex(questions, { first: { type: "true_false", answer: false }, second: { type: "short_answer", value: "bad" } })).toBe(1);
    expect(getFirstIncompleteQuestionIndex(questions, { first: { type: "true_false", answer: false }, second: { type: "short_answer", value: "3" } })).toBe(-1);
  });
  it("expires exactly at deadline and retains the second-rounded display", () => {
    expect(isAssignmentDeadlineExpired(2000, 1999)).toBe(false);
    expect(isAssignmentDeadlineExpired(2000, 2000)).toBe(true);
    expect(isAssignmentDeadlineExpired(NaN, 1000)).toBe(true);
    expect(formatAssignmentCountdown(2000, 999)).toBe("00:02");
    expect(formatAssignmentCountdown(2000, 1000)).toBe("00:01");
    expect(formatAssignmentCountdown(2000, 2000)).toBe("00:00");
    expect(formatAssignmentCountdown(3661000, 0)).toBe("1:01:01");
  });
});
