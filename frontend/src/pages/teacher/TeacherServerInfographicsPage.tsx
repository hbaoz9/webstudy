import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { geo10Chapters } from "../../data/geo10Curriculum";
import { useAuth } from "../../contexts/AuthContext";
import { listTeacherClassrooms, type TeacherClassroom } from "../../service/api/classrooms";
import { infographicImageUrl, listTeacherInfographics, publishInfographic, uploadInfographic, type InfographicAsset } from "../../service/api/infographics";

const button = "min-h-11 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold disabled:opacity-50";

export default function TeacherServerInfographicsPage() {
  const { session } = useAuth();
  return <Gallery key={session?.userId ?? "none"} />;
}

function Gallery() {
  const [params, setParams] = useSearchParams();
  const chapter = geo10Chapters.find(item => item.id === params.get("chapter")) ?? geo10Chapters[0];
  const [items, setItems] = useState<InfographicAsset[]>([]);
  const [classes, setClasses] = useState<TeacherClassroom[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState<InfographicAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(""); setItems([]);
    void Promise.all([listTeacherInfographics(chapter.id, page), listTeacherClassrooms()])
      .then(([result, classrooms]) => { if (live) {
        setItems(result.data); setLastPage(result.meta.lastPage);
        setClasses(classrooms.filter(item => item.status === "active"));
      } }).catch(() => { if (live) setError("Không thể tải thư viện infographic. Vui lòng thử lại."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [chapter.id, page, reload]);
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!image || !title.trim() || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const saved = await uploadInfographic(chapter.id, title.trim(), image);
      setItems(current => [saved, ...current]); setTitle(""); setImage(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessage("Ảnh đã lưu trên máy chủ. Chọn lớp để đăng cho học sinh.");
    } catch {
      setError("Không thể xác nhận ảnh đã được lưu. Hãy kiểm tra thư viện trước khi thử tải lại.");
    } finally { setBusy(false); }
  }
  async function publish() {
    if (!publishing || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const saved = await publishInfographic(publishing.id, publishing.version ?? 1, selected);
      setItems(current => current.map(item => item.id === saved.id ? saved : item));
      setPublishing(null); setMessage(selected.length ? "Đã đăng ảnh cho lớp đã chọn." : "Đã gỡ đăng ảnh.");
    } catch { setError("Không thể xác nhận trạng thái đăng ảnh. Hãy tải lại thư viện trước khi thử lại."); }
    finally { setBusy(false); }
  }
  return <main className="space-y-5">
    <header><h1 className="text-2xl font-extrabold text-ink">Học liệu trực quan</h1>
      <p className="text-sm text-secondary">Ảnh lưu trên máy chủ; chỉ học sinh trong lớp được đăng mới xem được.</p>
      <Link className="text-sm underline" to="/teacher/infographics/local">Thư viện ảnh cũ trên thiết bị này</Link></header>
    <label className="block max-w-sm text-sm font-bold">Chương
      <select className="mt-2 min-h-11 w-full rounded-xl border p-2" value={chapter.id}
        onChange={event => { setPage(1); setParams({ chapter: event.target.value }); }}>
        {geo10Chapters.map(item => <option key={item.id} value={item.id}>{item.number}. {item.title}</option>)}
      </select></label>
    <form onSubmit={upload} className="grid gap-3 rounded-2xl bg-white p-5 shadow-card sm:grid-cols-2">
      <label className="text-sm font-bold">Tên infographic<input required maxLength={200} className="mt-2 min-h-11 w-full rounded-xl border px-3" value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="text-sm font-bold">Ảnh PNG/JPEG/WebP, tối đa 15 MB<input required ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full" onChange={event => setImage(event.target.files?.[0] ?? null)} /></label>
      <button type="submit" disabled={busy || !image || !title.trim()} className={`${button} sm:col-span-2`}>{busy ? "Đang lưu…" : "Tải ảnh lên máy chủ"}</button>
    </form>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}<button className={`${button} ml-3`} onClick={() => setReload(value => value + 1)}>Thử lại</button></div>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    {loading ? <p role="status">Đang tải thư viện…</p> : !error && !items.length ? <p>Chưa có ảnh trên máy chủ cho chương này.</p> : null}
    <ul className="grid gap-4 md:grid-cols-2">{items.map(item => <li key={item.id} className="rounded-2xl bg-white p-4 shadow-card">
      <img className="h-56 w-full rounded-xl bg-canvas object-contain" src={infographicImageUrl(item)} alt={item.title} />
      <h2 className="mt-3 font-bold">{item.title}</h2>
      <p className="text-sm text-secondary">{item.classroomIds?.length ? `Đã đăng cho ${item.classroomIds.length} lớp` : "Bản nháp"}</p>
      <button className={`${button} mt-3`} disabled={busy} onClick={() => { setPublishing(item); setSelected(item.classroomIds ?? []); }}>Chọn lớp để đăng / gỡ đăng</button>
    </li>)}</ul>
    {lastPage > 1 && <nav className="flex items-center gap-3"><button className={button} disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button>{page}/{lastPage}<button className={button} disabled={page >= lastPage} onClick={() => setPage(value => value + 1)}>Sau</button></nav>}
    {publishing && <section role="dialog" aria-label="Đăng infographic" className="rounded-2xl border bg-white p-5 shadow-card">
      <h2 className="font-bold">Đăng {publishing.title} cho lớp</h2>
      <p className="text-sm text-secondary">Bỏ chọn tất cả lớp để gỡ đăng. Ảnh vẫn còn trong thư viện.</p>
      <div className="mt-3 grid gap-2">{classes.map(item => <label key={item.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />{item.name}</label>)}</div>
      <div className="mt-4 flex gap-2"><button className={button} disabled={busy} onClick={() => setPublishing(null)}>Hủy</button><button className={button} disabled={busy} onClick={publish}>Xác nhận</button></div>
    </section>}
  </main>;
}
