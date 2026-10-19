import { useState, useEffect, useRef, type FormEvent } from "react";

import { Link, useParams } from "react-router-dom";

import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";

import { useTeacherData } from "../../contexts/TeacherDataContext";

import { useStudentAccount } from "../../contexts/StudentAccountContext";
import { AssignmentContentView } from "../../components/assignments/AssignmentContent";
import AssignmentWorkQuestion from "../../components/student/AssignmentWorkQuestion";
import Dialog from "../../components/common/Dialog";
import { useAssignmentDraft } from "../../hooks/useAssignmentDraft";
import { useAssignmentCountdown } from "../../hooks/useAssignmentCountdown";
import { formatAssignmentCountdown, getFirstIncompleteQuestionIndex, isAssignmentDeadlineExpired } from "../../utils/studentAssignmentWork";
import type {
  AssignmentAnswerV2,
} from "../../types/assignment";

import {
  evaluateAssignmentAnswer,
  assignmentQuestionSignature,
  hasAssignmentDraftAnswers,
  getAssignmentResultVisibility,
} from "../../utils/assignmentQuestion";

export default function StudentAssignmentWorkPage() {
  const { assignmentId } = useParams();
  const { student, hasStudentProfile } = useStudentAccount();
  const { assignments } = useTeacherAssignments();
  const assignment = assignments.find((item) => item.id === assignmentId);
  const sessionKey = JSON.stringify([
    assignmentId,
    hasStudentProfile ? student.id : "",
    assignment ? assignmentQuestionSignature(assignment) : "",
  ]);
  return <AssignmentWorkSession key={sessionKey} />;
}

function AssignmentWorkSession() {
  const { assignmentId } = useParams();

  const { student, hasStudentProfile } = useStudentAccount();

  const studentId = hasStudentProfile ? student.id : "";

  const { assignments, submissions, submitAssignment, submissionStorageStatus, retryStorageSave } =
    useTeacherAssignments();

  const { classrooms, getJoinRequests, isStudentJoinedClass } =
    useTeacherData();

  const assignment = assignments.find((item) => item.id === assignmentId);
  const submission = submissions.find(
    (item) => item.assignmentId === assignmentId && item.studentId === studentId,
  );
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const resetNoticeRef = useRef<HTMLParagraphElement>(null);
  const resetDialogWasOpenRef = useRef(false);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);

  const [activeQuestion, setActiveQuestion] = useState(0);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousQuestionRef = useRef(0);

  useEffect(() => {
    if (previousQuestionRef.current !== activeQuestion) {
      questionHeadingRef.current?.focus();
      previousQuestionRef.current = activeQuestion;
    }
  }, [activeQuestion]);

  const setQuestionAnswer = (
    questionId: string,
    answer: AssignmentAnswerV2,
  ) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: answer,
    }));
  };

  const toggleMultipleChoiceAnswer = (questionId: string, optionId: string) => {
    setAnswers((current) => {
      const existingAnswer = current[questionId];

      const selectedIds =
        existingAnswer?.type === "multiple_choice"
          ? existingAnswer.selectedOptionIds
          : [];

      const nextSelectedIds = selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId];

      return {
        ...current,
        [questionId]: {
          type: "multiple_choice",
          selectedOptionIds: nextSelectedIds,
        },
      };
    });
  };

  const setStatementAnswer = (
    questionId: string,
    statementId: string,
    answer: boolean,
  ) => {
    setAnswers((current) => {
      const existingAnswer = current[questionId];

      const previousAnswers =
        existingAnswer?.type === "true_false_group"
          ? existingAnswer.answersByStatementId
          : {};

      return {
        ...current,
        [questionId]: {
          type: "true_false_group",
          answersByStatementId: {
            ...previousAnswers,
            [statementId]: answer,
          },
        },
      };
    });
  };

  const approvedRequest = assignment
    ? getJoinRequests(assignment.classroomId).find(
      (request) =>
        request.studentId === studentId && request.status === "approved",
    )
    : undefined;

  const isJoined = assignment
    ? classrooms.some((item) => item.id === assignment.classroomId && item.status !== "archived") &&
    isStudentJoinedClass(assignment.classroomId, studentId)
    : false;

  const hasSubmission = Boolean(submission);
  const { draftInfo, answers, setAnswers, draftSaveStatus, retryRead, resetDraft, retrySave } = useAssignmentDraft({
    assignment, studentId,
    canRead: Boolean(assignment && isStudentJoinedClass(assignment.classroomId, studentId)),
    canSave: isJoined && Boolean(approvedRequest), hasSubmission, submissionStorageStatus,
  });
  useEffect(() => {
    if (resetDialogWasOpenRef.current && !resetDialogOpen) {
      if (resetNotice) resetNoticeRef.current?.focus();
      else resetButtonRef.current?.focus();
    }
    resetDialogWasOpenRef.current = resetDialogOpen;
  }, [resetDialogOpen, resetNotice]);
  useEffect(() => {
    if (draftSaveStatus === "saved") setResetNotice(false);
  }, [draftSaveStatus]);

  const deadline = Date.parse(assignment?.dueAt ?? "");
  const { now, refreshNow } = useAssignmentCountdown(
    assignment?.status === "published" && Boolean(approvedRequest) && isJoined && !hasSubmission,
    deadline,
  );
  const isExpired = isAssignmentDeadlineExpired(deadline, now);

  useEffect(() => {
    const dialog = confirmDialogRef.current;
    const canConfirm = assignment?.status === "published" && isJoined && approvedRequest && !hasSubmission;
    if (confirmOpen && canConfirm && dialog) {
      if (!dialog.open) dialog.showModal();
      reviewButtonRef.current?.focus();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
        if (dialog.open) dialog.close();
      };
    } else {
      if (dialog?.open) dialog.close();
      if (confirmOpen) setConfirmOpen(false);
    }
  }, [confirmOpen, assignment?.status, isJoined, approvedRequest?.id, hasSubmission]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (
      !assignment ||
      assignment.status !== "published" ||
      !approvedRequest ||
      !isJoined ||
      draftInfo.status === "error" ||
      submission
    ) {
      return;
    }

    const currentTime = Date.now();
    refreshNow();

    if (isAssignmentDeadlineExpired(deadline, currentTime)) {
      setError("Bài tập đã hết hạn nộp.");
      return;
    }

    const incompleteQuestionIndex = getFirstIncompleteQuestionIndex(assignment.questions, answers);

    if (incompleteQuestionIndex !== -1) {
      setActiveQuestion(incompleteQuestionIndex);
      const question = assignment.questions[incompleteQuestionIndex];
      const result = evaluateAssignmentAnswer(question, answers[question.id]);
      setError(question.type === "short_answer" && result === "invalid"
        ? `Câu ${incompleteQuestionIndex + 1}: vui lòng nhập một số hợp lệ, không kèm đơn vị hay dấu tách hàng nghìn.`
        : `Vui lòng trả lời đầy đủ câu ${incompleteQuestionIndex + 1}.`);
      return;
    }

    setConfirmOpen(true);
  };

  const confirmSubmission = () => {
    if (!confirmOpen || submittingRef.current || !assignment || submission || !isJoined || !approvedRequest) return;
    const currentTime = Date.now();
    refreshNow();
    if (isAssignmentDeadlineExpired(deadline, currentTime)) {
      setError("Bài tập đã hết hạn nộp.");
      return;
    }
    // The context checks eligibility and deadline again at the actual submission.
    submittingRef.current = true;
    try {
      submitAssignment(assignment.id, studentId, answers);
      setConfirmOpen(false);
    } catch (caughtError) {
      submittingRef.current = false;
      setConfirmOpen(false);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể nộp bài.",
      );
    }
  };

  if (
    !assignment ||
    assignment.status !== "published" ||
    !approvedRequest ||
    !isJoined
  ) {
    return (
      <div className="min-w-0 py-2">
        <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-6">
          <h1 className="text-xl font-extrabold text-ink">
            Không thể mở bài tập
          </h1>

          <p className="mt-2 text-sm text-secondary">
            Bài chưa sẵn sàng hoặc học sinh chưa được duyệt vào lớp này.
          </p>

          <Link
            to="/student/assignments"
            className="mt-4 inline-block text-sm font-bold text-emerald-700"
          >
            Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  const classroom = classrooms.find(
    (item) => item.id === assignment.classroomId,
  );

  const displayAnswers = submission?.answers ?? answers;
  const answeredQuestions = assignment.questions.map((question) => {
    const result = evaluateAssignmentAnswer(question, displayAnswers[question.id]);
    return result === "correct" || result === "incorrect";
  });
  const answeredCount = answeredQuestions.filter(Boolean).length;
  const timeRemaining = formatAssignmentCountdown(deadline, now);
  const resultVisibility = getAssignmentResultVisibility(assignment);
  const canReviewAnswers = Boolean(submission) && resultVisibility === "answers" && submissionStorageStatus === "saved";

  return (
    <div className="min-w-0 py-2">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          to="/student/assignments"
          className="text-sm font-bold text-emerald-700"
        >
          ← Quay lại danh sách bài tập
        </Link>

        <header className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <h1 className="break-words text-2xl font-extrabold text-ink">
            {assignment.title}
          </h1>

          <p className="mt-2 text-sm text-secondary">
            {approvedRequest.studentName}
            {" · "}
            {classroom?.name ?? "Lớp học"}
            {" · "}
            {assignment.questions.length}
            {" câu"}
          </p>

          <p className="mt-2 text-sm text-secondary">
            Hạn nộp:{" "}
            {Number.isFinite(deadline)
              ? new Intl.DateTimeFormat("vi-VN", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(deadline))
              : assignment.dueAt
                ? "Không hợp lệ"
                : "Chưa đặt"}
          </p>

          <p className="mt-2 break-words text-sm text-secondary">Giáo viên: {assignment.teacherName || "Chưa cập nhật"}</p>
          <p className="mt-2 text-sm font-bold text-ink">Trạng thái: {submission
            ? submissionStorageStatus === "saved" ? "Đã nộp" : "Bài nộp chưa lưu xong"
            : isExpired ? "Đã khóa làm bài" : hasAssignmentDraftAnswers(answers) ? "Đang làm" : "Chưa làm"}</p>
        </header>

        <AssignmentContentView content={assignment.content} />

        {!submission && (
          <section aria-label="Trạng thái lưu bản nháp" className="rounded-xl border border-line bg-white p-4 text-sm">
            {draftInfo.status === "error" ? (
              <div role="alert">
                <p>Không đọc được bản nháp. Dữ liệu cũ chưa bị ghi đè.</p>
                <button type="button" className="mt-2 min-h-11 font-bold text-emerald-700" onClick={retryRead}>Thử đọc lại</button>
                <button ref={resetButtonRef} type="button" className="ml-4 min-h-11 font-bold text-red-600" onClick={() => setResetDialogOpen(true)}>Bắt đầu lại</button>
              </div>
            ) : draftSaveStatus === "error" ? (
              <div role="alert" className="text-red-600">
                <p>Chưa lưu được đáp án trên trình duyệt. Đừng tải lại hoặc đóng trang.</p>
                <button type="button" className="mt-2 min-h-11 font-bold" onClick={retrySave}>Thử lưu nháp lại</button>
              </div>
            ) : (
              <p ref={resetNoticeRef} tabIndex={resetNotice ? -1 : undefined} role="status" className="text-secondary">
                {resetNotice ? "Đã xóa bản nháp của bài này. Bạn có thể bắt đầu lại."
                  : draftSaveStatus === "saved" ? "Đã lưu nháp trên trình duyệt này."
                  : draftInfo.status === "restored" ? "Đã khôi phục đáp án chưa nộp."
                    : draftInfo.status === "changed" ? "Đề đã thay đổi. Vui lòng làm lại theo nội dung hiện tại."
                      : "Đáp án được tự động lưu nháp trên trình duyệt này. Lưu nháp chưa phải nộp bài."}
              </p>
            )}
          </section>
        )}

        {submission && (
          <section aria-label="Kết quả bài nộp" className="rounded-2xl border border-emerald/30 bg-emerald/5 p-5">
            <h2 className="font-extrabold text-ink">{submissionStorageStatus === "saved" ? "Đã nộp bài"
              : submissionStorageStatus === "error" ? "Bài nộp chưa lưu thành công" : "Đang lưu bài nộp…"}</h2>
            {submissionStorageStatus === "saved" ? (
              <>
                <p className="mt-2 text-sm text-secondary">Đã lưu bài nộp trên trình duyệt này. Bạn có thể xem lại các lựa chọn bên dưới.</p>
                {resultVisibility !== "hidden" ? (
                  <p className="mt-2 text-sm text-ink">Điểm: <strong>{submission.score}/10</strong>{" · "}
                    Đúng {submission.correctCount}/{submission.totalQuestions} câu</p>
                ) : <p className="mt-2 text-sm text-secondary">Giáo viên chưa công bố kết quả.</p>}
                {resultVisibility === "score" && <p className="mt-2 text-sm text-secondary">Giáo viên chưa cho xem đáp án và giải thích.</p>}
              </>
            ) : (
              <div role="status" className="mt-2 text-sm text-red-600">
                <p>{submissionStorageStatus === "error" ? "Chưa lưu được bài nộp. Đừng tải lại hoặc đóng trang; bản nháp được giữ lại để khôi phục." : "Vui lòng chờ lưu bài nộp trước khi rời trang."}</p>
                {submissionStorageStatus === "error" && <button type="button" onClick={retryStorageSave} className="mt-3 min-h-11 rounded-full border border-red-300 bg-white px-4 font-bold">Thử lưu bài nộp lại</button>}
              </div>
            )}
          </section>
        )}

        {!submission && isExpired && (
          <p className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-ink">
            {Number.isFinite(deadline)
              ? "Bài tập đã hết hạn nộp."
              : "Bài tập chưa có hạn nộp hợp lệ. Vui lòng liên hệ giáo viên."}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {assignment.questions.length === 0 ? (
            <p className="rounded-xl border border-line bg-white p-5 text-sm text-secondary">Bài tập chưa có câu hỏi. Vui lòng liên hệ giáo viên.</p>
          ) : (
            <section aria-label="Điều hướng câu hỏi" className="rounded-2xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 ref={questionHeadingRef} tabIndex={-1} className="font-extrabold text-ink outline-none focus-visible:ring-2 focus-visible:ring-emerald">
                  Câu {activeQuestion + 1} / {assignment.questions.length}
                </h2>
                {!submission && !isExpired && <p className="text-sm text-secondary">Còn đến hạn: <span className="font-mono font-bold text-ink">{timeRemaining}</span>
                </p>}
              </div>
              <p className="mt-2 text-sm text-secondary">Đã trả lời đầy đủ {answeredCount}/{assignment.questions.length} câu.</p>
              <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto p-1">
                {assignment.questions.map((question, index) => (
                  <button key={question.id} type="button"
                    aria-label={`Câu ${index + 1}, ${answeredQuestions[index] ? "đã trả lời" : "chưa trả lời đầy đủ"}`}
                    aria-current={index === activeQuestion ? "step" : undefined}
                    onClick={() => setActiveQuestion(index)}
                    className={`min-h-11 min-w-11 rounded-lg border px-2 text-sm font-bold ${index === activeQuestion ? "border-ink bg-ink text-white" : answeredQuestions[index] ? "border-emerald bg-emerald/10 text-emerald-700" : "border-line bg-white text-secondary"}`}>
                    {index + 1}{answeredQuestions[index] && <span aria-hidden="true"> ✓</span>}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-secondary">Dấu ✓ là đã trả lời đầy đủ, chưa phải kết quả đúng/sai.</p>
            </section>
          )}
          {assignment.questions.map((question, index) => index === activeQuestion ? (
            <AssignmentWorkQuestion key={question.id} question={question} index={index}
              currentAnswer={submission ? submission.answers[question.id] : answers[question.id]}
              isDisabled={Boolean(submission) || isExpired || draftInfo.status === "error"}
              canReviewAnswers={canReviewAnswers} setQuestionAnswer={setQuestionAnswer}
              toggleMultipleChoiceAnswer={toggleMultipleChoiceAnswer} setStatementAnswer={setStatementAnswer} />
          ) : null)}

          {assignment.questions.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <button type="button" disabled={activeQuestion === 0} onClick={() => setActiveQuestion((index) => index - 1)}
                className="min-h-11 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink disabled:opacity-40">← Trước</button>
              <button type="button" disabled={activeQuestion === assignment.questions.length - 1} onClick={() => setActiveQuestion((index) => index + 1)}
                className="min-h-11 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink disabled:opacity-40">Tiếp →</button>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600"
            >
              {error}
            </p>
          )}

          {!submission && !isExpired && draftInfo.status !== "error" && assignment.questions.length > 0 && (
            <button
              type="submit"
              className="min-h-12 rounded-full bg-emerald-700 px-6 text-sm font-bold text-white hover:bg-emerald-800"
            >
              Nộp toàn bài
            </button>
          )}
        </form>

        <dialog
          ref={confirmDialogRef}
          aria-labelledby="submission-confirm-title"
          aria-describedby="submission-confirm-description"
          onCancel={(event) => { event.preventDefault(); setConfirmOpen(false); }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}
          className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-ink/50 sm:p-6"
        >
          <h2 id="submission-confirm-title" className="text-xl font-extrabold">Nộp bài tập?</h2>
          <div id="submission-confirm-description" className="mt-3 space-y-3 text-sm leading-6">
            <p className="break-words font-bold">{assignment.title}</p>
            <p>Bạn đã trả lời <strong>{answeredCount}/{assignment.questions.length} câu</strong>.</p>
            <p className="text-secondary">Sau khi nộp, bạn không thể sửa đáp án. Chọn “Kiểm tra lại” để quay về bài làm.</p>
          </div>
          {isExpired && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">Bài tập đã hết hạn nộp. Các lựa chọn của bạn vẫn được giữ lại.</p>}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button ref={reviewButtonRef} type="button" onClick={() => setConfirmOpen(false)} className="min-h-11 rounded-full border border-line bg-white px-5 text-sm font-bold">Kiểm tra lại</button>
            <button type="button" onClick={confirmSubmission} disabled={isExpired || hasSubmission} className="min-h-11 rounded-full bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">Nộp bài</button>
          </div>
        </dialog>
        {resetDialogOpen && (
          <Dialog title="Xóa bản nháp của bài này?" onClose={() => setResetDialogOpen(false)}>
            <p className="text-sm leading-6 text-secondary">Các câu trả lời chưa nộp của bài này sẽ bị xóa trên trình duyệt. Hành động này không thể hoàn tác.</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setResetDialogOpen(false)} className="min-h-11 rounded-full border border-line px-5 text-sm font-bold text-ink">Giữ bản nháp</button>
              <button type="button" onClick={() => {
                if (resetDraft()) setResetNotice(true);
                else setError("Không thể xóa bản nháp. Hãy kiểm tra quyền lưu của trình duyệt.");
                setResetDialogOpen(false);
              }} className="min-h-11 rounded-full bg-red-700 px-5 text-sm font-bold text-white">Xóa bản nháp</button>
            </div>
          </Dialog>
        )}
      </div>
    </div>
  );
}
