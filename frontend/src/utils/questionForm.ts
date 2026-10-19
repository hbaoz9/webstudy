import { normalizeNumericAnswer } from "./assignmentQuestion";
import type { QuestionInputV2 as QuestionFormInput, QuestionV2 } from "../types/question";

export function toQuestionInput(savedQuestion: QuestionV2): QuestionFormInput | null {
  const commonFields = {
    chapter: savedQuestion.chapter ?? "",
    difficulty: savedQuestion.difficulty,
    content: savedQuestion.content,
    image: savedQuestion.image ? { ...savedQuestion.image } : undefined,
    explanation: savedQuestion.explanation ?? "",
    lessonId: savedQuestion.lessonId ?? "",
    showInLesson: savedQuestion.showInLesson ?? false,
  };

  if (savedQuestion.type === "short_answer") return { ...commonFields, type: "short_answer", correctAnswer: savedQuestion.correctAnswer };

  if (savedQuestion.type === "single_choice") {
    return {
      ...commonFields,
      type: "single_choice",
      options: savedQuestion.options.map((option) => ({
        ...option,
      })),
      correctOptionId: savedQuestion.correctOptionId,
    };
  }

  if (savedQuestion.type === "true_false") {
    return {
      ...commonFields,
      type: "true_false",
      correctAnswer: savedQuestion.correctAnswer,
    };
  }

  if (savedQuestion.type === "multiple_choice") {
    return {
      ...commonFields,
      type: "multiple_choice",

      options: savedQuestion.options.map((option) => ({
        ...option,
      })),

      correctOptionIds: [...savedQuestion.correctOptionIds],
    };
  }

  if (savedQuestion.type === "true_false_group") {
    return {
      ...commonFields,
      type: "true_false_group",

      statements: savedQuestion.statements.map((statement) => ({
        ...statement,
      })),
    };
  }

  return null;
}

export type QuestionFormValidationResult =
  | { ok: true; input: QuestionFormInput }
  | { ok: false; error: string };

export function validateQuestionInput(
  question: QuestionFormInput,
  lessons: ReadonlyArray<{ id: string }>,
): QuestionFormValidationResult {
  if (!lessons.some((lesson) => lesson.id === question.lessonId)) {
    return { ok: false, error: "Vui lòng chọn bài học cho câu hỏi." };
  }

  if (question.type === "short_answer") {
    if (!question.content.trim()) { return { ok: false, error: "Vui lòng nhập nội dung câu hỏi." }; }
    const correctAnswer = normalizeNumericAnswer(question.correctAnswer);
    if (correctAnswer === null) { return { ok: false, error: "Nhập đáp án là một số, ví dụ 125, -2 hoặc 12,5. Không kèm đơn vị hay dấu tách hàng nghìn." }; }
    return { ok: true, input: { ...question, content: question.content.trim(), correctAnswer, explanation: question.explanation?.trim() } };
  }

  if (question.type === "true_false_group") {
    const cleanedQuestion: Extract<QuestionFormInput, { type: "true_false_group" }> = {
      ...question,
      content: question.content.trim(),

      statements: question.statements.map((statement) => ({
        ...statement,
        content: statement.content.trim(),
      })),

      explanation: question.explanation?.trim() ?? "",
      lessonId: question.lessonId?.trim() ?? "",
      chapter: question.chapter?.trim() ?? "",
    };

    if (!cleanedQuestion.content) {
      return { ok: false, error: "Vui lòng nhập nội dung chung hoặc yêu cầu câu hỏi." };
    }

    if (cleanedQuestion.statements.length < 2) {
      return { ok: false, error: "Câu hỏi phải có ít nhất 2 ý." };
    }

    const emptyStatementIndex = cleanedQuestion.statements.findIndex(
      (statement) => !statement.content,
    );

    if (emptyStatementIndex !== -1) {
      return { ok: false, error: `Vui lòng nhập nội dung ý ${emptyStatementIndex + 1}.` };
    }

    return { ok: true, input: cleanedQuestion };
  }

  if (question.type === "multiple_choice") {
    const cleanedQuestion: Extract<QuestionFormInput, { type: "multiple_choice" }> = {
      ...question,
      content: question.content.trim(),

      options: question.options.map((option) => ({
        ...option,
        text: option.text.trim(),
      })),

      correctOptionIds: [...question.correctOptionIds],
      explanation: question.explanation?.trim() ?? "",
      lessonId: question.lessonId?.trim() ?? "",
      chapter: question.chapter?.trim() ?? "",
    };

    if (!cleanedQuestion.content) {
      return { ok: false, error: "Vui lòng nhập nội dung câu hỏi." };
    }

    if (cleanedQuestion.options.length < 2) {
      return { ok: false, error: "Câu hỏi phải có ít nhất 2 phương án." };
    }

    const hasEmptyOption = cleanedQuestion.options.some(
      (option) => !option.text,
    );

    if (hasEmptyOption) {
      return { ok: false, error: "Vui lòng nhập đầy đủ nội dung các phương án." };
    }

    if (cleanedQuestion.correctOptionIds.length === 0) {
      return { ok: false, error: "Vui lòng chọn ít nhất một đáp án đúng." };
    }

    const hasValidCorrectOptions = cleanedQuestion.correctOptionIds.every(
      (optionId) =>
        cleanedQuestion.options.some((option) => option.id === optionId),
    );

    if (!hasValidCorrectOptions) {
      return { ok: false, error: "Có đáp án đúng không còn tồn tại. Vui lòng chọn lại đáp án." };
    }

    return { ok: true, input: cleanedQuestion };
  }

  if (question.type === "true_false") {
    const cleanedQuestion: Extract<QuestionFormInput, { type: "true_false" }> = {
      ...question,
      content: question.content.trim(),
      explanation: question.explanation?.trim() ?? "",
      lessonId: question.lessonId?.trim() ?? "",
      chapter: question.chapter?.trim() ?? "",
    };

    if (!cleanedQuestion.content) {
      return { ok: false, error: "Vui lòng nhập nội dung câu hỏi." };
    }

    return { ok: true, input: cleanedQuestion };
  }

  const cleanedQuestion: Extract<QuestionFormInput, { type: "single_choice" }> = {
    ...question,

    content: question.content.trim(),

    options: question.options.map((option) => ({
      ...option,
      text: option.text.trim(),
    })),

    explanation: question.explanation?.trim() ?? "",

    lessonId: question.lessonId?.trim() ?? "",

    chapter: question.chapter?.trim() ?? "",
  };

  if (!cleanedQuestion.content) {
    return { ok: false, error: "Vui lòng nhập nội dung câu hỏi." };
  }

  if (cleanedQuestion.options.length < 2) {
    return { ok: false, error: "Câu hỏi phải có ít nhất 2 phương án." };
  }

  const hasEmptyOption = cleanedQuestion.options.some(
    (option) => !option.text,
  );

  if (hasEmptyOption) {
    return { ok: false, error: "Vui lòng nhập đầy đủ nội dung các phương án." };
  }

  const hasValidCorrectOption = cleanedQuestion.options.some(
    (option) => option.id === cleanedQuestion.correctOptionId,
  );

  if (!hasValidCorrectOption) {
    return { ok: false, error: "Vui lòng chọn một đáp án đúng." };
  }

  return { ok: true, input: cleanedQuestion };
}
