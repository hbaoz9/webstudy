import type {
  Assignment,
  AssignmentV2,
  AssignmentQuestion,
  AssignmentQuestionV2,
  AssignmentAnswerV2,
  AssignmentSubmission,
  AssignmentSubmissionV2,
  AssignmentAnswersV2,
  AssignmentResultVisibility,
} from "../types/assignment";

import type { AnswerOption, QuestionV2 } from "../types/question";

// Chuẩn hóa số nguyên/thập phân để dùng chung khi nhập đáp án và chấm câu trả lời ngắn.
// Giữ dạng chuỗi để không mất độ chính xác khi đổi sang Number.
export function normalizeNumericAnswer(value: string): string | null {
  const text = value.trim();
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(text)) return null;

  const unsigned = text.replace(/^[+-]/, "").replace(",", ".");
  const [whole, fraction = ""] = unsigned.split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  const decimal = fraction.replace(/0+$/, "");
  const magnitude = decimal ? `${integer}.${decimal}` : integer;
  // -0, +0 và 0.00 cùng một giá trị.
  return text.startsWith("-") && magnitude !== "0" ? `-${magnitude}` : magnitude;
}

export function evaluateNumericAnswer(
  correctAnswer: string,
  answer: string | undefined,
): "unanswered" | "invalid" | "correct" | "incorrect" {
  const expected = normalizeNumericAnswer(correctAnswer);
  if (expected === null) return "invalid";
  if (answer === undefined || !answer.trim()) return "unanswered";
  const actual = normalizeNumericAnswer(answer);
  if (actual === null) return "invalid";
  return actual === expected ? "correct" : "incorrect";
}

export function getAssignmentResultVisibility(assignment: AssignmentV2): AssignmentResultVisibility {
  const visibility = assignment.resultVisibility;
  if (visibility === undefined) return "score";
  return visibility === "score" || visibility === "answers" ? visibility : "hidden";
}

export function describeAssignmentCorrectAnswer(question: AssignmentQuestionV2): string {
  switch (question.type) {
    case "short_answer": return question.correctAnswer;
    case "single_choice":
    case "multiple_choice":
      return question.options.flatMap((option, index) => {
        const correct = question.type === "single_choice"
          ? question.correctOptionId === option.id : question.correctOptionIds.includes(option.id);
        return correct ? [`${String.fromCharCode(65 + index)}. ${option.text}`] : [];
      }).join("; ");
    case "true_false": return question.correctAnswer ? "Đúng" : "Sai";
    case "true_false_group": return question.statements.map((statement, index) =>
      `Ý ${index + 1}: ${statement.correctAnswer ? "Đúng" : "Sai"}`).join("; ");
  }
}

export function assignmentAnswerDraftKey(assignmentId: string, studentId: string) {
  return `webstudy-assignment-answer-draft-v1:${encodeURIComponent(studentId)}:${encodeURIComponent(assignmentId)}`;
}

export function assignmentQuestionSignature(assignment: AssignmentV2): string {
  return JSON.stringify([assignment.classroomId, assignment.questions.map((item) => {
    const question = toAssignmentQuestionV2(item);
    if (!question.image?.url.startsWith("data:")) return question;
    // Không chép cả ảnh base64 vào bản nháp đáp án; vẫn phát hiện khi tư liệu thay đổi.
    let hash = 2166136261;
    for (let index = 0; index < question.image.url.length; index++) hash = Math.imul(hash ^ question.image.url.charCodeAt(index), 16777619);
    return { ...question, image: { ...question.image, url: `local-image:${question.image.url.length}:${hash >>> 0}` } };
  })]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export type AssignmentAnswerDraftRead = {
  answers: AssignmentAnswersV2;
  status: "empty" | "restored" | "changed" | "error";
};

export function loadAssignmentAnswerDraft(
  assignment: AssignmentV2,
  studentId: string,
): AssignmentAnswerDraftRead {
  try {
    const raw = window.localStorage.getItem(assignmentAnswerDraftKey(assignment.id, studentId));
    if (raw === null) return { answers: {}, status: "empty" };
    const draft: unknown = JSON.parse(raw);
    if (!isRecord(draft) || draft.version !== 1 || !isRecord(draft.answers)) {
      throw new Error("Bản nháp không hợp lệ.");
    }
    if (draft.signature !== assignmentQuestionSignature(assignment)) {
      return { answers: {}, status: "changed" };
    }
    const answers: AssignmentAnswersV2 = {};
    for (const question of assignment.questions) {
      const answer = draft.answers[question.id];
      if (answer === undefined) continue;
      if (!isRecord(answer) || answer.type !== question.type) throw new Error("Sai loại đáp án.");
      switch (question.type) {
        case "short_answer":
          // Giữ cả chuỗi đang gõ dở (ví dụ dấu âm), không làm mất nháp khi refresh.
          if (typeof answer.value !== "string") throw new Error("Đáp án số không hợp lệ.");
          answers[question.id] = { type: question.type, value: answer.value };
          break;
        case "single_choice":
          if (typeof answer.selectedOptionId !== "string" ||
              !question.options.some((option) => option.id === answer.selectedOptionId)) {
            throw new Error("Phương án không hợp lệ.");
          }
          answers[question.id] = { type: question.type, selectedOptionId: answer.selectedOptionId };
          break;
        case "multiple_choice": {
          const ids = answer.selectedOptionIds;
          if (!Array.isArray(ids) || !ids.every((id): id is string =>
            typeof id === "string" && question.options.some((option) => option.id === id)) ||
            new Set(ids).size !== ids.length) throw new Error("Phương án không hợp lệ.");
          answers[question.id] = { type: question.type, selectedOptionIds: ids };
          break;
        }
        case "true_false":
          if (typeof answer.answer !== "boolean") throw new Error("Đáp án không hợp lệ.");
          answers[question.id] = { type: question.type, answer: answer.answer };
          break;
        case "true_false_group": {
          if (!isRecord(answer.answersByStatementId)) throw new Error("Các ý không hợp lệ.");
          const values: Record<string, boolean> = {};
          for (const [id, value] of Object.entries(answer.answersByStatementId)) {
            if (typeof value !== "boolean" || !question.statements.some((item) => item.id === id)) {
              throw new Error("Ý trả lời không hợp lệ.");
            }
            values[id] = value;
          }
          answers[question.id] = { type: question.type, answersByStatementId: values };
          break;
        }
      }
    }
    return { answers, status: "restored" };
  } catch {
    return { answers: {}, status: "error" };
  }
}

export function saveAssignmentAnswerDraft(
  assignment: AssignmentV2,
  studentId: string,
  answers: AssignmentAnswersV2,
) {
  window.localStorage.setItem(assignmentAnswerDraftKey(assignment.id, studentId), JSON.stringify({
    version: 1,
    signature: assignmentQuestionSignature(assignment),
    answers,
    updatedAt: new Date().toISOString(),
  }));
}

export function hasAssignmentDraftAnswers(answers: AssignmentAnswersV2): boolean {
  return Object.values(answers).some((answer) => {
    if (answer.type === "short_answer") return !!answer.value.trim();
    if (answer.type === "multiple_choice") return answer.selectedOptionIds.length > 0;
    if (answer.type === "true_false_group") return Object.keys(answer.answersByStatementId).length > 0;
    return true;
  });
}

export function toAssignmentQuestionV2(
  question: QuestionV2 | AssignmentQuestionV2,
): AssignmentQuestionV2 {
  const commonFields = {
    id: question.id,
    content: question.content,
    image: question.image ? { ...question.image } : undefined,
    difficulty: question.difficulty,
    chapter: question.chapter,
    lessonId: question.lessonId,
    explanation: question.explanation,
  };

  switch (question.type) {
    case "short_answer":
      return { ...commonFields, type: "short_answer", correctAnswer: question.correctAnswer };
    case "single_choice":
      return {
        ...commonFields,
        type: "single_choice",
        options: question.options.map((option) => ({
          ...option,
        })),
        correctOptionId: question.correctOptionId,
      };

    case "multiple_choice":
      return {
        ...commonFields,
        type: "multiple_choice",
        options: question.options.map((option) => ({
          ...option,
        })),
        correctOptionIds: [...question.correctOptionIds],
      };

    case "true_false":
      return {
        ...commonFields,
        type: "true_false",
        correctAnswer: question.correctAnswer,
      };

    case "true_false_group":
      return {
        ...commonFields,
        type: "true_false_group",
        statements: question.statements.map((statement) => ({
          ...statement,
        })),
      };
  }
}

const LEGACY_OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];

export function migrateAssignmentQuestionToV2(
  question: AssignmentQuestion,
): AssignmentQuestionV2 {
  return {
    id: question.id,
    type: "single_choice",
    content: question.content,
    difficulty: question.difficulty,
    chapter: question.chapter,
    lessonId: question.lessonId,
    explanation: question.explanation,

    options: LEGACY_OPTIONS.map((label) => ({
      id: `${question.id}-option-${label.toLowerCase()}`,
      text: question.options[label],
    })),

    correctOptionId: `${question.id}-option-${question.correctOption.toLowerCase()}`,
  };
}

export function migrateAssignmentToV2(assignment: Assignment): AssignmentV2 {
  return {
    ...assignment,
    questions: assignment.questions.map(migrateAssignmentQuestionToV2),
  };
}

export function evaluateAssignmentAnswer(
  question: AssignmentQuestionV2,
  answer: AssignmentAnswerV2 | undefined,
): "unanswered" | "invalid" | "correct" | "incorrect" {
  if (!answer) {
    return "unanswered";
  }

  if (question.type !== answer.type) {
    return "invalid";
  }

  switch (question.type) {
    case "short_answer":
      if (answer.type !== "short_answer" || typeof answer.value !== "string" || typeof question.correctAnswer !== "string") return "invalid";
      return evaluateNumericAnswer(question.correctAnswer, answer.value);
    case "single_choice": {
      if (answer.type !== "single_choice") {
        return "invalid";
      }

      if (!answer.selectedOptionId) {
        return "unanswered";
      }

      const optionExists = question.options.some(
        (option) => option.id === answer.selectedOptionId,
      );

      if (!optionExists) {
        return "invalid";
      }

      return answer.selectedOptionId === question.correctOptionId
        ? "correct"
        : "incorrect";
    }

    case "multiple_choice": {
      if (answer.type !== "multiple_choice") {
        return "invalid";
      }

      const selectedIds = answer.selectedOptionIds;

      if (selectedIds.length === 0) {
        return "unanswered";
      }

      const hasValidIds = selectedIds.every((id) =>
        question.options.some((option) => option.id === id),
      );

      const hasDuplicateIds = new Set(selectedIds).size !== selectedIds.length;

      if (!hasValidIds || hasDuplicateIds) {
        return "invalid";
      }

      const isCorrect =
        selectedIds.length === question.correctOptionIds.length &&
        question.correctOptionIds.every((id) => selectedIds.includes(id));

      return isCorrect ? "correct" : "incorrect";
    }

    case "true_false": {
      if (answer.type !== "true_false") {
        return "invalid";
      }

      if (typeof answer.answer !== "boolean") {
        return "invalid";
      }

      return answer.answer === question.correctAnswer ? "correct" : "incorrect";
    }

    case "true_false_group": {
      if (answer.type !== "true_false_group") {
        return "invalid";
      }

      const hasMissingAnswer = question.statements.some(
        (statement) =>
          typeof answer.answersByStatementId[statement.id] !== "boolean",
      );

      if (hasMissingAnswer) {
        return "unanswered";
      }

      const hasUnknownStatement = Object.keys(answer.answersByStatementId).some(
        (id) => !question.statements.some((statement) => statement.id === id),
      );

      if (hasUnknownStatement) {
        return "invalid";
      }

      const isCorrect = question.statements.every(
        (statement) =>
          answer.answersByStatementId[statement.id] === statement.correctAnswer,
      );

      return isCorrect ? "correct" : "incorrect";
    }
  }
}

export function migrateSubmissionToV2(
  submission: AssignmentSubmission,
): AssignmentSubmissionV2 {
  const answers: AssignmentSubmissionV2["answers"] = {};

  for (const [questionId, selectedOption] of Object.entries(
    submission.answers,
  )) {
    answers[questionId] = {
      type: "single_choice",
      selectedOptionId: `${questionId}-option-${selectedOption.toLowerCase()}`,
    };
  }

  return {
    ...submission,
    answers,
  };
}

// Trạng thái hiển thị; dữ liệu vẫn giữ draft/published như trước.
export function getAssignmentDisplayStatus(assignment: { status: "draft" | "published"; dueAt?: string }, now = Date.now()): "Bản nháp" | "Đang mở" | "Đã hết hạn" {
  if (assignment.status === "draft") return "Bản nháp";
  const deadline = Date.parse(assignment.dueAt ?? "");
  return Number.isFinite(deadline) && deadline <= now ? "Đã hết hạn" : "Đang mở";
}

export function formatAssignmentDeadline(value?: string): string {
  if (!value) return "Chưa đặt";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Hạn chưa rõ";
  const day = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day} – ${time}`;
}
