import { QuestionImageView } from "../../components/questions/QuestionImage";
import { useSearchParams, Link } from "react-router-dom";

import {
  geo10Chapters,
  geo10Lessons,
  geo10Parts,
} from "../../data/geo10Curriculum";

import { useEffect, useRef, useState } from "react";
import { useTeacherQuestions } from "../../contexts/TeacherQuestionsContext";
import type {
  AssignmentAnswerV2,
  AssignmentAnswersV2,
} from "../../types/assignment";
import { evaluateAssignmentAnswer, normalizeNumericAnswer } from "../../utils/assignmentQuestion";
import StudentLessonSections from "../../components/student/StudentLessonSections";
import { LessonBody } from "../../components/common/LessonBody";
import { loadLessonContents, LESSON_CONTENT_KEY, LESSON_CONTENT_CHANGED_EVENT } from "../../utils/lessonContentStorage";
import { useStudentAccount } from "../../contexts/StudentAccountContext";
import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";
import { useStudentClassMemberships } from "../../hooks/useStudentClassMemberships";
import type { CurriculumLesson } from "../../types/curriculum";

export default function StudentLessonsPage() {
  const { student, hasStudentProfile } = useStudentAccount();
  const { assignments, submissions, submissionStorageStatus } =
    useTeacherAssignments();
  const { memberships } = useStudentClassMemberships();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contents, setContents] = useState(loadLessonContents);
  useEffect(() => {
    const refresh = () => setContents(loadLessonContents());
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key === LESSON_CONTENT_KEY) refresh();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", visible);
    window.addEventListener(LESSON_CONTENT_CHANGED_EVENT, refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", visible);
      window.removeEventListener(LESSON_CONTENT_CHANGED_EVENT, refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  const { questions } = useTeacherQuestions();

  const [selectedAnswers, setSelectedAnswers] = useState<AssignmentAnswersV2>(
    {},
  );
  const [checkedQuestions, setCheckedQuestions] = useState<
    Record<string, boolean>
  >({});

  const togglePracticeOption = (questionId: string, optionId: string) => {
    setSelectedAnswers((current) => {
      const answer = current[questionId];

      const selectedIds =
        answer?.type === "multiple_choice" ? answer.selectedOptionIds : [];

      return {
        ...current,
        [questionId]: {
          type: "multiple_choice",
          selectedOptionIds: selectedIds.includes(optionId)
            ? selectedIds.filter((id) => id !== optionId)
            : [...selectedIds, optionId],
        },
      };
    });

    setCheckedQuestions((current) => ({
      ...current,
      [questionId]: false,
    }));
  };

  const setPracticeAnswer = (
    questionId: string,
    answer: AssignmentAnswerV2,
  ) => {
    setSelectedAnswers((current) => ({
      ...current,
      [questionId]: answer,
    }));

    setCheckedQuestions((current) => ({
      ...current,
      [questionId]: false,
    }));
  };

  const setPracticeStatementAnswer = (
    questionId: string,
    statementId: string,
    answer: boolean,
  ) => {
    setSelectedAnswers((current) => {
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

    setCheckedQuestions((current) => ({
      ...current,
      [questionId]: false,
    }));
  };

  const publishedLessons = geo10Lessons.filter(
    (lesson) => contents[lesson.id]?.status === "published",
  );

  const requestedId = searchParams.get("lesson");
  const selectedLesson =
    publishedLessons.find((lesson) => lesson.id === requestedId) ??
    publishedLessons[0];

  const selectedContent = selectedLesson
    ? contents[selectedLesson.id]
    : undefined;

  const [lessonSearch, setLessonSearch] = useState("");
  const [lessonListOpen, setLessonListOpen] = useState(false);
  const [openChapter, setOpenChapter] = useState(
    selectedLesson?.chapterId ?? "",
  );
  const lessonTitleRef = useRef<HTMLHeadingElement>(null);
  const lessonNavRef = useRef<HTMLElement>(null);
  const focusLessonRef = useRef(false);

  useEffect(() => {
    setOpenChapter(selectedLesson?.chapterId ?? "");
  }, [selectedLesson?.id]);

  useEffect(() => {
    if (!focusLessonRef.current) return;
    focusLessonRef.current = false;
    lessonTitleRef.current?.focus({ preventScroll: true });
    lessonTitleRef.current?.scrollIntoView({ block: "start" });
  }, [selectedLesson?.id, lessonListOpen]);

  function chooseLesson(id: string) {
    focusLessonRef.current = !window.matchMedia("(min-width: 1024px)").matches;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("lesson", id);
      return next;
    });
    setLessonListOpen(false);
    setLessonSearch("");
  }

  const activeClassIds = new Set(
    memberships
      .filter(
        ({ classroom, status }) =>
          status === "joined" && classroom.status !== "archived",
      )
      .map(({ classroom }) => classroom.id),
  );
  const requestedClassId = searchParams.get("class");
  const visibleAssignments = assignments.filter(
    (assignment) =>
      hasStudentProfile &&
      assignment.status === "published" &&
      activeClassIds.has(assignment.classroomId) &&
      (requestedClassId === null ||
        assignment.classroomId === requestedClassId),
  );
  const query = lessonSearch.trim().toLocaleLowerCase("vi");
  const matchingLessons = publishedLessons.filter((item) =>
    `Bài ${item.number}. ${item.title}`.toLocaleLowerCase("vi").includes(query),
  );

  useEffect(() => {
    const nav = lessonNavRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current || nav.clientHeight === 0) return;
    // Đưa bài đang xem vào vùng nhìn thấy của danh sách, không cuộn cả trang.
    const top =
      current.getBoundingClientRect().top -
      nav.getBoundingClientRect().top +
      nav.scrollTop;
    const searchHeight = nav.querySelector("label")?.offsetHeight ?? 0;
    if (
      top < nav.scrollTop + searchHeight ||
      top + current.offsetHeight > nav.scrollTop + nav.clientHeight
    ) {
      nav.scrollTop = Math.max(0, top - searchHeight - 8);
    }
  }, [selectedLesson?.id, openChapter, lessonListOpen, query]);

  function lessonButton(item: CurriculumLesson) {
    const isSelected = selectedLesson?.id === item.id;
    const hasPractice = questions.some(
      (question) =>
        question.lessonId === item.id && question.showInLesson === true,
    );
    const lessonAssignments = visibleAssignments.filter(
      (assignment) => assignment.lessonId === item.id,
    );
    const submittedCount = lessonAssignments.filter((assignment) =>
      submissions.some(
        (submission) =>
          submission.assignmentId === assignment.id &&
          submission.studentId === student.id,
      ),
    ).length;
    return (
      <button
        key={item.id}
        type="button"
        aria-current={isSelected ? "page" : undefined}
        onClick={() => chooseLesson(item.id)}
        className={`w-full rounded-lg px-3 py-2 text-left text-sm ${isSelected ? "bg-emerald text-white" : "text-ink hover:bg-canvas"}`}
      >
        <span className="block font-semibold">
          Bài {item.number}. {item.title}
        </span>
        {(isSelected || hasPractice || lessonAssignments.length > 0) && (
          <span
            className={`mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs ${isSelected ? "text-white" : "text-secondary"}`}
          >
            {isSelected && <span>Đang xem</span>}
            {hasPractice && <span>Luyện tập</span>}
            {lessonAssignments.length > 0 && (
              <span>
                {submissionStorageStatus === "saved"
                  ? `Bài tập: đã nộp ${submittedCount}/${lessonAssignments.length}`
                  : `Bài tập: ${lessonAssignments.length}`}
              </span>
            )}
          </span>
        )}
      </button>
    );
  }

  const practiceQuestions = selectedLesson
    ? questions.filter(
      (question) =>
        question.lessonId === selectedLesson.id &&
        question.showInLesson === true,
    )
    : [];

  return (
    <div className="min-w-0 py-2">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold text-ink">
            Bài học Địa lí 10
          </h1>
          <p className="mt-2 text-sm text-secondary">
            Kết nối tri thức với cuộc sống
          </p>
        </header>

        {publishedLessons.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white p-8 text-sm text-secondary">
            Chưa có bài học nào được xuất bản.
          </p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <section className="min-w-0 self-start rounded-2xl border border-line bg-white p-4 shadow-card lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold text-ink">
                    Danh sách bài học
                  </h2>
                  <p className="mt-1 text-xs text-secondary">
                    {publishedLessons.length} bài · Đang xem Bài{" "}
                    {selectedLesson?.number}
                  </p>
                </div>
                <button
                  type="button"
                  aria-expanded={lessonListOpen}
                  aria-controls="student-lesson-list"
                  onClick={() => setLessonListOpen((value) => !value)}
                  className="min-h-11 shrink-0 rounded-lg border border-line px-3 text-sm font-bold text-emerald lg:hidden"
                >
                  {lessonListOpen ? "Thu danh sách" : "Chọn bài học"}
                </button>
              </div>
              <nav
                ref={lessonNavRef}
                id="student-lesson-list"
                aria-label="Chọn bài học"
                className={`${lessonListOpen ? "block" : "hidden"} mt-4 max-h-[55vh] space-y-4 overflow-y-auto [overflow-wrap:anywhere] lg:block lg:max-h-[calc(100vh-12rem)]`}
              >
                <label className="sticky top-0 z-10 block bg-white pb-2 text-sm font-semibold text-ink">
                  Tìm bài học
                  <input
                    type="search"
                    value={lessonSearch}
                    onChange={(event) => setLessonSearch(event.target.value)}
                    placeholder="Tên bài hoặc Bài 12"
                    className="mt-1 min-h-11 w-full rounded-lg border border-line px-3 font-normal"
                  />
                </label>
                {query ? (
                  <div className="space-y-1">
                    <p role="status" className="text-xs text-muted">
                      {matchingLessons.length} bài phù hợp
                    </p>
                    {matchingLessons.map(lessonButton)}
                    {matchingLessons.length === 0 && (
                      <p className="text-sm text-secondary">
                        Không tìm thấy bài học phù hợp. Thử đổi từ khóa.
                      </p>
                    )}
                  </div>
                ) : (
                  geo10Parts
                    .filter((part) =>
                      geo10Chapters.some(
                        (chapter) =>
                          chapter.partId === part.id &&
                          publishedLessons.some(
                            (item) => item.chapterId === chapter.id,
                          ),
                      ),
                    )
                    .map((part) => (
                      <div key={part.id}>
                        <h2 className="text-sm font-extrabold text-ink">
                          Phần {part.number}. {part.title}
                        </h2>

                        {geo10Chapters
                          .filter((chapter) => chapter.partId === part.id)
                          .map((chapter) => {
                            const lessons = publishedLessons.filter(
                              (lesson) => lesson.chapterId === chapter.id,
                            );

                            if (lessons.length === 0) return null;

                            return (
                              <div key={chapter.id} className="mt-4">
                                <button
                                  type="button"
                                  aria-expanded={openChapter === chapter.id}
                                  onClick={() =>
                                    setOpenChapter((current) =>
                                      current === chapter.id ? "" : chapter.id,
                                    )
                                  }
                                  className="flex min-h-11 w-full items-start justify-between gap-2 rounded-lg py-2 text-left text-sm font-bold text-secondary hover:bg-canvas"
                                >
                                  <span>
                                    Chương {chapter.number}. {chapter.title}
                                    <span className="mt-1 block text-xs font-normal">
                                      {lessons.length} bài
                                    </span>
                                  </span>
                                  <span aria-hidden="true">
                                    {openChapter === chapter.id ? "▾" : "▸"}
                                  </span>
                                </button>
                                {openChapter === chapter.id && (
                                  <div className="mt-1 space-y-2">
                                    <div className="space-y-1">
                                      {lessons.map(lessonButton)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    ))
                )}
              </nav>
            </section>

            {selectedLesson && selectedContent && (
              <article className="min-w-0 space-y-6 rounded-2xl border border-line bg-white p-6 shadow-card [overflow-wrap:anywhere]">
                <div>
                  <p className="text-sm font-bold text-emerald">
                    Bài {selectedLesson.number}
                  </p>
                  <h2
                    ref={lessonTitleRef}
                    tabIndex={-1}
                    className="mt-2 scroll-mt-24 text-xl font-extrabold text-ink"
                  >
                    {selectedLesson.title}
                  </h2>
                </div>

                <section>
                  <h3 className="font-extrabold text-ink">Nội dung bài học</h3>
                  <div className="mt-2">
                    <LessonBody
                      value={selectedContent.explanation}
                      format={selectedContent.explanationFormat}
                      lessonPublished={selectedContent.status === "published"}
                    />
                  </div>
                </section>

                <StudentLessonSections
                  content={selectedContent}
                  lessonId={selectedLesson.id}
                  studentId={hasStudentProfile ? student.id : "demo"}
                />

                <Link
                  to={`/student/videos?lesson=${selectedLesson.id}`}
                  className="inline-flex rounded-full bg-emerald px-5 py-3 text-sm font-bold text-white"
                >
                  Xem video của Bài {selectedLesson.number}
                </Link>

                <Link
                  to={`/student/assignments?lesson=${selectedLesson.id}`}
                  className="inline-flex rounded-full border border-emerald px-5 py-3 text-sm font-bold text-emerald hover:bg-emerald/5"
                >
                  Xem bài tập của Bài {selectedLesson.number}
                </Link>

                {practiceQuestions.length > 0 && (
                  <section className="border-t border-line pt-6">
                    <h3 className="font-extrabold text-ink">Luyện tập</h3>

                    <div className="mt-4 space-y-6">
                      {practiceQuestions.map((question, index) => {
                        if (question.type === "short_answer") {
                          const answer = selectedAnswers[question.id];
                          const value = answer?.type === "short_answer" ? answer.value : "";
                          const valid = normalizeNumericAnswer(value) !== null;
                          const checked = checkedQuestions[question.id];
                          const result = evaluateAssignmentAnswer(question, answer);
                          return <div key={question.id} className="min-w-0 space-y-3 rounded-xl border border-line p-4">
                            <p className="whitespace-pre-wrap font-bold text-ink">Câu {index + 1}. {question.content}</p>
                            <QuestionImageView image={question.image} />
                            <label className="block text-sm font-bold">Câu trả lời của bạn
                              <input type="text" inputMode="text" autoComplete="off" spellCheck={false} aria-label={`Đáp án luyện tập câu ${index + 1}`} aria-describedby={`practice-number-${question.id}`} aria-invalid={!!value.trim() && !valid} value={value} onChange={(event) => setPracticeAnswer(question.id, { type: "short_answer", value: event.target.value })} placeholder="Nhập số, ví dụ -12,5" className="mt-2 block min-h-12 w-full rounded-xl border border-line px-3 font-normal sm:max-w-sm" />
                            </label>
                            <p id={`practice-number-${question.id}`} className="text-sm leading-6 text-secondary">Chỉ nhập số, có thể dùng dấu âm và dấu phẩy hoặc chấm thập phân. Không kèm đơn vị hay dấu tách hàng nghìn.</p>
                            {!!value.trim() && !valid && <p role="alert" className="text-sm text-red-700">Vui lòng nhập số hợp lệ, ví dụ 125 hoặc -12,5.</p>}
                            <button type="button" disabled={!valid} onClick={() => setCheckedQuestions((current) => ({ ...current, [question.id]: true }))} className="min-h-11 rounded-full bg-emerald px-4 text-sm font-bold text-white disabled:opacity-40">Kiểm tra</button>
                            {checked && <div className={`space-y-1 rounded-xl p-3 text-sm ${result === "correct" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}><p className="font-bold">{result === "correct" ? "Chính xác!" : "Chưa chính xác."}</p><p>Đáp án: {question.correctAnswer}</p>{question.explanation && <p className="whitespace-pre-wrap">Giải thích: {question.explanation}</p>}</div>}
                          </div>;
                        }
                        if (question.type === "multiple_choice") {
                          const answer = selectedAnswers[question.id];

                          const selectedIds =
                            answer?.type === "multiple_choice"
                              ? answer.selectedOptionIds
                              : [];

                          const checked = checkedQuestions[question.id];

                          const result = evaluateAssignmentAnswer(
                            question,
                            answer,
                          );

                          return (
                            <div
                              key={question.id}
                              className="rounded-xl border border-line p-4"
                            >
                              <p className="whitespace-pre-wrap font-bold text-ink">
                                Câu {index + 1}. {question.content}
                              </p>
                              <QuestionImageView image={question.image} />

                              <p className="mt-2 text-xs text-muted">
                                Chọn các đáp án bạn cho là đúng.
                              </p>

                              <div className="mt-3 space-y-2">
                                {question.options.map((option, optionIndex) => {
                                  const label = String.fromCharCode(
                                    65 + optionIndex,
                                  );

                                  const isCorrectOption =
                                    question.correctOptionIds.includes(
                                      option.id,
                                    );

                                  return (
                                    <label
                                      key={option.id}
                                      className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${checked && isCorrectOption
                                          ? "border-emerald bg-emerald/5 text-emerald"
                                          : "border-line text-secondary"
                                        }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(
                                          option.id,
                                        )}
                                        onChange={() =>
                                          togglePracticeOption(
                                            question.id,
                                            option.id,
                                          )
                                        }
                                        className="mt-1 shrink-0 accent-emerald"
                                      />

                                      <span className="whitespace-pre-wrap">
                                        {label}. {option.text}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>

                              <button
                                type="button"
                                disabled={selectedIds.length === 0}
                                onClick={() =>
                                  setCheckedQuestions((current) => ({
                                    ...current,
                                    [question.id]: true,
                                  }))
                                }
                                className="mt-4 rounded-full bg-emerald px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                              >
                                Kiểm tra đáp án
                              </button>

                              {checked && (
                                <div
                                  aria-live="polite"
                                  className="mt-3 text-sm text-secondary"
                                >
                                  <p>
                                    {result === "correct"
                                      ? "Chính xác!"
                                      : "Chưa đúng. Các phương án đúng được tô xanh."}
                                  </p>

                                  {question.explanation && (
                                    <p className="mt-1 whitespace-pre-wrap">
                                      Giải thích: {question.explanation}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }
                        if (
                          question.type === "true_false" ||
                          question.type === "true_false_group"
                        ) {
                          const answer = selectedAnswers[question.id];
                          const checked = checkedQuestions[question.id];

                          const result = evaluateAssignmentAnswer(
                            question,
                            answer,
                          );

                          const canCheck =
                            result === "correct" || result === "incorrect";

                          return (
                            <div
                              key={question.id}
                              className="rounded-xl border border-line p-4"
                            >
                              <p className="whitespace-pre-wrap font-bold text-ink">
                                Câu {index + 1}. {question.content}
                              </p>
                              <QuestionImageView image={question.image} />

                              {question.type === "true_false" ? (
                                <div className="mt-3 flex flex-wrap gap-5">
                                  {[true, false].map((value) => (
                                    <label
                                      key={String(value)}
                                      className="flex cursor-pointer items-center gap-2 text-sm text-secondary"
                                    >
                                      <input
                                        type="radio"
                                        name={`practice-${question.id}`}
                                        checked={
                                          answer?.type === "true_false" &&
                                          answer.answer === value
                                        }
                                        onChange={() =>
                                          setPracticeAnswer(question.id, {
                                            type: "true_false",
                                            answer: value,
                                          })
                                        }
                                        className="accent-emerald"
                                      />

                                      <span>{value ? "Đúng" : "Sai"}</span>
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-3 space-y-3">
                                  {question.statements.map(
                                    (statement, statementIndex) => {
                                      const selected =
                                        answer?.type === "true_false_group"
                                          ? answer.answersByStatementId[
                                          statement.id
                                          ]
                                          : undefined;

                                      const isCorrect =
                                        selected === statement.correctAnswer;

                                      return (
                                        <div
                                          key={statement.id}
                                          className="rounded-lg border border-line p-3"
                                        >
                                          <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
                                            <strong>
                                              Ý {statementIndex + 1}.{" "}
                                            </strong>
                                            {statement.content}
                                          </p>

                                          <div className="mt-2 flex flex-wrap gap-5">
                                            {[true, false].map((value) => (
                                              <label
                                                key={String(value)}
                                                className="flex cursor-pointer items-center gap-2 text-sm text-secondary"
                                              >
                                                <input
                                                  type="radio"
                                                  name={`practice-${question.id}-${statement.id}`}
                                                  checked={selected === value}
                                                  onChange={() =>
                                                    setPracticeStatementAnswer(
                                                      question.id,
                                                      statement.id,
                                                      value,
                                                    )
                                                  }
                                                  className="accent-emerald"
                                                />

                                                <span>
                                                  {value ? "Đúng" : "Sai"}
                                                </span>
                                              </label>
                                            ))}
                                          </div>

                                          {checked && (
                                            <p
                                              className={`mt-2 text-sm ${isCorrect
                                                  ? "text-emerald"
                                                  : "text-red-600"
                                                }`}
                                            >
                                              {isCorrect
                                                ? "Chính xác."
                                                : `Chưa đúng. Cần chọn ${statement.correctAnswer
                                                  ? "Đúng"
                                                  : "Sai"
                                                }.`}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              )}

                              <button
                                type="button"
                                disabled={!canCheck}
                                onClick={() =>
                                  setCheckedQuestions((current) => ({
                                    ...current,
                                    [question.id]: true,
                                  }))
                                }
                                className="mt-4 rounded-full bg-emerald px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                              >
                                Kiểm tra đáp án
                              </button>

                              {checked && (
                                <div
                                  aria-live="polite"
                                  className="mt-3 text-sm text-secondary"
                                >
                                  <p>
                                    {result === "correct"
                                      ? "Chính xác!"
                                      : question.type === "true_false"
                                        ? `Chưa đúng. Cần chọn ${question.correctAnswer
                                          ? "Đúng"
                                          : "Sai"
                                        }.`
                                        : "Chưa đúng toàn bộ. Xem phản hồi ở từng ý."}
                                  </p>

                                  {question.explanation && (
                                    <p className="mt-1 whitespace-pre-wrap">
                                      Giải thích: {question.explanation}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }

                        const answer = selectedAnswers[question.id];

                        const selected =
                          answer?.type === "single_choice"
                            ? answer.selectedOptionId
                            : undefined;

                        const checked = checkedQuestions[question.id];

                        const result = evaluateAssignmentAnswer(
                          question,
                          answer,
                        );

                        const correctOptionIndex = question.options.findIndex(
                          (option) => option.id === question.correctOptionId,
                        );

                        const correctOption =
                          question.options[correctOptionIndex];

                        const correctOptionLabel =
                          correctOptionIndex >= 0
                            ? String.fromCharCode(65 + correctOptionIndex)
                            : "";

                        return (
                          <div
                            key={question.id}
                            className="rounded-xl border border-line p-4"
                          >
                            <p className="font-bold text-ink">
                              Câu {index + 1}. {question.content}
                            </p>
                            <QuestionImageView image={question.image} />

                            <div className="mt-3 space-y-2">
                              {question.options.map((option, optionIndex) => {
                                const label = String.fromCharCode(
                                  65 + optionIndex,
                                );

                                return (
                                  <label
                                    key={option.id}
                                    className="flex cursor-pointer items-start gap-2 text-sm text-secondary"
                                  >
                                    <input
                                      type="radio"
                                      name={`practice-${question.id}`}
                                      checked={selected === option.id}
                                      onChange={() => {
                                        setSelectedAnswers((current) => ({
                                          ...current,
                                          [question.id]: {
                                            type: "single_choice",
                                            selectedOptionId: option.id,
                                          },
                                        }));

                                        setCheckedQuestions((current) => ({
                                          ...current,
                                          [question.id]: false,
                                        }));
                                      }}
                                      className="mt-1 accent-emerald"
                                    />

                                    <span className="whitespace-pre-wrap">
                                      {label}. {option.text}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              disabled={!selected}
                              onClick={() =>
                                setCheckedQuestions((current) => ({
                                  ...current,
                                  [question.id]: true,
                                }))
                              }
                              className="mt-4 rounded-full bg-emerald px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                            >
                              Kiểm tra đáp án
                            </button>

                            {checked && (
                              <p
                                aria-live="polite"
                                className="mt-3 text-sm text-secondary"
                              >
                                {result === "correct"
                                  ? "Chính xác!"
                                  : correctOption
                                    ? `Chưa đúng. Đáp án đúng là ${correctOptionLabel}. ${correctOption.text}`
                                    : "Không tìm thấy đáp án đúng của câu hỏi."}
                                {question.explanation && (
                                  <span className="mt-1 block">
                                    Giải thích: {question.explanation}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </article>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
