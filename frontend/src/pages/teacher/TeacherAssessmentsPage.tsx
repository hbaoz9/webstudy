import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from "lucide-react";
import { IconAction } from "../../components/common/IconAction";
import { ApiError } from "../../service/api/client";
import { QuestionImageView } from "../../components/questions/QuestionImage";
import TeacherCreateQuestionPage from "./TeacherCreateQuestionPage";
import { DistributionPanel } from "../../components/teacher/DistributionPanel";
import { listTeacherQuestions, getTeacherQuestion, type TeacherQuestion } from "../../service/api/questions";
import {
  createAssessment, createRevision, deleteAssessment, getAssessment, getRevision,
  listAssessments, publishRevision, saveDraft, updateAssessment, type Assessment, type AssessmentRevision,
  type DraftQuestion,
  type RevisionQuestion,
} from "../../service/api/assessments";

const button = "min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "min-h-11 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50";
const panel = "rounded-2xl border border-line bg-white p-4 shadow-card sm:p-6";
const questionsPerPage = 10;
type EditorRow = DraftQuestion & { label: string; sourceId: string; type: string; preview: RevisionQuestion["publicContent"]; pointInput: string };
type PendingInline = { revisionId: string; id: string; version: number };
const pendingKey = (revisionId: string) => `webstudy:assessment-inline:${revisionId}`;
function forgetPending(revisionId: string) {
  try { sessionStorage.removeItem(pendingKey(revisionId)); } catch { /* Storage may be unavailable. */ }
}

function displayPoints(value: string): string {
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function compactQuestion(value: string): string {
  const characters = Array.from(value.trim());
  return characters.length > 110 ? `${characters.slice(0, 110).join("")}…` : value.trim();
}

function sumPoints(rows: EditorRow[]): string {
  const units = rows.reduce((sum, row) => {
    const match = /^(\d+)(?:\.(\d{0,6}))?$/.exec(row.maxPoints);
    return match ? sum + BigInt(match[1]) * 1000000n + BigInt((match[2] ?? "").padEnd(6, "0")) : sum;
  }, 0n);
  return displayPoints(`${units / 1000000n}.${String(units % 1000000n).padStart(6, "0")}`);
}

function validPoints(rows: EditorRow[]): boolean {
  return rows.every(row => /^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(row.maxPoints)
    && Number(row.maxPoints) > 0);
}

function splitPreset(rows: EditorRow[], objectivePoints: number): EditorRow[] | null {
  const objective = rows.filter(row => row.type !== "essay_text");
  const essay = rows.filter(row => row.type === "essay_text");
  if (!objective.length || !essay.length) return null;
  const assign = (group: EditorRow[], totalUnits: bigint) => {
    const share = totalUnits / BigInt(group.length);
    const remainder = totalUnits % BigInt(group.length);
    return group.map((row, index) => {
      const units = share + (BigInt(index) < remainder ? 1n : 0n);
      const maxPoints = `${units / 1000000n}.${String(units % 1000000n).padStart(6, "0")}`;
      return [row.sourceId, { ...row, maxPoints, pointInput: displayPoints(maxPoints) }] as const;
    });
  };
  const allocated = new Map([...assign(objective, BigInt(objectivePoints) * 1000000n),
    ...assign(essay, BigInt(10 - objectivePoints) * 1000000n)]);
  return rows.map(row => allocated.get(row.sourceId) ?? row);
}

function snapshotRow(q: RevisionQuestion): EditorRow {
  return { revisionQuestionId: q.id, maxPoints: q.maxPoints,
    label: q.publicContent.content, sourceId: q.sourceQuestionId, type: q.type, preview: q.publicContent,
    pointInput: displayPoints(q.maxPoints) };
}

const typeLabels: Record<string, string> = {
  single_choice: "Chọn một đáp án", multiple_choice: "Chọn nhiều đáp án",
  true_false: "Đúng/Sai", true_false_group: "Đúng/Sai nhiều ý",
  short_answer: "Trả lời ngắn", essay_text: "Tự luận",
};

function errorText(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) return "Dữ liệu đã thay đổi hoặc không còn ở trạng thái cho phép. Hãy tải lại trước khi thử tiếp.";
  if (error instanceof ApiError && error.status === 422) return "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra câu hỏi và điểm.";
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

export default function TeacherAssessmentsPage() {
  const { assessmentId } = useParams();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get("classId");
  const classQuery = classId ? `?classId=${encodeURIComponent(classId)}` : "";
  const navigate = useNavigate();
  const [list, setList] = useState<Assessment[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listLastPage, setListLastPage] = useState(1);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [revision, setRevision] = useState<AssessmentRevision | null>(null);
  const [rows, setRows] = useState<EditorRow[]>([]);
  const [bank, setBank] = useState<TeacherQuestion[]>([]);
  const [bankPage, setBankPage] = useState(1);
  const [bankLastPage, setBankLastPage] = useState(1);
  const [bankQuery, setBankQuery] = useState("");
  const [bankType, setBankType] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState("");
  const [bankRetry, setBankRetry] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(searchParams.get("step") === "1" ? 1 : 2);
  const [editing, setEditing] = useState(searchParams.has("step") || searchParams.get("edit") === "1");
  const [publishedTab, setPublishedTab] = useState<"overview" | "content" | "grading" | "results">("overview");
  const [assignOpen, setAssignOpen] = useState(false);
  const skipSavedNavigationBlock = useRef(false);
  const [editorQuery, setEditorQuery] = useState("");
  const [reviewQuery, setReviewQuery] = useState("");
  const [editorPage, setEditorPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [editorExpanded, setEditorExpanded] = useState<string[]>([]);
  const [reviewExpanded, setReviewExpanded] = useState<string[]>([]);
  const inlineRef = useRef<HTMLElement | null>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const retryRunning = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved");
  const [changedSources, setChangedSources] = useState<string[]>([]);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineDirty, setInlineDirty] = useState(false);
  const [distributionDirty, setDistributionDirty] = useState(false);
  const [pendingInline, setPendingInline] = useState<PendingInline | null>(null);
  const publishKey = useRef<{ revisionId: string; version: number; key: string } | null>(null);
  const sourceCheckGeneration = useRef(0);

  const displayRevision = useCallback((detail: AssessmentRevision) => {
    const generation = ++sourceCheckGeneration.current;
    setRevision(detail);
    if (detail.status === "published") { setStep(3); setPublishedTab("overview"); }
    setAssignOpen(false);
    setTitle(detail.title); setInstructions(detail.instructions ?? "");
    setRows((detail.questions ?? []).map(snapshotRow));
    setSaveState("saved");
    setChangedSources([]);
    void Promise.all((detail.questions ?? []).map(async q => {
      try { const source = await getTeacherQuestion(q.sourceQuestionId); return source.version !== q.sourceQuestionVersion ? q.id : ""; }
      catch { return q.id; }
    })).then(changed => { if (sourceCheckGeneration.current === generation) setChangedSources(changed.filter(Boolean)); });
  }, []);

  useEffect(() => () => { sourceCheckGeneration.current += 1; }, []);

  const reload = useCallback(async () => {
    setLoading(true); setError(""); setRevision(null);
    try {
      if (assessmentId) {
        const item = await getAssessment(assessmentId);
        setAssessment(item);
        setAssessmentTitle(item.title);
        const active = item.revisions?.find(r => r.status === "draft") ?? item.revisions?.[item.revisions.length - 1];
        if (active) {
          const detail = await getRevision(active.id);
          await displayRevision(detail);
        }
      } else {
        const page = await listAssessments(listPage);
        setList(page.data); setListLastPage(page.meta.lastPage);
      }
    } catch (cause) { setError(errorText(cause)); }
    finally { setLoading(false); }
  }, [assessmentId, displayRevision, listPage]);

  async function retryReload() {
    if (retryRunning.current || loading) return;
    retryRunning.current = true;
    try { await reload(); }
    finally { retryRunning.current = false; }
  }

  useEffect(() => {
    if (assessmentId) {
      setStep(searchParams.get("step") === "1" ? 1 : 2);
      setEditing(searchParams.has("step") || searchParams.get("edit") === "1");
    }
    // A new assessment ID starts a new editor; moving between steps never writes to the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!revision?.id) { setPendingInline(null); return; }
    try {
      const saved = JSON.parse(sessionStorage.getItem(pendingKey(revision.id)) ?? "null") as PendingInline | null;
      setPendingInline(saved?.revisionId === revision.id && typeof saved.id === "string" && Number.isInteger(saved.version) && saved.version >= 1 ? saved : null);
    } catch { setPendingInline(null); }
  }, [revision?.id]);
  useEffect(() => {
    if (!assessmentId || revision?.status !== "draft") return;
    let current = true;
    setBankLoading(true); setBankError("");
    listTeacherQuestions({ page: bankPage, perPage: 20, q: bankQuery || undefined,
      type: bankType ? bankType as NonNullable<Parameters<typeof listTeacherQuestions>[0]>["type"] : undefined }).then(page => {
      if (current) { setBank(page.data); setBankLastPage(page.meta.last_page); }
    }).catch(() => { if (current) { setBank([]); setBankError("Không thể tải Ngân hàng câu hỏi. Vui lòng thử lại."); } })
      .finally(() => { if (current) setBankLoading(false); });
    return () => { current = false; };
  }, [assessmentId, revision?.status, bankPage, bankQuery, bankType, bankRetry]);
  useEffect(() => {
    if (!inlineOpen || bankOpen || step !== 2) return;
    inlineRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    inlineRef.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
  }, [inlineOpen, bankOpen, step]);

  const total = useMemo(() => sumPoints(rows), [rows]);
  const questionQuery = step === 3 ? reviewQuery : editorQuery;
  const currentPage = step === 3 ? reviewPage : editorPage;
  const expandedQuestions = step === 3 ? reviewExpanded : editorExpanded;
  const filteredQuestions = useMemo(() => rows.map((row, index) => ({ row, index })).filter(({ row }) =>
    `${row.label} ${typeLabels[row.type] ?? ""}`.toLocaleLowerCase("vi").includes(questionQuery.trim().toLocaleLowerCase("vi"))), [rows, questionQuery]);
  const questionPageCount = Math.max(1, Math.ceil(filteredQuestions.length / questionsPerPage));
  const visiblePage = Math.min(currentPage, questionPageCount);
  const visibleQuestions = filteredQuestions.slice((visiblePage - 1) * questionsPerPage, visiblePage * questionsPerPage);
  const allVisibleExpanded = visibleQuestions.length > 0 && visibleQuestions.every(({ row }) => expandedQuestions.includes(row.sourceId));
  const dirty = revision?.status === "draft" && (title !== revision.title || instructions !== (revision.instructions ?? "") ||
    JSON.stringify(rows.map(row => ({ sourceId: row.sourceId, maxPoints: row.maxPoints }))) !==
    JSON.stringify((revision.questions ?? []).map(q => ({ sourceId: q.sourceQuestionId, maxPoints: q.maxPoints }))));
  const unsaved = Boolean(dirty || inlineDirty || pendingInline || distributionDirty || (assessment && assessmentTitle !== assessment.title));
  const saveLabel = saveState === "saving" ? "Đang lưu" : saveState === "failed" ? "Lưu thất bại" : unsaved ? "Chưa lưu thay đổi" : "Đã lưu trên máy chủ";
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !skipSavedNavigationBlock.current && unsaved && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("Bạn có thay đổi chưa lưu. Rời trang?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!unsaved) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [unsaved]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); await reload(); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  function saveCurrentDraft() {
    if (!revision || revision.status !== "draft" || busy || pendingInline || !title.trim()) return;
    if (!validPoints(rows)) { setError("Điểm mỗi câu phải lớn hơn 0, tối đa 6 chữ số thập phân. Kiểm tra trước khi lưu."); return; }
    setBusy(true); setSaveState("saving"); setError(""); setNotice("");
    void saveDraft(revision.id, revision.version, title, instructions, draftPayload(rows)).then(async saved => {
      await displayRevision(saved);
      setNotice("Đã lưu bản nháp trên máy chủ.");
      if (!inlineDirty && !pendingInline && !distributionDirty && assessmentTitle === assessment?.title) {
        setEditing(false);
        skipSavedNavigationBlock.current = true;
        navigate(`/teacher/assessments/${encodeURIComponent(assessmentId!)}${classQuery}`, { replace: true });
        queueMicrotask(() => { skipSavedNavigationBlock.current = false; });
      }
    }).catch(cause => { setSaveState("failed"); setError(errorText(cause)); })
      .finally(() => setBusy(false));
  }

  function publishCurrentDraft() {
    if (!revision || revision.status !== "draft" || busy || dirty || !revision.questions?.length) return;
    if (!validPoints(rows)) { setError("Điểm của từng câu chưa hợp lệ. Kiểm tra trước khi hoàn tất đề."); return; }
    if (!window.confirm("Hoàn tất đề đã lưu? Nội dung, đáp án và điểm sẽ không thể sửa.")) return;
    if (publishKey.current?.revisionId !== revision.id || publishKey.current.version !== revision.version) {
      publishKey.current = { revisionId: revision.id, version: revision.version, key: crypto.randomUUID() };
    }
    const key = publishKey.current.key;
    void run(async () => { await publishRevision(revision.id, revision.version, key); publishKey.current = null; }, "Đề đã hoàn tất.");
  }

  function questionRow(question: TeacherQuestion): EditorRow {
    const preview: RevisionQuestion["publicContent"] = {
      content: question.content,
      ...(question.image ? { image: question.image } : {}),
      ...("options" in question ? { options: question.options } : {}),
      ...("statements" in question ? { statements: question.statements.map(({ id, content }) => ({ id, content })) } : {}),
    };
    return { sourceQuestionId: question.id, sourceQuestionVersion: question.version,
      maxPoints: "1.000000", label: question.content, sourceId: question.id, type: question.type, preview, pointInput: "1" };
  }

  function addQuestion(question: TeacherQuestion) {
    if (busy) return;
    setRows(current => current.some(row => row.sourceId === question.id) ? current : [...current, questionRow(question)]);
    setNotice("Câu hỏi đã được chọn. Nhấn Lưu bản nháp để tạo snapshot trên máy chủ.");
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    if (busy) return;
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    setRows(current => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    if (!editorQuery.trim()) setEditorPage(Math.floor(target / questionsPerPage) + 1);
  }

  const draftPayload = (items: EditorRow[]) => items.map(row =>
    "revisionQuestionId" in row ? { revisionQuestionId: row.revisionQuestionId, maxPoints: row.maxPoints }
      : { sourceQuestionId: row.sourceQuestionId, sourceQuestionVersion: row.sourceQuestionVersion, maxPoints: row.maxPoints });

  async function createInlineQuestion(question: TeacherQuestion) {
    if (!revision || rows.some(row => row.sourceId === question.id)) return;
    const next = [...rows, questionRow(question)];
    const pending = { revisionId: revision.id, id: question.id, version: question.version };
    try { sessionStorage.setItem(pendingKey(revision.id), JSON.stringify(pending)); } catch { /* In-memory recovery remains available. */ }
    setRows(next); setPendingInline(pending); setInlineOpen(false); setBusy(true); setSaveState("saving"); setError("");
    try {
      await saveDraft(revision.id, revision.version, title, instructions, draftPayload(next));
      setSaveState("saved"); forgetPending(revision.id); setPendingInline(null); setNotice("Đã tạo câu hỏi và lưu vào bản nháp.");
      await reload();
    } catch (cause) {
      setSaveState("failed");
      setError(`${errorText(cause)} Câu hỏi đã lưu trong Ngân hàng và vẫn ở danh sách soạn; dùng “Kiểm tra và thêm lại” để tiếp tục, không tạo câu mới.`);
    } finally { setBusy(false); }
  }

  async function recoverInlineQuestion() {
    if (!revision || !pendingInline || busy) return;
    setBusy(true); setSaveState("saving"); setError("");
    try {
      const fresh = await getRevision(revision.id);
      const persisted = fresh.questions?.find(question => question.sourceQuestionId === pendingInline.id);
      if (persisted) {
        forgetPending(revision.id); setPendingInline(null); setRevision(fresh); setSaveState("saved");
        setRows(current => current.some(row => row.sourceId === pendingInline.id)
          ? current.map(row => row.sourceId === pendingInline.id ? snapshotRow(persisted) : row)
          : [...current, snapshotRow(persisted)]);
        setNotice("Câu hỏi đã có trong bản nháp."); return;
      }
      if (fresh.version !== revision.version) {
        setSaveState("failed");
        setError("Bản nháp đã thay đổi ở nơi khác. Câu hỏi mới vẫn được giữ; kiểm tra các thay đổi trước khi lưu lại.");
        return;
      }
      const source = rows.some(row => row.sourceId === pendingInline.id) ? null : await getTeacherQuestion(pendingInline.id);
      if (source && (source.id !== pendingInline.id || source.version !== pendingInline.version)) {
        throw new ApiError("Câu hỏi nguồn đã thay đổi. Kiểm tra Ngân hàng trước khi thêm lại.", 409);
      }
      const next = source ? [...rows, { ...questionRow(source), sourceQuestionVersion: pendingInline.version }] : rows;
      const saved = await saveDraft(fresh.id, fresh.version, title, instructions, draftPayload(next));
      forgetPending(revision.id); setPendingInline(null); await displayRevision(saved);
      setNotice("Đã thêm câu hỏi vào bản nháp.");
    } catch (cause) { setSaveState("failed"); setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  if (!assessmentId) return <main className="space-y-5 p-4 sm:p-6">
    <header><h1 className="text-2xl font-bold text-ink">Bài tập & Kiểm tra</h1><p className="text-sm text-secondary">Soạn đề, lưu bản nháp và hoàn tất đề trước khi giao bài.</p></header>
    {classId && <p className={panel}>Đang soạn từ trang lớp. Ngữ cảnh lớp sẽ được giữ cho bước Giao bài sau này.</p>}
    <form className={panel} onSubmit={event => { event.preventDefault(); if (!newTitle.trim() || busy) return;
      setBusy(true); setError("");
      void createAssessment(newTitle.trim(), "").then(created => {
        navigate(`/teacher/assessments/${encodeURIComponent(created.id)}${classId ? `${classQuery}&step=1` : "?step=1"}`);
      }).catch(cause => setError(errorText(cause))).finally(() => setBusy(false)); }}>
      <div className="flex flex-wrap items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Plus size={22} aria-hidden="true" /></span><div><h2 className="font-bold">Tạo đề mới</h2><p className="text-sm text-secondary">Lưu để dùng sau, chưa cần chọn lớp.</p></div></div>
      <label className="mt-4 block text-sm font-semibold" htmlFor="assessment-new-title">Tên đề</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id="assessment-new-title" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3" value={newTitle} onChange={event => setNewTitle(event.target.value)} maxLength={255} required placeholder="Ví dụ: Ôn tập Địa lí tự nhiên" />
        <button className={button} disabled={busy}>Bắt đầu soạn</button></div>
    </form>
    {loading && <p role="status">Đang tải bộ đề...</p>}
    {error && <div role="alert" className={panel}><p>{error}</p><button className={secondary} onClick={() => void reload()}>Thử lại</button></div>}
    {notice && <p role="status">{notice}</p>}
    {!loading && !error && <section className="space-y-3"><h2 className="text-lg font-bold">Đề của tôi</h2>{list.length === 0 ? <p>Chưa có đề nào.</p> : list.map(item =>
      <div key={item.id} className={`${panel} flex flex-wrap items-center justify-between gap-3`}><div><h3 className="font-semibold">{item.title}</h3><p className="text-xs text-secondary">{item.revisions ? `${item.revisions.some(r => r.status === "draft") ? "Bản nháp" : "Đề đã hoàn tất"} · ${item.revisions.length} phiên bản` : "Mở để xem bản nháp và các phiên bản"}</p></div><Link className={secondary} to={`/teacher/assessments/${encodeURIComponent(item.id)}${classQuery}`}>Mở đề</Link></div>)}
      {listLastPage > 1 && <div className="flex items-center gap-2"><button className={secondary} disabled={listPage <= 1} onClick={() => setListPage(p => p - 1)}>Trước</button><span>Trang {listPage}/{listLastPage}</span><button className={secondary} disabled={listPage >= listLastPage} onClick={() => setListPage(p => p + 1)}>Sau</button></div>}</section>}
    <DistributionPanel classId={classId} initialDistributionId={searchParams.get("distribution")} />
    <div className={panel}><Link to="/teacher/assignments" className="text-sm font-semibold text-secondary underline">Mở bài tập cũ (dữ liệu mẫu trên thiết bị)</Link><p className="mt-1 text-xs text-secondary">Chức năng cũ được giữ riêng, chưa kết nối giao bài thật.</p></div>
  </main>;

  if (revision?.status === "draft" && !editing && !loading) return <main className="space-y-5 p-4 sm:p-6">
    <Link to={`/teacher/assessments${classQuery}`} className="text-sm font-semibold text-emerald-700">← Danh sách bộ đề</Link>
    <header className={panel}><p className="text-sm text-amber-700">Bản nháp · Phiên bản {revision.revisionNo}</p>
      <h1 className="mt-1 text-2xl font-bold">{revision.title}</h1>
      <p className="mt-2 text-sm text-secondary">{revision.questions?.length ?? 0} câu · Tổng điểm đã lưu {displayPoints(revision.totalPoints)}. Chưa giao cho học sinh.</p>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={button} onClick={() => { setEditing(true); setStep(2); }}>Tiếp tục soạn</button>
        <button type="button" className={secondary} onClick={() => { setEditing(true); setStep(3); }}>Xem lại & hoàn tất đề</button></div>
    </header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <section className={panel}><h2 className="text-lg font-bold">Câu hỏi đã lưu</h2>
      <ol className="mt-3 space-y-2">{rows.slice(0, 10).map((row, index) => <li key={row.sourceId} className="rounded-xl border border-line p-3 text-sm">
        Câu {index + 1}. {compactQuestion(row.label)} · {displayPoints(row.maxPoints)} điểm</li>)}</ol>
      {rows.length > 10 && <p className="mt-2 text-sm text-secondary">Và {rows.length - 10} câu khác. Mở trình soạn để xem toàn bộ.</p>}
    </section>
    <details className={panel}><summary className="cursor-pointer font-semibold">Chỉnh sửa / Quản lý phiên bản</summary>
      <ul className="mt-3 space-y-2">{assessment?.revisions?.map(item => <li key={item.id}><button className={secondary} disabled={busy} onClick={() => {
        if (unsaved && !window.confirm("Có thay đổi chưa lưu. Chuyển phiên bản và bỏ thay đổi này?")) return;
        setBusy(true); void getRevision(item.id).then(displayRevision).catch(cause => setError(errorText(cause))).finally(() => setBusy(false));
      }}>Phiên bản {item.revisionNo} · {item.status === "draft" ? "Bản nháp" : "Đề đã hoàn tất"}</button></li>)}</ul>
    </details>
  </main>;

  if (revision?.status === "published" && !loading) return <main className="space-y-5 p-4 sm:p-6">
    <Link to={`/teacher/assessments${classQuery}`} className="text-sm font-semibold text-emerald-700">← Danh sách bộ đề</Link>
    <header className={panel}><p className="text-sm text-emerald-700">Đề đã hoàn tất · Phiên bản {revision.revisionNo}</p>
      <h1 className="mt-1 text-2xl font-bold">{revision.title}</h1>
      <p className="mt-2 text-sm text-secondary">{revision.questions?.length ?? 0} câu · Tổng điểm {displayPoints(revision.totalPoints)} · Hoàn tất {revision.publishedAt ? new Date(revision.publishedAt).toLocaleString("vi-VN") : ""}. Nội dung và điểm đã đóng băng.</p>
      <button type="button" className={`${button} mt-4`} aria-expanded={assignOpen} onClick={() => { setPublishedTab("overview"); setAssignOpen(value => !value); }}>Giao bài cho lớp</button>
    </header>
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1" role="tablist" aria-label="Chi tiết đề đã hoàn tất">
      {([['overview', 'Tổng quan'], ['content', 'Nội dung đề'], ['grading', 'Chấm bài'], ['results', 'Kết quả']] as const).map(([value, label]) =>
        <button key={value} type="button" role="tab" aria-selected={publishedTab === value}
          className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold sm:px-5 ${publishedTab === value ? "bg-emerald-700 text-white" : "text-secondary hover:bg-slate-50"}`}
          onClick={() => { if (distributionDirty && !window.confirm("Thiết lập giao bài chưa lưu sẽ mất khi chuyển tab. Tiếp tục?")) return; setAssignOpen(false); setPublishedTab(value); }}>{label}</button>)}
    </nav>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {publishedTab === "overview" && <section className={`${panel} space-y-3`} aria-label="Tổng quan đề đã hoàn tất">
      <h2 className="text-lg font-bold">Tổng quan</h2>
      <p className="text-sm text-secondary">Phiên bản {revision.revisionNo} · {revision.questions?.length ?? 0} câu · Tổng điểm {displayPoints(revision.totalPoints)}. Có thể giao cùng đề cho nhiều lớp; mỗi đợt có lịch và kết quả riêng.</p>
      <DistributionPanel key={assessmentId} assessmentId={assessmentId} revisionId={revision.id} classId={classId} onDirtyChange={setDistributionDirty} onCreated={() => setAssignOpen(false)} showForm={assignOpen} />
    </section>}
    {publishedTab === "content" && <section className={panel} aria-label="Xem đề đã hoàn tất">
      <h2 className="text-lg font-bold">Xem đề</h2>
      {revision.instructions && <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{revision.instructions}</p>}
      <input aria-label="Tìm câu hỏi trong đề đã hoàn tất" className="mt-4 min-h-11 w-full rounded-xl border border-line px-3" placeholder="Tìm câu hỏi" value={reviewQuery}
        onChange={event => { setReviewQuery(event.target.value); setReviewPage(1); }} />
      <ol className="mt-3 space-y-2">{visibleQuestions.map(({ row, index }) => <li key={row.sourceId} className="rounded-xl border border-line p-3">
        <details><summary className="cursor-pointer font-semibold">Câu {index + 1}. {compactQuestion(row.label)} · {displayPoints(row.maxPoints)} điểm</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm">{row.label}</p>
          {row.preview.image && <QuestionImageView image={row.preview.image} />}
          {row.preview.options?.map((option, position) => <p key={option.id} className="text-sm">{String.fromCharCode(65 + position)}. {option.text}</p>)}
          {row.preview.statements?.map((statement, position) => <p key={statement.id} className="text-sm">Ý {position + 1}. {statement.content}</p>)}
        </details>
      </li>)}</ol>
      {filteredQuestions.length === 0 && <p className="mt-3 text-sm text-secondary">Không có câu hỏi phù hợp.</p>}
      {questionPageCount > 1 && <div className="mt-3 flex items-center gap-2"><button className={secondary} disabled={visiblePage <= 1} onClick={() => setReviewPage(visiblePage - 1)}>Trước</button>
        <span>Trang {visiblePage}/{questionPageCount}</span><button className={secondary} disabled={visiblePage >= questionPageCount} onClick={() => setReviewPage(visiblePage + 1)}>Sau</button></div>}
    </section>}
    {(publishedTab === "grading" || publishedTab === "results") && <section className="space-y-3" aria-label="Chọn đợt giao">
      <p className="text-sm text-secondary">Chọn đúng đợt giao và lớp để {publishedTab === "grading" ? "chấm bài" : "xem kết quả"}. Mỗi đợt có dữ liệu riêng.</p>
      <DistributionPanel key={`${assessmentId}-${publishedTab}`} assessmentId={assessmentId} classId={classId} showForm={false} targetTab={publishedTab} />
    </section>}
    {publishedTab === "overview" && <details className={panel}><summary className="cursor-pointer font-semibold">Chỉnh sửa / Quản lý phiên bản</summary>
      <p className="mt-2 text-sm text-secondary">Muốn đổi câu hỏi hoặc điểm, hãy tạo bản nháp mới. Đề đã hoàn tất và bài đã giao giữ nguyên.</p>
      <div className="mt-3 flex flex-wrap gap-2"><button className={secondary} disabled={busy} onClick={() => {
        if (unsaved && !window.confirm("Có thay đổi chưa lưu. Tiếp tục tạo phiên bản mới?")) return;
        void run(() => createRevision(assessmentId, revision.id), "Đã tạo bản nháp từ đề này.");
      }}>Tạo bản nháp từ đề này</button>
        <button className={secondary} disabled={busy} onClick={() => {
          if (unsaved && !window.confirm("Có thay đổi chưa lưu. Tiếp tục tạo phiên bản mới?")) return;
          void run(() => createRevision(assessmentId), "Đã tạo bản nháp trống.");
        }}>Tạo bản nháp trống</button></div>
      <ul className="mt-3 space-y-2">{assessment?.revisions?.map(item => <li key={item.id}><button className={secondary} disabled={busy} onClick={() => {
        if (unsaved && !window.confirm("Có thay đổi chưa lưu. Chuyển phiên bản và bỏ thay đổi này?")) return;
        setBusy(true); void getRevision(item.id).then(displayRevision).catch(cause => setError(errorText(cause))).finally(() => setBusy(false));
      }}>Phiên bản {item.revisionNo} · {item.status === "draft" ? "Bản nháp" : "Đề đã hoàn tất"}</button></li>)}</ul>
    </details>}
  </main>;

  const editable = revision?.status === "draft";
  return <main className="space-y-5 p-4 sm:p-6">
    <Link to={`/teacher/assessments${classQuery}`} className="text-sm font-semibold text-emerald-700">← Danh sách bộ đề</Link>
    <header><h1 className="text-2xl font-bold text-ink">{assessment?.title ?? "Bộ đề"}</h1>
      <p className="text-sm text-secondary">{revision ? `Phiên bản ${revision.revisionNo} · ${editable ? "Bản nháp" : "Đề đã hoàn tất"}` : "Đang tải"}</p></header>
    {classId && <p className="text-sm text-secondary">Ngữ cảnh lớp được giữ trong đường dẫn; chưa giao bài cho lớp.</p>}
    {loading && <p role="status">Đang tải bộ đề...</p>}
    {error && <div role="alert" className={`${panel} flex items-center justify-between gap-3`}><p>{error}</p><IconAction icon={RefreshCw} label="Tải lại bộ đề" loading={loading} onClick={() => void retryReload()} /></div>}
    {notice && <p role="status">{notice}</p>}
    {pendingInline && <div role="alert" className={panel}><p>Câu hỏi đã lưu vào Ngân hàng nhưng chưa xác nhận trong bản nháp. Không tạo lại câu hỏi này.</p><button type="button" className={secondary} disabled={busy} onClick={() => void recoverInlineQuestion()}>Kiểm tra và thêm lại</button></div>}
    {revision?.status === "draft" && !loading && <p role="status" aria-label="Trạng thái lưu bản nháp" className={`text-sm font-semibold ${saveState === "failed" ? "text-red-700" : "text-secondary"}`}>{saveLabel}</p>}
    {revision && !loading && <>
      <nav aria-label="Các bước soạn đề" className={`${panel} grid gap-2 sm:grid-cols-3`}>
        {(["Thông tin", "Soạn câu hỏi", "Xem lại & hoàn tất"] as const).map((label, index) => {
          const value = (index + 1) as 1 | 2 | 3;
          return <button type="button" key={label} aria-current={step === value ? "step" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold ${step === value ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-line bg-white text-secondary"}`}
            onClick={() => setStep(value)}><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs">{value}</span>{label}</button>;
        })}
      </nav>
      {step === 1 && <div className="grid items-start gap-4 lg:grid-cols-2">
      <section className={panel}><h2 className="text-lg font-bold">Trong thư viện</h2><p className="mt-1 text-sm text-secondary">Tên để tìm lại đề; có thể khác tên hiển thị cho học sinh.</p><label className="mt-4 block text-sm font-semibold" htmlFor="assessment-title">Tên trong thư viện</label>
        <div className="mt-2 flex flex-wrap gap-2"><input id="assessment-title" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3" value={assessmentTitle} maxLength={255} onChange={event => setAssessmentTitle(event.target.value)} />
          <button className={secondary} disabled={busy || dirty || !assessmentTitle.trim() || assessmentTitle === assessment?.title} onClick={() => {
            if (assessment) void run(() => updateAssessment(assessment.id, assessmentTitle, assessment.version), "Đã cập nhật tên bộ đề trong thư viện.");
          }}>Lưu tên bộ đề</button></div>
      </section>
      <section className={panel}><h2 className="mb-4 text-lg font-bold">Thông tin đề</h2>
        <div className="grid gap-3"><label className="text-sm font-semibold" htmlFor="revision-title">Tên đề</label>
          <input id="revision-title" className="min-h-11 rounded-xl border border-line px-3" value={title} disabled={!editable || busy} onChange={event => setTitle(event.target.value)} />
          <label className="text-sm font-semibold" htmlFor="revision-instructions">Hướng dẫn</label>
          <textarea id="revision-instructions" className="min-h-24 rounded-xl border border-line p-3" value={instructions} disabled={!editable || busy} onChange={event => setInstructions(event.target.value)} /></div>
        <p className="mt-3 text-sm text-secondary">{rows.length} câu · Tổng điểm nháp: {total}. Máy chủ tính lại khi lưu.</p>
      </section>
      </div>}
      {(step === 2 || step === 3) && <section className={panel}><h2 className="text-lg font-bold">{step === 2 ? "Câu hỏi trong đề" : "Xem lại toàn bộ đề"}</h2>
        {step === 2 && <><p className="mt-1 text-sm text-secondary">{rows.length} câu · Tổng điểm nháp: {total}</p>
          {editable && <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Phân bổ điểm trên thang 10">
            <span className="text-sm font-semibold">Chia điểm nhanh (trắc nghiệm – tự luận):</span>
            {[5, 6, 7].map(value => <button key={value} type="button" className={secondary} disabled={busy || !rows.some(row => row.type === "essay_text") || !rows.some(row => row.type !== "essay_text")}
              onClick={() => { const allocated = splitPreset(rows, value); if (allocated) setRows(allocated); }}>
              {value}–{10 - value}</button>)}
            <span className="text-xs text-secondary">Có thể chỉnh điểm từng câu; lưu nháp để máy chủ xác nhận tổng.</span>
          </div>}
        </>}
        {step === 3 && <div className="mt-3 rounded-xl bg-slate-50 p-4"><h3 className="text-lg font-bold">{title}</h3>{instructions && <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{instructions}</p>}<p className="mt-2 text-sm font-semibold">{rows.length} câu · Tổng điểm: {total}</p></div>}
        {changedSources.length > 0 && <p role="alert" className="mt-2 text-amber-700">{changedSources.length} câu trong Ngân hàng đã thay đổi hoặc bị xóa. Bản sao trong đề vẫn giữ nguyên.</p>}
        {rows.length === 0 && <p className="mt-3 text-sm text-secondary">Chưa có câu hỏi.</p>}
        {rows.length > 0 && <>
          <div className="mt-4 flex flex-wrap items-center gap-2"><input aria-label={step === 2 ? "Tìm câu hỏi trong đề" : "Tìm câu hỏi khi xem lại"} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3" placeholder="Tìm trong toàn bộ đề" value={questionQuery} onChange={event => {
            if (step === 2) { setEditorQuery(event.target.value); setEditorPage(1); }
            else { setReviewQuery(event.target.value); setReviewPage(1); }
          }} />
            {step === 3 && visibleQuestions.length > 0 && <button type="button" className={secondary} onClick={() => {
              setReviewExpanded(current => allVisibleExpanded ? current.filter(id => !visibleQuestions.some(({ row }) => row.sourceId === id))
                : [...new Set([...current, ...visibleQuestions.map(({ row }) => row.sourceId)])]);
            }}>{allVisibleExpanded ? "Thu gọn trang này" : "Mở tất cả trang này"}</button>}
          </div>
          {filteredQuestions.length === 0 ? <p className="mt-3 text-sm text-secondary">Không tìm thấy câu hỏi phù hợp trong đề.</p> : <>
            <p className="mt-2 text-sm text-secondary">Hiển thị {visibleQuestions.length} / {filteredQuestions.length} câu phù hợp · Trang {visiblePage}/{questionPageCount}</p>
            <ol className="mt-3 space-y-2" aria-label={step === 2 ? "Câu hỏi trong đề" : "Câu hỏi xem lại"}>{visibleQuestions.map(({ row, index }) => {
              const expanded = expandedQuestions.includes(row.sourceId);
              return <li key={row.sourceId} className="rounded-xl border border-line p-3" data-question-number={index + 1}>
                <button type="button" className="flex w-full min-w-0 items-start justify-between gap-3 text-left" aria-expanded={expanded} aria-label={`Câu ${index + 1}: ${expanded ? "Thu gọn" : "Mở chi tiết"}`} onClick={() => {
                  const setExpanded = step === 2 ? setEditorExpanded : setReviewExpanded;
                  setExpanded(current => current.includes(row.sourceId) ? current.filter(id => id !== row.sourceId) : [...current, row.sourceId]);
                }}><span className="min-w-0 break-words font-semibold">Câu {index + 1}. {compactQuestion(row.label)}</span><span className="shrink-0 text-xs text-emerald-700">{expanded ? "Thu gọn" : "Xem"}</span></button>
                <p className="mt-1 text-xs text-secondary">{typeLabels[row.type] ?? "Câu hỏi"} · {displayPoints(row.maxPoints)} điểm</p>
                {expanded && <div className="mt-3 space-y-1 border-t border-line pt-3"><p className="whitespace-pre-wrap text-sm">{row.label}</p>
                  {row.preview.image && <QuestionImageView image={row.preview.image} />}
                  {row.preview.options?.map((option, optionIndex) => <p key={option.id} className="text-sm text-secondary">{String.fromCharCode(65 + optionIndex)}. {option.text}</p>)}
                  {row.preview.statements?.map((statement, statementIndex) => <p key={statement.id} className="text-sm text-secondary">Ý {statementIndex + 1}. {statement.content}</p>)}
                  {row.type === "true_false" && <p className="text-sm text-secondary">Chọn Đúng hoặc Sai.</p>}
                  {row.type === "true_false_group" && <p className="text-sm text-secondary">Chọn Đúng hoặc Sai cho từng ý.</p>}
                  {row.type === "short_answer" && <p className="text-sm text-secondary">Trả lời bằng số.</p>}
                  {row.type === "essay_text" && <p className="text-sm text-secondary">Viết câu trả lời tự luận.</p>}
                </div>}
                {editable && step === 2 && <div className="mt-3 flex flex-wrap items-center gap-2"><label className="text-sm">Điểm <input aria-label={`Điểm câu ${index + 1}`} className="ml-1 w-24 rounded-lg border border-line p-2" value={row.pointInput} disabled={busy} onChange={event => setRows(current => current.map((r, i) => i === index ? { ...r, maxPoints: event.target.value, pointInput: event.target.value } : r))} /></label>
                  <button type="button" aria-label={`Đưa câu ${index + 1} lên`} title="Đưa câu lên" className={`${secondary} flex w-11 items-center justify-center px-0`} disabled={busy || index === 0} onClick={() => moveQuestion(index, -1)}><ArrowUp size={18} aria-hidden="true" /></button>
                  <button type="button" aria-label={`Đưa câu ${index + 1} xuống`} title="Đưa câu xuống" className={`${secondary} flex w-11 items-center justify-center px-0`} disabled={busy || index === rows.length - 1} onClick={() => moveQuestion(index, 1)}><ArrowDown size={18} aria-hidden="true" /></button>
                  <button type="button" aria-label={`Bỏ câu ${index + 1}`} title="Bỏ câu" className={`${secondary} flex w-11 items-center justify-center px-0`} disabled={busy} onClick={() => setRows(current => current.filter((_, i) => i !== index))}><Trash2 size={18} aria-hidden="true" /></button></div>}
              </li>;
            })}</ol>
            {questionPageCount > 1 && <nav aria-label="Trang câu hỏi trong đề" className="mt-4 flex items-center justify-center gap-3"><button type="button" className={secondary} disabled={visiblePage === 1} onClick={() => step === 2 ? setEditorPage(visiblePage - 1) : setReviewPage(visiblePage - 1)}>Trước</button><span className="text-sm">Trang {visiblePage}/{questionPageCount}</span><button type="button" className={secondary} disabled={visiblePage === questionPageCount} onClick={() => step === 2 ? setEditorPage(visiblePage + 1) : setReviewPage(visiblePage + 1)}>Sau</button></nav>}
          </>}
        </>}
      </section>}
      {editable && step === 2 && <section className={panel}><h2 className="text-lg font-bold">Thêm câu hỏi</h2><p className="mt-1 text-sm text-secondary">Câu chọn từ Ngân hàng sẽ thành snapshot khi lưu bản nháp.</p>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={secondary} aria-expanded={bankOpen} onClick={() => setBankOpen(value => !value)}><BookOpen size={18} className="mr-2 inline" aria-hidden="true" />Chọn từ Ngân hàng</button><button type="button" className={button} disabled={busy || Boolean(pendingInline)} onClick={() => { setBankOpen(false); setInlineOpen(true); }}>Tạo câu hỏi mới</button></div>
        {bankOpen && <div className="mt-4 space-y-3 rounded-xl border border-line bg-slate-50 p-3" aria-label="Chọn câu hỏi từ Ngân hàng">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]"><input aria-label="Tìm câu hỏi trong Ngân hàng" className="min-h-11 rounded-xl border border-line px-3" placeholder="Tìm theo nội dung" value={bankQuery} onChange={event => { setBankPage(1); setBankQuery(event.target.value); }} />
            <select aria-label="Lọc loại câu hỏi" className="min-h-11 rounded-xl border border-line px-3" value={bankType} onChange={event => { setBankPage(1); setBankType(event.target.value); }}><option value="">Tất cả loại câu</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          {bankLoading ? <p role="status">Đang tải Ngân hàng...</p> : bankError ? <div role="alert" className="flex flex-wrap items-center gap-2"><p>{bankError}</p><button type="button" className={secondary} onClick={() => setBankRetry(value => value + 1)}>Thử lại</button></div> : bank.length === 0 ? <p>Không tìm thấy câu hỏi phù hợp.</p> : <ul className="space-y-2">{bank.map(q => <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3"><span className="min-w-0 text-sm"><span className="font-medium">{q.content}</span><span className="ml-2 text-secondary">· {typeLabels[q.type] ?? "Câu hỏi"}</span></span><button type="button" className={secondary} disabled={busy || rows.some(row => row.sourceId === q.id)} onClick={() => addQuestion(q)}>{rows.some(row => row.sourceId === q.id) ? <><Check size={16} className="mr-1 inline" aria-hidden="true" />Đã thêm</> : "Thêm câu"}</button></li>)}</ul>}
          {bankLastPage > 1 && <div className="flex items-center gap-2"><button type="button" className={secondary} disabled={bankPage <= 1 || bankLoading} onClick={() => setBankPage(p => p - 1)}>Trước</button><span className="text-sm">Trang {bankPage}/{bankLastPage}</span><button type="button" className={secondary} disabled={bankPage >= bankLastPage || bankLoading} onClick={() => setBankPage(p => p + 1)}>Sau</button></div>}
        </div>}
      </section>}
      {editable && inlineOpen && <section ref={inlineRef} className={`${panel} scroll-mt-24 ${step === 2 && !bankOpen ? "" : "hidden"}`} aria-label="Tạo câu hỏi trong đề"><TeacherCreateQuestionPage onCreated={createInlineQuestion} onDirtyChange={setInlineDirty} onCancel={() => {
        if (inlineDirty && !window.confirm("Câu hỏi chưa lưu sẽ bị mất. Đóng trình soạn?")) return;
        setInlineOpen(false);
      }} /></section>}
      {step === 3 && <section className={`${panel} space-y-4`}><h2 className="text-lg font-bold">Hoàn tất đề và giao bài</h2><p className="text-sm text-secondary">Lưu bản nháp trước khi hoàn tất. Giao bài là một xác nhận riêng và hiện phụ thuộc release gate của máy chủ.</p>
        {editable && <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy || Boolean(pendingInline) || !title.trim()} onClick={saveCurrentDraft}>Lưu bản nháp</button><button type="button" className={secondary} disabled={busy || dirty || !revision.questions?.length} onClick={publishCurrentDraft}>Hoàn tất đề</button><button type="button" className={secondary} disabled title="Hoàn tất đề trước khi xem lịch giao" aria-label="Giao bài — chưa khả dụng">Giao bài · Chưa khả dụng</button></div>}
        {!editable && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Đề đã hoàn tất. Có thể xem trước lịch giao bên dưới; hệ thống chỉ tạo bài giao khi release gate được mở và bạn xác nhận riêng.</p>}
      </section>}
      <div className={step === 3 ? "" : "hidden"}><DistributionPanel revisionId={!editable ? revision.id : undefined} classId={classId} onDirtyChange={setDistributionDirty} /></div>
      <div className={`${panel} flex flex-wrap items-center justify-between gap-3`}><button type="button" className={secondary} disabled={step === 1} onClick={() => setStep(value => Math.max(1, value - 1) as 1 | 2 | 3)}><ChevronLeft size={16} className="mr-1 inline" aria-hidden="true" />Quay lại</button><div className="flex flex-wrap gap-2">{editable && step !== 3 && <button type="button" className={secondary} disabled={busy || Boolean(pendingInline) || !title.trim()} onClick={saveCurrentDraft}>Lưu bản nháp</button>}{step < 3 && <button type="button" className={button} onClick={() => setStep(value => Math.min(3, value + 1) as 1 | 2 | 3)}>Tiếp tục<ChevronRight size={16} className="ml-1 inline" aria-hidden="true" /></button>}</div></div>
      <details className={panel}><summary className="cursor-pointer font-bold">Lịch sử phiên bản</summary><ul className="mt-3 space-y-2">{assessment?.revisions?.map(r => <li key={r.id}><button className={secondary} disabled={busy} onClick={() => {
        if (unsaved && !window.confirm("Thay đổi chưa lưu sẽ bị mất. Tiếp tục?")) return;
        setBusy(true); setError("");
        void getRevision(r.id).then(displayRevision).catch(cause => setError(errorText(cause))).finally(() => setBusy(false));
      }}>Phiên bản {r.revisionNo} · {r.status === "draft" ? "Bản nháp" : "Đề đã hoàn tất"}</button></li>)}</ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {!editable && <button className={secondary} disabled={busy} onClick={() => void run(() => createRevision(assessmentId, revision.id), "Đã tạo bản nháp mới từ đề đã hoàn tất.")}>Tạo bản nháp từ đề này</button>}
          {!editable && <button className={secondary} disabled={busy} onClick={() => void run(() => createRevision(assessmentId), "Đã tạo bản nháp trống.")}>Tạo bản nháp trống</button>}
          {editable && assessment?.revisions?.every(r => r.status !== "published") && <button className={secondary} disabled={busy} onClick={() => {
            if (window.confirm("Xóa mềm bộ đề chưa từng công bố?")) {
              setBusy(true); setError("");
              void deleteAssessment(assessmentId, assessment.version).then(() => navigate(`/teacher/assessments${classQuery}`))
                .catch(cause => setError(errorText(cause))).finally(() => setBusy(false));
            }
          }}>Xóa bộ đề</button>}
        </div>
      </details>
    </>}
  </main>;
}
