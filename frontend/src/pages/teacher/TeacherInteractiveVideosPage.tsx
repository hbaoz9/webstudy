import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import InteractiveVideoPlayer, { getYouTubeVideoId } from "../../components/media/InteractiveVideoPlayer";
import { listTeacherClassrooms, type TeacherClassroom } from "../../service/api/classrooms";
import { createTeacherVideo, getTeacherVideo, listTeacherVideos, publishTeacherVideo, updateTeacherVideo,
  type TeacherVideo, type VideoDraftInput } from "../../service/api/interactiveVideos";
import type { VideoCheckpoint } from "../../utils/teacherVideoStorage";

const field = "mt-1 min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";
const primary = "min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const secondary = "min-h-11 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink disabled:opacity-50";
const blank = (): VideoDraftInput => ({ title: "", youtubeId: "", lessonId: null, checkpoints: [] });
const blankCheckpoint = () => ({ atSeconds: "0", prompt: "", A: "", B: "", C: "", D: "", correctOption: "A" });

export default function TeacherInteractiveVideosPage() {
  const { videoId } = useParams();
  const { session } = useAuth();
  return <VideoSession key={`${session?.userId ?? "none"}:${videoId ?? "list"}`} videoId={videoId} />;
}

function VideoSession({ videoId }: { videoId?: string }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [videos, setVideos] = useState<TeacherVideo[]>([]);
  const [selected, setSelected] = useState<TeacherVideo | null>(null);
  const [classes, setClasses] = useState<TeacherClassroom[]>([]);
  const [draft, setDraft] = useState<VideoDraftInput>(blank);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [checkpoint, setCheckpoint] = useState(blankCheckpoint);
  const [editingCheckpoint, setEditingCheckpoint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    void Promise.all([listTeacherClassrooms(), videoId ? getTeacherVideo(videoId) : listTeacherVideos(page)])
      .then(([classrooms, result]) => {
        if (!live) return;
        setClasses(classrooms);
        if (videoId) {
          const video = result as TeacherVideo;
          setSelected(video); setDraft({ title: video.title, youtubeId: video.youtubeId,
            lessonId: video.lessonId, checkpoints: video.checkpoints });
          const fromClass = params.get("classId");
          setClassIds(video.classroomIds.length ? video.classroomIds : fromClass && classrooms.some(item => item.id === fromClass && item.status === "active") ? [fromClass] : []);
          setDirty(false);
        } else {
          const list = result as Awaited<ReturnType<typeof listTeacherVideos>>;
          setVideos(list.data); setLastPage(list.meta.lastPage);
        }
      }).catch(() => { if (live) setError("Không thể tải video từ máy chủ. Vui lòng thử lại."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [videoId, page, refresh, params]);

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const set = (change: Partial<VideoDraftInput>) => { setDraft(current => ({ ...current, ...change })); setDirty(true); setNotice(""); };
  const videoUrl = /^[A-Za-z0-9_-]{11}$/.test(draft.youtubeId)
    ? `https://www.youtube.com/watch?v=${draft.youtubeId}` : draft.youtubeId;

  async function save() {
    if (saving) return;
    setError(""); setNotice("");
    if (!draft.title.trim() || !/^[A-Za-z0-9_-]{11}$/.test(draft.youtubeId)) { setError("Nhập tên và đường dẫn YouTube hợp lệ."); return; }
    setSaving(true);
    try {
      const saved = selected ? await updateTeacherVideo(selected.id, draft, selected.version) : await createTeacherVideo(draft);
      setSelected(saved); setDirty(false); setNotice("Đã lưu bản nháp trên máy chủ.");
      if (!selected) navigate(`/teacher/videos/${encodeURIComponent(saved.id)}${params.get("classId") ? `?classId=${encodeURIComponent(params.get("classId")!)}` : ""}`, { replace: true });
    } catch { setError(selected ? "Chưa lưu được. Dữ liệu nhập vẫn còn; tải lại nếu máy chủ báo phiên bản đã thay đổi."
      : "Chưa xác nhận được việc tạo video. Kiểm tra danh sách trên máy chủ trước khi thử lại để tránh tạo trùng."); }
    finally { setSaving(false); }
  }

  function upsertCheckpoint() {
    const atSeconds = Number(checkpoint.atSeconds);
    if (!Number.isInteger(atSeconds) || atSeconds < 0 || !checkpoint.prompt.trim()
      || [checkpoint.A, checkpoint.B, checkpoint.C, checkpoint.D].some(value => !value.trim())
      || draft.checkpoints.some(item => item.id !== editingCheckpoint && item.atSeconds === atSeconds)) {
      setError("Hoàn thiện mốc thời gian, câu hỏi, bốn phương án và tránh trùng thời điểm."); return;
    }
    const item: VideoCheckpoint = { id: editingCheckpoint ?? `checkpoint-${crypto.randomUUID()}`,
      atSeconds, prompt: checkpoint.prompt.trim(), options: { A: checkpoint.A.trim(), B: checkpoint.B.trim(),
        C: checkpoint.C.trim(), D: checkpoint.D.trim() }, correctOption: checkpoint.correctOption as "A" | "B" | "C" | "D" };
    set({ checkpoints: [...draft.checkpoints.filter(value => value.id !== editingCheckpoint), item]
      .sort((a, b) => a.atSeconds - b.atSeconds) });
    setCheckpoint(blankCheckpoint()); setEditingCheckpoint(null); setError("");
  }

  function editCheckpoint(item: VideoCheckpoint) {
    setEditingCheckpoint(item.id);
    setCheckpoint({ atSeconds: String(item.atSeconds), prompt: item.prompt,
      A: item.options?.A ?? "", B: item.options?.B ?? "", C: item.options?.C ?? "", D: item.options?.D ?? "",
      correctOption: item.correctOption ?? "A" });
  }

  async function publish() {
    if (!selected || saving || dirty) return;
    if (!window.confirm(classIds.length ? "Đăng bản nháp hiện tại cho các lớp đã chọn?" : "Gỡ video khỏi tất cả lớp?")) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = await publishTeacherVideo(selected.id, classIds, selected.version);
      setSelected(saved); setClassIds(saved.classroomIds); setNotice(classIds.length ? "Đã đăng video cho lớp." : "Đã gỡ video khỏi lớp.");
    } catch { setError("Chưa xác nhận được việc đăng video. Tải lại dữ liệu máy chủ trước khi thử lại."); }
    finally { setSaving(false); }
  }

  return <main className="mx-auto max-w-6xl space-y-5 pb-20">
    <header className="flex flex-wrap items-start justify-between gap-3"><div>
      <h1 className="text-2xl font-extrabold text-ink">Video tương tác</h1>
      <p className="mt-1 text-sm text-secondary">Bản nháp và video đăng cho lớp được lưu trên máy chủ.</p></div>
      <Link className={secondary} to="/teacher/videos/local">Mở video cũ trên thiết bị</Link>
    </header>
    {loading ? <p role="status" className="rounded-2xl bg-white p-5">Đang tải video từ máy chủ…</p> : null}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}
      {loading === false && <button className={`${secondary} ml-3`} onClick={() => setRefresh(value => value + 1)}>Thử lại</button>}</div>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {!videoId ? !loading && <>
      <section className="rounded-2xl bg-white p-5 shadow-card"><h2 className="font-bold">Tạo video mới</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Tên video<input className={field} value={draft.title} onChange={event => set({ title: event.target.value })} /></label>
          <label className="text-sm">Liên kết YouTube<input className={field} value={videoUrl} onChange={event => set({ youtubeId: getYouTubeVideoId(event.target.value) ?? event.target.value })} /></label></div>
        <button className={`${primary} mt-4`} disabled={saving} onClick={() => void save()}>Tạo bản nháp</button>
      </section>
      <section className="space-y-3"><h2 className="font-bold">Video trên máy chủ</h2>
        {videos.length ? videos.map(video => <Link key={video.id} to={`/teacher/videos/${encodeURIComponent(video.id)}`}
          className="block rounded-xl border border-line bg-white p-4 shadow-card"><strong>{video.title}</strong>
          <p className="mt-1 text-sm text-secondary">{video.status === "published" ? `Đã đăng cho ${video.classroomIds.length} lớp` : "Bản nháp"} · {video.checkpoints.length} câu hỏi</p></Link>)
          : <p className="rounded-xl bg-white p-5 text-sm text-secondary">Chưa có video trên máy chủ. Video cũ trên thiết bị chưa được nhập tự động.</p>}
        {lastPage > 1 && <div className="flex items-center gap-3"><button className={secondary} disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button>
          <span>{page}/{lastPage}</span><button className={secondary} disabled={page >= lastPage} onClick={() => setPage(value => value + 1)}>Sau</button></div>}
      </section>
    </> : !loading && selected && <>
      <Link className="text-sm font-bold text-emerald-700" to="/teacher/videos" onClick={event => { if (dirty && !window.confirm("Bản nháp chưa lưu. Rời trang?")) event.preventDefault(); }}>← Danh sách video</Link>
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Soạn bản nháp</h2>
          <span className="text-sm">{dirty ? "Chưa lưu thay đổi" : "Đã lưu trên máy chủ"}</span></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Tên video<input className={field} value={draft.title} onChange={event => set({ title: event.target.value })} /></label>
          <label className="text-sm">Liên kết YouTube<input className={field} value={videoUrl} onChange={event => set({ youtubeId: getYouTubeVideoId(event.target.value) ?? event.target.value })} /></label></div>
        <label className="block text-sm">Bài học (tùy chọn)<input className={field} value={draft.lessonId ?? ""} onChange={event => set({ lessonId: event.target.value || null })}
          placeholder="Mã bài học có trong cơ sở dữ liệu" /></label>
        <button className={primary} disabled={saving || !dirty} onClick={() => void save()}>Lưu bản nháp</button>
      </section>
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-card"><h2 className="font-bold">Mốc câu hỏi ({draft.checkpoints.length})</h2>
        <div className="space-y-2">{draft.checkpoints.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm">
          <span>{Math.floor(item.atSeconds / 60)}:{String(item.atSeconds % 60).padStart(2, "0")} · {item.prompt}</span>
          <div className="flex gap-2"><button className={secondary} onClick={() => editCheckpoint(item)}>Sửa</button>
            <button className={secondary} onClick={() => set({ checkpoints: draft.checkpoints.filter(row => row.id !== item.id) })}>Bỏ</button></div>
        </div>)}</div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Giây trong video<input className={field} type="number" min="0" value={checkpoint.atSeconds}
          onChange={event => setCheckpoint(current => ({ ...current, atSeconds: event.target.value }))} /></label>
          <label className="text-sm">Câu hỏi<input className={field} value={checkpoint.prompt} onChange={event => setCheckpoint(current => ({ ...current, prompt: event.target.value }))} /></label>
          {(["A", "B", "C", "D"] as const).map(letter => <label key={letter} className="text-sm">Phương án {letter}<input className={field} value={checkpoint[letter]}
            onChange={event => setCheckpoint(current => ({ ...current, [letter]: event.target.value }))} /></label>)}</div>
        <label className="block text-sm">Đáp án đúng<select className={field} value={checkpoint.correctOption}
          onChange={event => setCheckpoint(current => ({ ...current, correctOption: event.target.value }))}>
          {(["A", "B", "C", "D"] as const).map(letter => <option key={letter}>{letter}</option>)}</select></label>
        <button className={secondary} onClick={upsertCheckpoint}>{editingCheckpoint ? "Cập nhật câu hỏi" : "Thêm câu hỏi"}</button>
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-card"><h2 className="font-bold">Xem thử bản nháp</h2>
        <div className="mt-3"><InteractiveVideoPlayer videoId={draft.youtubeId} checkpoints={draft.checkpoints} title={draft.title} /></div></section>
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-card"><h2 className="font-bold">Đăng cho lớp</h2>
        {dirty && <p className="text-sm text-amber-700">Lưu bản nháp trước khi đăng. Bản đã đăng chưa đổi cho tới khi xác nhận đăng lại.</p>}
        <div className="grid gap-2 sm:grid-cols-2">{classes.filter(item => item.status === "active" || selected.classroomIds.includes(item.id)).map(item =>
          <label key={item.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-line p-3 text-sm"><input type="checkbox" checked={classIds.includes(item.id)}
            onChange={event => setClassIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />{item.name}</label>)}</div>
        <button className={primary} disabled={saving || dirty || classes.length === 0} onClick={() => void publish()}>{classIds.length ? "Đăng video cho lớp" : "Gỡ video khỏi tất cả lớp"}</button>
        {selected.publications.length > 0 && <div className="space-y-3 border-t border-line pt-4"><h3 className="font-semibold">Bản đang xem được trong lớp</h3>
          {selected.publications.map(item => <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm">
            <p>{classes.find(classroom => classroom.id === item.classroomId)?.name ?? "Lớp cũ"} · {item.snapshot.title} · {item.snapshot.checkpoints.length} câu</p>
          </div>)}</div>}
      </section>
    </>}
    {params.get("classId") && <p className="text-sm text-secondary">Lớp bắt đầu từ liên kết: {classes.find(item => item.id === params.get("classId"))?.name ?? "không khả dụng"}. Chọn lớp ở bước đăng video.</p>}
  </main>;
}
