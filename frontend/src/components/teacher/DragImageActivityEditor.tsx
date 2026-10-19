import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import type { DragImageActivity, DragImagePiece, ImageDropZone, ImageLabelActivity } from "../../types/curriculum";
import { ImageLabelBoard } from "../student/DragImageBoard";
import { dragImageActivityError, imageLabelSignature } from "../../utils/lessonContentStorage";

const MAX_FILE_BYTES = 400 * 1024;
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  value?: DragImageActivity;
  onChange: (value: DragImageActivity) => void;
};

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!allowedTypes.includes(file.type)) {
      reject(new Error("Chọn ảnh JPG, PNG hoặc WebP."));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      reject(
        new Error("Mỗi ảnh tối đa 400 KB trong bản demo lưu trên trình duyệt."),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Không đọc được ảnh."));
    reader.onerror = () => reject(new Error("Không đọc được ảnh."));
    reader.readAsDataURL(file);
  });
}

function LegacyDragImageActivityEditor({ value, onChange }: Props) {
  const activity = value ?? { backgroundUrl: "", pieces: [] };
  const [error, setError] = useState("");

  function updatePiece(id: string, changes: Partial<DragImagePiece>) {
    onChange({
      ...activity,
      pieces: activity.pieces.map((piece) =>
        piece.id === id ? { ...piece, ...changes } : piece,
      ),
    });
  }

  async function chooseBackground(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const backgroundUrl = await readImage(file);
      onChange({ ...activity, backgroundUrl });
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không đọc được ảnh nền.",
      );
    }
  }

  async function choosePiece(event: ChangeEvent<HTMLInputElement>, id: string) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imageUrl = await readImage(file);
      updatePiece(id, { imageUrl });
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không đọc được ảnh phần tử.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line p-4">
        <h3 className="font-bold text-ink">1. Ảnh nền</h3>
        <p className="mt-1 text-sm text-secondary">
          Dùng ảnh nền chưa có các phần tử cần kéo. Chữ và các vùng trên nền tùy
          giáo viên chuẩn bị.
        </p>
        <label className="mt-4 block text-sm font-semibold text-ink">
          URL ảnh nền
          <input
            value={
              activity.backgroundUrl.startsWith("data:")
                ? ""
                : activity.backgroundUrl
            }
            onChange={(event) =>
              onChange({ ...activity, backgroundUrl: event.target.value })
            }
            placeholder="https://..."
            className="mt-2 w-full rounded-lg border border-line p-3"
          />
        </label>
        <label className="mt-3 block text-sm font-semibold text-ink">
          Hoặc tải ảnh nền lên (JPG, PNG, WebP; tối đa 400 KB)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={chooseBackground}
            className="mt-2 block w-full text-sm"
          />
        </label>
        {activity.backgroundUrl && (
          <div className="mt-4">
            <img
              src={activity.backgroundUrl}
              alt="Xem trước ảnh nền"
              className="max-h-80 max-w-full rounded-lg border border-line object-contain"
            />
            <button
              type="button"
              onClick={() => onChange({ ...activity, backgroundUrl: "" })}
              className="mt-2 text-sm font-semibold text-red-600 hover:underline"
            >
              Gỡ ảnh nền
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-ink">2. Các phần tử rời</h3>
            <p className="mt-1 text-sm text-secondary">
              Tải từng hình đã tách sẵn, tốt nhất là PNG hoặc WebP nền trong
              suốt.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...activity,
                pieces: [
                  ...activity.pieces,
                  {
                    id: crypto.randomUUID(),
                    label: "",
                    imageUrl: "",
                  },
                ],
              })
            }
            className="rounded-full bg-emerald px-4 py-2 text-sm font-bold text-white"
          >
            + Thêm phần tử
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {activity.pieces.map((piece, index) => (
            <div
              key={piece.id}
              className="rounded-xl border border-line bg-canvas p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-ink">
                  Phần tử {index + 1}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...activity,
                      pieces: activity.pieces.filter(
                        (item) => item.id !== piece.id,
                      ),
                    })
                  }
                  className="text-sm font-semibold text-red-600 hover:underline"
                >
                  Xóa
                </button>
              </div>
              <label className="mt-3 block text-sm font-semibold text-ink">
                Tên phần tử
                <input
                  value={piece.label}
                  onChange={(event) =>
                    updatePiece(piece.id, { label: event.target.value })
                  }
                  placeholder="Ví dụ: Máy bay"
                  className="mt-2 w-full rounded-lg border border-line bg-white p-3"
                />
              </label>
              <label className="mt-3 block text-sm font-semibold text-ink">
                URL ảnh phần tử
                <input
                  value={
                    piece.imageUrl.startsWith("data:") ? "" : piece.imageUrl
                  }
                  onChange={(event) =>
                    updatePiece(piece.id, { imageUrl: event.target.value })
                  }
                  placeholder="https://..."
                  className="mt-2 w-full rounded-lg border border-line bg-white p-3"
                />
              </label>
              <label className="mt-3 block text-sm font-semibold text-ink">
                Hoặc tải ảnh lên
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => choosePiece(event, piece.id)}
                  className="mt-2 block w-full text-sm"
                />
              </label>
              {piece.imageUrl && (
                <img
                  src={piece.imageUrl}
                  alt={piece.label || "Phần tử"}
                  className="mt-3 h-20 w-20 object-contain"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function LabelActivityEditor({ activity, onChange }: { activity: ImageLabelActivity; onChange: Props['onChange'] }) {
  const activityRef = useRef(activity);
  activityRef.current = activity;
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => { setReady(false); setError(''); setPreview(false); }, [activity.backgroundUrl]);
  const configError = dragImageActivityError(activity);

  function addZone(x: number, y: number) {
    const id = crypto.randomUUID();
    onChange({ ...activity,
      zones: [...activity.zones, { id, x: Math.round(Math.min(72, Math.max(0, x)) * 10) / 10, y: Math.round(Math.min(76, Math.max(0, y)) * 10) / 10, width: 28, height: 24 }],
      labels: [...activity.labels, { id: crypto.randomUUID(), text: '', correctZoneId: id }],
    });
    setPreview(false);
  }

  function clickImage(event: MouseEvent<HTMLDivElement>) {
    if (!ready || event.target !== event.currentTarget.querySelector('img')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    addZone((event.clientX - rect.left) / rect.width * 100 - 14, (event.clientY - rect.top) / rect.height * 100 - 12);
  }

  function updateZone(id: string, changes: Partial<ImageDropZone>) {
    onChange({ ...activity, zones: activity.zones.map((zone) => {
      if (zone.id !== id) return zone;
      const next = { ...zone, ...changes };
      next.width = Math.min(100, Math.max(5, next.width));
      next.height = Math.min(100, Math.max(5, next.height));
      next.x = Math.min(100 - next.width, Math.max(0, next.x));
      next.y = Math.min(100 - next.height, Math.max(0, next.y));
      return next;
    }) });
  }

  async function chooseBackground(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProcessing(true);
    try {
      const backgroundUrl = await readImage(file);
      await new Promise<void>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('File đã chọn không phải ảnh đọc được.'));
        image.src = backgroundUrl;
      });
      onChange({ ...activityRef.current, backgroundUrl });
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không đọc được ảnh nền.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
      <div className="rounded-xl border border-line p-4">
        <h3 className="font-bold text-ink">1. Ảnh nền</h3>
        <p className="mt-1 text-sm text-secondary">Dùng một ảnh sơ đồ hoặc bản đồ. Nhãn chữ sẽ được ghép vào các vùng trên ảnh.</p>
        <label className="mt-3 block text-sm font-semibold text-ink">URL ảnh nền<input disabled={processing} value={activity.backgroundUrl.startsWith('data:') ? '' : activity.backgroundUrl} onChange={(event) => onChange({ ...activity, backgroundUrl: event.target.value })} placeholder="https://..." className="mt-2 w-full rounded-lg border border-line p-3" /></label>
        <label className="mt-3 block text-sm font-semibold text-ink">Hoặc tải ảnh nền (JPG, PNG, WebP; tối đa 400 KB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={processing} onChange={chooseBackground} className="mt-2 block w-full text-sm" /></label>
        {processing && <p role="status" className="mt-2 text-sm text-secondary">Đang đọc ảnh...</p>}
        {activity.backgroundUrl && <button type="button" disabled={processing} onClick={() => onChange({ ...activity, backgroundUrl: '' })} className="mt-2 min-h-11 text-sm font-bold text-red-600">Gỡ ảnh nền</button>}
      </div>
      <section className="space-y-3">
        <h3 className="font-bold text-ink">2. Vùng thả và nhãn chữ</h3>
        <p className="text-sm leading-6 text-secondary">Click vào ảnh để tạo vùng thả, nhập nhãn rồi chọn vùng đúng. Vị trí/kích thước lưu theo %. Khi đổi ảnh nền, hãy kiểm tra lại các vùng.</p>
        {activity.backgroundUrl && <div onClick={clickImage} className="relative rounded-xl border border-line bg-canvas">
          <img src={activity.backgroundUrl} alt="Ảnh nền tạo vùng thả" draggable={false} onLoad={() => setReady(true)} onError={() => { setReady(false); setError('Không tải được ảnh nền. Kiểm tra URL hoặc chọn ảnh khác.'); }} className="block h-auto w-full select-none rounded-xl" />
          {ready && activity.zones.map((zone, index) => <div key={zone.id} style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }} className="pointer-events-none absolute flex items-center justify-center rounded-lg border-2 border-dashed border-emerald bg-white/80 text-xs font-bold text-ink">Vùng {index + 1}</div>)}
        </div>}
        <button type="button" disabled={!ready || processing} onClick={() => addZone((activity.zones.length % 3) * 35, (Math.floor(activity.zones.length / 3) % 3) * 35)} className="min-h-11 rounded-xl bg-emerald px-4 text-sm font-bold text-white disabled:opacity-50">+ Thêm vùng thả</button>
        {activity.zones.map((zone, index) => {
          const label = activity.labels[index];
          return <article key={zone.id} className="space-y-3 rounded-xl border border-line bg-canvas p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold text-ink">Vùng {index + 1}</h4><button type="button" onClick={() => { onChange({ ...activity, zones: activity.zones.filter((item) => item.id !== zone.id), labels: activity.labels.filter((_, labelIndex) => labelIndex !== index).map((item) => item.correctZoneId === zone.id ? { ...item, correctZoneId: '' } : item) }); setPreview(false); }} className="min-h-11 text-sm font-bold text-red-600">Xóa vùng {index + 1}</button></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(['x', 'y', 'width', 'height'] as const).map((field) => <label key={field} className="min-w-0 text-xs font-semibold text-secondary">{field === 'x' ? 'Trái' : field === 'y' ? 'Trên' : field === 'width' ? 'Rộng' : 'Cao'} vùng {index + 1} (%)<input type="number" min={field === 'x' || field === 'y' ? 0 : 5} max={100} step={0.1} value={zone[field]} onChange={(event) => { const number = Number(event.target.value); if (Number.isFinite(number)) updateZone(zone.id, { [field]: number }); }} className="mt-1 w-full rounded-lg border border-line bg-white p-2 text-sm text-ink" /></label>)}</div>
            {label && <>
              <label className="block text-sm font-semibold text-ink">Nhãn {index + 1}<input value={label.text} maxLength={120} onChange={(event) => onChange({ ...activity, labels: activity.labels.map((item) => item.id === label.id ? { ...item, text: event.target.value } : item) })} placeholder="Ví dụ: Trái Đất" className="mt-2 w-full rounded-lg border border-line bg-white p-3" /></label>
              <label className="block text-sm font-semibold text-ink">Vùng đúng của nhãn {index + 1}<select aria-label={`Vùng đúng của nhãn ${index + 1}`} value={label.correctZoneId} onChange={(event) => onChange({ ...activity, labels: activity.labels.map((item) => item.id === label.id ? { ...item, correctZoneId: event.target.value } : item) })} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-white px-3"><option value="">Chọn vùng đúng</option>{activity.zones.map((item, zoneIndex) => <option key={item.id} value={item.id}>Vùng {zoneIndex + 1}</option>)}</select></label>
            </>}
          </article>;
        })}
        {configError && <p role="status" className="text-sm text-secondary">{configError} Có thể lưu nháp để tiếp tục soạn.</p>}
      </section>
      <button type="button" disabled={Boolean(configError) || !ready || processing} onClick={() => setPreview(!preview)} className="min-h-11 rounded-xl border border-emerald px-5 text-sm font-bold text-emerald disabled:opacity-40">{preview ? 'Đóng xem thử hoạt động' : 'Xem thử hoạt động'}</button>
      {preview && !configError && <section aria-label="Xem thử ghép nhãn" className="rounded-xl border border-line p-4"><p className="mb-3 text-sm font-bold text-ink">Xem thử như học sinh · không lưu bài làm</p><ImageLabelBoard key={imageLabelSignature(activity)} activity={activity} /></section>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function DragImageActivityEditor({ value, onChange }: Props) {
  if (value && value.kind !== 'label_zones' && (value.kind === 'image_pieces' || value.pieces.length > 0)) {
    return <div className="space-y-4"><div className="rounded-xl border border-line bg-canvas p-4"><p className="text-sm text-secondary">Activity cũ dùng các ảnh rời vẫn được giữ nguyên.</p><button type="button" onClick={() => { if (window.confirm('Chuyển sang nhãn chữ? Ảnh nền được giữ, các phần tử ảnh rời sẽ được thay bằng vùng thả và nhãn mới trong bản đang soạn.')) onChange({ kind: 'label_zones', backgroundUrl: value.backgroundUrl, pieces: [], zones: [], labels: [] }); }} className="mt-2 min-h-11 text-sm font-bold text-emerald">Chuyển sang nhãn chữ</button></div><LegacyDragImageActivityEditor value={value} onChange={onChange} /></div>;
  }
  const activity: ImageLabelActivity = value?.kind === 'label_zones' ? value : { kind: 'label_zones', backgroundUrl: value?.backgroundUrl ?? '', pieces: [], zones: [], labels: [] };
  return <LabelActivityEditor activity={activity} onChange={onChange} />;
}
