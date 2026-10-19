export type QuestionDifficulty =
  | "recognition"
  | "comprehension"
  | "application"
  | "advanced_application";

export type QuestionType =
  | "single_choice"
  | "true_false"
  | "multiple_choice"
  | "true_false_group"
  | "short_answer";

// Teacher-facing terminology; stored type values and grading stay unchanged.
export const questionTypeLabels: Record<QuestionType, string> = {
  single_choice: "Trắc nghiệm nhiều lựa chọn (chọn 1)",
  true_false_group: "Trắc nghiệm Đúng/Sai (nhiều ý)",
  short_answer: "Trắc nghiệm trả lời ngắn (điền số)",
  true_false: "Đúng/Sai (một nhận định)",
  multiple_choice: "Chọn nhiều đáp án đúng",
};

export type QuestionChoiceOption = {
  id: string;
  text: string;
};

export type TrueFalseStatement = {
  id: string;
  content: string;
  correctAnswer: boolean;
};

export type QuestionImage = {
  url: string;
  caption?: string;
  source?: string;
};

type BaseQuestionV2 = {
  id: string;
  type: QuestionType;

  content: string;
  image?: QuestionImage;
  difficulty: QuestionDifficulty;

  explanation?: string;

  lessonId?: string;

  // Tạm giữ để tương thích dữ liệu hiện tại.
  // Sau này chapter sẽ được suy ra từ lessonId.
  chapter?: string;

  // Legacy: chưa xóa vì Student Lesson hiện còn phụ thuộc.
  showInLesson?: boolean;

  createdAt: string;
  updatedAt: string;
};

export type SingleChoiceQuestionV2 = BaseQuestionV2 & {
  type: "single_choice";

  options: QuestionChoiceOption[];
  correctOptionId: string;
};

export type MultipleChoiceQuestionV2 = BaseQuestionV2 & {
  type: "multiple_choice";

  options: QuestionChoiceOption[];
  correctOptionIds: string[];
};

export type TrueFalseQuestionV2 = BaseQuestionV2 & {
  type: "true_false";

  correctAnswer: boolean;
};

export type TrueFalseGroupQuestionV2 = BaseQuestionV2 & {
  type: "true_false_group";

  statements: TrueFalseStatement[];
};

export type ShortAnswerQuestionV2 = BaseQuestionV2 & {
  type: "short_answer";
  correctAnswer: string;
};

export type QuestionV2 =
  | SingleChoiceQuestionV2
  | TrueFalseQuestionV2
  | MultipleChoiceQuestionV2
  | TrueFalseGroupQuestionV2
  | ShortAnswerQuestionV2;

type QuestionSystemField = "id" | "createdAt" | "updatedAt";

type QuestionInputFrom<T> = T extends QuestionV2
  ? Omit<T, QuestionSystemField>
  : never;

export type QuestionInputV2 = QuestionInputFrom<QuestionV2>;

export type AnswerOption = "A" | "B" | "C" | "D";

export type Question = {
  id: string;
  type: "single_choice";
  chapter: string;
  difficulty: QuestionDifficulty;
  content: string;
  options: Record<AnswerOption, string>;
  correctOption: AnswerOption;
  explanation?: string;
  createdAt: string;
  updatedAt: string;
  lessonId?: string;
  showInLesson?: boolean;
};

export type QuestionInput = Pick<
  Question,
  | "chapter"
  | "difficulty"
  | "content"
  | "options"
  | "correctOption"
  | "explanation"
  | "lessonId"
  | "showInLesson"
>;
