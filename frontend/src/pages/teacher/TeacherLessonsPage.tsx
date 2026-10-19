import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBlocker, useSearchParams } from "react-router-dom";

import {
  geo10Chapters,
  geo10Lessons,
  geo10Parts,
  getLessonsByChapter,
} from "../../data/geo10Curriculum";

import type { CurriculumLesson, LessonContent } from "../../types/curriculum";

import {
  loadLessonContents,
  saveLessonContents,
} from "../../utils/lessonContentStorage";

import { buildLessonSavePayload, validateLessonContent } from "../../utils/lessonForm";

import { LessonBody } from "../../components/common/LessonBody";
import { LessonBodyEditor } from "../../components/common/LessonBodyEditor";

type ContentFilter = "all" | "published" | "draft" | "empty";
const statusFilters: { value: ContentFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "published", label: "Đã đăng" },
  { value: "draft", label: "Nháp" },
  { value: "empty", label: "Chưa soạn" },
];

function blankContent(lessonId: string): LessonContent {
  return {
    lessonId,
    objectives: [],
    keyPoints: [],
    explanation: "",
    sections: [],
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}

export default function TeacherLessonsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [contents, setContents] = useState(loadLessonContents);

  const LAST_LESSON_KEY = "webstudy-v1-last-teacher-lesson";

  const requestedId = searchParams.get("lesson");
  const validRequestedId = geo10Lessons.some((item) => item.id === requestedId)
    ? requestedId
    : null;

  const savedLastId = (() => {
    try {
      const id = localStorage.getItem(LAST_LESSON_KEY);
      return geo10Lessons.some((item) => item.id === id) ? id : null;
    } catch {
      return null;
    }
  })();

  const firstDraftId = geo10Lessons.find(
    (item) =>
      contents[item.id]?.draft ||
      (contents[item.id] && contents[item.id].status === "draft"),
  )?.id;

  const firstEmptyId = geo10Lessons.find((item) => !contents[item.id])?.id;

  const lessonId =
    validRequestedId ?? savedLastId ?? firstDraftId ?? firstEmptyId ?? "";

  const lesson = geo10Lessons.find((item) => item.id === lessonId);
  const chapter = geo10Chapters.find((item) => item.id === lesson?.chapterId);

  useEffect(() => {
    if (!lesson) return;

    try {
      localStorage.setItem(LAST_LESSON_KEY, lesson.id);
    } catch {}
  }, [lesson?.id]);

  const [openPart, setOpenPart] = useState(
    () =>
      chapter?.partId ??
      geo10Chapters.find((item) => item.id === geo10Lessons[0]?.chapterId)
        ?.partId ??
      "",
  );
  const [openChapter, setOpenChapter] = useState(
    lesson?.chapterId ?? geo10Lessons[0]?.chapterId ?? "",
  );
  const lessonTreeRef = useRef<HTMLElement>(null);
  const [lessonSearch, setLessonSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentFilter>("all");
  const [dirty, setDirty] = useState(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation, historyAction }) =>
      dirty &&
      historyAction === "POP" &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [action, setAction] = useState<
    | { kind: "publish" | "withdraw" | "blocked" }
    | { kind: "switch"; lessonId: string }
    | null
  >(null);

  useEffect(() => {
    if (blocker.state === "blocked") {
      setAction({ kind: "blocked" });
    }
  }, [blocker.state]);

  const actionDialogRef = useRef<HTMLDialogElement>(null);
  const [undo, setUndo] = useState<{
    lessonId: string;
    previous?: LessonContent;
    edited: LessonContent;
    wasDirty: boolean;
    published: string;
  } | null>(null);
  const pickerDialogRef = useRef<HTMLDialogElement>(null);
  const previewDialogRef = useRef<HTMLDialogElement>(null);
  const storedContent = lesson ? contents[lesson.id] : undefined;
  const isPublished = storedContent?.status === "published";
  const content = lesson
    ? (storedContent?.draft ?? storedContent ?? blankContent(lesson.id))
    : undefined;

  useLayoutEffect(() => {
    const dialog = pickerDialogRef.current;
    if (!pickerOpen || !dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [pickerOpen]);

  useLayoutEffect(() => {
    const dialog = previewDialogRef.current;
    if (!previewOpen || !dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [previewOpen]);

  useLayoutEffect(() => {
    const dialog = actionDialogRef.current;
    if (!action || !dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [action]);

  const modalOpen = previewOpen || pickerOpen || action !== null;
  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 10000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    setPreviewOpen(false);

    if (!lesson || !chapter) return;

    setOpenPart(chapter.partId);
    setOpenChapter(chapter.id);
  }, [lessonId]);

  useEffect(() => {
    const tree = lessonTreeRef.current;
    if (!tree || !lessonId) return;

    const selectedButton = tree.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );

    if (!selectedButton) return;

    const treeRect = tree.getBoundingClientRect();
    const buttonRect = selectedButton.getBoundingClientRect();

    if (buttonRect.top < treeRect.top || buttonRect.bottom > treeRect.bottom) {
      tree.scrollTop +=
        buttonRect.top -
        treeRect.top -
        tree.clientHeight / 2 +
        buttonRect.height / 2;
    }
  }, [lessonId, openPart, openChapter, statusFilter, lessonSearch]);

  const contentStatus = (id: string): "draft" | "published" | "empty" =>
    contents[id]?.draft ? "draft" : (contents[id]?.status ?? "empty");
  const statusLabel = (id: string) =>
    contentStatus(id) === "published"
      ? "Đã đăng"
      : contentStatus(id) === "draft"
        ? "Bản nháp"
        : "Chưa soạn";
  const lessonLabel = (item: CurriculumLesson) => (
    <span className="flex items-start gap-2">
      <span
        aria-hidden="true"
        title={statusLabel(item.id)}
        className={`shrink-0 ${contentStatus(item.id) === "published" ? "text-emerald-700" : contentStatus(item.id) === "draft" ? "text-amber-700" : "text-secondary"}`}
      >
        {contentStatus(item.id) === "published"
          ? "●"
          : contentStatus(item.id) === "draft"
            ? "◐"
            : "○"}
      </span>
      <span className="min-w-0">
        Bài {item.number}. {item.title}
        <span className="sr-only">
          {" "}
          · {statusLabel(item.id)}
          {contents[item.id]?.draft && contents[item.id]?.status === "published"
            ? ", có bản đang đăng"
            : ""}
        </span>
      </span>
    </span>
  );
  const matchesStatus = (id: string, filter: ContentFilter) =>
    filter === "all" ||
    (filter === "published"
      ? contents[id]?.status === "published"
      : contentStatus(id) === filter);
  const preparedCount = geo10Lessons.filter(
    (item) => contentStatus(item.id) !== "empty",
  ).length;
  const query = lessonSearch.trim().toLocaleLowerCase("vi");
  const isFiltering = query !== "" || statusFilter !== "all";
  const matchingLessons = geo10Lessons.filter(
    (item) =>
      `Bài ${item.number}. ${item.title}`
        .toLocaleLowerCase("vi")
        .includes(query) && matchesStatus(item.id, statusFilter),
  );

  function updateLesson(changes: Partial<LessonContent>) {
    if (!lesson) return;
    setContents((current) => {
      const saved = current[lesson.id];
      const edited = {
        ...(saved?.draft ?? saved ?? blankContent(lesson.id)),
        ...changes,
        draft: undefined,
        status: "draft" as const,
      };
      return {
        ...current,
        [lesson.id]:
          saved?.status === "published" ? { ...saved, draft: edited } : edited,
      };
    });
    setUndo(null);
    setDirty(true);
    setMessage("");
    setError("");
  }

  function chooseLesson(id: string): boolean {
    if (id !== lessonId && dirty) {
      setError("");
      setAction({ kind: "switch", lessonId: id });
      return false;
    }
    return navigateLesson(id);
  }

  function navigateLesson(id: string): boolean {
    setUndo(null);
    const next = geo10Lessons.find((item) => item.id === id);
    const nextChapter = geo10Chapters.find(
      (item) => item.id === next?.chapterId,
    );
    if (nextChapter) setOpenPart(nextChapter.partId);
    if (next) setOpenChapter(next.chapterId);
    setMessage("");
    setError("");
    setPickerOpen(false);
    setSearchParams({ lesson: id });
    return true;
  }

  function save(status: "draft" | "published", withdraw = false): boolean {
    if (!lesson || !content) return false;
    setError("");
    setMessage("");

    const validationError = validateLessonContent(content, status);
    if (validationError) {
      setError(validationError);
      return false;
    }
    const savedContent: LessonContent = buildLessonSavePayload(
      content,
      status,
      new Date().toISOString(),
    );
    const next = {
      ...contents,
      [lesson.id]:
        status === "draft" && isPublished && storedContent && !withdraw
          ? { ...storedContent, draft: savedContent }
          : savedContent,
    };
    try {
      const previous = loadLessonContents()[lesson.id];
      saveLessonContents(next);
      setUndo(
        status === "published"
          ? {
              lessonId: lesson.id,
              previous,
              edited: storedContent ?? content,
              wasDirty: dirty,
              published: JSON.stringify(savedContent),
            }
          : null,
      );
      setContents(next);
      setDirty(false);
      setError("");
      setMessage(
        withdraw
          ? "Đã gỡ đăng. Nội dung được giữ trong bản nháp."
          : status === "published"
            ? "Đã đăng bài học."
            : "",
      );
      return true;
    } catch {
      setError(
        "Không đủ chỗ lưu nội dung/ảnh trong trình duyệt. Hãy dùng ảnh nhỏ hơn.",
      );
      return false;
    }
  }

  function undoPublication() {
    if (!undo) return;
    try {
      const current = loadLessonContents();
      if (JSON.stringify(current[undo.lessonId]) !== undo.published) {
        setUndo(null);
        setError(
          "Bài đã thay đổi ở nơi khác. Không thể hoàn tác bản đăng này.",
        );
        return;
      }
      if (undo.previous) current[undo.lessonId] = undo.previous;
      else delete current[undo.lessonId];
      saveLessonContents(current);
      setContents({ ...current, [undo.lessonId]: undo.edited });
      setDirty(undo.wasDirty);
      setUndo(null);
      setError("");
      setMessage("Đã hoàn tác đăng bài. Nội dung vừa soạn được giữ lại.");
    } catch {
      setError(
        "Không thể lưu hoàn tác. Bản đang đăng chưa thay đổi; hãy thử lại.",
      );
    }
  }

  function confirmAction() {
    if (!action) return;

    if (action.kind === "blocked") {
      if (blocker.state !== "blocked") return;

      if (!save("draft")) return;

      setAction(null);
      blocker.proceed();
      return;
    }

    if (action.kind === "switch") {
      if (!save("draft")) return;
      navigateLesson(action.lessonId);
    } else if (
      !save(
        action.kind === "publish" ? "published" : "draft",
        action.kind === "withdraw",
      )
    ) {
      return;
    }

    setAction(null);
  }

  const treeButton = (active: boolean) =>
    `min-h-11 w-full rounded-lg border-l-2 px-2 py-2 text-left text-sm leading-5 ${
      active
        ? "border-emerald-700 bg-emerald-50 text-ink font-semibold"
        : "border-transparent text-ink hover:bg-canvas"
    }`;

  const savedTime =
    content && Number.isFinite(Date.parse(content.updatedAt))
      ? new Intl.DateTimeFormat("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(content.updatedAt))
      : "";
  const saveLabel = dirty
    ? "Có thay đổi chưa lưu"
    : storedContent
      ? `Đã lưu${savedTime ? ` lúc ${savedTime}` : ""}`
      : "Chưa lưu bản nháp";

  const lessonTree = (
    <nav
      ref={lessonTreeRef}
      aria-label="Cây nội dung bài học"
      className="min-w-0 max-h-[55vh] overflow-y-auto rounded-2xl border border-line bg-white p-3 shadow-card [overflow-wrap:anywhere] lg:max-h-[75vh]"
    >
      <div className="mb-3 space-y-3 border-b border-line pb-3">
        <div>
          <p className="text-sm font-bold text-ink">
            Đã soạn {preparedCount}/{geo10Lessons.length} bài
          </p>
          <progress
            aria-label="Tiến độ soạn bài"
            value={preparedCount}
            max={geo10Lessons.length}
            className="mt-2 block h-2 w-full accent-emerald"
          />
        </div>
        <label className="block text-sm font-semibold text-ink">
          Tìm bài học
          <input
            type="search"
            value={lessonSearch}
            onChange={(event) => setLessonSearch(event.target.value)}
            placeholder="Tên bài hoặc Bài 12"
            className="mt-1 min-h-11 w-full rounded-lg border border-line px-3 font-normal"
          />
        </label>
        <div
          role="group"
          aria-label="Lọc trạng thái bài học"
          className="flex flex-wrap gap-2"
        >
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={statusFilter === filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${statusFilter === filter.value ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-line bg-white text-secondary hover:bg-canvas"}`}
            >
              {filter.label}{" "}
              <span className="font-normal tabular-nums">
                (
                {
                  geo10Lessons.filter((item) =>
                    matchesStatus(item.id, filter.value),
                  ).length
                }
                )
              </span>
            </button>
          ))}
        </div>
        {statusFilter === "draft" && (
          <p className="text-[13px] leading-5 text-secondary">
            Nháp có thể thuộc bài đang đăng; bản đăng được giữ nguyên.
          </p>
        )}
      </div>
      {isFiltering ? (
        <div className="space-y-1">
          <p role="status" className="px-2 pb-2 text-sm text-secondary">
            {matchingLessons.length} bài phù hợp
          </p>
          {matchingLessons.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === lessonId ? "page" : undefined}
              className={treeButton(item.id === lessonId)}
              onClick={() => chooseLesson(item.id)}
            >
              {lessonLabel(item)}
            </button>
          ))}
          {matchingLessons.length === 0 && (
            <p className="p-2 text-sm text-secondary">
              Không tìm thấy bài học phù hợp. Thử đổi từ khóa hoặc trạng thái.
            </p>
          )}
        </div>
      ) : (
        geo10Parts.map((part) => (
          <div key={part.id} className="mb-1">
            <button
              type="button"
              aria-expanded={openPart === part.id}
              onClick={() => setOpenPart(openPart === part.id ? "" : part.id)}
              className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm font-extrabold text-ink hover:bg-canvas"
            >
              <span aria-hidden="true">{openPart === part.id ? "▾" : "▸"}</span>
              <span>
                Phần {part.number}. {part.title}
              </span>
            </button>
            {openPart === part.id &&
              geo10Chapters
                .filter((item) => item.partId === part.id)
                .map((item) => (
                  <div key={item.id} className="ml-3 border-l border-line pl-2">
                    <button
                      type="button"
                      aria-expanded={openChapter === item.id}
                      onClick={() =>
                        setOpenChapter(openChapter === item.id ? "" : item.id)
                      }
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-bold text-secondary hover:bg-canvas"
                    >
                      <span aria-hidden="true">
                        {openChapter === item.id ? "▾" : "▸"}
                      </span>
                      <span>
                        Chương {item.number}. {item.title}
                      </span>
                    </button>
                    {openChapter === item.id &&
                      getLessonsByChapter(item.id).map((child) => (
                        <div
                          key={child.id}
                          className="ml-2 border-l border-line pl-2"
                        >
                          <button
                            type="button"
                            onClick={() => chooseLesson(child.id)}
                            aria-current={
                              lessonId === child.id ? "page" : undefined
                            }
                            className={treeButton(lessonId === child.id)}
                          >
                            {lessonLabel(child)}
                          </button>
                        </div>
                      ))}
                  </div>
                ))}
          </div>
        ))
      )}
    </nav>
  );

  function closeActionDialog() {
    if (action?.kind === "blocked" && blocker.state === "blocked") {
      blocker.reset();
    }

    setAction(null);
  }

  return (
    <div className="min-w-0 space-y-5 pb-40">
      <header>
        <h1 className="text-2xl font-extrabold text-ink">Nội dung bài học</h1>
        <p className="mt-1 text-sm text-secondary">
          Địa lí 10 · Kết nối tri thức với cuộc sống
        </p>
      </header>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-controls="lesson-picker-dialog"
        onClick={() => setPickerOpen(true)}
        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink 2xl:hidden"
      >
        <span>Chọn bài học{lesson ? ` · Bài ${lesson.number}` : ""}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <div className="grid items-start gap-5 2xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden 2xl:block">{lessonTree}</aside>

        <section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
          {lesson && content ? (
            <>
              <div className="border-b border-line pb-4">
                <p className="text-sm font-semibold text-secondary">
                  Chương {chapter?.number} · Bài {lesson.number}
                </p>
                <h2 className="mt-1 text-xl font-extrabold text-ink">
                  {lesson.title}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span
                    aria-label="Trạng thái bài học"
                    className={`rounded-full px-3 py-1 text-sm font-bold ${contentStatus(lesson.id) === "published" ? "bg-emerald-50 text-emerald-800" : contentStatus(lesson.id) === "draft" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-secondary"}`}
                  >
                    {statusLabel(lesson.id)}
                  </span>
                  <span className="text-sm text-secondary">{saveLabel}</span>
                </div>
                {isPublished && storedContent?.draft && (
                  <p className="mt-2 text-[13px] leading-5 text-secondary">
                    Bản đã đăng vẫn hiển thị cho học sinh. Bản nháp chưa được
                    cập nhật vào bài đăng.
                  </p>
                )}
              </div>

              <div id="lesson-editor-panel" aria-label="Biên soạn nội dung bài học" className="mt-5 min-w-0">
                <LessonBodyEditor
                  key={`${lesson.id}-body`}
                  title="Nội dung"
                  lessonId={lesson.id}
                  chapterId={lesson.chapterId}
                  value={content.explanation}
                  format={content.explanationFormat}
                  onChange={(explanation, explanationFormat) => updateLesson({ explanation, explanationFormat })}
                  layout="split"
                  hidePreview
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-secondary">
              Chọn một bài học để chỉnh sửa.
            </p>
          )}
        </section>

      </div>
      <dialog
        id="lesson-picker-dialog"
        ref={pickerDialogRef}
        aria-labelledby="lesson-picker-title"
        onCancel={(event) => {
          event.preventDefault();
          setPickerOpen(false);
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-line bg-white p-4 text-ink shadow-xl backdrop:bg-ink/50"
      >
        {pickerOpen && (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="lesson-picker-title" className="text-lg font-extrabold">
                Chọn bài học
              </h2>
              <button
                type="button"
                autoFocus
                onClick={() => setPickerOpen(false)}
                className="min-h-11 rounded-full border border-line px-4 text-sm font-bold"
              >
                Đóng chọn bài
              </button>
            </div>
            {lessonTree}
          </>
        )}
      </dialog>
      {lesson && content && (
        <section
          aria-label="Thao tác bài học"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white px-5 py-3 shadow-lg lg:left-[260px] lg:px-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p
                role="status"
                className={`text-sm font-semibold ${dirty ? "text-amber-700" : "text-secondary"}`}
              >
                {dirty ? "● " : storedContent ? "✓ " : ""}
                {saveLabel}
              </p>
              {message && (
                <p role="status" className="mt-1 text-sm text-secondary">
                  {message}
                  {undo && (
                    <button
                      type="button"
                      onClick={undoPublication}
                      className="ml-2 min-h-11 rounded-lg px-2 font-bold text-emerald-800 underline"
                    >
                      Hoàn tác
                    </button>
                  )}
                </p>
              )}
              {isPublished && (dirty || storedContent?.draft) && (
                <p className="mt-1 hidden text-sm text-secondary sm:block">
                  Nháp không đổi bản đang đăng. Chọn Cập nhật để học sinh thấy
                  thay đổi.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="hidden min-h-11 rounded-full border border-line px-4 text-sm font-bold text-ink sm:inline-flex sm:items-center"
              >
                Xem thử
              </button>
              <button
                type="button"
                onClick={() => save("draft")}
                disabled={!dirty && Boolean(storedContent)}
                className="min-h-11 rounded-full border border-line px-4 text-sm font-bold text-ink disabled:opacity-50"
              >
                <span className="sm:hidden">Lưu</span>
                <span className="hidden sm:inline">Lưu nháp</span>
              </button>
              <button
                type="button"
                aria-label={
                  isPublished ? "Cập nhật bài đăng" : "Đăng cho học sinh"
                }
                onClick={() => {
                  setError("");
                  setAction({ kind: "publish" });
                }}
                disabled={isPublished && !dirty && !storedContent?.draft}
                className="min-h-11 rounded-full bg-emerald px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                <span className="sm:hidden">
                  {isPublished ? "Cập nhật" : "Đăng"}
                </span>
                <span className="hidden sm:inline">
                  {isPublished ? "Cập nhật bài đăng" : "Đăng cho học sinh"}
                </span>
              </button>
              <details className={`relative ${isPublished ? "" : "sm:hidden"}`}>
                <summary
                  aria-label="Thêm thao tác bài học"
                  className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-full border border-line text-lg font-bold text-ink"
                >
                  ⋯
                </summary>
                <div className="absolute bottom-full right-0 mb-2 w-48 rounded-xl border border-line bg-white p-2 shadow-lg">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      setPreviewOpen(true);
                    }}
                    className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold text-ink sm:hidden"
                  >
                    Xem thử
                  </button>
                  {isPublished && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                        setError("");
                        setAction({ kind: "withdraw" });
                      }}
                      className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold text-red-600"
                    >
                      Gỡ đăng
                    </button>
                  )}
                </div>
              </details>
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </section>
      )}
      <dialog
        ref={actionDialogRef}
        aria-labelledby="lesson-action-title"
        aria-describedby="lesson-action-description"
        onCancel={(event) => {
          event.preventDefault();
          closeActionDialog();
        }}
        className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-ink/50 sm:p-6"
      >
        {action && lesson && content && (
          <>
            <h2 id="lesson-action-title" className="text-lg font-extrabold">
              {action.kind === "switch" || action.kind === "blocked"
                ? "Bài có thay đổi chưa lưu"
                : action.kind === "withdraw"
                  ? "Gỡ đăng bài học?"
                  : isPublished
                    ? "Cập nhật bài đăng?"
                    : "Đăng bài cho học sinh?"}
            </h2>
            <div
              id="lesson-action-description"
              className="mt-3 space-y-3 text-sm leading-6 text-secondary"
            >
              <p className="font-semibold text-ink">
                Bài {lesson.number}. {lesson.title}
              </p>
              {action.kind === "switch" || action.kind === "blocked" ? (
                <p>
                  Lưu bản nháp trước khi chuyển bài, hoặc bỏ những thay đổi chưa
                  lưu. Bản đang đăng được giữ nguyên.
                </p>
              ) : action.kind === "withdraw" ? (
                <p>
                  Học sinh sẽ không còn thấy bài này. Nội dung đang soạn được
                  giữ thành bản nháp.
                </p>
              ) : (
                <>
                  <p>
                    Nội dung sẽ hiển thị cho học sinh truy cập bài này trong
                    chương trình Địa lí 10. Nội dung hiện dùng chung, chưa phân
                    phối riêng theo lớp.
                  </p>
                  <p>Nội dung bài học đã sẵn sàng cập nhật.</p>
                  <p>Có thể Hoàn tác trong 10 giây sau khi đăng.</p>
                </>
              )}
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={closeActionDialog}
                className="min-h-11 rounded-full border border-line px-4 text-sm font-bold"
              >
                {action.kind === "switch" || action.kind === "blocked"
                  ? "Ở lại"
                  : "Hủy"}
              </button>
              {(action.kind === "switch" || action.kind === "blocked") && (
                <button
                  type="button"
                  onClick={() => {
                    setContents(loadLessonContents());
                    setDirty(false);

                    if (action.kind === "blocked") {
                      if (blocker.state === "blocked") {
                        blocker.proceed();
                      }
                    } else if (action?.kind === "switch") {
                      navigateLesson(action.lessonId);
                    }

                    setAction(null);
                  }}
                  className="min-h-11 rounded-full border border-line px-4 text-sm font-bold text-red-600"
                >
                  Bỏ thay đổi
                </button>
              )}
              <button
                type="button"
                onClick={confirmAction}
                className={`min-h-11 rounded-full px-4 text-sm font-bold text-white ${action.kind === "withdraw" ? "bg-red-600" : "bg-emerald"}`}
              >
                {action.kind === "switch" || action.kind === "blocked"
                  ? "Lưu nháp và chuyển bài"
                  : action.kind === "withdraw"
                    ? "Xác nhận gỡ đăng"
                    : isPublished
                      ? "Xác nhận cập nhật"
                      : "Xác nhận đăng"}
              </button>
            </div>
          </>
        )}
      </dialog>
      <dialog
        ref={previewDialogRef}
        aria-labelledby="lesson-preview-title"
        onCancel={(event) => {
          event.preventDefault();
          setPreviewOpen(false);
        }}
        className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-ink/50 sm:p-6"
      >
        {previewOpen && lesson && content && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <h2 id="lesson-preview-title" className="text-xl font-extrabold">
                Xem thử nội dung đang soạn
              </h2>
              <button
                type="button"
                autoFocus
                onClick={() => setPreviewOpen(false)}
                className="min-h-11 rounded-full border border-line px-4 text-sm font-bold"
              >
                Đóng xem thử
              </button>
            </div>
            <article className="mt-5 min-w-0 space-y-5 [overflow-wrap:anywhere]">
              <h3 className="text-xl font-extrabold">
                Bài {lesson.number}. {lesson.title}
              </h3>
              <p className="text-sm text-secondary">
                Xem thử không tự lưu hoặc đăng nội dung đang soạn.
              </p>

              <section>
                <h4 className="mb-2 font-bold">Nội dung bài học</h4>
                {content.explanation.trim() ? (
                  <LessonBody
                    value={content.explanation}
                    format={content.explanationFormat}
                    teacherPreview
                  />
                ) : (
                  <p className="text-sm text-secondary">Chưa có nội dung để xem thử.</p>
                )}
              </section>

            </article>
          </>
        )}
      </dialog>
    </div>
  );
}
