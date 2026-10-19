import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  AnswerOption,
  Question,
  QuestionInputV2,
  QuestionV2,
} from "../types/question";
const LEGACY_STORAGE_KEY = "webstudy-geo10-teacher-questions-v1";

const STORAGE_KEY = "webstudy-geo10-teacher-questions-v2";
const LEGACY_ANSWER_OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];

function migrateQuestionToV2(question: Question): QuestionV2 {
  const options = LEGACY_ANSWER_OPTIONS.map((option) => ({
    id: `${question.id}-option-${option.toLowerCase()}`,
    text: question.options[option],
  }));

  return {
    id: question.id,
    type: "single_choice",

    content: question.content,
    difficulty: question.difficulty,

    options,
    correctOptionId: `${question.id}-option-${question.correctOption.toLowerCase()}`,

    explanation: question.explanation,

    lessonId: question.lessonId,
    chapter: question.chapter,
    showInLesson: question.showInLesson,

    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

type TeacherQuestionsContextValue = {
  questions: QuestionV2[];
  addQuestion: (input: QuestionInputV2) => string | null;
  importQuestions: (inputs: QuestionInputV2[]) => string[] | null;
  updateQuestion: (id: string, changes: QuestionInputV2) => void;
  deleteQuestion: (id: string) => void;
};

const TeacherQuestionsContext = createContext<
  TeacherQuestionsContextValue | undefined
>(undefined);

function loadLegacyQuestions(): Question[] {
  const saved = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (saved === null) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error("Dữ liệu ngân hàng V1 không phải mảng.");
  return parsed as Question[];
}

function loadQuestionsV2(): QuestionV2[] | null {
  try {
    const savedV2 = window.localStorage.getItem(STORAGE_KEY);
    if (savedV2 !== null) {
      const parsed: unknown = JSON.parse(savedV2);
      if (!Array.isArray(parsed)) throw new Error("Dữ liệu ngân hàng V2 không phải mảng.");
      return parsed as QuestionV2[];
    }
    return loadLegacyQuestions().map(migrateQuestionToV2);
  } catch {
    // Giữ nguyên bản lưu lỗi để còn có thể khôi phục, không tự thay bằng [].
    return null;
  }
}

export function TeacherQuestionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [initialQuestions] = useState(loadQuestionsV2);
  const hasStorageReadError = initialQuestions === null;
  const [questions, setQuestions] = useState<QuestionV2[]>(() => initialQuestions ?? []);
  const latestQuestions = useRef(questions);
  latestQuestions.current = questions;
  const [saveFailed, setSaveFailed] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  useEffect(() => {
    if (hasStorageReadError) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
      setSaveFailed(false);
    } catch (error) {
      console.error("Không thể lưu ngân hàng câu hỏi.", error);
      setSaveFailed(true);
    }
  }, [questions, saveAttempt, hasStorageReadError]);

  const addQuestion = (input: QuestionInputV2) => {
    const now = new Date().toISOString();

    const question: QuestionV2 = {
      ...input,
      id: window.crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    const next = [question, ...latestQuestions.current];
    try {
      // Chỉ làm trống form soạn tiếp khi câu mới đã ghi được xuống bộ nhớ.
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error("Không thể lưu ngân hàng câu hỏi.", error);
      setSaveFailed(true);
      return null;
    }
    latestQuestions.current = next;
    setQuestions(next);
    setSaveFailed(false);
    return question.id;
  };

  const updateQuestion = (id: string, changes: QuestionInputV2) => {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== id) {
          return question;
        }

        if (question.type !== changes.type) {
          return question;
        }

        return {
          ...changes,
          id: question.id,
          createdAt: question.createdAt,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  };

  // Nhập cả nhóm trong một lần ghi: lỗi bộ nhớ không để lại nhóm nhập dở.
  const importQuestions = (inputs: QuestionInputV2[]): string[] | null => {
    if (!inputs.length || inputs.length > 500) return null;
    const now = Date.now();
    const imported: QuestionV2[] = inputs.map((input, index) => ({
      ...input, id: window.crypto.randomUUID(),
      createdAt: new Date(now - index).toISOString(), updatedAt: new Date(now).toISOString(),
    }));
    const next = [...imported, ...latestQuestions.current];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error("Không thể lưu ngân hàng câu hỏi.", error);
      setSaveFailed(true);
      return null;
    }
    latestQuestions.current = next;
    setQuestions(next);
    setSaveFailed(false);
    return imported.map((question) => question.id);
  };

  const deleteQuestion = (id: string) => {
    setQuestions((current) => current.filter((question) => question.id !== id));
  };

  if (hasStorageReadError) return <main role="alert" className="mx-auto my-8 w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-red-200 bg-white p-5 text-ink">
    <h1 className="text-lg font-bold">Không đọc được ngân hàng câu hỏi</h1>
    <p className="mt-3 text-sm leading-6 text-secondary">Bản lưu cũ được giữ nguyên để có thể khôi phục. Hãy thử tải lại; nếu lỗi vẫn còn, nhờ hỗ trợ kiểm tra dữ liệu trên trình duyệt.</p>
    <button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-11 rounded-xl border border-line px-4 text-sm font-bold">Thử tải lại</button>
  </main>;

  return (
    <TeacherQuestionsContext.Provider
      value={{
        questions,
        addQuestion,
        importQuestions,
        updateQuestion,
        deleteQuestion,
      }}
    >
      {saveFailed && <div role="alert" className="m-5 space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p>Chưa lưu được ngân hàng câu hỏi trên trình duyệt. Đừng tải lại hoặc đóng trang. Có thể bộ nhớ đã đầy; thử dùng ảnh nhỏ hơn hoặc bỏ ảnh vừa thêm.</p>
        <button type="button" onClick={() => setSaveAttempt((current) => current + 1)} className="min-h-11 rounded-xl border border-red-300 bg-white px-4 font-bold">Thử lưu lại ngân hàng</button>
      </div>}
      {children}
    </TeacherQuestionsContext.Provider>
  );
}

export function useTeacherQuestions() {
  const context = useContext(TeacherQuestionsContext);

  if (!context) {
    throw new Error(
      "useTeacherQuestions phải nằm trong TeacherQuestionsProvider.",
    );
  }

  return context;
}
