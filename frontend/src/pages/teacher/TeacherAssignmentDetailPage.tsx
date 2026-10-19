import { questionTypeLabels } from "../../types/question";
import { QuestionImageView } from "../../components/questions/QuestionImage";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";

import { useTeacherData } from "../../contexts/TeacherDataContext";

import type { QuestionDifficulty } from "../../types/question";

import { evaluateAssignmentAnswer, getAssignmentResultVisibility, getAssignmentDisplayStatus, formatAssignmentDeadline as formatDateTime } from "../../utils/assignmentQuestion";
import AssignmentActions from "../../components/teacher/AssignmentActions";
import { AssignmentContentView } from "../../components/assignments/AssignmentContent";

const difficultyLabels: Record<QuestionDifficulty, string> = {
  recognition: "Nhận biết",
  comprehension: "Thông hiểu",
  application: "Vận dụng",
  advanced_application: "Vận dụng cao",
};


const answerResultLabels = {
  unanswered: "Chưa trả lời đầy đủ",
  invalid: "Câu trả lời không hợp lệ",
  correct: "Đúng",
  incorrect: "Sai",
};

export default function TeacherAssignmentDetailPage() {
  const { assignmentId } = useParams();
  const [params] = useSearchParams();
  const requestedReturn = params.get("return");
  const backTo = requestedReturn === "/teacher/assignments" || requestedReturn?.startsWith("/teacher/assignments?") ? requestedReturn : "/teacher/assignments";

  const { assignments, submissions, setAssignmentResultVisibility } = useTeacherAssignments();

  const { classrooms, getJoinRequests, getRosterEntries } = useTeacherData();

  const assignment = assignments.find((item) => item.id === assignmentId);

  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionLimit, setSubmissionLimit] = useState(10);
  const [questionLimit, setQuestionLimit] = useState(10);
  useEffect(() => { setSubmissionSearch(""); setSubmissionLimit(10); setQuestionLimit(10); }, [assignmentId]);
  const [now, setNow] = useState(() => Date.now());
  const hasFutureDeadline = assignment?.status === "published" && Date.parse(assignment.dueAt ?? "") > now;
  useEffect(() => {
    if (!hasFutureDeadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasFutureDeadline]);

  if (!assignment) {
    return (
      <div className="space-y-4 rounded-2xl border border-line bg-white p-6">
        <h1 className="text-xl font-extrabold text-ink">
          Không tìm thấy bài tập
        </h1>

        <Link
          to={backTo}
          className="text-sm font-bold text-emerald"
        >
          Quay lại danh sách bài tập
        </Link>
      </div>
    );
  }

  const classroom = classrooms.find(
    (item) => item.id === assignment.classroomId,
  );

  const assignmentSubmissions = submissions
    .filter((submission) => submission.assignmentId === assignment.id && submission.classroomId === assignment.classroomId)
    .sort((first, second) =>
      second.submittedAt.localeCompare(first.submittedAt),
    );

  const classRequests = getJoinRequests(assignment.classroomId);

  const rosterEntries = getRosterEntries(assignment.classroomId);
  const joinedRoster = [...new Map(rosterEntries.filter((entry) => entry.status === "joined" && entry.linkedUserId)
    .map((entry) => [entry.linkedUserId!, entry])).values()];
  const submittedIds = new Set(assignmentSubmissions.map((submission) => submission.studentId));
  const submittedCount = joinedRoster.filter((entry) => submittedIds.has(entry.linkedUserId!)).length;
  const missingStudents = joinedRoster.filter((entry) => !submittedIds.has(entry.linkedUserId!));
  const scores = assignmentSubmissions.map((submission) => submission.score).filter((score) => Number.isFinite(score) && score >= 0 && score <= 10);
  const averageScore = scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : null;
  const formattedAverage = averageScore === null ? "—" : `${new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(averageScore)}/10`;
  const status = getAssignmentDisplayStatus(assignment, now);
  const questionStats = assignment.questions.map((question, index) => {
    const counts = { correct: 0, incorrect: 0, unanswered: 0, invalid: 0 };
    for (const submission of assignmentSubmissions) counts[evaluateAssignmentAnswer(question, submission.answers[question.id])]++;
    return { question, index, counts, notCorrect: counts.incorrect + counts.unanswered + counts.invalid };
  }).filter((item) => item.notCorrect > 0).sort((first, second) => second.notCorrect - first.notCorrect || first.index - second.index).slice(0, 3);
  function studentName(studentId: string) {
    return rosterEntries.find((entry) => entry.linkedUserId === studentId)?.fullName ||
      classRequests.find((request) => request.studentId === studentId)?.studentName || `Học sinh ${studentId}`;
  }
  function normalizeSearch(value: string) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi").trim();
  }
  const matchingSubmissions = assignmentSubmissions.filter((submission) => normalizeSearch(studentName(submission.studentId)).includes(normalizeSearch(submissionSearch)));
  const currentAssignmentId = assignment.id;
  function showQuestion(index: number) {
    setQuestionLimit((current) => Math.max(current, index + 1));
    window.requestAnimationFrame(() => {
      const list = document.getElementById(`assignment-questions-${currentAssignmentId}`);
      const question = document.getElementById(`assignment-question-${currentAssignmentId}-${index}`);
      if (list instanceof HTMLDetailsElement) list.open = true;
      if (question instanceof HTMLDetailsElement) { question.open = true; question.scrollIntoView({ block: "start", behavior: "smooth" }); }
    });
  }

  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <Link
        to={backTo}
        className="inline-flex items-center gap-2 text-sm font-bold text-secondary hover:text-emerald"
      >
        <ArrowLeft className="size-4" />
        Quay lại danh sách bài tập
      </Link>

      <header className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-ink">
              {assignment.title}
            </h1>

            <p className="mt-2 text-sm text-secondary">
              Bản xem dành cho giáo viên
            </p>
          </div>

          <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${status === "Đang mở" ? "bg-emerald-50 text-emerald-800" : status === "Đã hết hạn" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
            {status}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-muted">Lớp học</dt>
            <dd className="mt-1 font-bold text-ink">
              {classroom?.name ?? "Lớp không còn tồn tại"}
            </dd>
          </div>

          <div>
            <dt className="text-muted">Số câu hỏi</dt>
            <dd className="mt-1 font-bold text-ink">
              {assignment.questions.length}
            </dd>
          </div>

          <div>
            <dt className="text-muted">Ngày tạo</dt>
            <dd className="mt-1 font-bold text-ink">
              {formatDateTime(assignment.createdAt)}
            </dd>
          </div>

          <div>
            <dt className="text-muted">Hạn nộp</dt>
            <dd className="mt-1 font-bold text-ink">
              {formatDateTime(assignment.dueAt)}
            </dd>
          </div>
        </dl>
        <section aria-label="Tổng hợp bài tập" className="mt-5 grid min-w-0 gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <div className="min-w-0">
            <h2 className="text-sm font-bold">Tiến độ nộp bài</h2>
            <p className="mt-2 text-xl font-extrabold">{submittedCount}/{joinedRoster.length} đã nộp</p>
            <progress aria-label="Tiến độ nộp bài" value={submittedCount} max={Math.max(1, joinedRoster.length)} className="mt-2 h-2 w-full accent-emerald" />
            <p className="mt-2 text-sm text-secondary">{joinedRoster.length ? `${missingStudents.length} học sinh chưa nộp · Chỉ tính học sinh đã kết nối tài khoản.` : "Lớp chưa có học sinh đã kết nối tài khoản."}</p>
          </div>
          <div>
            <h2 className="text-sm font-bold">Điểm trung bình</h2>
            <p className="mt-2 text-xl font-extrabold">{formattedAverage}</p>
            <p className="mt-2 text-sm text-secondary">{assignmentSubmissions.length} bài nộp{scores.length !== assignmentSubmissions.length ? ` · ${scores.length} bài có điểm hợp lệ` : ""}</p>
            <a href="#assignment-submissions" className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-emerald-800">Xem bài nộp ↓</a>
          </div>
        </section>
        <div className="mt-5 flex flex-wrap items-start gap-2">
          <AssignmentActions key={assignment.id} assignment={assignment} />
          <Link to={`/teacher/assignments?status=all&copy=${encodeURIComponent(assignment.id)}`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-bold">Nhân bản</Link>
        </div>
      </header>

      <section aria-label="Câu cần củng cố" className="min-w-0 space-y-3 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-extrabold">Câu cần củng cố</h2>
        {!assignmentSubmissions.length ? <p className="text-sm text-secondary">Chưa có bài nộp để thống kê.</p> : !assignment.questions.length ? <p className="text-sm text-secondary">Bài tập chưa có câu hỏi để thống kê.</p> : !questionStats.length ? <p className="text-sm text-secondary">Các câu đều được trả lời đúng trong các bài đã nộp.</p> : <>
          <p className="text-sm text-secondary">Ba câu có nhiều bài chưa đúng nhất trong {assignmentSubmissions.length} bài nộp. Mỗi câu vẫn được chấm theo quy tắc đã giao.</p>
          <ul className="space-y-2">{questionStats.map(({ question, index, counts, notCorrect }) => <li key={question.id}>
            <button type="button" onClick={() => showQuestion(index)} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-left hover:bg-canvas">
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-bold">Câu {index + 1}. {question.content}</span>
                <span className="mt-1 block text-sm text-secondary">Sai {counts.incorrect} · Bỏ trống / thiếu ý {counts.unanswered}{counts.invalid ? ` · Không hợp lệ ${counts.invalid}` : ""}</span>
              </span>
              <span className="text-sm font-bold text-amber-900">{notCorrect}/{assignmentSubmissions.length} bài chưa đúng →</span>
            </button>
          </li>)}</ul>
        </>}
      </section>
      {assignment.status === "published" && <details key={`missing-${assignment.id}`} className="rounded-2xl border border-line bg-white">
        <summary className="min-h-11 cursor-pointer px-5 py-4 text-sm font-bold">Học sinh chưa nộp ({missingStudents.length})</summary>
        <div className="space-y-3 border-t border-line p-5">
          <p className="text-sm text-secondary">Chỉ tính học sinh đã kết nối tài khoản. Dùng nút Nhắc nộp bài ở đầu trang để chuẩn bị lời nhắc.</p>{missingStudents.length ? <ul className="max-h-60 space-y-2 overflow-y-auto text-sm">{missingStudents.map((entry) => <li key={entry.linkedUserId} className="rounded-xl border border-line px-3 py-2">{entry.fullName}{entry.studentCode ? ` · ${entry.studentCode}` : ""}</li>)}</ul> : <p className="text-sm text-secondary">{joinedRoster.length ? "Tất cả học sinh đã kết nối tài khoản đều đã nộp." : "Lớp chưa có học sinh đã kết nối tài khoản."}</p>}</div>
      </details>}
      <section className="rounded-2xl border border-line bg-white p-5">
        <label className="block text-sm font-bold text-ink">
          Học sinh xem kết quả sau khi nộp
          <select value={getAssignmentResultVisibility(assignment)} onChange={(event) => {
            const value = event.target.value;
            if (value === "hidden" || value === "score" || value === "answers") {
              setAssignmentResultVisibility(assignment.id, value);
            }
          }} className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-white px-3 font-normal sm:max-w-md">
            <option value="hidden">Chưa công bố kết quả</option>
            <option value="score">Chỉ hiện điểm</option>
            <option value="answers">Hiện điểm và đáp án</option>
          </select>
        </label>
        <p className="mt-2 text-sm text-secondary">Thiết lập được tự động lưu và áp dụng cho cả bài đã nộp. Học sinh chỉ xem đáp án khi đã nộp và bạn cho phép.</p>
      </section>

      <AssignmentContentView content={assignment.content} />

      <section id="assignment-submissions" aria-label="Bài nộp của học sinh" className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="text-lg font-extrabold text-ink">
            Bài nộp của học sinh
          </h2>

          <p className="mt-1 text-sm text-secondary">
            Bài làm được chấm theo bản câu hỏi đã lưu trong bài tập. Mỗi câu có
            trọng số bằng nhau; câu nhiều đáp án hoặc nhiều ý cần trả lời đúng
            toàn bộ.
          </p>
        </div>

        {assignmentSubmissions.length > 0 && <label className="block text-sm font-bold">Tìm học sinh đã nộp<input aria-label="Tìm học sinh đã nộp" value={submissionSearch} onChange={(event) => { setSubmissionSearch(event.target.value); setSubmissionLimit(10); }} placeholder="Nhập tên học sinh" className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-white px-3 font-normal sm:max-w-md" />
        </label>}
        {assignmentSubmissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-secondary">
            Chưa có học sinh nộp bài tập này.
          </div>
        ) : (
          <div className="space-y-3">
            {!matchingSubmissions.length && <p className="text-sm text-secondary">Không có học sinh phù hợp.</p>}
            {matchingSubmissions.slice(0, submissionLimit).map((submission) => {

              return (
                <details
                  key={submission.id}
                  className="overflow-hidden rounded-2xl border border-line bg-white shadow-card"
                >
                  <summary className="cursor-pointer px-5 py-4">
                    <span className="flex flex-wrap items-center justify-between gap-3">
                      <span>
                        <span className="block font-bold text-ink">
                          {studentName(submission.studentId)}
                        </span>

                        <span className="mt-1 block text-xs text-muted">
                          Nộp lúc {formatDateTime(submission.submittedAt)}
                        </span>
                      </span>

                      <span className="text-sm font-extrabold text-emerald">
                        {submission.score}/10
                      </span>
                    </span>
                  </summary>

                  <div className="space-y-4 border-t border-line p-5">
                    <p className="text-sm font-bold text-ink">
                      Đúng {submission.correctCount}/{submission.totalQuestions}
                      {" câu"}
                    </p>

                    {assignment.questions.map((question, index) => {
                      const answer = submission.answers[question.id];

                      const result = evaluateAssignmentAnswer(question, answer);

                      const getOptionText = (optionId: string) => {
                        if (
                          question.type !== "single_choice" &&
                          question.type !== "multiple_choice"
                        ) {
                          return "Không hợp lệ";
                        }

                        const optionIndex = question.options.findIndex(
                          (option) => option.id === optionId,
                        );

                        if (optionIndex === -1) {
                          return "Phương án không còn tồn tại";
                        }

                        const label = String.fromCharCode(65 + optionIndex);

                        return `${label}. ${question.options[optionIndex].text}`;
                      };

                      return (
                        <div
                          key={question.id}
                          className="rounded-xl border border-line bg-slate-50 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <p className="whitespace-pre-wrap text-sm font-bold leading-6 text-ink">
                              Câu {index + 1}. {question.content}
                            </p>
                            <QuestionImageView image={question.image} />

                            <span
                              className={`shrink-0 text-sm font-bold ${result === "correct"
                                ? "text-emerald"
                                : "text-red-600"
                                }`}
                            >
                              {answerResultLabels[result]}
                            </span>
                          </div>

                          {!answer ? (
                            <p className="mt-2 text-sm text-secondary">
                              Không có câu trả lời.
                            </p>
                          ) : question.type !== answer.type ? (
                            <p className="mt-2 text-sm text-red-600">
                              Loại câu trả lời không khớp với câu hỏi.
                            </p>
                          ) : answer.type === "single_choice" ? (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">
                              Học sinh chọn:{" "}
                              {getOptionText(answer.selectedOptionId)}
                            </p>
                          ) : answer.type === "multiple_choice" ? (
                            <div className="mt-2 text-sm text-secondary">
                              <p>Học sinh chọn:</p>

                              <ul className="mt-1 space-y-1">
                                {answer.selectedOptionIds.map((optionId) => (
                                  <li
                                    key={optionId}
                                    className="whitespace-pre-wrap"
                                  >
                                    {getOptionText(optionId)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : answer.type === "short_answer" && question.type === "short_answer" ? (
                            <div className="mt-2 space-y-1 text-sm text-secondary [overflow-wrap:anywhere]">
                              <p>Học sinh nhập: {answer.value.trim() || "Chưa trả lời"}</p>
                              <p className="font-bold text-emerald-800">Đáp án: {question.correctAnswer}</p>
                            </div>
                          ) : answer.type === "true_false" ? (
                            <p className="mt-2 text-sm text-secondary">
                              Học sinh chọn: {answer.answer ? "Đúng" : "Sai"}
                            </p>
                          ) : question.type === "true_false_group" && answer.type === "true_false_group" ? (
                            <div className="mt-3 space-y-3">
                              {question.statements.map(
                                (statement, statementIndex) => {
                                  const selectedAnswer =
                                    answer.answersByStatementId[statement.id];

                                  const hasAnswer =
                                    typeof selectedAnswer === "boolean";

                                  const isCorrect =
                                    hasAnswer &&
                                    selectedAnswer === statement.correctAnswer;

                                  return (
                                    <div
                                      key={statement.id}
                                      className="rounded-lg border border-line bg-white p-3"
                                    >
                                      <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
                                        <strong>
                                          Ý {statementIndex + 1}.{" "}
                                        </strong>
                                        {statement.content}
                                      </p>

                                      <p
                                        className={`mt-1 text-sm ${isCorrect
                                          ? "text-emerald"
                                          : "text-red-600"
                                          }`}
                                      >
                                        Học sinh chọn:{" "}
                                        {hasAnswer
                                          ? selectedAnswer
                                            ? "Đúng"
                                            : "Sai"
                                          : "Chưa trả lời"}
                                        {" · "}
                                        {hasAnswer
                                          ? isCorrect
                                            ? "Chính xác"
                                            : "Chưa chính xác"
                                          : "Thiếu câu trả lời"}
                                      </p>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          ) : null}

                          {question.explanation && (
                            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-secondary">
                              Giải thích: {question.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
            {submissionLimit < matchingSubmissions.length && <button type="button" onClick={() => setSubmissionLimit((current) => current + 10)} className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-bold">Xem thêm {Math.min(10, matchingSubmissions.length - submissionLimit)} bài nộp</button>}
          </div>
        )}
      </section>
      <section aria-label="Đề bài tập" className="min-w-0 space-y-3">
        <h2 className="text-lg font-extrabold text-ink">Nội dung bài tập</h2>

        <details key={assignment.id} id={`assignment-questions-${assignment.id}`} className="rounded-2xl border border-line bg-white">
          <summary className="min-h-11 cursor-pointer px-5 py-4 text-sm font-bold">Xem đề ({assignment.questions.length} câu)</summary>
          <div className="space-y-2 border-t border-line p-3 sm:p-5">
            {!assignment.questions.length && <p className="text-sm text-secondary">Bài tập chưa có câu hỏi.</p>}
            {assignment.questions.slice(0, questionLimit).map((question, index) => (
              <details key={question.id} id={`assignment-question-${assignment.id}-${index}`} className="scroll-mt-24 rounded-xl border border-line bg-white">
                <summary className="min-h-11 cursor-pointer px-4 py-3">
                  <span className="line-clamp-2 text-sm font-bold">Câu {index + 1}. {question.content}</span>
                  <span className="mt-1 block text-sm text-secondary">{questionTypeLabels[question.type]} · {difficultyLabels[question.difficulty]}</span>
                </summary>
                <div className="border-t border-line p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="rounded-full bg-emerald/10 px-3 py-1 text-emerald">
                      Câu {index + 1}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-secondary">
                      {question.chapter}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-secondary">
                      {difficultyLabels[question.difficulty]}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-secondary">
                      {questionTypeLabels[question.type]}
                    </span>
                  </div>

                  <h3 className="mt-4 font-bold leading-7 text-ink">
                    {question.content}
                  </h3>
                  <QuestionImageView image={question.image} />

                  {question.type === "single_choice" ||
                    question.type === "multiple_choice" ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {question.options.map((option, optionIndex) => {
                        const isCorrect =
                          question.type === "single_choice"
                            ? question.correctOptionId === option.id
                            : question.correctOptionIds.includes(option.id);

                        const label = String.fromCharCode(65 + optionIndex);

                        return (
                          <div
                            key={option.id}
                            className={`rounded-xl border px-4 py-3 text-sm ${isCorrect
                              ? "border-emerald bg-emerald/5 text-emerald"
                              : "border-line text-secondary"
                              }`}
                          >
                            <span className="mr-2 font-extrabold">{label}.</span>

                            <span className="whitespace-pre-wrap">{option.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : question.type === "short_answer" ? (
                    <p className="mt-4 text-sm font-bold text-emerald-800">Đáp án: {question.correctAnswer}</p>
                  ) : question.type === "true_false" ? (
                    <p className="mt-4 text-sm font-bold text-emerald">
                      {question.correctAnswer ? "Đúng" : "Sai"}
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {question.statements.map((statement, statementIndex) => (
                        <div
                          key={statement.id}
                          className="rounded-xl border border-line px-4 py-3"
                        >
                          <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
                            <span className="font-bold">
                              Ý {statementIndex + 1}.{" "}
                            </span>

                            {statement.content}
                          </p>

                          <p className="mt-2 text-sm font-bold text-emerald">
                            {statement.correctAnswer ? "Đúng" : "Sai"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {question.explanation && (
                    <p className="mt-2 text-sm leading-6 text-secondary">
                      <span className="font-bold text-ink">Giải thích:</span>{" "}
                      {question.explanation}
                    </p>
                  )}
                </div>
              </details>
            ))}
            {questionLimit < assignment.questions.length && <button type="button" onClick={() => setQuestionLimit((current) => current + 10)} className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold">Xem thêm {Math.min(10, assignment.questions.length - questionLimit)} câu</button>}
          </div>
        </details>
      </section>
    </div>
  );
}
