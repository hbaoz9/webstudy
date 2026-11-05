import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { ApiError } from "../../service/api/client";
import { QuestionImageView } from "../../components/questions/QuestionImage";
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
type EditorRow = DraftQuestion & { label: string; sourceId: string; type: string; preview: RevisionQuestion["publicContent"]; pointInput: string };

function displayPoints(value: string): string {
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function sumPoints(rows: EditorRow[]): string {
  const units = rows.reduce((sum, row) => {
    const match = /^(\d+)(?:\.(\d{0,6}))?$/.exec(row.maxPoints);
    return match ? sum + BigInt(match[1]) * 1000000n + BigInt((match[2] ?? "").padEnd(6, "0")) : sum;
  }, 0n);
  return displayPoints(`${units / 1000000n}.${String(units % 1000000n).padStart(6, "0")}`);
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
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [changedSources, setChangedSources] = useState<string[]>([]);
  const publishKey = useRef<{ revisionId: string; version: number; key: string } | null>(null);

  const displayRevision = useCallback(async (detail: AssessmentRevision) => {
    setRevision(detail);
    setTitle(detail.title); setInstructions(detail.instructions ?? "");
    setRows((detail.questions ?? []).map(q => ({ revisionQuestionId: q.id, maxPoints: q.maxPoints,
      label: q.publicContent.content, sourceId: q.sourceQuestionId, type: q.type, preview: q.publicContent,
      pointInput: displayPoints(q.maxPoints) })));
    const changed = await Promise.all((detail.questions ?? []).map(async q => {
      try { const source = await getTeacherQuestion(q.sourceQuestionId); return source.version !== q.sourceQuestionVersion ? q.id : ""; }
      catch { return q.id; }
    }));
    setChangedSources(changed.filter(Boolean));
  }, []);

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

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!assessmentId || revision?.status !== "draft") return;
    let current = true;
    listTeacherQuestions({ page: bankPage, perPage: 20 }).then(page => {
      if (current) { setBank(page.data); setBankLastPage(page.meta.last_page); }
    }).catch(cause => { if (current) setError(errorText(cause)); });
    return () => { current = false; };
  }, [assessmentId, revision?.status, bankPage]);

  const total = useMemo(() => sumPoints(rows), [rows]);
  const dirty = revision?.status === "draft" && (title !== revision.title || instructions !== (revision.instructions ?? "") ||
    JSON.stringify(rows.map(row => ({ sourceId: row.sourceId, maxPoints: row.maxPoints }))) !==
    JSON.stringify((revision.questions ?? []).map(q => ({ sourceId: q.sourceQuestionId, maxPoints: q.maxPoints }))));
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); await reload(); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  function addQuestion(question: TeacherQuestion) {
    if (rows.some(row => row.sourceId === question.id)) return;
    const preview: RevisionQuestion["publicContent"] = {
      content: question.content,
      ...(question.image ? { image: question.image } : {}),
      ...("options" in question ? { options: question.options } : {}),
      ...("statements" in question ? { statements: question.statements.map(({ id, content }) => ({ id, content })) } : {}),
    };
    setRows(current => [...current, { sourceQuestionId: question.id, sourceQuestionVersion: question.version,
      maxPoints: "1.000000", label: question.content, sourceId: question.id, type: question.type, preview, pointInput: "1" }]);
    setNotice("Câu hỏi đã được chọn. Nhấn Lưu bản nháp để tạo snapshot trên máy chủ.");
  }

  if (!assessmentId) return <main className="space-y-5 p-4 sm:p-6">
    <header><h1 className="text-2xl font-bold text-ink">Bộ đề đánh giá</h1><p className="text-sm text-secondary">Bản nháp và phiên bản đã công bố. Chưa giao bài cho lớp.</p></header>
    <form className={panel} onSubmit={event => { event.preventDefault(); if (newTitle.trim()) void run(async () => {
      await createAssessment(newTitle.trim(), ""); setNewTitle("");
    }, "Đã tạo bộ đề và bản nháp."); }}>
      <label className="block text-sm font-semibold" htmlFor="assessment-new-title">Tên bộ đề</label>
      <div className="mt-2 flex flex-wrap gap-2"><input id="assessment-new-title" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3" value={newTitle} onChange={event => setNewTitle(event.target.value)} maxLength={255} required />
        <button className={button} disabled={busy}>Tạo bộ đề</button></div>
    </form>
    {loading && <p role="status">Đang tải bộ đề...</p>}
    {error && <div role="alert" className={panel}><p>{error}</p><button className={secondary} onClick={() => void reload()}>Thử lại</button></div>}
    {notice && <p role="status">{notice}</p>}
    {!loading && !error && <section className="space-y-2">{list.length === 0 ? <p>Chưa có bộ đề.</p> : list.map(item =>
      <div key={item.id} className={`${panel} flex flex-wrap items-center justify-between gap-3`}><div><h2 className="font-semibold">{item.title}</h2><p className="text-xs text-secondary">Phiên bản thư viện {item.version}</p></div><Link className={secondary} to={`/teacher/assessments/${encodeURIComponent(item.id)}`}>Mở bộ đề</Link></div>)}
      {listLastPage > 1 && <div className="flex items-center gap-2"><button className={secondary} disabled={listPage <= 1} onClick={() => setListPage(p => p - 1)}>Trước</button><span>Trang {listPage}/{listLastPage}</span><button className={secondary} disabled={listPage >= listLastPage} onClick={() => setListPage(p => p + 1)}>Sau</button></div>}</section>}
  </main>;

  const editable = revision?.status === "draft";
  return <main className="space-y-5 p-4 sm:p-6">
    <Link to="/teacher/assessments" className="text-sm font-semibold text-emerald-700">← Danh sách bộ đề</Link>
    <header><h1 className="text-2xl font-bold text-ink">{assessment?.title ?? "Bộ đề"}</h1>
      <p className="text-sm text-secondary">{revision ? `Revision ${revision.revisionNo} · ${editable ? "Bản nháp" : "Đã công bố"}` : "Đang tải"}</p></header>
    {loading && <p role="status">Đang tải bộ đề...</p>}
    {error && <div role="alert" className={panel}><p>{error}</p><button className={secondary} onClick={() => void reload()}>Tải lại</button></div>}
    {notice && <p role="status">{notice}</p>}
    {revision && !loading && <>
      <section className={panel}><label className="block text-sm font-semibold" htmlFor="assessment-title">Tên trong thư viện</label>
        <div className="mt-2 flex flex-wrap gap-2"><input id="assessment-title" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3" value={assessmentTitle} maxLength={255} onChange={event => setAssessmentTitle(event.target.value)} />
          <button className={secondary} disabled={busy || dirty || !assessmentTitle.trim() || assessmentTitle === assessment?.title} onClick={() => {
            if (assessment) void run(() => updateAssessment(assessment.id, assessmentTitle, assessment.version), "Đã cập nhật tên bộ đề trong thư viện.");
          }}>Lưu tên bộ đề</button></div>
      </section>
      <section className={panel}>
        <div className="grid gap-3"><label className="text-sm font-semibold" htmlFor="revision-title">Tên đề</label>
          <input id="revision-title" className="min-h-11 rounded-xl border border-line px-3" value={title} disabled={!editable || busy} onChange={event => setTitle(event.target.value)} />
          <label className="text-sm font-semibold" htmlFor="revision-instructions">Hướng dẫn</label>
          <textarea id="revision-instructions" className="min-h-24 rounded-xl border border-line p-3" value={instructions} disabled={!editable || busy} onChange={event => setInstructions(event.target.value)} /></div>
        <p className="mt-3 text-sm text-secondary">{rows.length} câu · Tổng điểm nháp: {total}. Máy chủ tính lại khi lưu.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {editable && <button className={button} disabled={busy || !title.trim()} onClick={() => void run(async () => {
            const saved = await saveDraft(revision.id, revision.version, title, instructions, rows.map(row =>
              "revisionQuestionId" in row ? { revisionQuestionId: row.revisionQuestionId, maxPoints: row.maxPoints }
                : { sourceQuestionId: row.sourceQuestionId, sourceQuestionVersion: row.sourceQuestionVersion, maxPoints: row.maxPoints }));
            setRevision(saved);
          }, "Đã lưu bản nháp trên máy chủ.")}>Lưu bản nháp</button>}
          {editable && <button className={secondary} disabled={busy || dirty || revision.questions?.length === 0} onClick={() => {
            if (!window.confirm("Công bố revision đã lưu? Nội dung và điểm sẽ không thể sửa.")) return;
            if (publishKey.current?.revisionId !== revision.id || publishKey.current.version !== revision.version) {
              publishKey.current = { revisionId: revision.id, version: revision.version, key: crypto.randomUUID() };
            }
            const key = publishKey.current.key;
            void run(async () => { await publishRevision(revision.id, revision.version, key); publishKey.current = null; }, "Đã công bố revision.");
          }}>Công bố bản đã lưu</button>}
          {!editable && <button className={secondary} disabled={busy} onClick={() => void run(() => createRevision(assessmentId, revision.id), "Đã tạo bản nháp mới từ snapshot đã công bố.")}>Tạo bản nháp từ revision này</button>}
          {!editable && <button className={secondary} disabled={busy} onClick={() => void run(() => createRevision(assessmentId), "Đã tạo bản nháp trống.")}>Tạo bản nháp trống</button>}
          {editable && assessment?.revisions?.every(r => r.status !== "published") && <button className={secondary} disabled={busy} onClick={() => {
            if (window.confirm("Xóa mềm bộ đề chưa từng công bố?")) {
              setBusy(true); setError("");
              void deleteAssessment(assessmentId, assessment.version).then(() => navigate("/teacher/assessments"))
                .catch(cause => setError(errorText(cause))).finally(() => setBusy(false));
            }
          }}>Xóa bộ đề</button>}
        </div>
      </section>
      <section className={panel}><h2 className="text-lg font-bold">Xem trước câu hỏi {editable ? "bản nháp" : "đã công bố"}</h2>
        {changedSources.length > 0 && <p role="alert" className="mt-2 text-amber-700">{changedSources.length} câu nguồn đã thay đổi hoặc bị xóa. Snapshot trong bộ đề không tự cập nhật.</p>}
        {rows.length === 0 && <p className="mt-3 text-sm text-secondary">Chưa có câu hỏi.</p>}
        <ol className="mt-3 space-y-3">{rows.map((row, index) => <li key={"revisionQuestionId" in row ? row.revisionQuestionId : row.sourceQuestionId} className="rounded-xl border border-line p-3">
          <p className="font-semibold">Câu {index + 1}. {row.label}</p>
          <p className="mt-1 text-xs text-secondary">{typeLabels[row.type] ?? row.type} · {displayPoints(row.maxPoints)} điểm</p>
          {row.preview.image && <QuestionImageView image={row.preview.image} />}
          {row.preview.options?.map((option, optionIndex) => <p key={option.id} className="text-sm text-secondary">
            {String.fromCharCode(65 + optionIndex)}. {option.text}
          </p>)}
          {row.preview.statements?.map((statement, statementIndex) => <p key={statement.id} className="text-sm text-secondary">
            Ý {statementIndex + 1}. {statement.content}
          </p>)}
          {editable && <div className="mt-2 flex flex-wrap items-center gap-2"><label className="text-sm">Điểm <input aria-label={`Điểm câu ${index + 1}`} className="ml-1 w-28 rounded-lg border border-line p-2" value={row.pointInput} onChange={event => setRows(current => current.map((r, i) => i === index ? { ...r, maxPoints: event.target.value, pointInput: event.target.value } : r))} /></label>
            <button type="button" aria-label={`Đưa câu ${index + 1} lên`} title="Đưa câu lên" className={`${secondary} flex w-11 items-center justify-center px-0`} disabled={index === 0} onClick={() => setRows(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}><ArrowUp size={18} aria-hidden="true" /></button>
            <button type="button" aria-label={`Đưa câu ${index + 1} xuống`} title="Đưa câu xuống" className={`${secondary} flex w-11 items-center justify-center px-0`} disabled={index === rows.length - 1} onClick={() => setRows(current => { const next = [...current]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })}><ArrowDown size={18} aria-hidden="true" /></button>
            <button type="button" aria-label={`Bỏ câu ${index + 1}`} title="Bỏ câu" className={`${secondary} flex w-11 items-center justify-center px-0`} onClick={() => setRows(current => current.filter((_, i) => i !== index))}><Trash2 size={18} aria-hidden="true" /></button></div>}
        </li>)}</ol>
      </section>
      {editable && <section className={panel}><h2 className="text-lg font-bold">Chọn từ Ngân hàng câu hỏi</h2><p className="text-sm text-secondary">Đang xem trang {bankPage}/{bankLastPage}. Snapshot được tạo khi lưu bản nháp.</p>
        <ul className="mt-3 space-y-2">{bank.map(q => <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3"><span className="text-sm">{q.content} · {q.type}</span><button className={secondary} disabled={rows.some(row => row.sourceId === q.id)} onClick={() => addQuestion(q)}>Thêm câu</button></li>)}</ul>
        <div className="mt-3 flex gap-2"><button className={secondary} disabled={bankPage <= 1} onClick={() => setBankPage(p => p - 1)}>Trước</button><button className={secondary} disabled={bankPage >= bankLastPage} onClick={() => setBankPage(p => p + 1)}>Sau</button></div>
      </section>}
      <section className={panel}><h2 className="text-lg font-bold">Các revision</h2><ul className="mt-3 space-y-2">{assessment?.revisions?.map(r => <li key={r.id}><button className={secondary} disabled={busy} onClick={() => {
        if (dirty && !window.confirm("Thay đổi chưa lưu sẽ bị mất. Tiếp tục?")) return;
        setBusy(true); setError("");
        void getRevision(r.id).then(displayRevision).catch(cause => setError(errorText(cause))).finally(() => setBusy(false));
      }}>Revision {r.revisionNo} · {r.status}</button></li>)}</ul></section>
    </>}
  </main>;
}
