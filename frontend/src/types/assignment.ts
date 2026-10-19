import type { Question, AnswerOption, QuestionV2 } from "./question";

export type AssignmentQuestion = Pick<
  Question,
  | "id"
  | "type"
  | "chapter"
  | "difficulty"
  | "content"
  | "options"
  | "correctOption"
  | "explanation"
  | "lessonId"
>;

export type Assignment = {
  id: string;
  title: string;
  classroomId: string;
  questions: AssignmentQuestion[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  dueAt?: string;
  lessonId?: string;
};

export type AssignmentDraftInput = {
  title: string;
  classroomId: string;
  questions: Question[];
  lessonId: string;
};

export type AssignmentSubmission = {
  id: string;
  assignmentId: string;
  classroomId: string;
  studentId: string;
  answers: Record<string, AnswerOption>;
  correctCount: number;
  totalQuestions: number;
  score: number;
  submittedAt: string;
};

type AssignmentQuestionFrom<T> = T extends QuestionV2
  ? Omit<T, "createdAt" | "updatedAt" | "showInLesson">
  : never;

export type AssignmentQuestionV2 = AssignmentQuestionFrom<QuestionV2>;

export type AssignmentResultVisibility = "hidden" | "score" | "answers";

export type AssignmentContent = {
  text: string;
  imageUrl: string;
  videoUrl: string;
};

export type AssignmentV2 = Omit<Assignment, "questions"> & {
  questions: AssignmentQuestionV2[];
  teacherName?: string;
  resultVisibility?: AssignmentResultVisibility;
  content?: AssignmentContent;
};

export type AssignmentDraftInputV2 = Omit<AssignmentDraftInput, "questions"> & {
  questions: QuestionV2[];
  content?: AssignmentContent;
};

export type AssignmentAnswerV2 =
  | {
      type: "single_choice";
      selectedOptionId: string;
    }
  | {
      type: "multiple_choice";
      selectedOptionIds: string[];
    }
  | {
      type: "true_false";
      answer: boolean;
    }
  | {
      type: "true_false_group";
      answersByStatementId: Record<string, boolean>;
    }
  | {
      type: "short_answer";
      value: string;
    };

export type AssignmentAnswersV2 = Record<string, AssignmentAnswerV2>;

export type AssignmentSubmissionV2 = Omit<AssignmentSubmission, "answers"> & {
  answers: AssignmentAnswersV2;
};
