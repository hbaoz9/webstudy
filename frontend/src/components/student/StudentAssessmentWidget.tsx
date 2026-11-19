import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarClock, ClipboardList } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { listStudentDistributions, type StudentDistribution } from "../../service/api/attempts";

export function StudentAssessmentWidget() {
  const { session, status } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: StudentDistribution[]; error?: boolean } | null>(null);
  const key = `${status}:${session?.userId ?? "none"}:${revision}`;
  useEffect(() => {
    if (status !== "ready" || session?.role !== "student") return;
    let current = true;
    void listStudentDistributions().then(page => { if (current) setResult({ key, data: page.data }); })
      .catch(() => { if (current) setResult({ key, error: true }); });
    return () => { current = false; };
  }, [key, session?.role, status]);
  const current = result?.key === key ? result : null;
  const upcoming = [...(current?.data ?? [])].sort((a, b) => Date.parse(a.deadlineAt) - Date.parse(b.deadlineAt) || a.id.localeCompare(b.id)).slice(0, 3);
  return <section aria-labelledby="student-assessment-widget" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="student-assessment-widget" className="text-xl font-extrabold text-ink">Việc cần làm</h2>
      <Link to="/student/assessments" className="inline-flex min-h-11 items-center text-sm font-bold text-emerald">Xem tất cả →</Link>
    </div>
    {!current ? <p role="status" className="rounded-2xl border border-line bg-white p-5 text-sm">Đang tải bài được giao…</p>
      : current.error ? <div role="alert" className="rounded-2xl border border-line bg-white p-5 text-sm">
        <p>Không thể tải bài được giao. Vui lòng thử lại.</p>
        <button className="mt-2 min-h-11 rounded-xl border border-line px-4 font-bold" onClick={() => setRevision(value => value + 1)}>Thử lại</button>
      </div> : !upcoming.length ? <div className="flex items-center gap-4 rounded-3xl border border-line bg-white p-5 text-sm text-secondary"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald/10 text-emerald"><ClipboardList className="size-5" /></span>Hiện chưa có bài mới được giao cho bạn.</div>
        : <div className="grid gap-3 md:grid-cols-3">{upcoming.map((item, index) =>
          <Link key={item.id} to={`/student/assessments/${encodeURIComponent(item.id)}`} className={`group rounded-3xl border bg-white p-5 shadow-card transition hover:-translate-y-0.5 motion-reduce:transform-none ${index === 0 ? "border-emerald/40" : "border-line"}`}>
            <span className="text-xs font-bold uppercase tracking-wide text-emerald">{index === 0 ? "Hạn gần nhất" : "Bài được giao"}</span>
            <h3 className="mt-2 font-extrabold text-ink">{item.title}</h3>
            <p className="mt-1 text-sm text-secondary">{item.classroomName}</p>
            <p className="mt-4 flex items-center gap-2 text-xs text-secondary"><CalendarClock className="size-4" />Hạn bắt đầu: {new Date(item.deadlineAt).toLocaleString("vi-VN")}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-emerald">Xem bài <ArrowUpRight className="size-4" /></span>
          </Link>)}</div>}
  </section>;
}
