import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type {
  Assignment as LegacyAssignment,
  AssignmentV2 as Assignment,
  AssignmentDraftInputV2 as AssignmentDraftInput,
  AssignmentQuestionV2 as AssignmentQuestion,
  AssignmentSubmission as LegacyAssignmentSubmission,
  AssignmentSubmissionV2 as AssignmentSubmission,
  AssignmentAnswersV2,
  AssignmentResultVisibility,
  AssignmentContent,
} from "../types/assignment";
import { assignmentContentError, normalizeAssignmentContent } from "../utils/assignmentValidation";

import {
  migrateAssignmentToV2,
  migrateSubmissionToV2,
  toAssignmentQuestionV2,
  evaluateAssignmentAnswer,
} from "../utils/assignmentQuestion";

import { useTeacherData } from "./TeacherDataContext";
import { useTeacherAccount } from "./TeacherAccountContext";

const LEGACY_STORAGE_KEY = "webstudy-geo10-teacher-assignments-v1";

const STORAGE_KEY = "webstudy-geo10-teacher-assignments-v2";
const LEGACY_SUBMISSIONS_STORAGE_KEY =
  "webstudy-geo10-assignment-submissions-v1";

const SUBMISSIONS_STORAGE_KEY = "webstudy-geo10-assignment-submissions-v2";

export type DeletedAssignmentSnapshot = {
  assignment: Assignment;
  submissions: AssignmentSubmission[];
  index: number;
  expiresAt: number;
};

type CreateAssignmentCopiesInput = Omit<AssignmentDraftInput, "classroomId"> & {
  classroomIds: string[]; resultVisibility?: AssignmentResultVisibility;
  dueAt?: string; publish?: boolean;
};

type TeacherAssignmentsContextValue = {
  assignments: Assignment[];
  createDraft: (input: AssignmentDraftInput) => string;
  publishAssignment: (id: string, dueAt: string) => void;
  extendAssignmentDeadline: (id: string, dueAt: string) => void;
  createDrafts: (input: CreateAssignmentCopiesInput) => string[];
  duplicateAssignment: (id: string, classroomIds: string[], title: string) => string[];
  publishAssignments: (ids: string[], dueAt: string) => void;
  updateDraft: (
    id: string,
    changes: {
      title: string;
      classroomId: string;
      questions: AssignmentQuestion[];
      content?: AssignmentContent;
    },
  ) => void;
  updatePublishedAssignment: (
    id: string,
    changes: {
      title: string;
      dueAt: string;
      classroomId?: string;
      questions?: AssignmentQuestion[];
      content?: AssignmentContent;
    },
  ) => void;

  deleteDraft: (id: string) => void;
  deleteAssignment: (id: string) => DeletedAssignmentSnapshot;
  restoreDeletedAssignment: (snapshot: DeletedAssignmentSnapshot) => void;
  submissions: AssignmentSubmission[];
  submissionStorageStatus: "saving" | "saved" | "error";
  retryStorageSave: () => void;
  setAssignmentResultVisibility: (id: string, visibility: AssignmentResultVisibility) => void;

  submitAssignment: (
    assignmentId: string,
    studentId: string,
    answers: AssignmentAnswersV2,
  ) => void;

  deleteClassAssignmentData: (classroomId: string) => void;
};

const TeacherAssignmentsContext = createContext<
  TeacherAssignmentsContextValue | undefined
>(undefined);

function loadAssignments(): Assignment[] | null {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const savedV2 = window.localStorage.getItem(STORAGE_KEY);

    if (savedV2 !== null) {
      const parsed: unknown = JSON.parse(savedV2);

      if (!Array.isArray(parsed)) {
        throw new Error("Dữ liệu bài tập V2 không phải mảng.");
      }

      return parsed as Assignment[];
    }

    const savedV1 = window.localStorage.getItem(LEGACY_STORAGE_KEY);

    if (savedV1 === null) {
      return [];
    }

    const parsed: unknown = JSON.parse(savedV1);

    if (!Array.isArray(parsed)) {
      throw new Error("Dữ liệu bài tập V1 không phải mảng.");
    }

    return (parsed as LegacyAssignment[]).map(migrateAssignmentToV2);
  } catch (error) {
    console.error("Không thể đọc dữ liệu bài tập.", error);
    return null;
  }
}

function loadSubmissions(): AssignmentSubmission[] | null {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const savedV2 = window.localStorage.getItem(SUBMISSIONS_STORAGE_KEY);

    if (savedV2 !== null) {
      const parsed: unknown = JSON.parse(savedV2);

      if (!Array.isArray(parsed)) {
        throw new Error("Dữ liệu bài nộp V2 không phải mảng.");
      }

      return parsed as AssignmentSubmission[];
    }

    const savedV1 = window.localStorage.getItem(LEGACY_SUBMISSIONS_STORAGE_KEY);

    if (savedV1 === null) {
      return [];
    }

    const parsed: unknown = JSON.parse(savedV1);

    if (!Array.isArray(parsed)) {
      throw new Error("Dữ liệu bài nộp V1 không phải mảng.");
    }

    return (parsed as LegacyAssignmentSubmission[]).map(migrateSubmissionToV2);
  } catch (error) {
    console.error("Không thể đọc dữ liệu bài nộp.", error);
    return null;
  }
}

export function TeacherAssignmentsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isStudentJoinedClass, classrooms } = useTeacherData();
  const { teacherAccount } = useTeacherAccount();

  const [initialAssignments] = useState(loadAssignments);
  const [initialSubmissions] = useState(loadSubmissions);

  const hasStorageReadError =
    initialAssignments === null || initialSubmissions === null;

  const [assignments, setAssignments] = useState<Assignment[]>(
    () => initialAssignments ?? [],
  );

  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>(
    () => initialSubmissions ?? [],
  );

  const [assignmentSaveFailed, setAssignmentSaveFailed] = useState(false);
  const [submissionSaveFailed, setSubmissionSaveFailed] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [savedSubmissions, setSavedSubmissions] = useState(() => initialSubmissions ?? []);
  const submissionStorageStatus = submissionSaveFailed
    ? "error"
    : savedSubmissions === submissions ? "saved" : "saving";

  useEffect(() => {
    if (hasStorageReadError) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
      setAssignmentSaveFailed(false);
    } catch (error) {
      console.error("Không thể lưu bài tập.", error);
      setAssignmentSaveFailed(true);
    }
  }, [assignments, hasStorageReadError, saveAttempt]);

  useEffect(() => {
    if (hasStorageReadError) return;

    try {
      window.localStorage.setItem(
        SUBMISSIONS_STORAGE_KEY,
        JSON.stringify(submissions),
      );
      setSubmissionSaveFailed(false);
      setSavedSubmissions(submissions);
    } catch (error) {
      console.error("Không thể lưu bài nộp.", error);
      setSubmissionSaveFailed(true);
    }
  }, [submissions, hasStorageReadError, saveAttempt]);

  if (hasStorageReadError) {
    return (
      <div
        role="alert"
        className="m-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700"
      >
        <h1 className="font-bold">
          Không thể đọc dữ liệu bài tập hoặc bài nộp
        </h1>

        <p className="mt-2 text-sm">
          Ứng dụng đã tạm dừng để tránh ghi đè dữ liệu cũ.
          Hãy khôi phục dữ liệu Local Storage rồi tải lại trang.
        </p>
      </div>
    );
  }

  const createDraft = (input: AssignmentDraftInput) => {
    const contentError = assignmentContentError(input.content);
    if (contentError) throw new Error(contentError);
    const now = new Date().toISOString();

    const questionSnapshots: AssignmentQuestion[] = input.questions.map(
      toAssignmentQuestionV2,
    );

    const draft: Assignment = {
      id: window.crypto.randomUUID(),
      title: input.title.trim(),
      classroomId: input.classroomId,
      questions: questionSnapshots,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      lessonId: input.lessonId,
      teacherName: teacherAccount.submission?.fullName.trim() || undefined,
      resultVisibility: "score",
      content: normalizeAssignmentContent(input.content),
    };

    setAssignments((current) => [draft, ...current]);

    return draft.id;
  };

  // Mỗi lớp có một bản độc lập; kiểm tra cả nhóm trước khi thay đổi state.
  function validateTargetClasses(ids: string[]): string[] {
    const unique = [...new Set(ids)];
    if (!unique.length || unique.some((id) => !classrooms.some((item) => item.id === id && item.status !== "archived"))) {
      throw new Error("Chọn ít nhất một lớp đang hoạt động.");
    }
    return unique;
  }
  function insertDraftCopies(source: {
    title: string; questions: AssignmentQuestion[]; lessonId?: string;
    content?: AssignmentContent; resultVisibility?: AssignmentResultVisibility;
  }, classroomIds: string[], options: { dueAt?: string; publish?: boolean } = {}): string[] {
    const ids = validateTargetClasses(classroomIds);
    if (!source.title.trim() || !source.questions.length) throw new Error("Bài tập cần tên và ít nhất một câu hỏi.");
    const contentError = assignmentContentError(source.content);
    if (contentError) throw new Error(contentError);
    const deadline = options.dueAt ? Date.parse(options.dueAt) : NaN;
    if (options.dueAt && !Number.isFinite(deadline)) throw new Error("Hạn nộp không hợp lệ.");
    if (options.publish && (!Number.isFinite(deadline) || deadline <= Date.now())) {
      throw new Error("Hạn nộp phải muộn hơn thời điểm hiện tại.");
    }
    const now = new Date().toISOString();
    const copies: Assignment[] = ids.map((classroomId) => ({
      id: window.crypto.randomUUID(), title: source.title.trim(), classroomId,
      questions: structuredClone(source.questions), lessonId: source.lessonId || undefined,
      status: options.publish ? "published" : "draft", dueAt: options.dueAt,
      publishedAt: options.publish ? now : undefined, createdAt: now, updatedAt: now,
      teacherName: teacherAccount.submission?.fullName.trim() || undefined,
      resultVisibility: source.resultVisibility ?? "score",
      content: normalizeAssignmentContent(source.content),
    }));
    setAssignments((current) => [...copies, ...current]);
    return copies.map((item) => item.id);
  }
  const createDrafts = (input: CreateAssignmentCopiesInput) =>
    insertDraftCopies({ ...input, questions: input.questions.map(toAssignmentQuestionV2) }, input.classroomIds, input);
  const duplicateAssignment = (id: string, classroomIds: string[], title: string) => {
    const source = assignments.find((item) => item.id === id);
    if (!source) throw new Error("Không tìm thấy bài cần nhân bản.");
    return insertDraftCopies({ ...source, title }, classroomIds);
  };
  const publishAssignments = (ids: string[], dueAt: string) => {
    const unique = [...new Set(ids)];
    const targets = unique.map((id) => assignments.find((item) => item.id === id));
    if (!unique.length || targets.some((item) => !item || item.status !== "draft")) throw new Error("Nhóm giao bài phải gồm các bản nháp còn tồn tại.");
    const deadline = Date.parse(dueAt);
    if (!Number.isFinite(deadline) || deadline <= Date.now()) throw new Error("Hạn nộp phải muộn hơn thời điểm hiện tại.");
    validateTargetClasses(targets.flatMap((item) => item ? [item.classroomId] : []));
    for (const target of targets) {
      const error = assignmentContentError(target?.content);
      if (error) throw new Error(error);
    }
    const now = new Date().toISOString();
    setAssignments((current) => current.map((item) => unique.includes(item.id)
      ? { ...item, status: "published", dueAt, publishedAt: now, updatedAt: now } : item));
  };

  const publishAssignment = (id: string, dueAt: string) => {
    const contentError = assignmentContentError(assignments.find((item) => item.id === id)?.content);
    if (contentError) throw new Error(contentError);
    const now = new Date().toISOString();

    setAssignments((current) =>
      current.map((assignment) =>
        assignment.id === id && assignment.status === "draft"
          ? {
              ...assignment,
              status: "published",
              dueAt,
              publishedAt: now,
              updatedAt: now,
            }
          : assignment,
      ),
    );
  };

  const updateDraft = (
    id: string,
    changes: {
      title: string;
      classroomId: string;
      questions: AssignmentQuestion[];
      content?: AssignmentContent;
    },
  ) => {
    const contentError = assignmentContentError(changes.content);
    if (contentError) throw new Error(contentError);
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.id === id && assignment.status === "draft"
          ? {
              ...assignment,
              title: changes.title.trim(),
              classroomId: changes.classroomId,
              questions: changes.questions.map(toAssignmentQuestionV2),
              content: changes.content === undefined ? assignment.content : normalizeAssignmentContent(changes.content),
              updatedAt: new Date().toISOString(),
            }
          : assignment,
      ),
    );
  };

  const updatePublishedAssignment = (
    id: string,
    changes: {
      title: string;
      dueAt: string;
      classroomId?: string;
      questions?: AssignmentQuestion[];
      content?: AssignmentContent;
    },
  ) => {
    const hasSubmissions = submissions.some(
      (submission) => submission.assignmentId === id,
    );

    if (
      hasSubmissions &&
      (changes.classroomId !== undefined || changes.questions !== undefined || changes.content !== undefined)
    ) {
      throw new Error(
        "Không thể thay đổi lớp, câu hỏi hoặc nội dung vì bài tập đã có học sinh nộp.",
      );
    }

    const contentError = assignmentContentError(changes.content);
    if (contentError) throw new Error(contentError);
    setAssignments((current) =>
      current.map((assignment) => {
        if (assignment.id !== id || assignment.status !== "published") {
          return assignment;
        }

        return {
          ...assignment,

          title: changes.title.trim(),

          dueAt: changes.dueAt,
          content: changes.content === undefined ? assignment.content : normalizeAssignmentContent(changes.content),

          classroomId: changes.classroomId ?? assignment.classroomId,

          questions: changes.questions
            ? changes.questions.map(toAssignmentQuestionV2)
            : assignment.questions,

          updatedAt: new Date().toISOString(),
        };
      }),
    );
  };

  const extendAssignmentDeadline = (id: string, dueAt: string) => {
    const assignment = assignments.find((item) => item.id === id);
    if (!assignment || assignment.status !== "published") throw new Error("Chỉ gia hạn bài đã giao.");
    validateTargetClasses([assignment.classroomId]);
    const deadline = Date.parse(dueAt);
    const previous = Date.parse(assignment.dueAt ?? "");
    if (!Number.isFinite(deadline) || deadline <= Date.now() || (Number.isFinite(previous) && deadline <= previous)) {
      throw new Error("Hạn mới phải trong tương lai và muộn hơn hạn hiện tại.");
    }
    // Gia hạn chỉ đổi thời gian, không chạm vào câu hỏi, lớp hoặc bài nộp.
    setAssignments((current) => current.map((item) => item.id === id
      ? { ...item, dueAt: new Date(deadline).toISOString(), updatedAt: new Date().toISOString() } : item));
  };

  const deleteDraft = (id: string) => {
    setAssignments((current) =>
      current.filter(
        (assignment) => assignment.id !== id || assignment.status !== "draft",
      ),
    );
  };

  const setAssignmentResultVisibility = (id: string, visibility: AssignmentResultVisibility) => {
    setAssignments((current) => current.map((assignment) => assignment.id === id
      ? { ...assignment, resultVisibility: visibility, updatedAt: new Date().toISOString() }
      : assignment));
  };

  const deleteAssignment = (id: string): DeletedAssignmentSnapshot => {
    const index = assignments.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Bài tập không còn tồn tại.");
    const snapshot: DeletedAssignmentSnapshot = {
      assignment: structuredClone(assignments[index]), index,
      submissions: structuredClone(submissions.filter((item) => item.assignmentId === id)),
      expiresAt: Date.now() + 10_000,
    };
    setAssignments((current) => current.filter((item) => item.id !== id));
    setSubmissions((current) => current.filter((item) => item.assignmentId !== id));
    return snapshot;
  };

  const restoreDeletedAssignment = (snapshot: DeletedAssignmentSnapshot) => {
    if (Date.now() >= snapshot.expiresAt) throw new Error("Đã hết 10 giây để hoàn tác.");
    if (!classrooms.some((item) => item.id === snapshot.assignment.classroomId)) {
      throw new Error("Lớp không còn tồn tại nên không thể khôi phục bài tập.");
    }
    if (assignments.some((item) => item.id === snapshot.assignment.id) ||
      submissions.some((item) => snapshot.submissions.some((saved) => saved.id === item.id))) {
      throw new Error("Dữ liệu đã thay đổi; không thể ghi đè khi hoàn tác.");
    }
    setAssignments((current) => {
      const next = [...current];
      next.splice(Math.min(snapshot.index, next.length), 0, structuredClone(snapshot.assignment));
      return next;
    });
    setSubmissions((current) => [...current, ...structuredClone(snapshot.submissions)]);
  };

  const deleteClassAssignmentData = (classroomId: string) => {
    setAssignments((current) =>
      current.filter((assignment) => assignment.classroomId !== classroomId),
    );

    setSubmissions((current) =>
      current.filter((submission) => submission.classroomId !== classroomId),
    );
  };

  const submitAssignment = (
    assignmentId: string,
    studentId: string,
    answers: AssignmentAnswersV2,
  ) => {
    const assignment = assignments.find((item) => item.id === assignmentId);

    if (!assignment || assignment.status !== "published") {
      throw new Error("Bài tập chưa sẵn sàng để nộp.");
    }

    if (!classrooms.some((item) => item.id === assignment.classroomId && item.status !== "archived")) {
      throw new Error("Lớp học không còn hoạt động nên không thể nộp bài.");
    }

    if (assignment.questions.length === 0) {
      throw new Error("Bài tập chưa có câu hỏi nên không thể nộp.");
    }

    const isApproved = isStudentJoinedClass(assignment.classroomId, studentId);

    if (!isApproved) {
      throw new Error("Học sinh chưa được duyệt vào lớp này.");
    }

    const deadline = Date.parse(assignment.dueAt ?? "");

    if (!Number.isFinite(deadline) || Date.now() >= deadline) {
      throw new Error("Bài tập đã hết hạn nộp.");
    }

    if (
      submissions.some(
        (item) =>
          item.assignmentId === assignmentId && item.studentId === studentId,
      )
    ) {
      throw new Error("Bạn đã nộp bài tập này.");
    }

    const results = assignment.questions.map((question) =>
      evaluateAssignmentAnswer(question, answers[question.id]),
    );

    const incompleteQuestionIndex = results.findIndex(
      (result) => result === "unanswered",
    );

    if (incompleteQuestionIndex !== -1) {
      throw new Error(
        `Vui lòng trả lời đầy đủ câu ${incompleteQuestionIndex + 1}.`,
      );
    }

    const invalidQuestionIndex = results.findIndex(
      (result) => result === "invalid",
    );

    if (invalidQuestionIndex !== -1) {
      throw new Error(
        `Câu trả lời của câu ${invalidQuestionIndex + 1} không hợp lệ.`,
      );
    }

    const savedAnswers: AssignmentAnswersV2 = {};

    for (const question of assignment.questions) {
      savedAnswers[question.id] = structuredClone(answers[question.id]);
    }

    const correctCount = results.filter(
      (result) => result === "correct",
    ).length;

    const totalQuestions = assignment.questions.length;

    const submission: AssignmentSubmission = {
      id: window.crypto.randomUUID(),
      assignmentId: assignment.id,
      classroomId: assignment.classroomId,
      studentId,
      answers: savedAnswers,
      correctCount,
      totalQuestions,
      score: Math.round((correctCount / totalQuestions) * 1000) / 100,
      submittedAt: new Date().toISOString(),
    };

    setSubmissions((current) =>
      current.some(
        (item) =>
          item.assignmentId === assignmentId && item.studentId === studentId,
      )
        ? current
        : [submission, ...current],
    );
  };

  return (
    <TeacherAssignmentsContext.Provider
      value={{
        assignments,
        createDraft,
        createDrafts,
        duplicateAssignment,
        publishAssignment,
        extendAssignmentDeadline,
        publishAssignments,
        updateDraft,
        updatePublishedAssignment,

        deleteDraft,
        deleteAssignment,
        restoreDeletedAssignment,
        deleteClassAssignmentData,
        submissions,
        submissionStorageStatus,
        retryStorageSave: () => setSaveAttempt((current) => current + 1),
        setAssignmentResultVisibility,
        submitAssignment,
      }}
    >
      {(assignmentSaveFailed || submissionSaveFailed) && (
        <div
          role="alert"
          className="m-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700"
        >
          <p className="font-bold">
            {assignmentSaveFailed && submissionSaveFailed
              ? "Chưa lưu được thay đổi bài tập và bài nộp."
              : assignmentSaveFailed
                ? "Chưa lưu được thay đổi bài tập."
                : "Chưa lưu được bài nộp và điểm."}
          </p>

          <p className="mt-2 text-sm">
            Dữ liệu mới hiện chỉ được giữ trong phiên đang mở. Đừng tải lại
            hoặc đóng trang vì phần chưa lưu có thể bị mất. Hãy kiểm tra
            dung lượng hoặc quyền lưu của trình duyệt rồi thử lưu lại.
          </p>

          <button
            type="button"
            onClick={() => setSaveAttempt((current) => current + 1)}
            className="mt-3 rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-bold"
          >
            Thử lưu lại
          </button>
        </div>
      )}
      {children}
    </TeacherAssignmentsContext.Provider>
  );
}

export function useTeacherAssignments() {
  const context = useContext(TeacherAssignmentsContext);

  if (!context) {
    throw new Error(
      "useTeacherAssignments phải nằm trong TeacherAssignmentsProvider.",
    );
  }

  return context;
}
