import { questionTypeLabels as QUESTION_TYPES } from "../../types/question";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClipboardList } from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { AssignmentListRow } from "../../components/assignments/AssignmentListRow";
import Dialog from "../../components/common/Dialog";

import { useTeacherData } from "../../contexts/TeacherDataContext";
import { useTeacherQuestions } from "../../contexts/TeacherQuestionsContext";
import type { DeletedAssignmentSnapshot } from "../../contexts/TeacherAssignmentsContext";
import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";

import type {
  AssignmentV2 as Assignment,
  AssignmentQuestionV2 as AssignmentQuestion,
} from "../../types/assignment";

import {
  getAssignmentDisplayStatus,
  formatAssignmentDeadline,
  toAssignmentQuestionV2,
} from "../../utils/assignmentQuestion";
import { geo10Chapters, geo10Lessons } from "../../data/geo10Curriculum";
import {
  AssignmentContentEditor,
  EMPTY_ASSIGNMENT_CONTENT,
} from "../../components/assignments/AssignmentContent";
import { assignmentContentError } from "../../utils/assignmentValidation";
import { AssignmentClassPicker } from "../../components/assignments/AssignmentClassPicker";
import { AssignmentFilters } from "../../components/assignments/AssignmentFilters";
import { AssignmentCopyDialog } from "../../components/assignments/AssignmentCopyDialog";
import { AssignmentPublishDialog } from "../../components/assignments/AssignmentPublishDialog";
import { AssignmentEditDialog } from "../../components/assignments/AssignmentEditDialog";
import type { QuestionDifficulty } from "../../types/question";
import type { AssignmentResultVisibility } from "../../types/assignment";
import type { AssignmentContent } from "../../types/assignment";

const DIFFICULTIES: Record<QuestionDifficulty, string> = {
  recognition: "Nhận biết",
  comprehension: "Thông hiểu",
  application: "Vận dụng",
  advanced_application: "Vận dụng cao",
};
const CREATE_STEPS = [
  "Thông tin",
  "Chọn câu hỏi",
  "Hướng dẫn",
  "Xem lại & giao",
];
function normalizeQuestionSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLocaleLowerCase("vi")
    .trim();
}

// Chỉ nhận ID từ ngân hàng; nội dung vẫn lấy từ context và được sao chép khi lưu đề.
function readBankSelection(
  state: unknown,
): { ids: string[]; returnTo: string } | null {
  if (
    !state ||
    typeof state !== "object" ||
    !("source" in state) ||
    state.source !== "question-bank" ||
    !("questionIds" in state) ||
    !Array.isArray(state.questionIds)
  )
    return null;
  const ids = [
    ...new Set(
      state.questionIds.filter(
        (id): id is string => typeof id === "string" && !!id,
      ),
    ),
  ];
  const returnTo =
    "returnTo" in state &&
    typeof state.returnTo === "string" &&
    (state.returnTo === "/teacher/questions" ||
      state.returnTo.startsWith("/teacher/questions?"))
      ? state.returnTo
      : "/teacher/questions";
  return { ids, returnTo };
}

function toDateTimeLocalValue(value?: string): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );

  return localDate.toISOString().slice(0, 16);
}

export default function TeacherAssignmentsPage() {
  const { classrooms, getRosterEntries } = useTeacherData();
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const bankSelection = readBankSelection(location.state);
  const creating = pathname === "/teacher/assignments/new";
  const [params, setParams] = useSearchParams();
  const statusFilter = ["open", "draft", "expired", "all"].includes(
    params.get("status") ?? "",
  )
    ? params.get("status")!
    : "open";
  const search = params.get("q") ?? "";
  const classFilter = params.get("class") ?? "";
  const lessonFilter = params.get("lesson") ?? "";
  const sort = ["deadline", "newest", "title"].includes(
    params.get("sort") ?? "",
  )
    ? params.get("sort")!
    : "deadline";
  const [notice, setNotice] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [publishingIds, setPublishingIds] = useState<string[]>([]);
  const [copySourceId, setCopySourceId] = useState<string | null>(null);
  const [copyTitle, setCopyTitle] = useState("");
  const [copyClasses, setCopyClasses] = useState<string[]>([]);
  const [copyError, setCopyError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [lessonId, setLessonId] = useState("");

  const { questions } = useTeacherQuestions();

  const {
    assignments,
    createDrafts,
    duplicateAssignment,
    publishAssignments,
    updateDraft,
    updatePublishedAssignment,
    deleteAssignment,
    restoreDeletedAssignment,
    submissions,
  } = useTeacherAssignments();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [editConfirmationId, setEditConfirmationId] = useState<string | null>(
    null,
  );
  const [undoDelete, setUndoDelete] =
    useState<DeletedAssignmentSnapshot | null>(null);
  const [undoError, setUndoError] = useState("");
  useEffect(() => {
    if (!undoDelete) return;
    const timer = window.setTimeout(
      () => setUndoDelete(null),
      Math.max(0, undoDelete.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [undoDelete]);

  // Form tạo bài tập
  const [title, setTitle] = useState("");
  const [classroomIds, setClassroomIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [createDeadline, setCreateDeadline] = useState("");
  const [resultVisibility, setResultVisibility] =
    useState<AssignmentResultVisibility>("score");
  const [lessonSearch, setLessonSearch] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionLesson, setQuestionLesson] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [questionDifficulty, setQuestionDifficulty] = useState("");
  const [pickerNotice, setPickerNotice] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const dropTarget = useRef<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const selectedRows = useRef(new Map<string, HTMLLIElement>());
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editClassroomId, setEditClassroomId] = useState("");
  const [editError, setEditError] = useState("");
  const [editQuestionIds, setEditQuestionIds] = useState<string[]>([]);
  const [editDeadline, setEditDeadline] = useState("");
  const [imageProcessing, setImageProcessing] = useState(false);
  const [editImageProcessing, setEditImageProcessing] = useState(false);
  const [content, setContent] = useState<AssignmentContent>(
    EMPTY_ASSIGNMENT_CONTENT,
  );
  const [editContent, setEditContent] = useState<AssignmentContent>(
    EMPTY_ASSIGNMENT_CONTENT,
  );

  const importedEntry = useRef<string | null>(null);
  const [bankSelectionNotice, setBankSelectionNotice] = useState("");
  useEffect(() => {
    if (!creating || importedEntry.current === location.key) return;
    const selection = readBankSelection(location.state);
    if (!selection) {
      setBankSelectionNotice("");
      return;
    }
    importedEntry.current = location.key;
    const available = selection.ids.flatMap((id) => {
      const question = questions.find((item) => item.id === id);
      return question ? [question] : [];
    });
    setSelectedIds(available.map((question) => question.id));
    const sharedLesson = available[0]?.lessonId;
    setLessonId(
      sharedLesson &&
        geo10Lessons.some((item) => item.id === sharedLesson) &&
        available.every((question) => question.lessonId === sharedLesson)
        ? sharedLesson
        : "",
    );
    setStep(0);
    setError("");
    const missing = selection.ids.length - available.length;
    setBankSelectionNotice(
      `Đã nhận ${available.length} câu từ ngân hàng. Bạn có thể xem lại, đổi thứ tự hoặc bỏ chọn ở bước Chọn câu hỏi.${missing ? ` Có ${missing} câu không còn trong ngân hàng nên không được thêm.` : ""}`,
    );
  }, [creating, location.key, location.state, questions]);

  // Hạn nộp và lỗi khi chốt bài tập
  const [deadlines, setDeadlines] = useState<Record<string, string>>({});

  const [publishError, setPublishError] = useState<{
    assignmentId: string;
    message: string;
  } | null>(null);

  const hasFutureDeadline = assignments.some(
    (item) => item.status === "published" && Date.parse(item.dueAt ?? "") > now,
  );
  useEffect(() => {
    if (!hasFutureDeadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasFutureDeadline]);

  // Chỉ lấy các lớp đang hoạt động
  const activeClassrooms = classrooms.filter(
    (classroom) => classroom.status !== "archived",
  );

  // Chọn hoặc bỏ chọn câu hỏi
  const toggleQuestion = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  };

  const selectedQuestions = selectedIds.flatMap((id) => {
    const question = questions.find((item) => item.id === id);
    return question ? [question] : [];
  });
  const matchingQuestions = questions.filter(
    (question) =>
      (!lessonId || question.lessonId === lessonId) &&
      (!questionLesson || question.lessonId === questionLesson) &&
      (!questionType || question.type === questionType) &&
      (!questionDifficulty || question.difficulty === questionDifficulty) &&
      normalizeQuestionSearch(question.content).includes(
        normalizeQuestionSearch(questionSearch),
      ),
  );
  function moveQuestion(id: string, targetId: string) {
    setSelectedIds((current) => {
      const from = current.indexOf(id),
        to = current.indexOf(targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });
  }
  function chooseRandomQuestions() {
    const candidates = matchingQuestions.filter(
      (question) => !selectedIds.includes(question.id),
    );
    for (let index = candidates.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [candidates[index], candidates[other]] = [
        candidates[other],
        candidates[index],
      ];
    }
    const added = candidates.slice(0, 10).map((question) => question.id);
    setSelectedIds((current) => [...current, ...added]);
    setPickerNotice(
      added.length
        ? `Đã thêm ${added.length} câu từ kết quả lọc, không trùng câu đã chọn.`
        : "Không còn câu chưa chọn trong kết quả lọc.",
    );
  }
  function stepError(index: number): string | null {
    if (index === 0) {
      if (!title.trim()) return "Vui lòng nhập tên bài tập.";
      if (
        !classroomIds.length ||
        classroomIds.some(
          (id) => !activeClassrooms.some((item) => item.id === id),
        )
      )
        return "Vui lòng chọn một lớp đang hoạt động.";
      if (lessonId && !geo10Lessons.some((lesson) => lesson.id === lessonId))
        return "Bài học không còn tồn tại.";
      if (createDeadline && !Number.isFinite(Date.parse(createDeadline)))
        return "Hạn nộp không hợp lệ.";
    }
    if (index === 1) {
      if (!selectedQuestions.length)
        return "Vui lòng chọn ít nhất một câu hỏi.";
      if (selectedQuestions.length !== selectedIds.length)
        return "Có câu hỏi đã bị xóa khỏi ngân hàng. Hãy bỏ chọn câu đó.";
      if (
        lessonId &&
        selectedQuestions.some((question) => question.lessonId !== lessonId)
      )
        return "Có câu đã chọn thuộc bài học khác. Bỏ chọn câu đó hoặc chọn Ôn tập tổng hợp ở bước Thông tin.";
    }
    if (index === 2)
      return imageProcessing
        ? "Đợi ảnh xử lý xong trước khi tiếp tục."
        : assignmentContentError(content);
    return null;
  }
  function goToStep(target: number) {
    if (target > step) {
      for (let index = 0; index < target; index++) {
        const message = stepError(index);
        if (message) {
          setError(message);
          setStep(index);
          return;
        }
      }
    }
    setError("");
    setStep(target);
  }
  function saveCreatedAssignment(publish: boolean) {
    for (let index = 0; index < 3; index++) {
      const message = stepError(index);
      if (message) {
        setError(message);
        setStep(index);
        return;
      }
    }
    if (
      publish &&
      (!createDeadline || Date.parse(createDeadline) <= Date.now())
    ) {
      setError("Chọn hạn nộp muộn hơn thời điểm hiện tại trước khi giao bài.");
      setStep(0);
      return;
    }
    try {
      // Tạo và giao cả nhóm trong một cập nhật, tránh nhóm bài được giao một phần.
      const ids = createDrafts({
        title: title.trim(),
        classroomIds,
        questions: selectedQuestions,
        lessonId,
        content,
        resultVisibility,
        publish,
        dueAt: createDeadline
          ? new Date(createDeadline).toISOString()
          : undefined,
      });
      setNotice(
        publish
          ? `Đã giao cho ${activeClassrooms
              .filter((item) => classroomIds.includes(item.id))
              .map((item) => item.name)
              .join(", ")}.`
          : "Đã lưu bản nháp. Học sinh chưa thấy bài.",
      );
      navigate(
        `/teacher/assignments?status=${publish ? "open" : "draft"}&sort=newest${publish ? "" : `&batch=${ids.join(",")}`}`,
      );
      setStep(0);
      setTitle("");
      setSelectedIds([]);
      setError("");
      setLessonId("");
      setContent(EMPTY_ASSIGNMENT_CONTENT);
      setClassroomIds([]);
      setCreateDeadline("");
      setResultVisibility("score");
      setQuestionSearch("");
      setQuestionLesson("");
      setQuestionType("");
      setQuestionDifficulty("");
      setLessonSearch("");
      setPickerNotice("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể lưu bài tập.",
      );
    }
  }
  function setDeadlinePreset(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(23, 59, 0, 0);
    setCreateDeadline(toDateTimeLocalValue(date.toISOString()));
  }

  // Chốt bài tập
  const handlePublish = (assignment: Assignment) => {
    setPublishError(null);

    const targets = assignments.filter((item) =>
      publishingIds.includes(item.id),
    );
    if (
      !targets.length ||
      targets.some(
        (item) =>
          !activeClassrooms.some(
            (classroom) => classroom.id === item.classroomId,
          ),
      )
    ) {
      setPublishError({
        assignmentId: assignment.id,
        message: "Lớp đã lưu trữ hoặc không còn tồn tại.",
      });

      return;
    }

    const localDeadline =
      deadlines[assignment.id] ?? toDateTimeLocalValue(assignment.dueAt);

    const deadline = new Date(localDeadline);

    if (
      !localDeadline ||
      Number.isNaN(deadline.getTime()) ||
      deadline.getTime() <= Date.now()
    ) {
      setPublishError({
        assignmentId: assignment.id,
        message: "Hãy chọn hạn nộp muộn hơn thời điểm hiện tại.",
      });

      return;
    }

    try {
      publishAssignments(publishingIds, deadline.toISOString());
      setPublishingIds([]);
      setNotice(
        `Đã giao ${targets.length} bản bài tập cho ${targets.map((item) => classrooms.find((classroom) => classroom.id === item.classroomId)?.name).join(", ")}. Bài hiện trong tab Đang mở.`,
      );
    } catch (cause) {
      setPublishError({
        assignmentId: assignment.id,
        message:
          cause instanceof Error ? cause.message : "Không thể chốt bài tập.",
      });
    }
  };

  // Sửa & Xóa bài tập
  const startEditing = (assignment: Assignment) => {
    setEditingId(assignment.id);
    setEditTitle(assignment.title);
    setEditClassroomId(assignment.classroomId);
    setEditQuestionIds(assignment.questions.map((question) => question.id));
    setEditError("");
    setEditDeadline(toDateTimeLocalValue(assignment.dueAt));
    setEditContent(assignment.content ?? EMPTY_ASSIGNMENT_CONTENT);
  };

  const toggleEditQuestion = (id: string) => {
    setEditQuestionIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );

    setEditError("");
  };

  const saveEditing = (confirmed = false) => {
    if (confirmed) setEditConfirmationId(null);
    if (!editingId) return;

    setEditError("");

    const editingAssignment = assignments.find((item) => item.id === editingId);

    if (!editingAssignment) {
      setEditError("Không tìm thấy bài tập cần sửa.");
      return;
    }

    if (!editTitle.trim()) {
      setEditError("Vui lòng nhập tên bài tập.");
      return;
    }

    const submissionCount = submissions.filter(
      (submission) => submission.assignmentId === editingAssignment.id,
    ).length;

    const hasSubmissions = submissionCount > 0;
    if (!hasSubmissions) {
      if (editImageProcessing) {
        setEditError("Đợi ảnh xử lý xong trước khi lưu.");
        return;
      }
      const contentError = assignmentContentError(editContent);
      if (contentError) {
        setEditError(contentError);
        return;
      }
    }

    /*
     * ==========================
     * BÀI ĐÃ XUẤT BẢN
     * ==========================
     */
    if (editingAssignment.status === "published") {
      if (!editDeadline) {
        setEditError("Vui lòng chọn hạn nộp.");
        return;
      }

      const nextDeadline = new Date(editDeadline);

      if (Number.isNaN(nextDeadline.getTime())) {
        setEditError("Hạn nộp không hợp lệ.");
        return;
      }

      const oldDeadline = editingAssignment.dueAt
        ? new Date(editingAssignment.dueAt)
        : null;

      const deadlineChanged =
        !oldDeadline || nextDeadline.getTime() !== oldDeadline.getTime();

      /*
       * Nếu đổi deadline,
       * deadline mới phải ở tương lai.
       *
       * Nếu deadline cũ đã hết hạn nhưng
       * Teacher chỉ sửa tên thì vẫn cho lưu.
       */
      if (deadlineChanged && nextDeadline.getTime() <= Date.now()) {
        setEditError("Hạn nộp mới phải muộn hơn thời điểm hiện tại.");
        return;
      }

      /*
       * ĐÃ CÓ BÀI NỘP:
       * chỉ tên + deadline được thay đổi.
       */
      if (hasSubmissions) {
        if (!confirmed) {
          setEditConfirmationId(editingAssignment.id);
          return;
        }

        try {
          updatePublishedAssignment(editingAssignment.id, {
            title: editTitle,
            dueAt: nextDeadline.toISOString(),
          });
        } catch (error) {
          setEditError(
            error instanceof Error
              ? error.message
              : "Không thể cập nhật bài tập.",
          );

          return;
        }

        setEditingId(null);
        setEditError("");

        return;
      }

      /*
       * CHƯA CÓ BÀI NỘP:
       * cho phép thay đổi cấu trúc.
       */
    }

    /*
     * ==========================
     * PHẦN EDIT CẤU TRÚC
     * Draft hoặc Published chưa có submission
     * ==========================
     */

    if (
      !activeClassrooms.some((classroom) => classroom.id === editClassroomId)
    ) {
      setEditError("Vui lòng chọn một lớp đang hoạt động.");
      return;
    }

    if (editQuestionIds.length === 0) {
      setEditError("Vui lòng giữ lại ít nhất một câu hỏi.");
      return;
    }

    const nextQuestions: AssignmentQuestion[] = [];

    for (const id of editQuestionIds) {
      const savedVersion = editingAssignment.questions.find(
        (question) => question.id === id,
      );

      if (savedVersion) {
        nextQuestions.push(savedVersion);
        continue;
      }

      const bankQuestion = questions.find((question) => question.id === id);

      if (bankQuestion) {
        nextQuestions.push(toAssignmentQuestionV2(bankQuestion));
      }
    }

    if (nextQuestions.length !== editQuestionIds.length) {
      setEditError("Có câu hỏi không còn tồn tại. Vui lòng chọn lại.");
      return;
    }

    if (
      editingAssignment.lessonId &&
      nextQuestions.some(
        (question) => question.lessonId !== editingAssignment.lessonId,
      )
    ) {
      setEditError("Bài tập chỉ được dùng câu hỏi thuộc bài học đã chọn.");
      return;
    }

    /*
     * Draft → dùng logic cũ.
     */
    if (editingAssignment.status === "draft") {
      updateDraft(editingAssignment.id, {
        title: editTitle,
        classroomId: editClassroomId,
        questions: nextQuestions,
        content: editContent,
      });

      setEditingId(null);
      setEditError("");

      return;
    }

    /*
     * Published chưa có bài nộp.
     */
    const nextDeadline = new Date(editDeadline);

    if (!confirmed) {
      setEditConfirmationId(editingAssignment.id);
      return;
    }

    try {
      updatePublishedAssignment(editingAssignment.id, {
        title: editTitle,

        classroomId: editClassroomId,

        questions: nextQuestions,

        content: editContent,

        dueAt: nextDeadline.toISOString(),
      });
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Không thể cập nhật bài tập.",
      );

      return;
    }

    setEditingId(null);
    setEditError("");
  };

  const removeAssignment = (assignment: Assignment) => {
    setDeletingId(assignment.id);
    setDeleteError("");
  };
  function confirmDelete() {
    if (!deletingId) return;
    try {
      const snapshot = deleteAssignment(deletingId);
      setUndoDelete(snapshot);
      setUndoError("");
      setNotice("");
      if (editingId === deletingId) setEditingId(null);
      setDeletingId(null);
      setDeleteError("");
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : "Không thể xóa bài tập.",
      );
    }
  }
  function restoreDeletion() {
    if (!undoDelete) return;
    try {
      restoreDeletedAssignment(undoDelete);
      setNotice(
        `Đã khôi phục “${undoDelete.assignment.title}” cùng ${undoDelete.submissions.length} bài nộp.`,
      );
      setUndoDelete(null);
      setUndoError("");
    } catch (cause) {
      setUndoError(
        cause instanceof Error ? cause.message : "Không thể hoàn tác.",
      );
      setUndoDelete(null);
    }
  }

  useEffect(() => {
    const copyId = params.get("copy");
    if (!copyId || creating) return;
    const source = assignments.find((item) => item.id === copyId);
    if (source) openCopy(source);
    else setNotice("Không tìm thấy bài để nhân bản.");
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("copy");
        return next;
      },
      { replace: true },
    );
  }, [params, creating, assignments, setParams]);

  function renderEditing(assignment: Assignment) {
    const submissionCount = submissions.filter(
      (item) => item.assignmentId === assignment.id,
    ).length;
    const isStructureLocked =
      assignment.status === "published" && submissionCount > 0;
    const bankQuestions = questions
      .filter(
        (question) =>
          !assignment.lessonId || question.lessonId === assignment.lessonId,
      )
      .map((question) => {
        const savedVersion = assignment.questions.find(
          (item) => item.id === question.id,
        );
        return {
          id: question.id,
          content: savedVersion ? savedVersion.content : question.content,
        };
      });
    const savedQuestions = assignment.questions.filter(
      (savedQuestion) =>
        !questions.some(
          (bankQuestion) =>
            bankQuestion.id === savedQuestion.id &&
            (!assignment.lessonId || bankQuestion.lessonId === assignment.lessonId),
        ),
    );
    return (
      <AssignmentEditDialog
        assignment={assignment}
        submissionCount={submissionCount}
        isStructureLocked={isStructureLocked}
        values={{
          title: editTitle,
          classroomId: editClassroomId,
          questionIds: editQuestionIds,
          deadline: editDeadline,
          content: editContent,
          error: editError,
        }}
        classrooms={activeClassrooms}
        bankQuestions={bankQuestions}
        savedQuestions={savedQuestions}
        onTitleChange={setEditTitle}
        onClassroomChange={setEditClassroomId}
        onDeadlineChange={(value) => {
          setEditDeadline(value);
          setEditError("");
        }}
        onContentChange={setEditContent}
        onProcessingChange={setEditImageProcessing}
        onToggleQuestion={toggleEditQuestion}
        onSave={() => saveEditing()}
        onClose={() => setEditingId(null)}
      />
    );
  }
  const editingAssignment = assignments.find((item) => item.id === editingId);
  const publishingAssignments = assignments.filter((item) =>
    publishingIds.includes(item.id),
  );
  const publishingAssignment = publishingAssignments[0];
  const batchIds = (params.get("batch") ?? "").split(",");
  const newDrafts = assignments.filter(
    (item) => batchIds.includes(item.id) && item.status === "draft",
  );
  const copySource = assignments.find((item) => item.id === copySourceId);
  function openCopy(assignment: Assignment) {
    setCopySourceId(assignment.id);
    setCopyTitle(`${assignment.title} (bản sao)`);
    setCopyClasses(
      activeClassrooms.some((item) => item.id === assignment.classroomId)
        ? [assignment.classroomId]
        : [],
    );
    setCopyError("");
  }
  function saveCopy(event: FormEvent) {
    event.preventDefault();
    if (!copySource) return;
    try {
      const ids = duplicateAssignment(copySource.id, copyClasses, copyTitle);
      setCopySourceId(null);
      setParams({ status: "draft", sort: "newest", batch: ids.join(",") });
      setNotice(
        `Đã nhân bản ${ids.length} bản nháp. Bài nộp và điểm của bài gốc được giữ nguyên.`,
      );
    } catch (cause) {
      setCopyError(
        cause instanceof Error ? cause.message : "Không thể nhân bản bài tập.",
      );
    }
  }
  const relativeDeadline = (assignment: Assignment) => {
    if (assignment.status === "draft") return "Chưa giao";
    if (!assignment.dueAt) return "Không có hạn";
    const deadline = new Date(assignment.dueAt);
    if (!Number.isFinite(deadline.getTime())) return "Hạn chưa rõ";
    const remaining = deadline.getTime() - now;
    if (remaining <= 0) return "Đã hết hạn";
    if (remaining < 3600000)
      return `Còn ${Math.max(1, Math.ceil(remaining / 60000))} phút`;
    if (remaining < 6 * 3600000)
      return `Còn ${Math.ceil(remaining / 3600000)} giờ`;
    const today = new Date(now),
      tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sameDay = (day: Date) =>
      deadline.getFullYear() === day.getFullYear() &&
      deadline.getMonth() === day.getMonth() &&
      deadline.getDate() === day.getDate();
    const time = new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(deadline);
    if (sameDay(today)) return `Hôm nay ${time}`;
    if (sameDay(tomorrow)) return `Ngày mai ${time}`;
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(deadline);
  };
  const fullDeadline = formatAssignmentDeadline;

  const normalizeSearch = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .trim();
  const baseMatches = assignments.filter(
    (assignment) =>
      normalizeSearch(assignment.title).includes(normalizeSearch(search)) &&
      (!classFilter || assignment.classroomId === classFilter) &&
      (!lessonFilter ||
        (lessonFilter === "none"
          ? !assignment.lessonId
          : assignment.lessonId === lessonFilter)),
  );
  const statusMatches = (assignment: Assignment, filter: string) =>
    filter === "all" ||
    getAssignmentDisplayStatus(assignment, now) ===
      (filter === "open"
        ? "Đang mở"
        : filter === "draft"
          ? "Bản nháp"
          : "Đã hết hạn");
  const tabs = [
    { id: "open", label: "Đang mở" },
    { id: "draft", label: "Bản nháp" },
    { id: "expired", label: "Đã hết hạn" },
    { id: "all", label: "Tất cả" },
  ];
  const filteredAssignments = baseMatches
    .filter((assignment) => statusMatches(assignment, statusFilter))
    .sort((a, b) => {
      const byTitle = () =>
        a.title.localeCompare(b.title, "vi", {
          numeric: true,
          sensitivity: "base",
        }) || a.id.localeCompare(b.id);
      if (sort === "title") return byTitle();
      if (sort === "newest")
        return (
          (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) ||
          byTitle()
        );
      const ranks = { "Đang mở": 0, "Đã hết hạn": 1, "Bản nháp": 2 };
      const first = getAssignmentDisplayStatus(a, now),
        second = getAssignmentDisplayStatus(b, now);
      const rank = ranks[first] - ranks[second];
      if (rank) return rank;
      if (first === "Bản nháp")
        return (
          (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) ||
          byTitle()
        );
      const firstDate = Number.isFinite(Date.parse(a.dueAt ?? ""))
        ? Date.parse(a.dueAt!)
        : Infinity;
      const secondDate = Number.isFinite(Date.parse(b.dueAt ?? ""))
        ? Date.parse(b.dueAt!)
        : Infinity;
      return (
        (first === "Đã hết hạn"
          ? secondDate - firstDate
          : firstDate - secondDate) || byTitle()
      );
    });
  const pageValue = Number(params.get("page") ?? "1");
  const pageCount = Math.max(1, Math.ceil(filteredAssignments.length / 10));
  const page = Math.min(
    pageCount,
    Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
  );
  const pageAssignments = filteredAssignments.slice((page - 1) * 10, page * 10);
  const firstPageButton = Math.max(1, Math.min(page - 1, pageCount - 2));
  const pageButtons = Array.from(
    { length: Math.min(3, pageCount) },
    (_, index) => firstPageButton + index,
  );
  const listQuery = new URLSearchParams(params);
  listQuery.delete("return");
  const detailSuffix = `?return=${encodeURIComponent(`/teacher/assignments?${listQuery}`)}`;
  function changeFilter(key: string, value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  function changePage(value: number) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value === 1) next.delete("page");
      else next.set("page", String(value));
      return next;
    });
    window.requestAnimationFrame(() =>
      document
        .getElementById("assignment-list")
        ?.scrollIntoView({ block: "start" }),
    );
  }

  const deletingAssignment = assignments.find((item) => item.id === deletingId);
  const deletingSubmissions = submissions.filter(
    (item) => item.assignmentId === deletingId,
  ).length;
  const confirmingEdit = assignments.find(
    (item) => item.id === editConfirmationId && item.id === editingId,
  );
  const confirmingEditSubmissions = submissions.filter(
    (item) => item.assignmentId === confirmingEdit?.id,
  ).length;

  return (
    <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">
            {creating ? "Tạo bài tập mới" : "Bài tập"}
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {creating
              ? "Chuẩn bị bài trong bốn bước, rồi lưu nháp hoặc giao cho lớp."
              : "Theo dõi hạn nộp, tiến độ và kết quả của các bài đã tạo."}
          </p>
        </div>
        <Link
          to={
            creating
              ? (bankSelection?.returnTo ?? "/teacher/assignments")
              : "/teacher/assignments/new"
          }
          state={
            creating && bankSelection
              ? { source: "assignment-builder", questionIds: selectedIds }
              : undefined
          }
          className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold ${creating ? "border border-line bg-white text-ink" : "bg-emerald text-white"}`}
        >
          {creating
            ? bankSelection
              ? "← Ngân hàng câu hỏi"
              : "← Danh sách bài tập"
            : "+ Tạo bài tập mới"}
        </Link>
      </header>
      {undoDelete && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          <p>
            Đã xóa “{undoDelete.assignment.title}” cùng{" "}
            {undoDelete.submissions.length} bài nộp. Có thể hoàn tác lần xóa này
            trong 10 giây.
          </p>
          <button
            type="button"
            onClick={restoreDeletion}
            className="min-h-11 rounded-xl border border-emerald-700 px-4 font-bold"
          >
            Hoàn tác
          </button>
        </div>
      )}
      {undoError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {undoError}
        </p>
      )}
      {creating ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (step < 3) goToStep(step + 1);
          }}
          noValidate
          className="min-w-0 space-y-5 rounded-2xl bg-white p-4 shadow-card sm:p-6"
        >
          {bankSelectionNotice && (
            <p
              role="status"
              className="rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-900"
            >
              {bankSelectionNotice}
            </p>
          )}
          <nav
            aria-label="Các bước tạo bài"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {CREATE_STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                aria-current={step === index ? "step" : undefined}
                onClick={() => goToStep(index)}
                className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-bold ${step === index ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-line text-ink"}`}
              >
                {index + 1}. {label}
              </button>
            ))}
          </nav>
          <h2 className="text-lg font-extrabold">{CREATE_STEPS[step]}</h2>
          {step === 0 && (
            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              <div className="min-w-0 space-y-5">
                <label className="block text-sm font-bold">
                  Tên bài tập *
                  <input
                    aria-label="Tên bài tập"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Ví dụ: Ôn tập Địa lí tự nhiên"
                    className="mt-2 min-h-11 w-full rounded-xl border border-line px-3 font-normal"
                  />
                </label>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-bold">
                    Bài học (tùy chọn)
                  </legend>
                  <input
                    aria-label="Tìm bài học"
                    value={lessonSearch}
                    onChange={(event) => setLessonSearch(event.target.value)}
                    placeholder="Tìm tên hoặc số bài"
                    className="min-h-11 w-full rounded-xl border border-line px-3 text-sm"
                  />
                  <select
                    aria-label="Bài học"
                    value={lessonId}
                    onChange={(event) => {
                      setLessonId(event.target.value);
                      setQuestionLesson("");
                    }}
                    className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm"
                  >
                    <option value="">
                      Ôn tập tổng hợp / Không gắn bài học
                    </option>
                    {geo10Chapters.map((chapter) => {
                      const matches = geo10Lessons.filter(
                        (lesson) =>
                          lesson.chapterId === chapter.id &&
                          (lesson.id === lessonId ||
                            normalizeQuestionSearch(
                              `Bài ${lesson.number}. ${lesson.title}`,
                            ).includes(normalizeQuestionSearch(lessonSearch))),
                      );
                      return matches.length ? (
                        <optgroup
                          key={chapter.id}
                          label={`Chương ${chapter.number}. ${chapter.title}`}
                        >
                          {matches.map((lesson) => (
                            <option key={lesson.id} value={lesson.id}>
                              Bài {lesson.number}. {lesson.title}
                            </option>
                          ))}
                        </optgroup>
                      ) : null;
                    })}
                  </select>
                  <p className="text-sm text-secondary">
                    Ôn tập tổng hợp cho phép chọn câu từ nhiều bài học.
                  </p>
                </fieldset>
                <fieldset className="min-w-0 space-y-3">
                  <legend className="text-sm font-bold">Hạn nộp</legend>
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="min-w-0 text-sm">
                      Ngày
                      <input
                        aria-label="Ngày hạn nộp"
                        type="date"
                        value={createDeadline.split("T")[0] || ""}
                        onChange={(event) =>
                          setCreateDeadline(
                            event.target.value
                              ? `${event.target.value}T${createDeadline.split("T")[1] || "23:59"}`
                              : "",
                          )
                        }
                        className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-line px-3"
                      />
                    </label>
                    <label className="min-w-0 text-sm">
                      Giờ
                      <input
                        aria-label="Giờ hạn nộp"
                        type="time"
                        value={createDeadline.split("T")[1] || "23:59"}
                        onChange={(event) => {
                          if (event.target.value)
                            setCreateDeadline(
                              `${createDeadline.split("T")[0] || toDateTimeLocalValue(new Date().toISOString()).split("T")[0]}T${event.target.value}`,
                            );
                        }}
                        className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-line px-3"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      [0, "Hôm nay"],
                      [1, "Ngày mai"],
                      [3, "Sau 3 ngày"],
                      [7, "Sau 1 tuần"],
                    ].map(([days, label]) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setDeadlinePreset(Number(days))}
                        className="min-h-11 rounded-xl border border-line px-3 text-sm"
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCreateDeadline("")}
                      className="min-h-11 rounded-xl border border-line px-3 text-sm"
                    >
                      Để sau
                    </button>
                  </div>
                  <p className="text-sm text-secondary">
                    Có thể để sau khi lưu nháp. Khi giao bài cần một hạn nộp
                    trong tương lai.
                  </p>
                </fieldset>
              </div>
              <AssignmentClassPicker
                classrooms={activeClassrooms}
                value={classroomIds}
                onChange={setClassroomIds}
              />
            </div>
          )}
          {step === 1 && (
            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              <section
                aria-label="Ngân hàng để chọn"
                className="min-w-0 space-y-3"
              >
                <h3 className="font-bold">Ngân hàng câu hỏi</h3>
                <input
                  aria-label="Tìm câu hỏi"
                  value={questionSearch}
                  onChange={(event) => setQuestionSearch(event.target.value)}
                  placeholder="Tìm nội dung câu hỏi"
                  className="min-h-11 w-full rounded-xl border border-line px-3 text-sm"
                />
                <div className="grid min-w-0 gap-2 sm:grid-cols-3">
                  <select
                    aria-label="Lọc bài của câu hỏi"
                    disabled={!!lessonId}
                    value={lessonId || questionLesson}
                    onChange={(event) => setQuestionLesson(event.target.value)}
                    className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-2 text-sm"
                  >
                    <option value="">Tất cả bài học</option>
                    {geo10Lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        Bài {lesson.number}. {lesson.title}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Lọc dạng câu hỏi"
                    value={questionType}
                    onChange={(event) => setQuestionType(event.target.value)}
                    className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-2 text-sm"
                  >
                    <option value="">Tất cả dạng</option>
                    {Object.entries(QUESTION_TYPES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Lọc mức độ câu hỏi"
                    value={questionDifficulty}
                    onChange={(event) =>
                      setQuestionDifficulty(event.target.value)
                    }
                    className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-2 text-sm"
                  >
                    <option value="">Tất cả mức độ</option>
                    {Object.entries(DIFFICULTIES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-secondary">
                    {matchingQuestions.length} câu phù hợp
                  </p>
                  <button
                    type="button"
                    onClick={chooseRandomQuestions}
                    className="min-h-11 rounded-xl border border-line px-3 text-sm font-bold"
                  >
                    + Chọn ngẫu nhiên tối đa 10 câu
                  </button>
                </div>
                {pickerNotice && (
                  <p role="status" className="text-sm text-secondary">
                    {pickerNotice}
                  </p>
                )}
                <div className="max-h-[30rem] space-y-2 overflow-y-auto">
                  {matchingQuestions.map((question) => (
                    <label
                      key={question.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(question.id)}
                        onChange={() => toggleQuestion(question.id)}
                        className="mt-1 size-4 shrink-0 accent-emerald"
                      />
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        <span className="line-clamp-3 text-sm font-semibold">
                          {question.content}
                        </span>
                        <span className="mt-1 block text-sm text-secondary">
                          {QUESTION_TYPES[question.type]} ·{" "}
                          {DIFFICULTIES[question.difficulty]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {!matchingQuestions.length && (
                  <div className="space-y-3 rounded-xl border border-dashed border-line p-4 text-sm">
                    <p>
                      {questions.length
                        ? "Không có câu phù hợp. Hãy đổi bộ lọc."
                        : "Ngân hàng câu hỏi chưa có câu nào."}
                    </p>
                    <Link
                      to="/teacher/questions"
                      className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 font-bold"
                    >
                      Mở ngân hàng để thêm câu hỏi
                    </Link>
                  </div>
                )}
              </section>
              <section
                aria-label="Câu hỏi đã chọn"
                className="min-w-0 space-y-3"
              >
                <h3 className="font-bold">Đã chọn {selectedIds.length} câu</h3>
                <p className="text-sm text-secondary">
                  Kéo nút ↕ để đổi thứ tự hoặc dùng nút Lên / Xuống. Thứ tự này
                  sẽ được lưu trong đề.
                </p>
                {!selectedIds.length && (
                  <p className="rounded-xl border border-dashed border-line p-4 text-sm text-secondary">
                    Chọn câu hỏi từ ngân hàng bên cạnh.
                  </p>
                )}
                <ol className="max-h-[30rem] space-y-2 overflow-y-auto">
                  {selectedIds.map((id, index) => {
                    const question = questions.find((item) => item.id === id);
                    return (
                      <li
                        key={id}
                        ref={(element) => {
                          if (element) selectedRows.current.set(id, element);
                          else selectedRows.current.delete(id);
                        }}
                        className={`min-w-0 rounded-xl border p-3 ${draggingId === id || dropTargetId === id ? "border-emerald-700 bg-emerald-50" : "border-line"}`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            aria-label={`Kéo câu ${index + 1}`}
                            className="min-h-11 min-w-11 shrink-0 touch-none rounded-lg border border-line text-lg"
                            onPointerDown={(event) => {
                              if (event.button !== 0) return;
                              dragId.current = id;
                              dropTarget.current = id;
                              setDraggingId(id);
                              event.currentTarget.setPointerCapture(
                                event.pointerId,
                              );
                            }}
                            onPointerMove={(event) => {
                              if (!dragId.current) return;
                              for (const [
                                targetId,
                                element,
                              ] of selectedRows.current) {
                                const rect = element.getBoundingClientRect();
                                if (
                                  event.clientX >= rect.left &&
                                  event.clientX <= rect.right &&
                                  event.clientY >= rect.top &&
                                  event.clientY <= rect.bottom
                                ) {
                                  dropTarget.current = targetId;
                                  setDropTargetId(targetId);
                                  break;
                                }
                              }
                            }}
                            onPointerUp={() => {
                              if (dragId.current && dropTarget.current)
                                moveQuestion(
                                  dragId.current,
                                  dropTarget.current,
                                );
                              dragId.current = null;
                              setDraggingId(null);
                              setDropTargetId(null);
                            }}
                            onPointerCancel={() => {
                              dragId.current = null;
                              setDraggingId(null);
                              setDropTargetId(null);
                            }}
                            onLostPointerCapture={() => {
                              dragId.current = null;
                              setDraggingId(null);
                              setDropTargetId(null);
                            }}
                          >
                            ↕
                          </button>
                          <p className="min-w-0 text-sm [overflow-wrap:anywhere]">
                            <strong>Câu {index + 1}. </strong>
                            {question?.content ||
                              "Câu hỏi không còn trong ngân hàng"}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            aria-label={`Đưa câu ${index + 1} lên`}
                            disabled={index === 0}
                            onClick={() =>
                              moveQuestion(id, selectedIds[index - 1])
                            }
                            className="min-h-11 rounded-lg border border-line px-3 text-sm disabled:opacity-40"
                          >
                            ↑ Lên
                          </button>
                          <button
                            type="button"
                            aria-label={`Đưa câu ${index + 1} xuống`}
                            disabled={index === selectedIds.length - 1}
                            onClick={() =>
                              moveQuestion(id, selectedIds[index + 1])
                            }
                            className="min-h-11 rounded-lg border border-line px-3 text-sm disabled:opacity-40"
                          >
                            ↓ Xuống
                          </button>
                          <button
                            type="button"
                            aria-label={`Bỏ câu ${index + 1}`}
                            onClick={() => toggleQuestion(id)}
                            className="min-h-11 rounded-lg border border-line px-3 text-sm"
                          >
                            Bỏ chọn
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>
          )}
          {step === 2 && (
            <>
              <p className="text-sm text-secondary">
                Thêm yêu cầu hoặc tư liệu cần đọc. Có thể tiếp tục mà không thêm
                nội dung.
              </p>
              <AssignmentContentEditor
                value={content}
                onChange={setContent}
                onProcessingChange={setImageProcessing}
              />
            </>
          )}
          {step === 3 && (
            <div className="space-y-5">
              <section
                aria-label="Tóm tắt bài tập"
                className="space-y-2 rounded-xl bg-canvas p-4 text-sm [overflow-wrap:anywhere]"
              >
                <h3 className="text-lg font-bold">{title}</h3>
                <p>
                  {activeClassrooms
                    .filter((item) => classroomIds.includes(item.id))
                    .map((item) => item.name)
                    .join(", ")}{" "}
                  · {selectedIds.length} câu
                </p>
                <p>
                  {geo10Lessons.find((item) => item.id === lessonId)?.title ||
                    "Ôn tập tổng hợp / Không gắn bài học"}
                </p>
                <p>
                  Hạn nộp:{" "}
                  {createDeadline
                    ? formatAssignmentDeadline(
                        new Date(createDeadline).toISOString(),
                      )
                    : "Chưa đặt — chỉ có thể lưu nháp"}
                </p>
                <p>
                  {content.text || content.imageUrl || content.videoUrl
                    ? "Có hướng dẫn hoặc tư liệu kèm theo"
                    : "Không có hướng dẫn kèm theo"}
                </p>
              </section>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-bold">
                  Học sinh được xem sau khi nộp
                </legend>
                {(
                  [
                    ["hidden", "Không hiện kết quả"],
                    ["score", "Chỉ điểm"],
                    ["answers", "Điểm và đáp án"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="create-result-visibility"
                      checked={resultVisibility === value}
                      onChange={() => setResultVisibility(value)}
                      className="accent-emerald"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <p className="text-sm text-secondary">
                Lưu nháp giữ bài riêng tư. Giao bài sẽ hiển thị ngay cho học
                sinh của các lớp đã chọn.
              </p>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white py-3">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => goToStep(step - 1)}
              className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold disabled:opacity-40"
            >
              ← Quay lại
            </button>
            {step < 3 ? (
              <button
                type="submit"
                className="min-h-11 rounded-xl bg-emerald px-4 text-sm font-bold text-white"
              >
                {step === 2 ? "Tiếp tục: xem lại" : "Tiếp tục →"}
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveCreatedAssignment(false)}
                  className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold"
                >
                  Lưu nháp
                </button>
                <button
                  type="button"
                  onClick={() => saveCreatedAssignment(true)}
                  className="min-h-11 rounded-xl bg-emerald px-4 text-sm font-bold text-white"
                >
                  Giao bài
                </button>
              </div>
            )}
          </div>
        </form>
      ) : (
        <section
          id="assignment-list"
          aria-label="Danh sách bài tập"
          className="scroll-mt-24 space-y-3"
        >
          <AssignmentFilters
            tabs={tabs.map((tab) => ({
              ...tab,
              count: baseMatches.filter((assignment) =>
                statusMatches(assignment, tab.id),
              ).length,
            }))}
            statusFilter={statusFilter}
            search={search}
            classFilter={classFilter}
            lessonFilter={lessonFilter}
            sort={sort}
            classrooms={classrooms}
            chapters={geo10Chapters}
            lessons={geo10Lessons}
            mobileFiltersOpen={mobileFiltersOpen}
            onFilterChange={changeFilter}
            onToggleMobileFilters={() => setMobileFiltersOpen((value) => !value)}
            onResetFilters={() => setParams({ status: "all" }, { replace: true })}
          />
          {newDrafts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3">
              <p className="min-w-0 text-sm text-emerald-900">
                Đã chuẩn bị {newDrafts.length} bản nháp cho{" "}
                {newDrafts
                  .map(
                    (item) =>
                      classrooms.find(
                        (classroom) => classroom.id === item.classroomId,
                      )?.name ?? "Lớp không còn tồn tại",
                  )
                  .join(", ")}
                .
              </p>
              <button
                type="button"
                onClick={() => {
                  setPublishError(null);
                  setPublishingIds(newDrafts.map((item) => item.id));
                }}
                className="min-h-11 rounded-xl bg-emerald px-4 text-sm font-bold text-white"
              >
                Giao {newDrafts.length} bản nháp
              </button>
            </div>
          )}
          {notice && (
            <p
              role="status"
              className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
            >
              {notice}
            </p>
          )}
          <p className="text-sm text-secondary">
            {filteredAssignments.length} bài phù hợp · tiến độ chỉ tính học sinh
            đã kết nối tài khoản.
          </p>
          {pageAssignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
              <ClipboardList
                aria-hidden="true"
                className="mx-auto size-9 text-secondary"
              />
              <p className="mt-3 text-sm text-secondary">
                {assignments.length === 0
                  ? "Bạn chưa tạo bài tập nào. Chọn Tạo bài tập mới để bắt đầu."
                  : "Không có bài phù hợp với tab và bộ lọc hiện tại. Chọn tab khác hoặc Bỏ lọc để xem các bài còn lại."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-card">
              <div
                aria-hidden="true"
                className="hidden items-center gap-2 border-b border-line px-3 py-3 text-[13px] font-bold text-secondary md:flex"
              >
                <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_5.5rem_8rem_5.5rem_4.5rem] gap-2 px-1">
                  <span>Tên bài</span>
                  <span>Lớp</span>
                  <span>Hạn nộp</span>
                  <span>Đã nộp</span>
                  <span>Điểm TB</span>
                </div>
                <span className="w-11 shrink-0"> </span>
              </div>
              {pageAssignments.map((assignment) => {
                const classroom = classrooms.find(
                  (item) => item.id === assignment.classroomId,
                );
                const entries = submissions.filter(
                  (item) =>
                    item.assignmentId === assignment.id &&
                    item.classroomId === assignment.classroomId,
                );
                const rosterIds = new Set(
                  getRosterEntries(assignment.classroomId).flatMap((item) =>
                    item.status === "joined" && item.linkedUserId
                      ? [item.linkedUserId]
                      : [],
                  ),
                );
                const submittedIds = new Set(
                  entries.map((item) => item.studentId),
                );
                const submittedCount = [...rosterIds].filter((id) =>
                  submittedIds.has(id),
                ).length;
                const scores = entries
                  .map((item) => item.score)
                  .filter(
                    (score) =>
                      Number.isFinite(score) && score >= 0 && score <= 10,
                  );
                const average = scores.length
                  ? new Intl.NumberFormat("vi-VN", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }).format(
                      scores.reduce((sum, score) => sum + score, 0) /
                        scores.length,
                    )
                  : "—";
                const status = getAssignmentDisplayStatus(assignment, now);
                const deadline = Date.parse(assignment.dueAt ?? "");
                const soon =
                  assignment.status === "published" &&
                  deadline > now &&
                  deadline <= now + 3 * 86400000;
                const classroomName = classroom
                  ? `${classroom.name}${classroom.status === "archived" ? " (lưu trữ)" : ""}`
                  : "Lớp không còn tồn tại";
                return (
                  <AssignmentListRow
                    key={assignment.id}
                    assignment={assignment}
                    classroomName={classroomName}
                    isClassroomArchived={classroom?.status === "archived"}
                    status={status}
                    soon={soon}
                    submittedCount={submittedCount}
                    joinedStudentCount={rosterIds.size}
                    progressMax={Math.max(1, rosterIds.size)}
                    average={average}
                    detailHref={`/teacher/assignments/${assignment.id}${detailSuffix}`}
                    deadlineTitle={fullDeadline(assignment.dueAt)}
                    deadlineLabel={relativeDeadline(assignment)}
                    onEdit={startEditing}
                    onCopy={openCopy}
                    onPublish={(assignment) => {
                      setPublishError(null);
                      setPublishingIds([assignment.id]);
                    }}
                    onDelete={removeAssignment}
                  />
                );
              })}
            </div>
          )}
          {filteredAssignments.length > 0 && (
            <nav aria-label="Phân trang bài tập" className="space-y-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-secondary">
                <p>
                  Hiển thị{" "}
                  <span className="font-semibold text-ink">
                    {(page - 1) * 10 + 1}–
                    {Math.min(page * 10, filteredAssignments.length)}
                  </span>{" "}
                  trong{" "}
                  <span className="font-semibold text-ink">
                    {filteredAssignments.length} bài tập
                  </span>
                </p>

                <p>
                  Trang{" "}
                  <span className="font-semibold text-ink">
                    {page}/{pageCount}
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label="Trang trước"
                  disabled={page === 1}
                  onClick={() => changePage(page - 1)}
                  className="min-h-11 min-w-11 rounded-xl border border-line bg-white text-lg disabled:opacity-40"
                >
                  ‹
                </button>

                {pageButtons.map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-label={`Trang ${value}`}
                    aria-current={value === page ? "page" : undefined}
                    onClick={() => changePage(value)}
                    className={`min-h-11 min-w-11 rounded-xl border text-sm font-bold ${
                      value === page
                        ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                        : "border-line bg-white text-ink"
                    }`}
                  >
                    {value}
                  </button>
                ))}

                <button
                  type="button"
                  aria-label="Trang sau"
                  disabled={page === pageCount}
                  onClick={() => changePage(page + 1)}
                  className="min-h-11 min-w-11 rounded-xl border border-line bg-white text-lg disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </nav>
          )}
        </section>
      )}
      {copySource && (
        <AssignmentCopyDialog
          sourceTitle={copySource.title}
          copyTitle={copyTitle}
          copyClasses={copyClasses}
          copyError={copyError}
          classrooms={activeClassrooms}
          onTitleChange={setCopyTitle}
          onClassesChange={setCopyClasses}
          onClose={() => setCopySourceId(null)}
          onSubmit={saveCopy}
        />
      )}
      {deletingId && (
        <Dialog
          title="Xóa bài tập?"
          onClose={() => {
            setDeletingId(null);
            setDeleteError("");
          }}
        >
          <div className="space-y-4 text-sm">
            <p className="[overflow-wrap:anywhere]">
              Xóa <strong>{deletingAssignment?.title || "bài tập này"}</strong>?
            </p>
            <p>
              Bài này có <strong>{deletingSubmissions} bài nộp</strong>. Xóa bài
              sẽ xóa toàn bộ bài nộp và điểm liên quan
              {deletingAssignment?.status === "published"
                ? ", đồng thời học sinh không còn thấy bài"
                : ""}
              .
            </p>
            <p className="text-secondary">
              Có thể Hoàn tác lần xóa gần nhất trong 10 giây tại trang này.
            </p>
            {!deletingAssignment && (
              <p role="alert" className="text-red-700">
                Bài tập không còn tồn tại.
              </p>
            )}
            {deleteError && (
              <p role="alert" className="text-red-700">
                {deleteError}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="min-h-11 rounded-xl border border-line px-4 font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!deletingAssignment}
                onClick={confirmDelete}
                className="min-h-11 rounded-xl bg-red-700 px-4 font-bold text-white disabled:opacity-40"
              >
                Xóa bài tập
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {editingAssignment && (
        renderEditing(editingAssignment)
      )}
      {confirmingEdit && (
        <Dialog
          title="Lưu thay đổi bài đã giao?"
          onClose={() => setEditConfirmationId(null)}
        >
          <div className="space-y-4 text-sm">
            <p className="[overflow-wrap:anywhere]">
              <strong>{confirmingEdit.title}</strong> đã được giao. Thay đổi sẽ
              hiển thị ngay cho học sinh.
            </p>
            {confirmingEditSubmissions > 0 && (
              <p>
                Bài có <strong>{confirmingEditSubmissions} bài nộp</strong>. Chỉ
                tên và hạn nộp được thay đổi; câu hỏi, bài nộp và điểm giữ
                nguyên.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditConfirmationId(null)}
                className="min-h-11 rounded-xl border border-line px-4 font-bold"
              >
                Quay lại chỉnh sửa
              </button>
              <button
                type="button"
                onClick={() => saveEditing(true)}
                className="min-h-11 rounded-xl bg-emerald px-4 font-bold text-white"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {publishingAssignment && (
        <AssignmentPublishDialog
          publishingCount={publishingAssignments.length}
          assignmentTitle={publishingAssignment.title}
          classroomNames={publishingAssignments
            .map(
              (item) =>
                classrooms.find(
                  (classroom) => classroom.id === item.classroomId,
                )?.name ?? "Lớp không còn tồn tại",
            )
            .join(", ")}
          deadline={
            deadlines[publishingAssignment.id] ??
            toDateTimeLocalValue(publishingAssignment.dueAt)
          }
          errorMessage={
            publishError?.assignmentId === publishingAssignment.id
              ? publishError.message
              : undefined
          }
          onDeadlineChange={(value) =>
            setDeadlines((current) => ({
              ...current,
              [publishingAssignment.id]: value,
            }))
          }
          onClose={() => setPublishingIds([])}
          onPublish={() => handlePublish(publishingAssignment)}
        />
      )}
    </div>
  );
}
