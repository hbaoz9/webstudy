import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Copy, MoreHorizontal, Pencil, Plus, Trash2, Video } from "lucide-react";
import InteractiveVideoPlayer, { getYouTubeVideoId, type VideoEditorControl } from "../../components/media/InteractiveVideoPlayer";
import Dialog from "../../components/common/Dialog";
import { useTeacherData } from "../../contexts/TeacherDataContext";
import { geo10Chapters, geo10Lessons } from "../../data/geo10Curriculum";
import { TEACHER_VIDEOS_KEY, loadTeacherVideos, saveTeacherVideos, videoClassIds, formatVideoTime, type InteractiveVideo, type VideoCheckpoint } from "../../utils/teacherVideoStorage";
import type { AnswerOption } from "../../types/question";

const letters = ["A", "B", "C", "D"] as const;
const emptyOptions = (): Record<AnswerOption, string> => ({ A: "", B: "", C: "", D: "" });
const inputStyle = "mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm font-bold text-ink hover:bg-canvas";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald px-4 text-sm font-bold text-white disabled:opacity-50";
function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}
function VideoThumbnail({ id, title }: { id: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100">{failed ? <span className="absolute inset-0 grid place-items-center text-secondary">
    <Video aria-label="Ảnh bìa không tải được" className="size-10" />
  </span> : <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={`Ảnh bìa ${title}`} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />}</div>;
}
function LessonSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const options = geo10Lessons.filter((lesson) => lesson.id === value || normalize(`Bài ${lesson.number} ${lesson.title}`).includes(normalize(search)));
  return <div className="space-y-2">
    <label className="block text-sm font-semibold">Tìm bài học<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên hoặc số bài học" className={inputStyle} />
    </label>
    <label className="block text-sm font-semibold">Bài học (có thể chọn sau)<select aria-label="Bài học (có thể chọn sau)" value={value} onChange={(event) => onChange(event.target.value)} className={inputStyle}>
      <option value="">Chưa gắn bài học</option>{geo10Chapters.map((chapter) => {
        const lessons = options.filter((lesson) => lesson.chapterId === chapter.id);
        return lessons.length ? <optgroup key={chapter.id} label={`Chương ${chapter.number}. ${chapter.title}`}>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>Bài {lesson.number}. {lesson.title}</option>)}</optgroup> : null;
      })}</select>
    </label>
    {options.length === 0 && <p className="text-sm text-secondary">Không tìm thấy bài học phù hợp.</p>}
  </div>;
}

type UndoChange = { id: string; previous?: InteractiveVideo; after: string; index: number };
export default function TeacherVideosPage() {
  const navigate = useNavigate();
  const { videoId } = useParams();
  const [params, setParams] = useSearchParams();
  const { classrooms } = useTeacherData();
  const [videos, setVideos] = useState(loadTeacherVideos);
  const video = videos.find((item) => item.id === videoId);
  const query = params.get("q") ?? "";
  const filter = params.get("status") ?? "all";
  const lessonFilter = params.get("lesson") ?? "";
  const [limit, setLimit] = useState(12);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [undo, setUndo] = useState<UndoChange | null>(null);
  const [modal, setModal] = useState<"create" | "info" | "question" | "publish" | "preview" | null>(null);
  const [target, setTarget] = useState<InteractiveVideo | undefined>();
  const [pending, setPending] = useState<{ title: string; description: string; apply: () => boolean } | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formLesson, setFormLesson] = useState("");
  const titleEdited = useRef(false);
  const [metadata, setMetadata] = useState("");
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [timeInput, setTimeInput] = useState("00:00");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(emptyOptions);
  const [answer, setAnswer] = useState<AnswerOption>("A");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [classSearch, setClassSearch] = useState("");
  const [allowEmpty, setAllowEmpty] = useState(false);
  const [clock, setClock] = useState({ seconds: 0, duration: 0 });
  const control = useRef<VideoEditorControl | null>(null);
  const checkpoints = [...(video?.checkpoints ?? [])].sort((a, b) => a.atSeconds - b.atSeconds);
  const parsedId = getYouTubeVideoId(formUrl);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 10000);
    return () => window.clearTimeout(timer);
  }, [undo]);
  useEffect(() => { setLimit(12); }, [query, filter, lessonFilter]);
  useEffect(() => {
    const refresh = (event: StorageEvent) => { if (event.key === TEACHER_VIDEOS_KEY || event.key === null) setVideos(loadTeacherVideos()); };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  useEffect(() => {
    if (modal !== "create" || !parsedId) { setMetadata(""); return; }
    const abort = new AbortController();
    let cancelled = false;
    setMetadata("Đang lấy tên video…");
    const timer = window.setTimeout(() => { abort.abort(); if (!cancelled) setMetadata("Không lấy được tên từ YouTube. Bạn có thể nhập tên và tiếp tục."); }, 8000);
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${parsedId}`)}&format=json`, { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không lấy được tên");
        const data: unknown = await response.json();
        if (cancelled) return;
        if (data && typeof data === "object" && "title" in data && typeof data.title === "string") {
          if (!titleEdited.current) setFormTitle(data.title);
          setMetadata("Đã lấy tên từ YouTube. Bạn có thể sửa tên.");
        } else throw new Error("Thiếu tên");
      }).catch(() => { if (!cancelled) setMetadata("Không lấy được tên từ YouTube. Bạn vẫn có thể nhập tên và tiếp tục."); })
      .finally(() => window.clearTimeout(timer));
    return () => { cancelled = true; window.clearTimeout(timer); abort.abort(); };
  }, [modal, parsedId]);

  function changeVideo(previous: InteractiveVideo | undefined, next: InteractiveVideo | undefined, notice: string): boolean {
    const id = previous?.id ?? next?.id;
    if (!id) return false;
    try {
      const current = loadTeacherVideos();
      const index = current.findIndex((item) => item.id === id);
      if (JSON.stringify(current[index]) !== JSON.stringify(previous)) {
        setError("Video đã thay đổi ở tab khác. Hãy đóng hộp thoại và tải lại trước khi sửa tiếp.");
        return false;
      }
      const updated = next ? index < 0 ? [next, ...current] : current.map((item) => item.id === id ? next : item) : current.filter((item) => item.id !== id);
      saveTeacherVideos(updated);
      setVideos(updated);
      setUndo({ id, previous, after: JSON.stringify(next) ?? "", index: Math.max(0, index) });
      setError(""); setMessage(notice);
      return true;
    } catch { setError("Không thể lưu video trong trình duyệt. Nội dung đang nhập được giữ lại; hãy thử lại."); return false; }
  }
  function undoChange() {
    if (!undo) return;
    try {
      const current = loadTeacherVideos();
      if ((JSON.stringify(current.find((item) => item.id === undo.id)) ?? "") !== undo.after) {
        setError("Video đã thay đổi ở nơi khác; không thể hoàn tác thao tác này."); setUndo(null); return;
      }
      const restored = current.filter((item) => item.id !== undo.id);
      if (undo.previous) restored.splice(undo.index, 0, undo.previous);
      saveTeacherVideos(restored);
      setVideos(restored); setUndo(null); setError(""); setMessage("Đã hoàn tác. Bản trước đã được khôi phục.");
    } catch { setError("Không lưu được hoàn tác. Dữ liệu chưa thay đổi; hãy thử lại."); }
  }
  function closeModal() { setModal(null); setError(""); }
  function openInfo(item?: InteractiveVideo) {
    titleEdited.current = Boolean(item);
    setTarget(item); setFormTitle(item?.title ?? ""); setFormUrl(item ? `https://www.youtube.com/watch?v=${item.youtubeId}` : ""); setFormLesson(item?.lessonId ?? ""); setError(""); setModal(item ? "info" : "create");
  }
  function confirmChange(title: string, description: string, apply: () => boolean) {
    setError(""); setPending({ title, description, apply });
  }
  function saveInfo(event: FormEvent) {
    event.preventDefault();
    if (!formTitle.trim()) { setError("Nhập tên video."); return; }
    if (!parsedId) { setError("Link này chưa đúng. Hãy sao chép từ thanh địa chỉ YouTube."); return; }
    if (formLesson && !geo10Lessons.some((lesson) => lesson.id === formLesson)) { setError("Chọn bài học hợp lệ hoặc để trống."); return; }
    const next: InteractiveVideo = target && modal === "info" ? { ...target, title: formTitle.trim(), youtubeId: parsedId, lessonId: formLesson || undefined } : { id: crypto.randomUUID(), title: formTitle.trim(), youtubeId: parsedId, lessonId: formLesson || undefined, status: "draft", checkpoints: [], createdAt: new Date().toISOString() };
    const apply = () => {
      if (!changeVideo(modal === "info" ? target : undefined, next, modal === "info" ? "Đã lưu thông tin video." : "Đã thêm video.")) return false;
      setModal(null);
      if (modal === "create") navigate(`/teacher/videos/${next.id}`);
      return true;
    };
    if (target?.status === "published" && modal === "info") confirmChange("Cập nhật video đã đăng?", "Thay đổi thông tin sẽ hiển thị ngay cho học sinh trong các lớp đã đăng.", apply);
    else apply();
  }
  function duplicate(item: InteractiveVideo) {
    const next: InteractiveVideo = { ...item, id: crypto.randomUUID(), title: `${item.title} (bản sao)`, status: "draft", classroomIds: [], classroomId: undefined, publishedAt: undefined, checkpoints: item.checkpoints.map((checkpoint) => ({ ...checkpoint, id: `checkpoint-${crypto.randomUUID()}` })), createdAt: new Date().toISOString() };
    changeVideo(undefined, next, "Đã nhân bản thành video nháp độc lập.");
  }
  function deleteVideo(item: InteractiveVideo) {
    confirmChange("Xóa video?", `“${item.title}” cùng các câu hỏi sẽ bị xóa${item.status === "published" ? " và không còn hiển thị cho học sinh" : ""}. Có thể Hoàn tác trong 10 giây.`, () => changeVideo(item, undefined, "Đã xóa video."));
  }
  function openQuestion(checkpoint?: VideoCheckpoint) {
    if (!video) return;
    control.current?.pause();
    setTarget(video); setCheckpointId(checkpoint?.id ?? null);
    const currentTime = control.current?.getCurrentTime();
    setTimeInput(formatVideoTime(checkpoint?.atSeconds ?? (Number.isFinite(currentTime) ? currentTime ?? 0 : clock.seconds)));
    setPrompt(checkpoint?.prompt ?? ""); setOptions(checkpoint?.options ?? emptyOptions()); setAnswer(checkpoint?.correctOption ?? "A"); setError(""); setModal("question");
  }
  function saveQuestion(event: FormEvent) {
    event.preventDefault(); if (!target) return;
    const match = /^(\d{1,4}):([0-5]\d)$/.exec(timeInput.trim());
    if (!match) { setError("Nhập mốc phút:giây, ví dụ 01:30."); return; }
    const atSeconds = Number(match[1]) * 60 + Number(match[2]);
    if (target.checkpoints.some((item) => item.id !== checkpointId && item.atSeconds === atSeconds)) { setError("Mốc này đã có câu hỏi khác."); return; }
    if (clock.duration > 0 && target.id === videoId && atSeconds > clock.duration) { setError("Mốc câu hỏi nằm ngoài thời lượng video."); return; }
    if (!prompt.trim() || letters.some((letter) => !options[letter]?.trim())) { setError("Nhập nội dung câu hỏi và đủ bốn lựa chọn."); return; }
    const checkpoint: VideoCheckpoint = { id: checkpointId ?? `checkpoint-${crypto.randomUUID()}`, atSeconds, prompt: prompt.trim(), options: { A: options.A.trim(), B: options.B.trim(), C: options.C.trim(), D: options.D.trim() }, correctOption: answer };
    const next = { ...target, checkpoints: [...target.checkpoints.filter((item) => item.id !== checkpointId), checkpoint].sort((a, b) => a.atSeconds - b.atSeconds) };
    const apply = () => { if (!changeVideo(target, next, "Đã lưu câu hỏi.")) return false; setModal(null); return true; };
    if (target.status === "published") confirmChange("Cập nhật câu hỏi trong video đã đăng?", "Thay đổi sẽ hiển thị ngay cho học sinh. Bạn có thể Hoàn tác trong 10 giây.", apply); else apply();
  }
  function deleteQuestion(item: VideoCheckpoint) {
    if (!video) return;
    confirmChange("Xóa câu hỏi?", `Xóa câu hỏi tại ${formatVideoTime(item.atSeconds)}?${video.status === "published" ? " Thay đổi áp dụng ngay cho học sinh." : ""}${video.checkpoints.length === 1 ? " Video sẽ không còn câu hỏi tương tác." : ""}`, () => changeVideo(video, { ...video, checkpoints: video.checkpoints.filter((checkpoint) => checkpoint.id !== item.id) }, "Đã xóa câu hỏi."));
  }
  function openPublish() {
    if (!video) return;
    setTarget(video); setSelectedClasses(videoClassIds(video)); setClassSearch(""); setAllowEmpty(false); setError(""); setModal("publish");
  }
  function savePublication(event: FormEvent) {
    event.preventDefault(); if (!target) return;
    const previousIds = videoClassIds(target);
    const newlySelected = selectedClasses.filter((id) => !previousIds.includes(id));
    if (newlySelected.some((id) => !classrooms.some((item) => item.id === id && item.status !== "archived"))) { setError("Chỉ đăng mới cho lớp đang hoạt động."); return; }
    if (selectedClasses.length && target.checkpoints.some((item) => !item.options || letters.some((letter) => !item.options?.[letter]?.trim()) || !item.correctOption)) { setError("Hoàn thiện đáp án cho các câu hỏi trước khi đăng."); return; }
    if (selectedClasses.length && target.checkpoints.length === 0 && !allowEmpty) { setError("Video chưa có câu hỏi. Hãy xác nhận nếu bạn vẫn muốn đăng."); return; }
    const next: InteractiveVideo = { ...target, status: selectedClasses.length ? "published" : "draft", classroomIds: selectedClasses, classroomId: selectedClasses[0], publishedAt: selectedClasses.length ? new Date().toISOString() : undefined };
    const names = selectedClasses.map((id) => classrooms.find((item) => item.id === id)?.name ?? "Lớp không còn tồn tại").join(", ");
    if (changeVideo(target, next, selectedClasses.length ? `Đã đăng cho ${names}.` : "Đã gỡ khỏi các lớp. Video được giữ trong bản nháp.")) setModal(null);
  }
  function filterList(key: string, value: string) {
    setParams((previous) => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true });
  }
  function seek(seconds: number) { control.current?.seekTo(seconds); setClock((current) => ({ ...current, seconds })); }
  const filtered = videos.filter((item) => normalize(item.title).includes(normalize(query)) && (filter === "all" || item.status === filter) && (!lessonFilter || item.lessonId === lessonFilter));
  const publishedIds = target ? videoClassIds(target) : [];
  const shownClasses = classrooms.filter((item) => (item.status !== "archived" || publishedIds.includes(item.id)) && normalize(item.name).includes(normalize(classSearch)));
  const notices = <>{message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-900 [overflow-wrap:anywhere]">{message}{undo && <button type="button" onClick={undoChange} className="ml-2 min-h-11 px-2 font-bold underline">Hoàn tác</button>}</p>}{error && !modal && !pending && <p role="alert" className="text-sm text-red-600">{error}</p>}</>;
  function videoMenu(item: InteractiveVideo) {
    return <details className="relative shrink-0">
      <summary aria-label={`Thao tác video ${item.title}`} className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-xl border border-line">
        <MoreHorizontal aria-hidden="true" className="size-5" />
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-line bg-white p-2 shadow-lg">{[
        { label: "Sửa thông tin", icon: Pencil, run: () => openInfo(item) },
        { label: "Nhân bản", icon: Copy, run: () => duplicate(item) },
        { label: "Xóa video", icon: Trash2, run: () => deleteVideo(item) },
      ].map(({ label, icon: Icon, run }) => <button key={label} type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); run(); }} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold hover:bg-canvas ${label === "Xóa video" ? "border-t border-line text-red-700" : "text-ink"}`}>
        <Icon aria-hidden="true" className="size-4" />{label}</button>)}</div>
    </details>;
  }
  return <div className={`min-w-0 space-y-5 [overflow-wrap:anywhere] ${video ? "pb-20 lg:pb-0" : ""}`}>
    {!videoId ? <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Video tương tác</h1>
          <p className="mt-1 text-sm text-secondary">Chọn video để soạn câu hỏi và đăng cho lớp.</p>
        </div>
        <button type="button" onClick={() => openInfo()} className={primaryButton}>
          <Plus aria-hidden="true" className="size-4" />Thêm video</button>
      </header>
      {notices}
      <section aria-label="Lọc video" className="space-y-3 rounded-2xl bg-white p-4 shadow-card">
        <label className="block text-sm font-semibold">Tìm video<input value={query} onChange={(event) => filterList("q", event.target.value)} placeholder="Nhập tên video" className={inputStyle} />
        </label>
        <div className="flex flex-wrap items-center gap-2">{([['all', 'Tất cả'], ['published', 'Đã đăng'], ['draft', 'Bản nháp']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => filterList("status", value)} className={`${secondaryButton} ${filter === value ? "border-emerald-700 bg-emerald-50 text-emerald-800" : ""}`}>{label}</button>)}<label className="min-w-0 flex-1 text-sm font-semibold">
          <span className="sr-only">Lọc theo bài học</span>
          <select aria-label="Lọc theo bài học" value={lessonFilter} onChange={(event) => filterList("lesson", event.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm">
            <option value="">Tất cả bài học</option>{geo10Chapters.map((chapter) => <optgroup key={chapter.id} label={`Chương ${chapter.number}. ${chapter.title}`}>{geo10Lessons.filter((lesson) => lesson.chapterId === chapter.id).map((lesson) => <option key={lesson.id} value={lesson.id}>Bài {lesson.number}. {lesson.title}</option>)}</optgroup>)}</select>
        </label>
        </div>
      </section>
      <section aria-label="Danh sách video" className="space-y-4">
        <p className="text-sm text-secondary">{filtered.length} video · đang hiển thị {Math.min(limit, filtered.length)}</p>{filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-secondary">{videos.length ? "Không tìm thấy video phù hợp. Thử đổi tìm kiếm hoặc bộ lọc." : "Dán link YouTube để tạo video tương tác đầu tiên."}</p>{!videos.length && <button type="button" onClick={() => openInfo()} className={`${primaryButton} mt-4`}>Thêm video đầu tiên</button>}</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.slice(0, limit).map((item) => {
            const lesson = geo10Lessons.find((entry) => entry.id === item.lessonId); const ids = videoClassIds(item); const names = ids.map((id) => classrooms.find((entry) => entry.id === id)?.name ?? "Lớp không còn tồn tại").join(", ");
            return <article key={item.id} className="min-w-0 rounded-2xl bg-white p-3 shadow-card">
              <Link to={`/teacher/videos/${item.id}${params.toString() ? `?${params}` : ""}`} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
                <VideoThumbnail key={item.youtubeId} id={item.youtubeId} title={item.title} />
                <h2 title={item.title} className="mt-3 truncate text-base font-extrabold">{item.title}</h2>
                <p title={lesson?.title} className="mt-1 truncate text-sm text-secondary">{lesson ? `Bài ${lesson.number}. ${lesson.title}` : "Chưa gắn bài học"}</p>
              </Link>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="min-w-0 text-[13px] text-secondary">
                  <span className={`rounded-full px-2 py-1 font-semibold ${item.status === "published" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{item.status === "published" ? "Đã đăng" : "Bản nháp"}</span>
                  <span className="ml-2">{item.checkpoints.length} câu hỏi</span>
                </p>{videoMenu(item)}</div>
              <p title={names} className="mt-1 truncate text-[13px] text-secondary">{ids.length ? names : "Chưa đăng cho lớp"}</p>
            </article>;
          })}</div>}{limit < filtered.length && <button type="button" onClick={() => setLimit((current) => current + 12)} className={secondaryButton}>Xem thêm 12 video</button>}</section>
    </> : video ? <>
      <header className="space-y-3">
        <Link to={`/teacher/videos${params.toString() ? `?${params}` : ""}`} className={secondaryButton}>← Danh sách video</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold">{video.title}</h1>
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${video.status === "published" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{video.status === "published" ? "Đã đăng" : "Bản nháp"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setTarget(video); setModal("preview"); }} className={secondaryButton}>Xem thử</button>
            <button type="button" onClick={openPublish} className={primaryButton}>Đăng cho lớp ▾</button>{videoMenu(video)}</div>
        </div>
      </header>
      {notices}
      <ol aria-label="Các bước soạn video" className="flex flex-wrap gap-3 rounded-xl bg-white p-3 text-sm">
        <li>① Video ✓</li>
        <li>② Câu hỏi ({checkpoints.length})</li>
        <li>③ {video.status === "published" ? "Đã đăng cho lớp ✓" : "Đăng cho lớp"}</li>
      </ol>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="Trình phát soạn video" className="min-w-0 space-y-3 rounded-2xl bg-white p-4 shadow-card">
          <InteractiveVideoPlayer videoId={video.youtubeId} title={video.title} authoring onClock={(seconds, duration) => { if (Number.isFinite(seconds) && Number.isFinite(duration)) setClock({ seconds: Math.max(0, seconds), duration: Math.max(0, duration) }); }} onController={(value) => { control.current = value; if (!value) setClock({ seconds: 0, duration: 0 }); }} />
          <div className="relative h-16 rounded-lg bg-slate-100" aria-label="Mốc câu hỏi trên video">
            <input type="range" aria-label="Tua video" min={0} max={Math.max(1, clock.duration)} value={Math.min(clock.seconds, Math.max(1, clock.duration))} disabled={clock.duration <= 0} onChange={(event) => seek(Number(event.target.value))} className="absolute inset-x-3 top-2 h-3 w-[calc(100%-1.5rem)] accent-emerald" />{clock.duration > 0 && checkpoints.map((item, index) => <button key={item.id} type="button" title={`${formatVideoTime(item.atSeconds)} · ${item.prompt}`} aria-label={`Tua đến câu ${index + 1} tại ${formatVideoTime(item.atSeconds)}`} onClick={() => seek(item.atSeconds)} style={{ left: `${Math.min(95, Math.max(5, item.atSeconds / clock.duration * 100))}%` }} className="absolute bottom-0 min-h-11 min-w-11 -translate-x-1/2 rounded-full text-sm font-bold text-emerald-900">
              <span className="inline-grid size-5 place-items-center rounded-full bg-emerald-700 text-[11px] text-white">{index + 1}</span>
            </button>)}</div>
          <p className="text-sm text-secondary">Mốc hiện tại: {formatVideoTime(clock.seconds)}{clock.duration > 0 ? ` / ${formatVideoTime(clock.duration)}` : " · Bạn có thể nhập mốc thủ công khi trình phát chưa sẵn sàng."}</p>
          <p className="text-sm text-secondary">Bài học: {geo10Lessons.find((item) => item.id === video.lessonId)?.title ?? "Chưa gắn bài học"}</p>
          <p className="text-sm text-secondary">Lớp: {videoClassIds(video).map((id) => classrooms.find((item) => item.id === id)?.name ?? "Lớp không còn tồn tại").join(", ") || "Chưa đăng"}</p>
        </section>
        <section aria-label="Câu hỏi theo thời gian" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">Câu hỏi theo thời gian</h2>
            <button type="button" onClick={() => openQuestion()} className={`${primaryButton} hidden lg:inline-flex`}>+ Thêm câu hỏi tại {formatVideoTime(clock.seconds)}</button>
          </div>{!checkpoints.length ? <p className="rounded-2xl bg-white p-5 text-sm text-secondary">Tua video tới mốc cần hỏi, rồi chọn Thêm câu hỏi. Bạn cũng có thể chỉnh mốc thủ công.</p> : <div className="space-y-2">{checkpoints.map((item, index) => <article key={item.id} className="min-w-0 rounded-xl bg-white px-3 shadow-card">
            <div className="flex items-start gap-1">
              <button type="button" onClick={() => seek(item.atSeconds)} aria-label={`Tua đến ${formatVideoTime(item.atSeconds)}`} className="min-h-11 shrink-0 px-1 text-sm font-bold text-emerald-800">{formatVideoTime(item.atSeconds)}</button>
              <details className="min-w-0 flex-1">
                <summary title={item.prompt} className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                  <span className="min-w-0 flex-1 truncate">{item.prompt}</span>
                  <span className="hidden shrink-0 text-[13px] text-secondary sm:inline">{item.correctOption ? `Đáp án ${item.correctOption}` : "Chưa có đáp án"}</span>
                </summary>
                <div className="space-y-2 pb-3 text-sm">
                  <p className="whitespace-pre-wrap">{item.prompt}</p>{letters.map((letter) => <p key={letter} className={`rounded-lg p-2 ${item.correctOption === letter ? "bg-emerald-50 text-emerald-900" : "bg-canvas"}`}>{letter}. {item.options?.[letter] || "Chưa nhập lựa chọn"}</p>)}<p className="text-secondary">{item.correctOption ? `Đáp án ${item.correctOption}` : "Chưa chọn đáp án"}</p>
                </div>
              </details>
              <button type="button" onClick={() => openQuestion(item)} aria-label={`Sửa câu ${index + 1}`} className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-canvas">
                <Pencil aria-hidden="true" className="size-4" />
              </button>
              <details className="relative">
                <summary aria-label={`Thao tác câu ${index + 1}`} className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-lg hover:bg-canvas">
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                </summary>
                <div className="absolute right-0 top-full z-20 w-44 rounded-xl border border-line bg-white p-2 shadow-lg">
                  <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); deleteQuestion(item); }} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-sm font-bold text-red-700">
                    <Trash2 aria-hidden="true" className="size-4" />Xóa câu hỏi</button>
                </div>
              </details>
            </div>
          </article>)}</div>}</section>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white p-3 lg:hidden">
        <button type="button" onClick={() => openQuestion()} className={`${primaryButton} w-full`}>+ Thêm câu hỏi tại {formatVideoTime(clock.seconds)}</button>
      </div>
    </> : <>
      <Link to="/teacher/videos" className={secondaryButton}>← Danh sách video</Link>{notices}<p className="rounded-xl bg-white p-5 text-sm">Video không còn tồn tại. Nếu vừa xóa, bạn có thể Hoàn tác trong thông báo.</p>
    </>}
    {(modal === "create" || modal === "info") && <Dialog title={modal === "create" ? "Thêm video" : "Sửa thông tin video"} onClose={closeModal}>
      <form onSubmit={saveInfo} noValidate className="space-y-4">
        <label className="block text-sm font-semibold">Liên kết YouTube<input autoFocus value={formUrl} onChange={(event) => { setFormUrl(event.target.value); if (modal === "create" && !titleEdited.current) setFormTitle(""); }} placeholder="https://www.youtube.com/watch?v=..." className={inputStyle} />
        </label>{formUrl.trim() && !parsedId && <p role="alert" className="text-sm text-red-700">Link này chưa đúng. Hãy sao chép từ thanh địa chỉ YouTube.</p>}{parsedId && <VideoThumbnail key={parsedId} id={parsedId} title={formTitle || "Video mới"} />}{metadata && <p role="status" className="text-sm text-secondary">{metadata}</p>}<label className="block text-sm font-semibold">Tên video<input value={formTitle} onChange={(event) => { titleEdited.current = true; setFormTitle(event.target.value); }} maxLength={300} className={inputStyle} />
        </label>
        <LessonSelect value={formLesson} onChange={setFormLesson} />{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={closeModal} className={secondaryButton}>Hủy</button>
          <button type="submit" className={primaryButton}>{modal === "create" ? "Tiếp tục: thêm câu hỏi" : "Lưu thông tin"}</button>
        </div>
      </form>
    </Dialog>}
    {modal === "question" && target && <Dialog title={checkpointId ? "Sửa câu hỏi" : "Thêm câu hỏi"} onClose={closeModal} side>
      <form onSubmit={saveQuestion} noValidate className="space-y-4">
        <label className="block text-sm font-semibold">Mốc thời gian (phút:giây)<input value={timeInput} onChange={(event) => setTimeInput(event.target.value)} placeholder="01:30" className={inputStyle} />
        </label>
        <label className="block text-sm font-semibold">Nội dung câu hỏi<textarea aria-label="Nội dung câu hỏi" rows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} className={inputStyle} />
        </label>{letters.map((letter) => <label key={letter} className="block text-sm font-semibold">Lựa chọn {letter}<input value={options[letter]} onChange={(event) => setOptions((current) => ({ ...current, [letter]: event.target.value }))} className={inputStyle} />
        </label>)}<label className="block text-sm font-semibold">Đáp án đúng<select aria-label="Đáp án đúng" value={answer} onChange={(event) => { const value = event.target.value; if (letters.some((letter) => letter === value)) setAnswer(value as AnswerOption); }} className={inputStyle}>{letters.map((letter) => <option key={letter}>{letter}</option>)}</select>
        </label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-line bg-white py-3">
          <button type="button" onClick={closeModal} className={secondaryButton}>Hủy</button>
          <button type="submit" className={primaryButton}>Lưu câu hỏi</button>
        </div>
      </form>
    </Dialog>}
    {modal === "publish" && target && <Dialog title="Đăng cho lớp" onClose={closeModal}>
      <form onSubmit={savePublication} noValidate className="space-y-4">
        <p className="text-sm text-secondary">Chọn các lớp muốn đăng. Bỏ chọn hoặc bấm Gỡ để gỡ khỏi lớp; thay đổi chỉ áp dụng khi bạn bấm Áp dụng.</p>
        <label className="block text-sm font-semibold">Tìm lớp<input value={classSearch} onChange={(event) => setClassSearch(event.target.value)} className={inputStyle} />
        </label>
        <div className="max-h-64 space-y-1 overflow-y-auto">{shownClasses.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-lg bg-canvas px-3">
          <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-sm">
            <input type="checkbox" checked={selectedClasses.includes(item.id)} onChange={(event) => setSelectedClasses((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} className="shrink-0 accent-emerald" />
            <span className="min-w-0">{item.name}{publishedIds.includes(item.id) ? " · Đã đăng ✓" : ""}{item.status === "archived" ? " · Đã lưu trữ" : ""}</span>
          </label>{publishedIds.includes(item.id) && selectedClasses.includes(item.id) && <button type="button" aria-label={`Gỡ khỏi lớp ${item.name}`} onClick={() => setSelectedClasses((current) => current.filter((id) => id !== item.id))} className="min-h-11 px-2 text-sm font-bold text-red-700">Gỡ</button>}</div>)}</div>{shownClasses.length === 0 && <p className="text-sm text-secondary">Không có lớp phù hợp. Tạo lớp hoặc đổi từ khóa tìm kiếm.</p>}{selectedClasses.filter((id) => !classrooms.some((item) => item.id === id)).map((id) => <button key={id} type="button" onClick={() => setSelectedClasses((current) => current.filter((value) => value !== id))} className={secondaryButton}>Gỡ lớp không còn tồn tại</button>)}{target.checkpoints.length === 0 && <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <input type="checkbox" checked={allowEmpty} onChange={(event) => setAllowEmpty(event.target.checked)} className="mt-1 accent-emerald" />
            <span>Video chưa có câu hỏi. Tôi vẫn muốn đăng video này cho lớp.</span>
          </label>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={closeModal} className={secondaryButton}>Hủy</button>
          <button type="submit" className={primaryButton}>Áp dụng cho {selectedClasses.length} lớp</button>
        </div>
      </form>
    </Dialog>}
    {modal === "preview" && target && <Dialog title="Xem thử video như học sinh" onClose={closeModal}>
      <InteractiveVideoPlayer videoId={target.youtubeId} checkpoints={target.checkpoints} title={target.title} />
    </Dialog>}
    {pending && <Dialog title={pending.title} onClose={() => { setPending(null); setError(""); }}>
      <p className="text-sm leading-6 text-secondary">{pending.description}</p>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => { setPending(null); setError(""); }} className={secondaryButton}>Hủy</button>
        <button type="button" onClick={() => { if (pending.apply()) setPending(null); }} className={primaryButton}>Xác nhận</button>
      </div>
    </Dialog>}
  </div>;
}
