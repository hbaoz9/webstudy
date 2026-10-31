import { useSearchParams } from "react-router-dom";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getStudentLesson, getStudentLessons, type StudentLessonDetail, type StudentLessonSummary } from "../../service/api/lessons";
import { ApiError } from "../../service/api/client";
import StudentLessonSections from "../../components/student/StudentLessonSections";
import { LessonBody } from "../../components/common/LessonBody";

export default function StudentLessonsPage() {
  const { session, status: authStatus } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const [lessonResult, setLessonResult] = useState<{
    key: string; data?: StudentLessonSummary[]; error?: string;
  } | null>(null);
  const requestKey = `${authStatus}:${session?.role ?? "none"}:${session?.userId ?? "none"}:${revision}`;
  const currentLessons = lessonResult?.key === requestKey ? lessonResult : null;
  useEffect(() => {
    if (authStatus !== "ready" || session?.role !== "student") return;
    let active = true;
    void getStudentLessons()
      .then((data) => { if (active) setLessonResult({ key: requestKey, data }); })
      .catch(() => { if (active) setLessonResult({ key: requestKey, error: "Không thể tải danh sách bài học. Vui lòng thử lại." }); });
    return () => { active = false; };
  }, [authStatus, requestKey, session?.role]);

  const publishedLessons = currentLessons?.data ?? [];
  const parts = Array.from(new Map(publishedLessons.map((lesson) => [lesson.partId, {
    id: lesson.partId, number: lesson.partNumber, title: lesson.partTitle,
  }])).values()).sort((a, b) => a.number - b.number);
  const chapters = Array.from(new Map(publishedLessons.map((lesson) => [lesson.chapterId, {
    id: lesson.chapterId, partId: lesson.partId, number: lesson.chapterNumber, title: lesson.chapterTitle,
  }])).values()).sort((a, b) => a.number - b.number);

  const requestedId = searchParams.get("lesson");
  const selectedLesson = requestedId === null
    ? publishedLessons[0]
    : publishedLessons.find((lesson) => lesson.id === requestedId);
  const [detailRevision, setDetailRevision] = useState(0);
  const [detailResult, setDetailResult] = useState<{
    key: string; data?: StudentLessonDetail; error?: string;
  } | null>(null);
  const detailKey = `${requestKey}:${selectedLesson?.id ?? "none"}:${detailRevision}`;
  const currentDetail = detailResult?.key === detailKey ? detailResult : null;
  const selectedContent = currentDetail?.data?.content;

  useEffect(() => {
    if (authStatus !== "ready" || session?.role !== "student" || !selectedLesson) return;
    let active = true;
    void getStudentLesson(selectedLesson.id)
      .then((data) => {
        if (active) setDetailResult({
          key: detailKey,
          ...(data.id === selectedLesson.id
            ? { data }
            : { error: "Không thể tải đúng bài học này. Vui lòng thử lại." }),
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        const error = cause instanceof ApiError && cause.status === 404
          ? "Bài học này không còn khả dụng hoặc chưa được phân phối cho lớp của bạn."
          : cause instanceof ApiError && cause.status === 401
            ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            : cause instanceof ApiError && cause.status === 403
              ? "Bạn không có quyền xem bài học này."
              : "Không thể tải nội dung bài học. Vui lòng thử lại.";
        setDetailResult({ key: detailKey, error });
      });
    return () => { active = false; };
  }, [authStatus, detailKey, selectedLesson, session?.role]);

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

  function lessonButton(item: StudentLessonSummary) {
    const isSelected = selectedLesson?.id === item.id;
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
        {isSelected && <span className="mt-1 block text-xs text-white">Đang xem</span>}
      </button>
    );
  }

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

        {!currentLessons ? (
          <p role="status" className="rounded-2xl border border-line bg-white p-8 text-sm text-secondary">
            Đang tải danh sách bài học...
          </p>
        ) : currentLessons.error ? (
          <div role="alert" className="rounded-2xl border border-line bg-white p-8 text-sm text-secondary">
            <p>{currentLessons.error}</p>
            <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-4 min-h-11 rounded-lg border border-emerald px-4 font-bold text-emerald">
              Thử lại
            </button>
          </div>
        ) : publishedLessons.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white p-8 text-sm text-secondary">
            Chưa có bài học nào được phân phối cho lớp của bạn.
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
                    {publishedLessons.length} bài{selectedLesson ? ` · Đang xem Bài ${selectedLesson.number}` : ""}
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
                  parts
                    .filter((part) =>
                      chapters.some(
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

                        {chapters
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

            {requestedId !== null && !selectedLesson && (
              <article role="status" className="min-w-0 rounded-2xl border border-line bg-white p-6 text-sm text-secondary shadow-card">
                Bài học này không khả dụng hoặc chưa được phân phối cho lớp của bạn.
              </article>
            )}
            {selectedLesson && !selectedContent && (
              <article className="min-w-0 rounded-2xl border border-line bg-white p-6 shadow-card">
                <h2 ref={lessonTitleRef} tabIndex={-1} className="text-xl font-extrabold text-ink">Bài {selectedLesson.number}. {selectedLesson.title}</h2>
                {currentDetail?.error ? (
                  <div role="alert" className="mt-4 text-sm text-secondary">
                    <p>{currentDetail.error}</p>
                    <button type="button" onClick={() => setDetailRevision((value) => value + 1)} className="mt-4 min-h-11 rounded-lg border border-emerald px-4 font-bold text-emerald">
                      Thử lại
                    </button>
                  </div>
                ) : (
                  <p role="status" className="mt-4 text-sm text-secondary">Đang tải nội dung bài học...</p>
                )}
              </article>
            )}
            {selectedLesson && selectedContent && (
              <article className="min-w-0 space-y-6 rounded-2xl border border-line bg-white p-6 shadow-card [overflow-wrap:anywhere]">
                <div>
                  <p className="text-sm font-bold text-emerald">
                    Bài {currentDetail?.data?.number ?? selectedLesson.number}
                  </p>
                  <h2
                    ref={lessonTitleRef}
                    tabIndex={-1}
                    className="mt-2 scroll-mt-24 text-xl font-extrabold text-ink"
                  >
                    {currentDetail?.data?.title ?? selectedLesson.title}
                  </h2>
                </div>

                {selectedContent.explanation.trim() ? <section>
                  <h3 className="font-extrabold text-ink">Nội dung bài học</h3>
                  <div className="mt-2">
                    <LessonBody
                      value={selectedContent.explanation}
                      format={selectedContent.explanationFormat}
                      lessonPublished={selectedContent.status === "published"}
                    />
                  </div>
                </section> : !selectedContent.sections?.length ? (
                  <p className="text-sm text-secondary">Bài học này chưa có nội dung để hiển thị.</p>
                ) : null}

                <StudentLessonSections
                  content={selectedContent}
                  lessonId={selectedLesson.id}
                  studentId={session?.userId}
                />


              </article>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
