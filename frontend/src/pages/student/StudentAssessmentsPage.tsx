import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { CalendarClock, ClipboardList } from "lucide-react";
import { StudentEmptyState } from "../../components/student/StudentEmptyState";
import { getStudentResult, listHistoricalDistributions, listOwnAttempts, listStudentDistributions, type Attempt, type StudentDistribution, type StudentResult } from "../../service/api/attempts";

const action = "inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white";

function DistributionCard({ item, userId }: { item: StudentDistribution; userId: string }) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ attempt?: Attempt; result?: StudentResult; error?: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    setState(null);
    void listOwnAttempts(item.id).then(async page => {
      const attempt = page.data[0];
      if (!attempt || attempt.status === "IN_PROGRESS") return { attempt };
      const result = await getStudentResult(item.id);
      return { attempt, result };
    }).then(next => { if (live) setState(next); }).catch(() => { if (live) setState({ error: true }); });
    return () => { live = false; };
  }, [item.id, userId, retry]);
  const status = state?.attempt?.status === "IN_PROGRESS" ? "Đang làm"
    : state?.result?.scoreVisible ? "Đã có kết quả"
      : state?.result?.status === "PENDING_GRADING" || state?.result?.status === "PENDING_REGRADE" ? "Chờ chấm"
        : state?.attempt ? "Đã nộp" : item.status === "closed" ? "Đã kết thúc" : item.attemptAvailable ? "Cần làm" : "Chưa thể bắt đầu";
  return <li className="rounded-3xl border border-line bg-white p-5 shadow-card">
    <div className="flex flex-wrap items-start justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wide text-emerald">{item.classroomName}</span>
      {!state ? <span className="text-xs text-secondary">Đang kiểm tra trạng thái…</span> : !state.error && <span className="rounded-full bg-emerald/10 px-3 py-1 text-xs font-bold text-emerald">{status}</span>}</div>
    <h2 className="mt-3 text-lg font-extrabold text-ink">{item.title}</h2>
    <p className="mt-3 flex items-center gap-2 text-sm text-secondary"><CalendarClock className="size-4 shrink-0" />Hạn bắt đầu: {new Date(item.deadlineAt).toLocaleString("vi-VN")}</p>
    {state?.error && <div role="alert" className="mt-3 text-sm text-red-700">Không thể tải trạng thái bài làm. <button type="button" className="font-bold underline" onClick={() => setRetry(value => value + 1)}>Thử lại</button></div>}
    <Link className={`${action} mt-5`} to={`/student/assessments/${encodeURIComponent(item.id)}`}>{status === "Đang làm" ? "Tiếp tục làm" : status === "Đã có kết quả" ? "Xem kết quả" : "Xem bài"}</Link>
  </li>;
}

export default function StudentAssessmentsPage() {
  const { session, status } = useAuth();
  const [params] = useSearchParams();
  const classroomId = params.get("classId") ?? undefined;
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [response, setResponse] = useState<{ key: string; data?: StudentDistribution[]; history?: StudentDistribution[]; lastPage?: number; error?: boolean } | null>(null);
  const key = `${status}:${session?.userId ?? "none"}:${classroomId ?? "all"}:${page}:${revision}`;
  useEffect(() => { setPage(1); }, [classroomId]);
  useEffect(() => {
    if (status !== "ready" || session?.role !== "student") return;
    let live = true;
    void Promise.all([listStudentDistributions(page, classroomId), listHistoricalDistributions(1, classroomId)]).then(([result, history]) => {
      if (live) setResponse({ key, data: result.data, history: history.data, lastPage: result.meta.lastPage ?? 1 });
    }).catch(() => { if (live) setResponse({ key, error: true }); });
    return () => { live = false; };
  }, [key, page, classroomId, session?.role, status]);
  const current = response?.key === key ? response : null;
  return <main className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-3xl border border-line bg-white px-6 py-7 shadow-card sm:px-8"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald">Góc luyện tập</p><h1 className="mt-2 text-2xl font-extrabold text-ink">Bài tập & Kiểm tra</h1>
      <p className="mt-2 text-sm text-secondary">Xem bài được giao và theo dõi kết quả của bạn.</p></header>
    {classroomId && <Link className="text-sm font-bold text-emerald-700" to={`/student/classes/${encodeURIComponent(classroomId)}`}>← Trở lại lớp</Link>}
    {!current ? <p role="status" className="rounded-2xl border border-line bg-white p-5">Đang tải bài được giao…</p>
      : current.error ? <section role="alert" className="rounded-2xl border border-red-200 bg-white p-5">
        <p>Không thể tải bài được giao. Vui lòng thử lại.</p>
        <button className={`${action} mt-3`} onClick={() => setRevision(value => value + 1)}>Thử lại</button>
      </section> : current.data?.length ? <>
        <ul className="grid gap-4 sm:grid-cols-2">{[...current.data].sort((a, b) => Date.parse(a.deadlineAt) - Date.parse(b.deadlineAt) || a.id.localeCompare(b.id)).map(item => <DistributionCard key={item.id} item={item} userId={session?.userId ?? ""} />)}</ul>
        {(current.lastPage ?? 1) > 1 && <nav aria-label="Trang bài được giao" className="flex items-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="min-h-11 rounded-xl border border-line px-4 disabled:opacity-50">Trước</button>
          <span>Trang {page}/{current.lastPage}</span>
          <button disabled={page >= (current.lastPage ?? 1)} onClick={() => setPage(value => value + 1)} className="min-h-11 rounded-xl border border-line px-4 disabled:opacity-50">Sau</button>
        </nav>}
      </> : current.history?.length ? null : <StudentEmptyState title="Hiện chưa có bài mới được giao cho bạn." description="Bài tập mới sẽ xuất hiện khi giáo viên giao cho lớp. Bạn vẫn có thể xem bài học đã đăng." to="/student/lessons" action="Xem bài học" />}
    {current?.history && current.history.length > 0 && <section className="rounded-3xl border border-line bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-extrabold text-ink"><ClipboardList className="size-5 text-emerald" />Bài đã từng làm</h2>
      <ul className="mt-3 space-y-2">{current.history.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>{item.title} · {item.classroomName}</span>
        <Link className="font-bold text-emerald-700" to={`/student/assessments/${encodeURIComponent(item.id)}`}>Xem lịch sử và kết quả</Link>
      </li>)}</ul>
    </section>}
  </main>;
}
