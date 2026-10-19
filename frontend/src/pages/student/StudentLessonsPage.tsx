import { useSearchParams, Link } from "react-router-dom";

import {
  geo10Chapters,
  geo10Lessons,
  geo10Parts,
} from "../../data/geo10Curriculum";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTeacherQuestions } from "../../contexts/TeacherQuestionsContext";
import StudentLessonSections from "../../components/student/StudentLessonSections";
import StudentLessonPractice from "../../components/student/StudentLessonPractice";
import StudentPageHeader from "../../components/student/StudentPageHeader";
import { LessonBody } from "../../components/common/LessonBody";
import { loadLessonContents, LESSON_CONTENT_KEY, LESSON_CONTENT_CHANGED_EVENT } from "../../utils/lessonContentStorage";
import { useStudentAccount } from "../../contexts/StudentAccountContext";
import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";
import { useStudentClassMemberships } from "../../hooks/useStudentClassMemberships";
import { getActiveStudentClassIds } from "../../utils/studentMembership";
import { useLocalStorageRevision } from "../../hooks/useLocalStorageRevision";
import { getPublishedStudentLessons, getVisibleStudentLessonAssignments, selectStudentLesson } from "../../utils/studentLessons";
import type { CurriculumLesson } from "../../types/curriculum";

const lessonStorageKeys = [LESSON_CONTENT_KEY];
const lessonEvents = [LESSON_CONTENT_CHANGED_EVENT];

export default function StudentLessonsPage() {
  const { student, hasStudentProfile } = useStudentAccount();
  const { assignments, submissions, submissionStorageStatus } =
    useTeacherAssignments();
  const { memberships } = useStudentClassMemberships();
  const [searchParams, setSearchParams] = useSearchParams();
  const contentsRevision = useLocalStorageRevision(lessonStorageKeys, lessonEvents);
  const contents = useMemo(loadLessonContents, [contentsRevision]);

  const { questions } = useTeacherQuestions();

  const publishedLessons = getPublishedStudentLessons(geo10Lessons, contents);

  const requestedId = searchParams.get("lesson");
  const selectedLesson = selectStudentLesson(publishedLessons, requestedId);

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

  const activeClassIds = getActiveStudentClassIds(memberships);
  const requestedClassId = searchParams.get("class");
  const visibleAssignments = getVisibleStudentLessonAssignments(
    assignments, hasStudentProfile, activeClassIds, requestedClassId,
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
        className={`w-full rounded-lg px-3 py-2 text-left text-sm ${isSelected ? "bg-emerald-700 text-white" : "text-ink hover:bg-canvas"}`}
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
        <StudentPageHeader title="Bài học Địa lí 10" description="Kết nối tri thức với cuộc sống" />

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
                  className="min-h-11 shrink-0 rounded-lg border border-line px-3 text-sm font-bold text-emerald-700 lg:hidden"
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
                    <p role="status" className="text-xs text-secondary">
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
                  <p className="text-sm font-bold text-emerald-700">
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
                  className="inline-flex rounded-full bg-emerald-700 px-5 py-3 text-sm font-bold text-white"
                >
                  Xem video của Bài {selectedLesson.number}
                </Link>

                <Link
                  to={`/student/assignments?lesson=${selectedLesson.id}`}
                  className="inline-flex rounded-full border border-emerald px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald/5"
                >
                  Xem bài tập của Bài {selectedLesson.number}
                </Link>

                <StudentLessonPractice questions={practiceQuestions} />
              </article>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
