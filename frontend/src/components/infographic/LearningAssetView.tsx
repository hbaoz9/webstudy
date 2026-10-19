import { useEffect, useState } from "react";
import Dialog from "../common/Dialog";
import { getUploadedInfographic, subscribeUploadedInfographicChanges, type UploadedInfographic } from "../../utils/uploadedInfographicStorage";

// Object URLs belong to the mounted image, never to the saved lesson body.
export function UploadedInfographicImage({ item, large = false }: { item: UploadedInfographic; large?: boolean }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    const url = URL.createObjectURL(item.imageBlob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [item.imageBlob]);
  if (failed) return <p role="status" className="rounded-xl bg-canvas p-4 text-sm text-secondary">Không hiển thị được ảnh này. Bạn có thể thử mở lại hoặc kiểm tra file gốc.</p>;
  return src ? <img src={src} alt={item.title} onError={() => setFailed(true)} className={`${large ? "max-h-[70dvh]" : "h-44"} w-full rounded-xl bg-canvas object-contain`} /> : null;
}

export default function LearningAssetView({ assetId, audience }: { assetId: string; audience: "teacher" | "student" }) {
  const [state, setState] = useState<{ id: string; item?: UploadedInfographic; error?: string } | null>(null);
  const [reload, setReload] = useState(0);
  const [large, setLarge] = useState(false);
  useEffect(() => {
    let active = true;
    let revision = 0;
    function refresh() {
      const request = ++revision;
      // Hide the old image, including its large view, while rechecking access.
      setState(null);
      setLarge(false);
      getUploadedInfographic(assetId).then(item => {
        if (active && request === revision) setState({ id: assetId, item });
      }).catch(() => {
        if (active && request === revision) setState({ id: assetId, error: "Chưa tải được học liệu. Bạn có thể thử lại." });
      });
    }
    const unsubscribe = subscribeUploadedInfographicChanges(id => { if (!id || id === assetId) refresh(); });
    refresh();
    return () => { active = false; unsubscribe(); };
  }, [assetId, reload]);
  const teacher = audience === "teacher";
  if (!state || state.id !== assetId) return teacher ? <p role="status" className="p-3 text-sm text-secondary">Đang tải học liệu…</p> : null;
  if (state.error) return <div role="alert" className="rounded-xl border border-line p-3 text-sm text-secondary">{state.error} <button type="button" onClick={() => setReload(n => n + 1)} className="min-h-11 px-3 font-bold underline">Thử lại</button>
  </div>;
  const item = state.item;
  if (!teacher && (!item || item.visibility !== "published")) return null;
  if (!item) return <p role="status" className="rounded-xl border border-line p-3 text-sm text-secondary">Infographic không còn trong thư viện. Bạn có thể xóa khối này và chọn ảnh khác.</p>;
  return <figure className="my-3 min-w-0 space-y-3 rounded-xl border border-line bg-white p-3" aria-label={`Học liệu: ${item.title}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <figcaption className="min-w-0 break-words text-sm font-bold text-ink">{item.title}</figcaption>
      {teacher && <span className={`rounded-full px-3 py-1 text-sm ${item.visibility === "published" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{item.visibility === "published" ? "Học liệu đã đăng" : "Bản nháp · Học sinh chưa thấy"}</span>}
    </div>
    <UploadedInfographicImage item={item} large />
    <button type="button" onClick={() => setLarge(true)} className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold">Xem lớn</button>
    {large && <Dialog title={item.title} onClose={() => setLarge(false)}>
      <UploadedInfographicImage item={item} large />
    </Dialog>}
  </figure>;
}
