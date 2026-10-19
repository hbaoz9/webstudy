import { useEffect, useRef, useState } from "react";
import Dialog from "../common/Dialog";
import { ImagePlus } from "lucide-react";
import type { QuestionImage } from "../../types/question";
import { compressCoverImage } from "../../utils/imageCompression";

const MAX_IMAGE_LENGTH = 300_000;
function validImageUrl(value: string) {
  if (value.startsWith("data:")) return value.length <= MAX_IMAGE_LENGTH && /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}
export function questionImageError(image?: QuestionImage): string | null {
  if (!image) return null;
  if (!validImageUrl(image.url.trim())) return "Chọn ảnh hợp lệ hoặc dán liên kết HTTP / HTTPS đến ảnh.";
  if ((image.caption?.length ?? 0) > 300) return "Mô tả ảnh tối đa 300 ký tự.";
  if ((image.source?.length ?? 0) > 500) return "Nguồn tư liệu tối đa 500 ký tự.";
  return null;
}

export function QuestionImageView({ image }: { image?: QuestionImage }) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!image) return null;
  const invalid = questionImageError(image);
  return <figure className="my-4 min-w-0 space-y-2 [overflow-wrap:anywhere]">
    {invalid || failedUrl === image.url ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{invalid || "Không tải được ảnh tư liệu. Hãy kiểm tra liên kết hoặc báo giáo viên."}</p>
      : <img key={image.url} src={image.url} alt={image.caption?.trim() || "Ảnh tư liệu câu hỏi"} onError={() => setFailedUrl(image.url)} className="mx-auto block h-auto max-h-[36rem] max-w-full rounded-xl object-contain" />}
    {!invalid && failedUrl !== image.url && <button type="button" onClick={() => setZoomOpen(true)} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-bold">Phóng to ảnh tư liệu</button>}
    {zoomOpen && <Dialog title={image.caption || "Ảnh tư liệu câu hỏi"} onClose={() => setZoomOpen(false)}>
      <p className="mb-3 text-sm text-secondary">Vuốt hoặc cuộn để xem các phần của ảnh.</p>
      <div className="max-h-[65dvh] overflow-auto rounded-xl border border-line">
        <img src={image.url} alt={image.caption || "Ảnh tư liệu câu hỏi"} className="block h-auto max-w-none" />
      </div>{image.source && <p className="mt-3 text-sm text-secondary [overflow-wrap:anywhere]">Nguồn: {image.source}</p>}</Dialog>}
    {(image.caption || image.source) && <figcaption className="space-y-1 text-sm leading-6 text-secondary">{image.caption && <p>{image.caption}</p>}{image.source && <p>Nguồn: {image.source}</p>}</figcaption>}
  </figure>;
}

export function QuestionImageEditor({ value, onChange, onProcessingChange }: {
  value?: QuestionImage;
  onChange: (image?: QuestionImage) => void;
  onProcessingChange: (processing: boolean) => void;
}) {
  const ref = useRef<HTMLFieldSetElement>(null);
  const latest = useRef({ value, onChange, onProcessingChange });
  latest.current = { value, onChange, onProcessingChange };
  const attempt = useRef(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  function cancelUpload() { attempt.current++; setProcessing(false); latest.current.onProcessingChange(false); setError(""); }
  async function upload(file: File) {
    const currentAttempt = ++attempt.current;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setProcessing(false); latest.current.onProcessingChange(false); setError("Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB."); return;
    }
    setProcessing(true); latest.current.onProcessingChange(true);
    try {
      const url = await compressCoverImage(file, { maxWidth: 1600, maxHeight: 1600, maxDataLength: MAX_IMAGE_LENGTH });
      if (currentAttempt !== attempt.current) return;
      if (!validImageUrl(url)) throw new Error("Ảnh sau khi nén còn quá lớn. Hãy cắt bớt vùng thừa hoặc chọn ảnh nhỏ hơn.");
      latest.current.onChange({ ...latest.current.value, url });
    } catch (cause) {
      if (currentAttempt === attempt.current) setError(cause instanceof Error ? cause.message : "Không thể đọc ảnh.");
    } finally { if (currentAttempt === attempt.current) { setProcessing(false); latest.current.onProcessingChange(false); } }
  }
  const uploadRef = useRef(upload); uploadRef.current = upload;
  useEffect(() => {
    const form = ref.current?.closest("form");
    const paste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
      if (file) { event.preventDefault(); void uploadRef.current(file); }
    };
    form?.addEventListener("paste", paste);
    return () => { form?.removeEventListener("paste", paste); attempt.current++; latest.current.onProcessingChange(false); };
  }, []);
  const local = value?.url.startsWith("data:");
  return <fieldset ref={ref} className="min-w-0 space-y-4 rounded-xl border border-line p-4">
    <legend className="px-1 text-sm font-bold">Ảnh / bảng số liệu (tùy chọn)</legend>
    <p className="text-sm leading-6 text-secondary">Thêm ảnh bản đồ, biểu đồ hoặc ảnh chụp bảng số liệu. Có thể dán ảnh bằng Ctrl+V khi đang soạn câu hỏi.</p>
    <label className="block text-sm font-bold">Tải ảnh tư liệu<input aria-label="Tải ảnh tư liệu câu hỏi" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} className="mt-2 block min-h-11 w-full min-w-0 text-sm font-normal file:mr-2 file:min-h-11 file:rounded-xl file:border file:border-line file:bg-white file:px-3" />
      <span className="mt-1 block text-sm font-normal text-secondary">JPG, PNG, WebP · tối đa 5 MB. Ảnh được thu nhỏ để lưu trên trình duyệt.</span>
    </label>
    <button type="button" className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line p-3 text-sm text-secondary">
      <ImagePlus aria-hidden="true" className="size-5 shrink-0" />Bấm vào đây rồi Ctrl+V để dán ảnh</button>
    {!local && <label className="block text-sm font-bold">Hoặc liên kết ảnh<input aria-label="Liên kết ảnh câu hỏi" type="url" value={value?.url ?? ""} onChange={(event) => { cancelUpload(); const url = event.target.value; onChange(url ? { ...value, url } : undefined); }} placeholder="https://…" className="mt-2 block min-h-11 w-full rounded-xl border border-line px-3 font-normal" />
    </label>}
    {processing && <p role="status" className="text-sm text-secondary">Đang xử lý ảnh tư liệu…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {value && <>
      <label className="block text-sm font-bold">Mô tả ảnh<input aria-label="Mô tả ảnh câu hỏi" value={value.caption ?? ""} maxLength={300} onChange={(event) => onChange({ ...value, caption: event.target.value })} placeholder="Ví dụ: Biểu đồ cơ cấu dân số năm 2025" className="mt-2 block min-h-11 w-full rounded-xl border border-line px-3 font-normal" />
      </label>
      <label className="block text-sm font-bold">Nguồn tư liệu<input aria-label="Nguồn ảnh câu hỏi" value={value.source ?? ""} maxLength={500} onChange={(event) => onChange({ ...value, source: event.target.value })} placeholder="Tên sách, tác giả hoặc đường dẫn nguồn" className="mt-2 block min-h-11 w-full rounded-xl border border-line px-3 font-normal" />
      </label>
      <QuestionImageView image={value} />
      <button type="button" onClick={() => { cancelUpload(); onChange(undefined); }} className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold">Bỏ ảnh tư liệu</button>
    </>}
  </fieldset>;
}
