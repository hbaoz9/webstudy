import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { ApiError } from "../service/api/client";
import type { QuestionBankInput, QuestionInputV2, QuestionV2 } from "../types/question";
import { createTeacherQuestion, deleteTeacherQuestion, getTeacherQuestion, listTeacherQuestions, updateTeacherQuestion, type TeacherQuestion } from "../service/api/questions";

type ImportResult = { imported: string[]; failedAt: number | null; error?: string; uncertain?: boolean };
type TeacherQuestionsContextValue = {
  questions: QuestionV2[];
  bankQuestions: TeacherQuestion[];
  loading: boolean;
  ready: boolean;
  error: string;
  revision: number;
  reload: () => Promise<void>;
  getQuestion: (id: string) => Promise<TeacherQuestion>;
  addQuestion: (input: QuestionBankInput) => Promise<TeacherQuestion>;
  updateQuestion: (id: string, input: QuestionBankInput, expectedVersion: number) => Promise<TeacherQuestion>;
  deleteQuestion: (id: string, expectedVersion: number) => Promise<void>;
  importQuestions: (inputs: QuestionInputV2[]) => Promise<ImportResult>;
};

const TeacherQuestionsContext = createContext<TeacherQuestionsContextValue | undefined>(undefined);

export function TeacherQuestionsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const teacherId = session?.role === "teacher" && session.teacherVerificationStatus === "verified" ? session.userId : null;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [bankQuestions, setBankQuestions] = useState<TeacherQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const activeTeacher = useRef(teacherId);
  activeTeacher.current = teacherId;

  const reload = useCallback(async () => {
    const current = ++generation.current;
    if (!teacherId) {
      setBankQuestions([]); setLoadedFor(null); setLoading(false); setError("");
      return;
    }
    setLoading(true); setError("");
    try {
      const first = await listTeacherQuestions({ page: 1, perPage: 100 });
      const all = [...first.data];
      for (let page = 2; page <= first.meta.last_page; page++) {
        const next = await listTeacherQuestions({ page, perPage: 100 });
        all.push(...next.data);
      }
      if (all.length !== first.meta.total || new Set(all.map((item) => item.id)).size !== all.length) {
        throw new Error("Danh sách câu hỏi đã thay đổi khi đang tải. Vui lòng thử lại.");
      }
      if (current !== generation.current) return;
      setBankQuestions(all); setLoadedFor(teacherId);
    } catch (cause) {
      if (current !== generation.current) return;
      setBankQuestions([]); setLoadedFor(null);
      setError(cause instanceof Error ? cause.message : "Không tải được ngân hàng câu hỏi.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { void reload(); return () => { ++generation.current; }; }, [reload]);

  const getQuestion = useCallback((id: string) => getTeacherQuestion(id), []);
  const addQuestion = useCallback(async (input: QuestionBankInput) => {
    const created = await createTeacherQuestion(input);
    setRevision((value) => value + 1); void reload();
    return created;
  }, [reload]);
  const updateQuestion = useCallback(async (id: string, input: QuestionBankInput, expectedVersion: number) => {
    const updated = await updateTeacherQuestion(id, input, expectedVersion);
    setRevision((value) => value + 1); void reload();
    return updated;
  }, [reload]);
  const deleteQuestion = useCallback(async (id: string, expectedVersion: number) => {
    await deleteTeacherQuestion(id, expectedVersion);
    setRevision((value) => value + 1); void reload();
  }, [reload]);
  const importQuestions = useCallback(async (inputs: QuestionInputV2[]): Promise<ImportResult> => {
    const imported: string[] = [];
    const owner = teacherId;
    for (let index = 0; index < inputs.length; index++) {
      if (!owner || activeTeacher.current !== owner) return { imported, failedAt: index, error: "Phiên giáo viên đã thay đổi. Dừng nhập để tránh lưu vào tài khoản khác.", uncertain: false };
      try { imported.push((await createTeacherQuestion(inputs[index])).id); }
      catch (cause) {
        if (imported.length) { setRevision((value) => value + 1); void reload(); }
        return { imported, failedAt: index, error: cause instanceof Error ? cause.message : "Không lưu được câu hỏi.", uncertain: !(cause instanceof ApiError) || cause.status === undefined || cause.status >= 500 };
      }
    }
    if (imported.length) { setRevision((value) => value + 1); void reload(); }
    return { imported, failedAt: null };
  }, [reload, teacherId]);

  const visible = loadedFor === teacherId && teacherId ? bankQuestions : [];
  // The assignment prototype supports only five objective question types.
  const questions = visible.filter((question): question is TeacherQuestion & QuestionV2 => question.type !== "essay_text");
  return <TeacherQuestionsContext.Provider value={{ questions, bankQuestions: visible, loading, ready: !!teacherId && loadedFor === teacherId, error, revision, reload, getQuestion, addQuestion, updateQuestion, deleteQuestion, importQuestions }}>
    {children}
  </TeacherQuestionsContext.Provider>;
}

export function useTeacherQuestions() {
  const context = useContext(TeacherQuestionsContext);
  if (!context) throw new Error("useTeacherQuestions phải nằm trong TeacherQuestionsProvider.");
  return context;
}
