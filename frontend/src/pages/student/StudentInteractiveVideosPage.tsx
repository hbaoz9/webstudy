import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import InteractiveVideoPlayer from "../../components/media/InteractiveVideoPlayer";
import { getStudentVideo, listStudentVideos, type StudentVideo } from "../../service/api/interactiveVideos";
import { Play } from "lucide-react";
import { StudentEmptyState } from "../../components/student/StudentEmptyState";

const button = "min-h-11 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink";

export default function StudentInteractiveVideosPage() {
  const { publicationId } = useParams();
  const { session } = useAuth();
  return <VideoSession key={`${session?.userId ?? "none"}:${publicationId ?? "list"}`} publicationId={publicationId} />;
}

function VideoSession({ publicationId }: { publicationId?: string }) {
  const [params] = useSearchParams();
  const classroomId = params.get("classId") ?? undefined;
  const [items, setItems] = useState<StudentVideo[]>([]);
  const [video, setVideo] = useState<StudentVideo | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(false); setVideo(null); setItems([]);
    const request = publicationId ? getStudentVideo(publicationId) : listStudentVideos(page, classroomId);
    void request.then(result => {
      if (!live) return;
      if (publicationId) setVideo(result as StudentVideo);
      else { const list = result as Awaited<ReturnType<typeof listStudentVideos>>;
        setItems(list.data); setLastPage(list.meta.lastPage); }
    }).catch(() => { if (live) setError(true); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [publicationId, classroomId, page, retry]);
  return <main className="mx-auto max-w-5xl space-y-5 pb-20">
    <header className="rounded-3xl border border-line bg-white px-6 py-7 shadow-card sm:px-8"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald">Học qua hình ảnh</p><h1 className="mt-2 text-2xl font-extrabold text-ink">Video tương tác</h1>
      <p className="mt-2 text-sm text-secondary">Video giáo viên đã chia sẻ với lớp của bạn.</p></header>
    {publicationId && <Link className="text-sm font-bold text-emerald-700" to="/student/videos">← Danh sách video</Link>}
    {loading ? <p role="status" className="rounded-xl bg-white p-5">Đang tải video…</p>
      : error ? <section role="alert" className="rounded-xl bg-white p-5">Không thể tải video hoặc video không còn khả dụng.
        <button className={`${button} ml-3`} onClick={() => setRetry(value => value + 1)}>Thử lại</button></section>
        : video ? <section className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-card">
          <h2 className="text-xl font-bold">{video.title}</h2><p className="text-sm text-secondary">{video.classroomName} · {video.checkpoints.length} câu hỏi trong video</p>
          <InteractiveVideoPlayer videoId={video.youtubeId} checkpoints={video.checkpoints} title={video.title} />
          <p className="text-sm text-secondary">Câu hỏi trong video dùng để tự luyện tập; chưa ghi điểm chính thức.</p>
        </section> : items.length ? <>
          <ul className="grid gap-4 sm:grid-cols-2">{items.map(item => <li key={item.id} className="overflow-hidden rounded-3xl border border-line bg-white shadow-card">
            <div className="flex h-32 items-center justify-center bg-emerald/10"><span className="grid size-16 place-items-center rounded-full border border-emerald/20 bg-white text-emerald"><Play className="ml-1 size-7" fill="currentColor" /></span></div>
            <div className="p-5"><h2 className="font-extrabold text-ink">{item.title}</h2><p className="mt-2 text-sm text-secondary">{item.classroomName} · {item.checkpoints.length} câu hỏi trong video</p>
            <Link className="mt-4 inline-flex min-h-11 items-center font-bold text-emerald-700" to={`/student/videos/${encodeURIComponent(item.id)}`}>Xem video →</Link></div>
          </li>)}</ul>
          {lastPage > 1 && <nav className="flex items-center gap-3"><button className={button} disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button>
            <span>{page}/{lastPage}</span><button className={button} disabled={page >= lastPage} onClick={() => setPage(value => value + 1)}>Sau</button></nav>}
        </> : <StudentEmptyState title="Chưa có video nào được đăng cho lớp của bạn." description="Video mới sẽ xuất hiện tại đây khi giáo viên chia sẻ với lớp." to="/student/classes" action="Xem lớp học" />}
  </main>;
}
