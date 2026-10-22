import { QuestionImageView } from "../../components/questions/QuestionImage";
import { useState, useEffect, useRef, type FormEvent } from "react";

import { Link, useParams } from "react-router-dom";

import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";

import { useTeacherData } from "../../contexts/TeacherDataContext";

import { useStudentAccount } from "../../contexts/StudentAccountContext";
import { AssignmentContentView } from "../../components/assignments/AssignmentContent";
import type {
  AssignmentAnswerV2,
  AssignmentAnswersV2,
} from "../../types/assignment";

import {
  evaluateAssignmentAnswer,
  normalizeNumericAnswer,
  assignmentAnswerDraftKey,
  assignmentQuestionSignature,
  loadAssignmentAnswerDraft,
  saveAssignmentAnswerDraft,
  hasAssignmentDraftAnswers,
  getAssignmentResultVisibility,
  describeAssignmentCorrectAnswer,
  type AssignmentAnswerDraftRead,
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
  const [draftInfo, setDraftInfo] = useState<AssignmentAnswerDraftRead>(() =>
    assignment?.status === "published" && studentId && !submission &&
      isStudentJoinedClass(assignment.classroomId, studentId)
      ? loadAssignmentAnswerDraft(assignment, studentId)
      : { answers: {}, status: "empty" },
  );
  const [answers, setAnswers] = useState<AssignmentAnswersV2>(() => draftInfo.answers);
  const [draftSaveStatus, setDraftSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [draftSaveAttempt, setDraftSaveAttempt] = useState(0);

  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);

  const [now, setNow] = useState(() => Date.now());
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

  const deadline = Date.parse(assignment?.dueAt ?? "");

  const hasSubmission = Boolean(submission);
  const isExpired = !Number.isFinite(deadline) || now >= deadline;

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

  useEffect(() => {
    if (!assignment || !studentId || !isJoined || !approvedRequest ||
      assignment.status !== "published" || hasSubmission ||
      draftInfo.status === "error" || answers === draftInfo.answers) return;
    try {
      saveAssignmentAnswerDraft(assignment, studentId, answers);
      setDraftSaveStatus("saved");
    } catch {
      setDraftSaveStatus("error");
    }
  }, [assignment, studentId, isJoined, approvedRequest, hasSubmission, answers, draftInfo, draftSaveAttempt]);

  useEffect(() => {
    if (!assignmentId || !studentId || !hasSubmission || submissionStorageStatus !== "saved") return;
    try {
      window.localStorage.removeItem(assignmentAnswerDraftKey(assignmentId, studentId));
    } catch {
      // A saved submission always takes precedence over a leftover answer draft.
    }
  }, [assignmentId, studentId, hasSubmission, submissionStorageStatus]);

  useEffect(() => {
    const currentTime = Date.now();
    setNow(currentTime);

    if (
      assignment?.status !== "published" ||
      !approvedRequest ||
      !isJoined ||
      hasSubmission ||
      !Number.isFinite(deadline) ||
      currentTime >= deadline
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      const nextTime = Date.now();
      setNow(nextTime);

      if (nextTime >= deadline) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    assignmentId,
    studentId,
    assignment?.status,
    approvedRequest?.id,
    isJoined,
    deadline,
    hasSubmission,
  ]);

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
    setNow(currentTime);

    if (!Number.isFinite(deadline) || currentTime >= deadline) {
      setError("Bài tập đã hết hạn nộp.");
      return;
    }

    const incompleteQuestionIndex = assignment.questions.findIndex(
      (question) => {
        const result = evaluateAssignmentAnswer(question, answers[question.id]);

        return result === "unanswered" || result === "invalid";
      },
    );

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
    setNow(currentTime);
    if (!Number.isFinite(deadline) || currentTime >= deadline) {
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
            className="mt-4 inline-block text-sm font-bold text-emerald"
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
  const remainingSeconds = Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const timeRemaining = `${hours > 0 ? `${hours}:` : ""}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const resultVisibility = getAssignmentResultVisibility(assignment);
  const canReviewAnswers = Boolean(submission) && resultVisibility === "answers" && submissionStorageStatus === "saved";

  return (
    <div className="min-w-0 py-2">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          to="/student/assignments"
          className="text-sm font-bold text-emerald"
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
                <button type="button" className="mt-2 min-h-11 font-bold text-emerald" onClick={() => {
                  const restored = loadAssignmentAnswerDraft(assignment, studentId);
                  setDraftInfo(restored);
                  setAnswers(restored.answers);
                }}>Thử đọc lại</button>
                <button type="button" className="ml-4 min-h-11 font-bold text-red-600" onClick={() => {
                  if (!window.confirm("Xóa bản nháp của bài này và bắt đầu lại?")) return;
                  try {
                    window.localStorage.removeItem(assignmentAnswerDraftKey(assignment.id, studentId));
                    const empty: AssignmentAnswerDraftRead = { answers: {}, status: "empty" };
                    setDraftInfo(empty);
                    setAnswers(empty.answers);
                    setDraftSaveStatus("idle");
                  } catch { setError("Không thể xóa bản nháp. Hãy kiểm tra quyền lưu của trình duyệt."); }
                }}>Bắt đầu lại</button>
              </div>
            ) : draftSaveStatus === "error" ? (
              <div role="alert" className="text-red-600">
                <p>Chưa lưu được đáp án trên trình duyệt. Đừng tải lại hoặc đóng trang.</p>
                <button type="button" className="mt-2 min-h-11 font-bold" onClick={() => setDraftSaveAttempt((value) => value + 1)}>Thử lưu nháp lại</button>
              </div>
            ) : (
              <p role="status" className="text-secondary">
                {draftSaveStatus === "saved" ? "Đã lưu nháp trên trình duyệt này."
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
                    className={`min-h-11 min-w-11 rounded-lg border px-2 text-sm font-bold ${index === activeQuestion ? "border-ink bg-ink text-white" : answeredQuestions[index] ? "border-emerald bg-emerald/10 text-emerald" : "border-line bg-white text-secondary"}`}>
                    {index + 1}{answeredQuestions[index] && <span aria-hidden="true"> ✓</span>}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Dấu ✓ là đã trả lời đầy đủ, chưa phải kết quả đúng/sai.</p>
            </section>
          )}
          {assignment.questions.map((question, index) => {
            if (index !== activeQuestion) return null;
            const currentAnswer = submission
              ? submission.answers[question.id]
              : answers[question.id];

            const isDisabled = Boolean(submission) || isExpired || draftInfo.status === "error";

            return (
              <article key={question.id} className="min-w-0 break-words rounded-2xl border border-line bg-white p-5 shadow-card">

                <p className="whitespace-pre-wrap font-bold leading-7 text-ink">
                  Câu {index + 1}. {question.content}
                </p>
                <QuestionImageView image={question.image} />
                <fieldset disabled={isDisabled} className="min-w-0">
                  <legend className="sr-only">Câu {index + 1}</legend>

                  {question.type === "single_choice" ||
                    question.type === "multiple_choice" ? (
                    <>
                      <p className="mt-2 text-xs text-muted">
                        {question.type === "single_choice"
                          ? "Chọn một đáp án."
                          : "Chọn các đáp án bạn cho là đúng."}
                      </p>

                      <div className="mt-4 space-y-2">
                        {question.options.map((option, optionIndex) => {
                          const label = String.fromCharCode(65 + optionIndex);

                          const isChecked =
                            question.type === "single_choice"
                              ? currentAnswer?.type === "single_choice" &&
                              currentAnswer.selectedOptionId === option.id
                              : currentAnswer?.type === "multiple_choice" &&
                              currentAnswer.selectedOptionIds.includes(
                                option.id,
                              );

                          return (
                            <label
                              key={option.id}
                              className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm text-ink"
                            >
                              <input
                                type={
                                  question.type === "single_choice"
                                    ? "radio"
                                    : "checkbox"
                                }
                                name={`question-${question.id}`}
                                checked={isChecked}
                                onChange={() => {
                                  if (question.type === "single_choice") {
                                    setQuestionAnswer(question.id, {
                                      type: "single_choice",
                                      selectedOptionId: option.id,
                                    });
                                  } else {
                                    toggleMultipleChoiceAnswer(
                                      question.id,
                                      option.id,
                                    );
                                  }
                                }}
                                className="mt-1 size-4 shrink-0 accent-emerald"
                              />

                              <span className="min-w-0 break-words whitespace-pre-wrap">
                                <strong className="mr-2">{label}.</strong>
                                {option.text}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  ) : question.type === "short_answer" ? (
                    <div className="mt-4 space-y-2">
                      <label className="block text-sm font-bold">Câu trả lời của bạn
                        <input type="text" inputMode="text" autoComplete="off" spellCheck={false} aria-label={`Đáp án số câu ${index + 1}`} aria-describedby={`numeric-hint-${question.id}`} aria-invalid={currentAnswer?.type === "short_answer" && !!currentAnswer.value.trim() && normalizeNumericAnswer(currentAnswer.value) === null} value={currentAnswer?.type === "short_answer" ? currentAnswer.value : ""} onChange={(event) => setQuestionAnswer(question.id, { type: "short_answer", value: event.target.value })} placeholder="Nhập số, ví dụ -12,5" className="mt-2 block min-h-12 w-full rounded-xl border border-line px-3 font-normal disabled:bg-slate-50 sm:max-w-sm" />
                      </label>
                      <p id={`numeric-hint-${question.id}`} className="text-sm leading-6 text-secondary">Chỉ nhập số; có thể dùng dấu âm, dấu phẩy hoặc dấu chấm thập phân. Không kèm đơn vị hay dấu tách hàng nghìn.</p>
                      {currentAnswer?.type === "short_answer" && !!currentAnswer.value.trim() && normalizeNumericAnswer(currentAnswer.value) === null && <p role="alert" className="text-sm text-red-700">Giá trị chưa đúng định dạng số, ví dụ 125 hoặc -12,5.</p>}
                    </div>
                  ) : question.type === "true_false" ? (
                    <div className="mt-4 flex flex-wrap gap-4">
                      {[true, false].map((value) => (
                        <label
                          key={String(value)}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm text-ink"
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            checked={
                              currentAnswer?.type === "true_false" &&
                              currentAnswer.answer === value
                            }
                            onChange={() =>
                              setQuestionAnswer(question.id, {
                                type: "true_false",
                                answer: value,
                              })
                            }
                            className="size-4 accent-emerald"
                          />

                          <span>{value ? "Đúng" : "Sai"}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {question.statements.map((statement, statementIndex) => (
                        <div
                          key={statement.id}
                          className="rounded-xl border border-line p-4"
                        >
                          <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
                            <strong>Ý {statementIndex + 1}. </strong>
                            {statement.content}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-5">
                            {[true, false].map((value) => (
                              <label
                                key={String(value)}
                                className="flex cursor-pointer items-center gap-2 text-sm text-ink"
                              >
                                <input
                                  type="radio"
                                  name={`question-${question.id}-statement-${statement.id}`}
                                  checked={
                                    currentAnswer?.type === "true_false_group" &&
                                    currentAnswer.answersByStatementId[
                                    statement.id
                                    ] === value
                                  }
                                  onChange={() =>
                                    setStatementAnswer(
                                      question.id,
                                      statement.id,
                                      value,
                                    )
                                  }
                                  className="size-4 accent-emerald"
                                />

                                <span>{value ? "Đúng" : "Sai"}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {canReviewAnswers && (
                    <div className="mt-4 border-t border-line pt-4 text-sm">
                      <p className="font-bold text-ink">Kết quả câu này: {evaluateAssignmentAnswer(question, currentAnswer) === "correct" ? "Chính xác" : "Chưa chính xác"}</p>
                      <p className="mt-2 break-words whitespace-pre-wrap text-emerald">Đáp án: {describeAssignmentCorrectAnswer(question)}</p>
                      {question.explanation && <p className="mt-2 break-words whitespace-pre-wrap text-secondary">Giải thích: {question.explanation}</p>}
                    </div>
                  )}
                </fieldset>
              </article>
            );
          })}

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
              className="min-h-12 rounded-full bg-emerald px-6 text-sm font-bold text-white hover:bg-emerald/90"
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
            <button type="button" onClick={confirmSubmission} disabled={isExpired || hasSubmission} className="min-h-11 rounded-full bg-emerald px-5 text-sm font-bold text-white hover:bg-emerald/90 disabled:opacity-50">Nộp bài</button>
          </div>
        </dialog>
      </div>
    </div>
  );
}
