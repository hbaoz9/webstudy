import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, Settings } from "lucide-react";
import { IconAction } from "../../components/common/IconAction";
import { ApiError } from "../../service/api/client";
import { getRevision, type AssessmentRevision } from "../../service/api/assessments";
import { cancelDistribution, closeDistribution, getDistribution, listDistributionEvents,
  type Distribution, type DistributionEvent } from "../../service/api/distributions";
import { TeacherAttemptPanel } from "../../components/teacher/TeacherAttemptPanel";
import { QuestionImageView } from "../../components/questions/QuestionImage";

const card = "min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card sm:p-6";
const secondary = "inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50";
const statusLabel: Record<Distribution["status"], string> = {
  scheduled: "Chưa mở", open: "Đang mở", expired: "Đã hết hạn", closed: "Ngừng nhận lượt mới", cancelled: "Đã hủy",
};
const eventLabel: Record<DistributionEvent["type"], string> = {
  created: "Đã giao bài", closed: "Ngừng nhận lượt mới", cancelled: "Đã hủy",
};
type Tab = "overview" | "content" | "grading" | "results" | "settings";
const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Tổng quan" }, { id: "content", label: "Nội dung đề" },
  { id: "grading", label: "Chấm bài" }, { id: "results", label: "Kết quả" },
];

export default function TeacherGradingPage() {
  const { distributionId } = useParams();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab");
  const tab: Tab = requestedTab && ["overview", "content", "grading", "results", "settings"].includes(requestedTab)
    ? requestedTab as Tab : location.pathname.endsWith("/grade") ? "grading" : "overview";
  const [distribution, setDistribution] = useState<Distribution | null>(null);
  const [revision, setRevision] = useState<AssessmentRevision | null>(null);
  const [events, setEvents] = useState<DistributionEvent[]>([]);
  const [eventPage, setEventPage] = useState(1);
  const [eventLastPage, setEventLastPage] = useState(1);
  const [questionPage, setQuestionPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const commandKey = useRef<{ id: string; action: "close" | "cancel"; key: string; version: number; reason: string } | null>(null);
  const previousTab = useRef<Exclude<Tab, "settings">>("overview");
  const settingsButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (tab !== "settings") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); chooseTab(previousTab.current); settingsButton.current?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!distributionId) return;
    let live = true;
    setDistribution(null); setRevision(null); setLoading(true); setError(""); setQuestionPage(1);
    void getDistribution(distributionId).then(async item => {
      const detail = await getRevision(item.revisionId);
      if (live) { setDistribution(item); setRevision(detail); }
    }).catch(() => { if (live) setError("Không thể tải chi tiết bài đã giao. Vui lòng thử lại."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [distributionId, retry]);

  useEffect(() => {
    if (!distributionId || tab !== "settings") return;
    let live = true;
    void listDistributionEvents(distributionId, eventPage).then(response => {
      if (live) { setEvents(response.data); setEventLastPage(response.meta.lastPage); }
    }).catch(() => { if (live) setError("Không thể tải lịch sử đợt giao."); });
    return () => { live = false; };
  }, [distributionId, tab, eventPage]);

  function chooseTab(next: Tab) {
    if (next === "settings" && tab !== "settings") previousTab.current = tab;
    setError(""); setNotice(""); setParams(next === "overview" ? {} : { tab: next });
  }

  async function command(action: "close" | "cancel") {
    if (!distribution || busy) return;
    const pending = commandKey.current?.id === distribution.id && commandKey.current.action === action ? commandKey.current : null;
    const reason = pending?.reason ?? window.prompt(action === "cancel" ? "Lý do hủy bài (bắt buộc):" : "Lý do ngừng nhận lượt mới:", "");
    if (reason === null || (action === "cancel" && !reason.trim())) return;
    if (!window.confirm(action === "cancel" ? "Hủy đợt giao và thông báo học sinh? Kết quả sẽ không còn hiệu lực."
      : "Ngừng nhận lượt làm mới của đợt giao này?")) return;
    const request = pending ?? { id: distribution.id, action, key: crypto.randomUUID(), version: distribution.version, reason: reason.trim() };
    commandKey.current = request; setBusy(true); setError(""); setNotice("");
    try {
      const updated = action === "cancel"
        ? await cancelDistribution(request.id, request.version, request.reason, request.key)
        : await closeDistribution(request.id, request.version, request.key, request.reason);
      commandKey.current = null; setDistribution(updated); setEventPage(1);
      const history = await listDistributionEvents(request.id);
      setEvents(history.data); setEventLastPage(history.meta.lastPage);
      setNotice(action === "cancel" ? "Đã hủy đợt giao và ghi thông báo." : "Đã ngừng nhận lượt mới.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) commandKey.current = null;
      setError(cause instanceof ApiError && cause.status === 409
        ? "Trạng thái đã thay đổi. Tải lại chi tiết trước khi thao tác tiếp."
        : "Chưa xác định được kết quả lệnh. Kiểm tra lại trước khi thử lại; mã yêu cầu được giữ nguyên.");
    } finally { setBusy(false); }
  }

  const questions = revision?.questions ?? [];
  return <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
    <Link className="inline-grid size-11 place-items-center rounded-xl text-emerald-700 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700" to="/teacher/assessments" aria-label="Quay lại Bài tập & Kiểm tra" title="Quay lại Bài tập & Kiểm tra"><ArrowLeft size={20} aria-hidden="true" /></Link>
    {loading && <p role="status">Đang tải chi tiết bài đã giao…</p>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}
      {!distribution && <IconAction icon={RefreshCw} label="Tải lại chi tiết đợt giao" loading={loading} className="ml-3 align-middle" onClick={() => setRetry(value => value + 1)} />}
    </div>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {distribution && revision && <>
      <header className={card}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0">
        <p className="text-sm font-semibold text-emerald-700">{statusLabel[distribution.status]} · {distribution.classroomName}</p>
        <h1 className="mt-1 break-words text-2xl font-bold text-ink">{distribution.assessmentTitle}</h1>
        <p className="mt-2 text-sm text-secondary">{questions.length} câu · Tổng điểm {Number(revision.totalPoints)} · {distribution.timeLimitSeconds / 60} phút/lượt · {distribution.maxAttempts} lượt</p>
        <p className="mt-1 text-sm text-secondary">Mở {new Date(distribution.opensAt).toLocaleString("vi-VN")} · Hạn {new Date(distribution.deadlineAt).toLocaleString("vi-VN")}</p>
      </div><IconAction ref={settingsButton} icon={Settings} label="Cài đặt đợt giao" aria-expanded={tab === "settings"} aria-controls="distribution-settings" className={tab === "settings" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : ""} onClick={() => chooseTab(tab === "settings" ? previousTab.current : "settings")} /></div></header>
      <nav aria-label="Chi tiết bài đã giao" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1" role="tablist">
        {tabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id}
          className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold sm:px-5 ${tab === item.id ? "bg-emerald-700 text-white" : "text-secondary hover:bg-slate-50"}`}
          onClick={() => chooseTab(item.id)}>{item.label}</button>)}
      </nav>
      {tab === "overview" && <section className={card} aria-label="Tổng quan đợt giao"><h2 className="text-lg font-bold">Tổng quan</h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p className="rounded-xl bg-slate-50 p-3">Lớp<br /><strong>{distribution.classroomName}</strong></p>
          <p className="rounded-xl bg-slate-50 p-3">Đề đã hoàn tất<br /><strong>Phiên bản {revision.revisionNo} · {questions.length} câu</strong></p>
          <p className="rounded-xl bg-slate-50 p-3">Điểm tối đa<br /><strong>{Number(revision.totalPoints)}</strong></p>
          <p className="rounded-xl bg-slate-50 p-3">Số lượt và thời lượng<br /><strong>{distribution.maxAttempts} lượt · {distribution.timeLimitSeconds / 60} phút</strong></p>
          <p className="rounded-xl bg-slate-50 p-3">Chính sách đến hạn<br /><strong>{distribution.deadlinePolicy === "HARD_DEADLINE" ? "Kết thúc đúng hạn" : "Làm hết thời lượng nếu bắt đầu trước hạn"}</strong></p>
          <p className="rounded-xl bg-slate-50 p-3">Chính sách điểm<br /><strong>{distribution.scorePolicy === "LATEST" ? "Lượt mới nhất" : distribution.scorePolicy === "AVERAGE" ? "Trung bình" : "Cao nhất"}</strong></p>
        </div><div className="mt-4 flex flex-wrap gap-2"><button className={secondary} onClick={() => chooseTab("content")}>Xem nội dung đề</button>
          <button className={secondary} onClick={() => chooseTab("grading")}>Chấm bài</button><button className={secondary} onClick={() => chooseTab("results")}>Xem kết quả</button></div>
      </section>}
      {tab === "content" && <section className={`${card} space-y-3`} aria-label="Nội dung đề đã giao"><h2 className="text-lg font-bold">Nội dung đề</h2>
        {revision.instructions && <p className="whitespace-pre-wrap text-sm text-secondary">{revision.instructions}</p>}
        {questions.length === 0 && <p className="text-sm text-secondary">Đề chưa có câu hỏi.</p>}
        <ol className="space-y-2" start={(questionPage - 1) * 10 + 1}>{questions.slice((questionPage - 1) * 10, questionPage * 10).map(question => <li key={question.id} className="rounded-xl border border-line p-3 text-sm">
          <p className="whitespace-pre-wrap font-semibold">Câu {question.position}. {question.publicContent.content} · {Number(question.maxPoints)} điểm</p>
          {question.publicContent.image && <QuestionImageView image={question.publicContent.image} />}
          {question.publicContent.options?.map((option, index) => <p key={option.id} className="mt-1">{String.fromCharCode(65 + index)}. {option.text}</p>)}
          {question.publicContent.statements?.map((statement, index) => <p key={statement.id} className="mt-1">Ý {index + 1}. {statement.content}</p>)}
        </li>)}</ol>
        {questions.length > 10 && <div className="flex items-center gap-2"><button className={secondary} disabled={questionPage <= 1} onClick={() => setQuestionPage(page => page - 1)}>Trước</button>
          <span>Trang {questionPage}/{Math.ceil(questions.length / 10)}</span><button className={secondary} disabled={questionPage * 10 >= questions.length} onClick={() => setQuestionPage(page => page + 1)}>Sau</button></div>}
      </section>}
      {(tab === "grading" || tab === "results" || tab === "settings") && <TeacherAttemptPanel key={distribution.id} distribution={distribution} initialOpen activeSection={tab} />}
      {tab === "settings" && <section id="distribution-settings" className={`${card} space-y-3`} aria-label="Cài đặt đợt giao"><h2 className="text-lg font-bold">Thao tác nâng cao của đợt giao</h2>
        <p className="text-sm text-secondary">Các lệnh dưới đây chỉ áp dụng cho lớp {distribution.classroomName}.</p>
        <div className="flex flex-wrap gap-2">{distribution.lifecycleStatus === "active" && <button className={secondary} disabled={busy} onClick={() => void command("close")}>Ngừng nhận lượt mới</button>}
          {distribution.lifecycleStatus !== "cancelled" && <button className={secondary} disabled={busy} onClick={() => void command("cancel")}>Hủy đợt giao</button>}</div>
        <h3 className="font-semibold">Lịch sử thao tác</h3>
        {events.length === 0 && <p className="text-sm text-secondary">Chưa có sự kiện trong trang này.</p>}
        <ul className="space-y-2 text-sm">{events.map(event => <li key={event.id} className="rounded-lg bg-slate-50 p-2">{eventLabel[event.type]} · {new Date(event.createdAt).toLocaleString("vi-VN")}{event.reason ? ` · ${event.reason}` : ""}</li>)}</ul>
        {eventLastPage > 1 && <div className="flex items-center gap-2"><button className={secondary} disabled={eventPage <= 1} onClick={() => setEventPage(page => page - 1)}>Trước</button>
          <span>{eventPage}/{eventLastPage}</span><button className={secondary} disabled={eventPage >= eventLastPage} onClick={() => setEventPage(page => page + 1)}>Sau</button></div>}
      </section>}
    </>}
  </main>;
}
