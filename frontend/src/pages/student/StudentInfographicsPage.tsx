import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { infographicImageUrl, listStudentInfographics, type InfographicAsset } from "../../service/api/infographics";
import { StudentEmptyState } from "../../components/student/StudentEmptyState";

export default function StudentInfographicsPage() {
  const { session } = useAuth();
  return <Gallery key={session?.userId ?? "none"} />;
}

function Gallery() {
  const [params] = useSearchParams();
  const classroomId = params.get("classId") ?? undefined;
  const [items, setItems] = useState<InfographicAsset[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    setItems([]); setLoading(true); setError(false);
    void listStudentInfographics(page, classroomId)
      .then(result => { if (live) { setItems(result.data); setLastPage(result.meta.lastPage); } })
      .catch(() => { if (live) setError(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [page, classroomId, reload]);
  return <main className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-3xl border border-line bg-white px-6 py-7 shadow-card sm:px-8"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald">Quan sát và khám phá</p><h1 className="mt-2 text-2xl font-extrabold text-ink">Học liệu trực quan</h1>
      <p className="mt-2 text-sm text-secondary">Ảnh giáo viên đã đăng cho lớp của bạn.</p></header>
    {loading ? <p role="status">Đang tải học liệu…</p> : error ? <div role="alert" className="rounded-xl bg-white p-5">Không thể tải học liệu. <button className="min-h-11 font-bold underline" onClick={() => setReload(value => value + 1)}>Thử lại</button></div>
      : items.length ? <ul className="grid gap-4 md:grid-cols-2">{items.map(item => <li key={`${item.id}:${item.classroomId}`} className="overflow-hidden rounded-3xl border border-line bg-white shadow-card">
          <img src={infographicImageUrl(item)} alt={item.title} className="max-h-[70vh] w-full bg-canvas object-contain" />
          <div className="p-5"><h2 className="font-extrabold text-ink">{item.title}</h2><p className="mt-1 text-sm text-secondary">{item.classroomName}</p></div>
        </li>)}</ul> : <StudentEmptyState title="Chưa có học liệu trực quan nào được đăng cho lớp của bạn." description="Khi giáo viên đăng ảnh hoặc sơ đồ mới, bạn sẽ thấy ở đây." to="/student/classes" action="Xem lớp học" />}
    {lastPage > 1 && <nav className="flex items-center gap-3"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button>{page}/{lastPage}<button disabled={page >= lastPage} onClick={() => setPage(value => value + 1)}>Sau</button></nav>}
  </main>;
}
