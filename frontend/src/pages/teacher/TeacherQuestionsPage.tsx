import { questionTypeLabels } from "../../types/question";
import { QuestionImageView } from "../../components/questions/QuestionImage";
import { lazy, Suspense, useRef, useState, useEffect } from "react";
import { CircleHelp, Search, Plus, ChevronDown, CircleDot, ListChecks, ToggleLeft, ListTodo, ClipboardPlus, X, ImageIcon, FileUp, Hash, type LucideIcon } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { geo10Chapters, geo10Lessons } from "../../data/geo10Curriculum";
import { useTeacherQuestions } from "../../contexts/TeacherQuestionsContext";
import { listTeacherQuestions, type TeacherQuestion } from "../../service/api/questions";
import { useAuth } from "../../contexts/AuthContext";
import { ApiError } from "../../service/api/client";

import type {
  QuestionDifficulty,
  QuestionType,
  QuestionBankQuestion,
} from "../../types/question";

const QuestionWordImportDialog = lazy(() => import("../../components/teacher/QuestionWordImportDialog"));

const difficultyLabels: Record<QuestionDifficulty, string> = {
  recognition: "Nhận biết",
  comprehension: "Thông hiểu",
  application: "Vận dụng",
  advanced_application: "Vận dụng cao",
};


const lessonById = new Map(geo10Lessons.map((lesson) => [lesson.id, lesson]));
const typeIcons: Record<QuestionType | "essay_text", LucideIcon> = { single_choice: CircleDot, multiple_choice: ListChecks, true_false: ToggleLeft, true_false_group: ListTodo, short_answer: Hash, essay_text: ListTodo };
const difficultyDots: Record<QuestionDifficulty, string> = { recognition: "bg-emerald-600", comprehension: "bg-yellow-500", application: "bg-orange-500", advanced_application: "bg-red-600" };
function QuestionAnswerPreview({ question }: { question: QuestionBankQuestion }) {
  return <div className="min-w-0 space-y-4 text-sm [overflow-wrap:anywhere]">
    <QuestionImageView image={question.image} />
    {question.type === "essay_text" ? <p className="whitespace-pre-wrap text-secondary">{question.rubricText || "Tự luận: giáo viên chấm điểm."}</p> : question.type === "short_answer" ? <p className="font-bold text-emerald-800">Đáp án: {question.correctAnswer}</p> : question.type === "single_choice" || question.type === "multiple_choice" ? <div className="grid gap-2 sm:grid-cols-2">{question.options.map((option, index) => {
      const correct = question.type === "single_choice" ? question.correctOptionId === option.id : question.correctOptionIds.includes(option.id);
      return <p key={option.id} className={`whitespace-pre-wrap rounded-xl border p-3 leading-6 ${correct ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-line text-ink"}`}><strong>{String.fromCharCode(65 + index)}. </strong>{option.text}</p>;
    })}</div> : question.type === "true_false" ? <p className="font-bold text-emerald-800">{question.correctAnswer ? "Đúng" : "Sai"}</p> : <div className="space-y-2">{question.statements.map((statement, index) => <div key={statement.id} className="rounded-xl border border-line p-3"><p className="whitespace-pre-wrap leading-6"><strong>Ý {index + 1}. </strong>{statement.content}</p><p className="mt-1 font-bold text-emerald-800">{statement.correctAnswer ? "Đúng" : "Sai"}</p></div>)}</div>}
    {question.explanation && <p className="whitespace-pre-wrap border-t border-line pt-3 leading-6 text-secondary"><strong className="text-ink">Giải thích: </strong>{question.explanation}</p>}
  </div>;
}

export default function TeacherQuestionsPage() {
  const { bankQuestions, ready: bankReady, error: bankError, reload: reloadBank, revision, addQuestion, deleteQuestion } = useTeacherQuestions();
  const { session } = useAuth();
  const teacherId = session?.role === "teacher" ? session.userId : null;
  const [loadedPageQuestions, setPageQuestions] = useState<TeacherQuestion[]>([]);
  const [loadedTotal, setTotal] = useState(0);
  const [loadedPageCount, setPageCount] = useState(1);
  const [loadedFor, setLoadedFor] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [actionError, setActionError] = useState("");
  const actionPending = useRef(false);
  const [retry, setRetry] = useState(0);
  const [wordImportOpen, setWordImportOpen] = useState(false);
  const [importNotice, setImportNotice] = useState("");

  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const requestedChapter = params.get("chapter") ?? "all";
  const chapter = requestedChapter === "all" || geo10Chapters.some((item) => item.id === requestedChapter) ? requestedChapter : "all";
  const requestedLesson = params.get("lesson") ?? "all";
  const matchedLesson = lessonById.get(requestedLesson);
  const lesson = requestedLesson === "all" || (matchedLesson && (chapter === "all" || matchedLesson.chapterId === chapter)) ? requestedLesson : "all";
  const requestedType = params.get("type") ?? "all";
  const selectedType = Object.prototype.hasOwnProperty.call(questionTypeLabels, requestedType) ? requestedType : "all";
  const requestedDifficulty = params.get("difficulty") ?? "all";
  const difficulty = Object.prototype.hasOwnProperty.call(difficultyLabels, requestedDifficulty) ? requestedDifficulty : "all";
  const sort = ["newest", "lesson", "difficulty"].includes(params.get("sort") ?? "") ? params.get("sort")! : "newest";
  const queryKey = `${teacherId ?? ""}:${params.toString()}:${revision}:${retry}`;
  const pageQuestions = loadedFor === queryKey ? loadedPageQuestions : [];
  const total = loadedFor === queryKey ? loadedTotal : 0;
  const pageCount = loadedFor === queryKey ? loadedPageCount : 1;
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(() => {
    const state: unknown = location.state;
    if (!state || typeof state !== "object" || !("source" in state) || state.source !== "assignment-builder" || !("questionIds" in state) || !Array.isArray(state.questionIds)) return new Set();
    return new Set(state.questionIds.filter((id): id is string => typeof id === "string"));
  });

  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionBankQuestion | null>(
    null,
  );
  const previousTeacherId = useRef(teacherId);
  useEffect(() => {
    if (previousTeacherId.current === teacherId) return;
    const previous = previousTeacherId.current;
    previousTeacherId.current = teacherId;
    if (!previous) return;
    setPreviewQuestion(null);
    setSelectedQuestionIds(new Set());
    setImportNotice("");
    setActionError("");
  }, [teacherId]);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!openMenuId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;

      if (target.closest("[data-question-menu]")) {
        return;
      }

      setOpenMenuId(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openMenuId]);

  const chapters = geo10Chapters.map((item) => ({ id: item.id, label: `Chương ${item.number}. ${item.title}` }));
  const availableLessons = geo10Lessons.filter((item) => chapter === "all" || item.chapterId === chapter);
  const requestedPage = Number(params.get("page") ?? 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  useEffect(() => {
    let active = true;
    setPageQuestions([]); setLoadedFor(""); setListLoading(true); setListError("");
    if (!teacherId) { setListLoading(false); return () => { active = false; }; }
    void listTeacherQuestions({ page, perPage: 20, ...(search ? { q: search } : {}), ...(selectedType !== "all" ? { type: selectedType as QuestionType } : {}), ...(difficulty !== "all" ? { difficulty: difficulty as QuestionDifficulty } : {}), ...(lesson !== "all" ? { lessonId: lesson } : {}), ...(chapter !== "all" ? { chapterId: chapter } : {}), sort: sort as "newest" | "lesson" | "difficulty" })
      .then((response) => { if (!active) return; if (page > response.meta.last_page && response.meta.total > 0) { setParams((current) => { const next = new URLSearchParams(current); next.set("page", String(response.meta.last_page)); return next; }, { replace: true }); return; } setPageQuestions(response.data); setTotal(response.meta.total); setPageCount(Math.max(1, response.meta.last_page)); setLoadedFor(queryKey); })
      .catch((cause: unknown) => { if (active) setListError(cause instanceof Error ? cause.message : "Không tải được câu hỏi."); })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, [teacherId, page, search, selectedType, difficulty, lesson, chapter, sort, revision, retry, queryKey, setParams]);
  const firstPageButton = Math.max(1, Math.min(page - 1, pageCount - 2));
  const pageButtons = Array.from({ length: Math.min(3, pageCount) }, (_, index) => firstPageButton + index);
  const listPath = `/teacher/questions${params.size ? `?${params}` : ""}`;
  const hasFilters = !!search || chapter !== "all" || lesson !== "all" || selectedType !== "all" || difficulty !== "all" || sort !== "newest";
  function changeFilter(key: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === "all" || (key === "sort" && value === "newest")) next.delete(key); else next.set(key, value);
      next.delete("page"); if (key === "chapter") next.delete("lesson");
      return next;
    }, { replace: true });
  }
  function resetFilters() {
    setParams((current) => { const next = new URLSearchParams(current); for (const key of ["q", "chapter", "lesson", "type", "difficulty", "sort", "page"]) next.delete(key); return next; }, { replace: true });
  }
  function changePage(nextPage: number) {
    setParams((current) => { const next = new URLSearchParams(current); if (nextPage === 1) next.delete("page"); else next.set("page", String(nextPage)); return next; }, { replace: true });
    window.requestAnimationFrame(() => document.getElementById("question-bank-list")?.scrollIntoView({ block: "start" }));
  }
  useEffect(() => { setExpandedIds(new Set()); setOpenMenuId(null); }, [search, chapter, lesson, selectedType, difficulty, sort, page]);
  useEffect(() => {
    if (!bankReady) return;
    setSelectedQuestionIds((current) => { const next = new Set([...current].filter((id) => bankQuestions.some((item) => item.id === id && item.type !== "essay_text"))); return next.size === current.size ? current : next; });
  }, [bankQuestions, bankReady]);

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestionIds((current) => {
      const next = new Set(current);

      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }

      return next;
    });
  };

  const allPageSelected =
    pageQuestions.some((question) => question.type !== "essay_text") &&
    pageQuestions.filter((question) => question.type !== "essay_text").every((question) => selectedQuestionIds.has(question.id));

  const somePageSelected =
    pageQuestions.filter((question) => question.type !== "essay_text").some((question) =>
      selectedQuestionIds.has(question.id),
    ) && !allPageSelected;

  const toggleSelectAllPage = () => {
    setSelectedQuestionIds((current) => {
      const next = new Set(current);

      if (allPageSelected) {
        pageQuestions.filter((question) => question.type !== "essay_text").forEach((question) => {
          next.delete(question.id);
        });
      } else {
        pageQuestions.filter((question) => question.type !== "essay_text").forEach((question) => {
          next.add(question.id);
        });
      }

      return next;
    });
  };

  useEffect(() => {
    if (!selectAllCheckboxRef.current) return;

    selectAllCheckboxRef.current.indeterminate = somePageSelected;
  }, [somePageSelected]);

  const duplicateQuestion = async (question: TeacherQuestion) => {
    if (actionPending.current) return;
    actionPending.current = true; setActionError("");
    try { switch (question.type) {
      case "short_answer": {
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = question;
        await addQuestion({ ...input, image: question.image ? { ...question.image } : undefined });
        break;
      }
      case "single_choice": {
        const optionIdMap = new Map<string, string>();

        const options = question.options.map((option) => {
          const newId = window.crypto.randomUUID();

          optionIdMap.set(option.id, newId);

          return {
            id: newId,
            text: option.text,
          };
        });

        await addQuestion({
          type: "single_choice",
          content: question.content,
          image: question.image ? { ...question.image } : undefined,
          difficulty: question.difficulty,
          explanation: question.explanation,
          lessonId: question.lessonId,
          chapter: question.chapter,
          showInLesson: question.showInLesson,

          options,

          correctOptionId: optionIdMap.get(question.correctOptionId) ?? "",
        });

        break;
      }

      case "multiple_choice": {
        const optionIdMap = new Map<string, string>();

        const options = question.options.map((option) => {
          const newId = window.crypto.randomUUID();

          optionIdMap.set(option.id, newId);

          return {
            id: newId,
            text: option.text,
          };
        });

        await addQuestion({
          type: "multiple_choice",
          content: question.content,
          image: question.image ? { ...question.image } : undefined,
          difficulty: question.difficulty,
          explanation: question.explanation,
          lessonId: question.lessonId,
          chapter: question.chapter,
          showInLesson: question.showInLesson,

          options,

          correctOptionIds: question.correctOptionIds
            .map((id) => optionIdMap.get(id))
            .filter((id): id is string => Boolean(id)),
        });

        break;
      }

      case "true_false": {
        await addQuestion({
          type: "true_false",
          content: question.content,
          image: question.image ? { ...question.image } : undefined,
          difficulty: question.difficulty,
          explanation: question.explanation,
          lessonId: question.lessonId,
          chapter: question.chapter,
          showInLesson: question.showInLesson,

          correctAnswer: question.correctAnswer,
        });

        break;
      }

      case "true_false_group": {
        await addQuestion({
          type: "true_false_group",
          content: question.content,
          image: question.image ? { ...question.image } : undefined,
          difficulty: question.difficulty,
          explanation: question.explanation,
          lessonId: question.lessonId,
          chapter: question.chapter,
          showInLesson: question.showInLesson,

          statements: question.statements.map((statement) => ({
            id: window.crypto.randomUUID(),
            content: statement.content,
            correctAnswer: statement.correctAnswer,
          })),
        });

        break;
      }
      case "essay_text":
        await addQuestion({ type: "essay_text", lessonId: question.lessonId, difficulty: question.difficulty, content: question.content, image: question.image, explanation: question.explanation ?? undefined, showInLesson: question.showInLesson, rubricText: question.rubricText });
        break;
    }
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Không nhân bản được câu hỏi."); }
    finally { actionPending.current = false; }
  };

  async function removeQuestion(question: TeacherQuestion) {
    if (actionPending.current) return;
    actionPending.current = true; setActionError("");
    try { await deleteQuestion(question.id, question.version); }
    catch (cause) { setActionError(cause instanceof ApiError && cause.status === 409 ? "Câu hỏi đã được sửa ở nơi khác. Tải lại danh sách rồi thử lại." : cause instanceof Error ? cause.message : "Không xóa được câu hỏi."); }
    finally { actionPending.current = false; }
  }

  return (
    <>
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5 [overflow-wrap:anywhere]">
        {/* Tiêu đề */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">
              Ngân hàng câu hỏi
            </h1>

            <p className="mt-2 text-sm text-secondary">
              Tìm, rà soát và sử dụng lại câu hỏi theo bài học.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setWordImportOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-slate-50"><FileUp aria-hidden="true" className="size-4" />Nhập từ Word</button>
          <Link
            to="/teacher/questions/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-emerald px-5 text-sm font-extrabold text-white hover:bg-emerald/90"
          >
            <Plus className="size-4" />
            Thêm câu hỏi
          </Link>
          </div>
        </header>

        {importNotice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{importNotice}</p>}
        {actionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}
        {bankError && !listError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Chưa tải đủ câu hỏi để tạo bài tập. {bankError} <button type="button" onClick={() => { void reloadBank(); }} className="font-bold underline">Thử lại</button></p>}

        <section aria-label="Lọc ngân hàng câu hỏi" className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(12rem,1.7fr)_repeat(5,minmax(0,1fr))]">
            <label className="min-w-0 text-sm font-bold">Tìm câu hỏi<span className="relative mt-2 block"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary" /><input aria-label="Tìm câu hỏi" type="search" maxLength={100} value={search} onChange={(event) => changeFilter("q", event.target.value)} placeholder="Tìm theo nội dung câu hỏi" className="min-h-11 w-full min-w-0 rounded-xl border border-line pl-9 pr-3 font-normal" /></span></label>
            <button type="button" aria-expanded={mobileFiltersOpen} aria-controls="question-bank-filters" onClick={() => setMobileFiltersOpen((current) => !current)} className="min-h-11 self-end rounded-xl border border-line px-3 text-sm font-bold xl:hidden">Lọc và sắp xếp{hasFilters ? " · đang áp dụng" : ""} {mobileFiltersOpen ? "▴" : "▾"}</button>
            <div id="question-bank-filters" className={`${mobileFiltersOpen ? "grid" : "hidden"} gap-3 sm:col-span-2 sm:grid-cols-2 xl:contents`}>
              <label className="min-w-0 text-sm font-bold">Chương<select aria-label="Lọc chương" value={chapter} onChange={(event) => changeFilter("chapter", event.target.value)} className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-2 font-normal"><option value="all">Tất cả chương</option>{chapters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="min-w-0 text-sm font-bold">Bài học<select aria-label="Lọc bài học" value={lesson} onChange={(event) => changeFilter("lesson", event.target.value)} className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-2 font-normal"><option value="all">Tất cả bài học</option>{geo10Chapters.map((group) => { const lessons = availableLessons.filter((item) => item.chapterId === group.id); return lessons.length ? <optgroup key={group.id} label={`Chương ${group.number}. ${group.title}`}>{lessons.map((item) => <option key={item.id} value={item.id}>Bài {item.number}. {item.title}</option>)}</optgroup> : null; })}</select></label>
              <label className="min-w-0 text-sm font-bold">Loại câu<select aria-label="Lọc loại câu hỏi" value={selectedType} onChange={(event) => changeFilter("type", event.target.value)} className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-2 font-normal"><option value="all">Tất cả loại</option>{Object.entries(questionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="min-w-0 text-sm font-bold">Mức độ<select aria-label="Lọc mức độ" value={difficulty} onChange={(event) => changeFilter("difficulty", event.target.value)} className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-2 font-normal"><option value="all">Tất cả mức độ</option>{Object.entries(difficultyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="min-w-0 text-sm font-bold">Sắp xếp<select aria-label="Sắp xếp câu hỏi" value={sort} onChange={(event) => changeFilter("sort", event.target.value)} className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-2 font-normal"><option value="newest">Mới nhất</option><option value="lesson">Theo bài học</option><option value="difficulty">Theo mức độ</option></select></label>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">{!listLoading && !listError && <p className="text-secondary">{total} câu phù hợp</p>}<button type="button" disabled={!hasFilters && page === 1} onClick={resetFilters} className="min-h-11 rounded-lg px-2 font-bold text-emerald-800 disabled:opacity-40">Xóa bộ lọc</button></div>
        </section>
        <div id="question-bank-list" className="scroll-mt-24 rounded-2xl border border-line bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-ink">
              <input ref={selectAllCheckboxRef} type="checkbox" checked={allPageSelected} onChange={toggleSelectAllPage} disabled={!pageQuestions.some((item) => item.type !== "essay_text")} aria-label="Chọn tất cả câu trên trang này" className="size-4 accent-emerald" />
              {selectedQuestionIds.size ? `Đã chọn ${selectedQuestionIds.size} câu` : "Danh sách câu hỏi"}
            </label>
            {selectedQuestionIds.size > 0 && <div className="flex w-full items-center gap-2 sm:w-auto">
              <button type="button" aria-label="Bỏ chọn tất cả" onClick={() => setSelectedQuestionIds(new Set())} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold text-secondary transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
                <X aria-hidden="true" className="size-4" />Bỏ chọn
              </button>
              <Link to="/teacher/assignments/new" onClick={(event) => { if (!bankReady) event.preventDefault(); }} aria-disabled={!bankReady} state={{ source: "question-bank", questionIds: [...selectedQuestionIds], returnTo: listPath }} className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-center text-sm font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:flex-none sm:px-4">
                <ClipboardPlus aria-hidden="true" className="size-4 shrink-0" />Tạo bài tập từ {selectedQuestionIds.size} câu
              </Link>
            </div>}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-3 text-sm text-secondary">
            {!listLoading && !listError && <p role="status">Hiển thị {pageQuestions.length ? `${(page - 1) * 20 + 1}–${(page - 1) * 20 + pageQuestions.length}` : "0"}/{total} câu</p>}
            {selectedQuestionIds.size > 0 && <p>Lựa chọn được giữ khi đổi trang hoặc bộ lọc.</p>}
          </div>
        </div>

        {/* Danh sách */}
        {listLoading ? <p role="status" className="rounded-xl bg-white p-6">Đang tải câu hỏi…</p> : listError ? <div role="alert" className="rounded-xl border border-red-200 bg-white p-6"><p>{listError}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 min-h-11 rounded-xl border border-line px-4 font-bold">Thử lại</button></div> : pageQuestions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
            <CircleHelp className="mx-auto size-10 text-muted" />

            <p className="mt-4 font-bold text-ink">
              {total === 0 && !hasFilters
                ? "Ngân hàng câu hỏi đang trống"
                : "Không tìm thấy câu hỏi phù hợp"}
            </p>

            <p className="mt-2 text-sm text-secondary">
              {total === 0 && !hasFilters
                ? "Các câu hỏi của bạn sẽ xuất hiện tại đây."
                : "Thử thay đổi từ khóa hoặc bộ lọc."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-white shadow-sm">
            {pageQuestions.map((question) => {
              const isSelected = selectedQuestionIds.has(question.id);
              const linkedLesson = lessonById.get(question.lessonId ?? "");
              const TypeIcon = typeIcons[question.type];
              const expanded = expandedIds.has(question.id);

              return (
                <article
                  key={question.id}
                  className={`relative border-b border-line px-3 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl last:border-b-0 sm:px-4 ${isSelected
                      ? "bg-emerald-50/60 shadow-[inset_3px_0_0_#047857]"
                      : "hover:bg-slate-50"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleQuestionSelection(question.id)}
                      disabled={question.type === "essay_text"}
                      aria-label={`Chọn câu hỏi: ${question.content}`}
                      className="mt-3.5 size-4 shrink-0 rounded border-line accent-emerald"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3><button type="button" aria-label={`Xem đáp án: ${question.content}`} aria-expanded={expanded} aria-controls={`question-answer-${question.id}`} onClick={() => setExpandedIds((current) => { const next = new Set(current); if (next.has(question.id)) next.delete(question.id); else next.add(question.id); return next; })} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg text-left font-bold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"><span className="line-clamp-2">{question.content}</span><ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} /></button></h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-secondary">
                            <span className="inline-flex items-center gap-1.5"><TypeIcon aria-hidden="true" className="size-4" />{questionTypeLabels[question.type]}</span>
                            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`size-2 rounded-full ${difficultyDots[question.difficulty]}`} />{difficultyLabels[question.difficulty]}</span>
                            <span title={linkedLesson ? `Bài ${linkedLesson.number}. ${linkedLesson.title}` : question.chapter || "Chưa gắn bài học"} className="rounded-lg bg-canvas px-2 py-1">{linkedLesson ? `Bài ${linkedLesson.number}` : "Chưa rõ bài học"}</span>{!linkedLesson && question.chapter && <span>{question.chapter}</span>}
                            {question.image && <span className="inline-flex items-center gap-1.5"><ImageIcon aria-hidden="true" className="size-4" />Có ảnh tư liệu</span>}
                          </div>
                        </div>
                        <div data-question-menu className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId((current) =>
                                current === question.id ? null : question.id,
                              )
                            }
                            aria-label="Mở menu thao tác câu hỏi"
                            className="flex size-11 items-center justify-center rounded-lg text-xl font-bold text-secondary hover:bg-slate-100 hover:text-ink"
                          >
                            ⋯
                          </button>

                          {openMenuId === question.id && (
                            <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewQuestion(question);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-slate-50"
                              >
                                Xem trước
                              </button>

                              <Link
                                to={`/teacher/questions/${question.id}/edit?return=${encodeURIComponent(listPath)}`}
                                onClick={() => setOpenMenuId(null)}
                                className="flex w-full items-center px-4 py-2.5 text-sm font-medium text-ink hover:bg-slate-50"
                              >
                                Sửa
                              </Link>

                              <button
                                type="button"
                                onClick={() => {
                                  void duplicateQuestion(question);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-slate-50"
                              >
                                Nhân bản
                              </button>

                              <div className="my-1 border-t border-line" />

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);

                                  const confirmed = window.confirm(
                                    "Bạn có chắc muốn xóa câu hỏi này? Thao tác này không thể hoàn tác.",
                                  );

                                  if (confirmed) {
                                    void removeQuestion(question);
                                  }
                                }}
                                className="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                              >
                                Xóa
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {expanded && <div id={`question-answer-${question.id}`} role="region" aria-label={`Đáp án: ${question.content}`} className="mt-3 space-y-3 border-t border-line pt-4"><p className="whitespace-pre-wrap font-bold leading-7">{question.content}</p><QuestionAnswerPreview question={question} /></div>}

                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {total > 0 && <nav aria-label="Phân trang câu hỏi" className="flex flex-wrap items-center justify-center gap-2 py-2"><button type="button" aria-label="Trang câu hỏi trước" disabled={page === 1} onClick={() => changePage(page - 1)} className="min-h-11 min-w-11 rounded-xl border border-line bg-white px-3 text-sm disabled:opacity-40">‹</button>{pageButtons.map((value) => <button key={value} type="button" aria-label={`Trang câu hỏi ${value}`} aria-current={page === value ? "page" : undefined} onClick={() => changePage(value)} className={`min-h-11 min-w-11 rounded-xl border px-3 text-sm font-bold ${page === value ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-line bg-white"}`}>{value}</button>)}<button type="button" aria-label="Trang câu hỏi sau" disabled={page === pageCount} onClick={() => changePage(page + 1)} className="min-h-11 min-w-11 rounded-xl border border-line bg-white px-3 text-sm disabled:opacity-40">›</button><span className="text-sm text-secondary">Trang {page}/{pageCount}</span></nav>}
      </div>
      {wordImportOpen && <Suspense fallback={<p role="status" className="text-sm text-secondary">Đang mở công cụ nhập Word…</p>}><QuestionWordImportDialog onClose={() => setWordImportOpen(false)} onImported={(count) => { setWordImportOpen(false); setImportNotice(`Đã nhập và lưu ${count} câu hỏi vào ngân hàng.`); resetFilters(); }} /></Suspense>}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-line p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Xem trước câu hỏi
                </p>

                <h2 className="mt-1 text-lg font-extrabold text-ink">
                  {questionTypeLabels[previewQuestion.type]}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="rounded-lg px-3 py-2 text-sm font-bold text-secondary hover:bg-slate-100 hover:text-ink"
              >
                Đóng
              </button>
            </div>

            <div className="p-5">
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-secondary">
                  {difficultyLabels[previewQuestion.difficulty]}
                </span>

                <span className="rounded-full bg-emerald/10 px-2.5 py-1 text-emerald">
                  {previewQuestion.chapter ?? "Chưa phân loại"}
                </span>
              </div>

              <h3 className="mt-5 font-bold leading-7 text-ink">
                {previewQuestion.content}
              </h3>
              <QuestionAnswerPreview question={previewQuestion} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
