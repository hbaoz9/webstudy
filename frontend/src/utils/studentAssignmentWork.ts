import type { AssignmentAnswersV2, AssignmentQuestionV2 } from "../types/assignment";
import { evaluateAssignmentAnswer } from "./assignmentQuestion";

export function getFirstIncompleteQuestionIndex(
  questions: readonly AssignmentQuestionV2[],
  answers: AssignmentAnswersV2,
) {
  return questions.findIndex((question) => {
    const result = evaluateAssignmentAnswer(question, answers[question.id]);
    return result === "unanswered" || result === "invalid";
  });
}

export function isAssignmentDeadlineExpired(deadline: number, now: number) {
  return !Number.isFinite(deadline) || now >= deadline;
}

export function formatAssignmentCountdown(deadline: number, now: number) {
  const remainingSeconds = Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  return `${hours > 0 ? `${hours}:` : ""}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
