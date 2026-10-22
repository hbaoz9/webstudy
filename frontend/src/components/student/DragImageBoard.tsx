import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { DragImageActivity, ImageLabelActivity } from "../../types/curriculum";
import { dragImageActivityError, imageLabelSignature } from "../../utils/lessonContentStorage";

type Position = { x: number; y: number };
type Positions = Record<string, Position>;
type Drag = {
  id: string;
  pointerId: number;
  fromBoard: boolean;
  offsetX: number;
  offsetY: number;
  clientX: number;
  clientY: number;
};

function readPositions(key: string, activity: DragImageActivity): Positions {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const saved = value as Record<string, unknown>;
    const result: Positions = {};
    for (const piece of activity.pieces) {
      const position = saved[piece.id] as Partial<Position> | undefined;
      if (
        position &&
        typeof position.x === "number" &&
        typeof position.y === "number" &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y)
      ) {
        result[piece.id] = {
          x: Math.min(86, Math.max(0, position.x)),
          y: Math.min(86, Math.max(0, position.y)),
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

function LegacyImageBoard({
  activity,
  storageKey,
}: {
  activity: DragImageActivity;
  storageKey?: string;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [positions, setPositions] = useState<Positions>(() =>
    storageKey ? readPositions(storageKey, activity) : {},
  );

  function store(next: Positions) {
    setPositions(next);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Kéo thả vẫn hoạt động trong phiên hiện tại nếu trình duyệt chặn lưu.
    }
  }

  function start(
    event: ReactPointerEvent<HTMLButtonElement>,
    id: string,
    fromBoard: boolean,
  ) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const next: Drag = {
      id,
      pointerId: event.pointerId,
      fromBoard,
      offsetX: fromBoard ? event.clientX - rect.left : rect.width / 2,
      offsetY: fromBoard ? event.clientY - rect.top : rect.height / 2,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = next;
    setDrag(next);
  }

  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const next = { ...current, clientX: event.clientX, clientY: event.clientY };
    dragRef.current = next;
    setDrag(next);
  }

  function finish(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (
      rect &&
      rect.width > 0 &&
      rect.height > 0 &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      const iconSize = rect.width * 0.14;
      const left = Math.min(
        rect.width - iconSize,
        Math.max(0, event.clientX - rect.left - current.offsetX),
      );
      const top = Math.min(
        Math.max(0, rect.height - iconSize),
        Math.max(0, event.clientY - rect.top - current.offsetY),
      );
      store({
        ...positions,
        [current.id]: {
          x: (left / rect.width) * 100,
          y: (top / rect.height) * 100,
        },
      });
    } else if (current.fromBoard) {
      const next = { ...positions };
      delete next[current.id];
      store(next);
    }
    dragRef.current = null;
    setDrag(null);
  }

  function cancel() {
    dragRef.current = null;
    setDrag(null);
  }

  function keyboard(event: ReactKeyboardEvent<HTMLButtonElement>, id: string) {
    const old = positions[id];
    if (!old && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      store({ ...positions, [id]: { x: 43, y: 43 } });
    } else if (old && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      const next = { ...positions };
      delete next[id];
      store(next);
    } else if (
      old &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      const dx =
        event.key === "ArrowLeft" ? -2 : event.key === "ArrowRight" ? 2 : 0;
      const dy =
        event.key === "ArrowUp" ? -2 : event.key === "ArrowDown" ? 2 : 0;
      store({
        ...positions,
        [id]: {
          x: Math.min(86, Math.max(0, old.x + dx)),
          y: Math.min(86, Math.max(0, old.y + dy)),
        },
      });
    }
  }

  const activePiece = activity.pieces.find((piece) => piece.id === drag?.id);
  const tray = activity.pieces.filter((piece) => !positions[piece.id]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary">
        Kéo hình từ khay vào ảnh nền. Có thể kéo lại, hoặc kéo ra ngoài để bỏ vị
        trí.
      </p>
      <div
        ref={boardRef}
        className="relative w-full overflow-hidden rounded-xl border-2 border-emerald-300 bg-canvas"
      >
        <img
          src={activity.backgroundUrl}
          alt="Ảnh nền của bài kéo thả"
          className="block h-auto w-full select-none"
          draggable={false}
        />
        {activity.pieces.map((piece) => {
          const position = positions[piece.id];
          if (!position) return null;
          return (
            <button
              key={piece.id}
              type="button"
              aria-label={`${piece.label}: kéo để di chuyển, phím mũi tên để chỉnh vị trí, Delete để bỏ`}
              title={piece.label}
              onPointerDown={(event) => start(event, piece.id, true)}
              onPointerMove={move}
              onPointerUp={finish}
              onPointerCancel={cancel}
              onKeyDown={(event) => keyboard(event, piece.id)}
              className="absolute aspect-square cursor-grab touch-none rounded focus:outline-none focus:ring-2 focus:ring-emerald"
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                width: "14%",
              }}
            >
              <img
                src={piece.imageUrl}
                alt=""
                draggable={false}
                className="block h-full w-full select-none object-contain"
              />
            </button>
          );
        })}
      </div>
      <div className="rounded-xl border border-line bg-canvas p-4">
        <p className="text-sm font-bold text-ink">Các hình cần xếp</p>
        {tray.length ? (
          <div className="mt-3 flex flex-wrap gap-3">
            {tray.map((piece) => (
              <button
                key={piece.id}
                type="button"
                aria-label={`Kéo ${piece.label} vào ảnh; nhấn Enter để đặt ở giữa`}
                title={piece.label}
                onPointerDown={(event) => start(event, piece.id, false)}
                onPointerMove={move}
                onPointerUp={finish}
                onPointerCancel={cancel}
                onKeyDown={(event) => keyboard(event, piece.id)}
                className="flex min-w-20 cursor-grab touch-none flex-col items-center rounded-lg border border-line bg-white p-2 text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-emerald"
              >
                <img
                  src={piece.imageUrl}
                  alt=""
                  draggable={false}
                  className="h-16 w-16 select-none object-contain"
                />
                <span className="mt-1 max-w-24 text-center">{piece.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-secondary">
            Tất cả hình đã được đặt lên ảnh.
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-secondary">
          Bàn phím: Enter để đặt, phím mũi tên để di chuyển, Delete để gỡ hình.
        </p>
        <button
          type="button"
          onClick={() => store({})}
          className="shrink-0 rounded-full border border-emerald px-4 py-2 text-sm font-bold text-emerald"
        >
          Đặt lại
        </button>
      </div>
      {activePiece && drag && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50"
          style={{
            left: drag.clientX - drag.offsetX,
            top: drag.clientY - drag.offsetY,
            width: 72,
          }}
        >
          <img
            src={activePiece.imageUrl}
            alt=""
            draggable={false}
            className="w-full drop-shadow-lg"
          />
        </div>
      )}
    </div>
  );
}

type LabelPlacements = Record<string, string>;

function readLabelPlacements(activity: ImageLabelActivity, storageKey?: string) {
  if (!storageKey) return { placements: {}, error: '' };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { placements: {}, error: '' };
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || !('signature' in saved) || !('placements' in saved)) throw new Error();
    if (saved.signature !== imageLabelSignature(activity)) return { placements: {}, error: '' };
    if (!saved.placements || typeof saved.placements !== 'object' || Array.isArray(saved.placements)) throw new Error();
    const placements: LabelPlacements = {};
    const values = saved.placements as Record<string, unknown>;
    const occupied = new Set<string>();
    for (const label of activity.labels) {
      const zoneId = values[label.id];
      if (typeof zoneId === 'string' && activity.zones.some((zone) => zone.id === zoneId) && !occupied.has(zoneId)) {
        placements[label.id] = zoneId;
        occupied.add(zoneId);
      }
    }
    return { placements, error: '' };
  } catch {
    return { placements: {}, error: 'Không đọc được bản nháp của hoạt động. Dữ liệu cũ chưa bị ghi đè.' };
  }
}

export function ImageLabelBoard({ activity, storageKey }: { activity: ImageLabelActivity; storageKey?: string }) {
  const [initial] = useState(() => readLabelPlacements(activity, storageKey));
  const [labelOrder] = useState(() => {
    const items = [...activity.labels];
    for (let index = items.length - 1; index > 0; index--) {
      const target = Math.floor(Math.random() * (index + 1));
      [items[index], items[target]] = [items[target], items[index]];
    }
    return items;
  });
  const [placements, setPlacements] = useState<LabelPlacements>(initial.placements);
  const [storageError, setStorageError] = useState(initial.error);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [ready, setReady] = useState(false);
  const [imageError, setImageError] = useState(false);
  const zonesRef = useRef(new Map<string, HTMLButtonElement>());
  const pointer = useRef<{ id: string; pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null);

  function persist(next: LabelPlacements) {
    setPlacements(next);
    setChecked(false);
    setFeedback(null);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ signature: imageLabelSignature(activity), placements: next }));
      setStorageError('');
    } catch {
      setStorageError('Chưa lưu được nhãn trên trình duyệt. Đừng tải lại hoặc đóng trang.');
    }
  }

  function place(labelId: string, zoneId: string) {
    const next = { ...placements };
    const oldZone = next[labelId];
    const otherLabel = Object.keys(next).find((id) => id !== labelId && next[id] === zoneId);
    if (otherLabel) {
      if (oldZone) next[otherLabel] = oldZone;
      else delete next[otherLabel];
    }
    next[labelId] = zoneId;
    persist(next);
    setSelected(null);
  }

  function start(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (!ready || (event.pointerType === 'mouse' && event.button !== 0)) return;
    suppressClick.current = false;
    pointer.current = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(id);
  }

  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 6) current.moved = true;
    if (current.moved) setGhost({ id: current.id, x: event.clientX, y: event.clientY });
  }

  function finish(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.moved) {
      suppressClick.current = true;
      for (const [zoneId, element] of zonesRef.current) {
        const rect = element.getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
          place(current.id, zoneId);
          break;
        }
      }
    }
    pointer.current = null;
    setGhost(null);
  }

  function chooseZone(zoneId: string) {
    if (selected) place(selected, zoneId);
    else setSelected(activity.labels.find((label) => placements[label.id] === zoneId)?.id ?? null);
  }

  const placedCount = Object.keys(placements).length;
  const ghostLabel = activity.labels.find((label) => label.id === ghost?.id);
  return (
    <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
      <p className="text-sm leading-6 text-secondary">Kéo nhãn vào vùng thả, hoặc chọn nhãn rồi chạm vùng trên ảnh / nút vùng bên dưới. Thả vào vùng đã có nhãn sẽ đổi chỗ hoặc đưa nhãn cũ về khay.</p>
      <div className="relative w-full rounded-xl border border-line bg-canvas">
        <img src={activity.backgroundUrl} alt="Ảnh nền ghép nhãn" draggable={false} onLoad={() => { setReady(true); setImageError(false); }} onError={() => { setReady(false); setImageError(true); }} className="block h-auto w-full select-none rounded-xl" />
        {ready && activity.zones.map((zone, index) => {
          const placed = activity.labels.find((label) => placements[label.id] === zone.id);
          const correct = placed?.correctZoneId === zone.id;
          return <button key={zone.id} type="button" ref={(element) => { if (element) zonesRef.current.set(zone.id, element); else zonesRef.current.delete(zone.id); }} aria-label={`Vùng ${index + 1}${placed ? `: ${placed.text}` : ': chưa có nhãn'}`} onClick={() => chooseZone(zone.id)} style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }} className={`absolute flex min-w-0 items-center justify-center overflow-auto rounded-lg border-2 p-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald ${checked ? correct ? 'border-emerald bg-emerald/20 text-ink' : 'border-red-500 bg-red-50/90 text-red-700' : 'border-dashed border-emerald bg-white/85 text-ink'}`}>
            <span>{placed?.text ?? `Vùng ${index + 1}`}</span>
          </button>;
        })}
      </div>
      {imageError && <p role="alert" className="text-sm text-red-600">Không tải được ảnh nền. Kiểm tra kết nối hoặc báo giáo viên.</p>}
      <fieldset disabled={!ready} className="rounded-xl border border-line bg-canvas p-4">
        <legend className="px-1 text-sm font-bold text-ink">Nhãn chữ · Đã đặt {placedCount}/{activity.labels.length}</legend>
        <div className="flex flex-wrap gap-2">{labelOrder.map((label) => {
          const index = activity.zones.findIndex((zone) => zone.id === placements[label.id]);
          return <button key={label.id} type="button" aria-label={`Nhãn ${label.text}`} aria-pressed={selected === label.id} onPointerDown={(event) => start(event, label.id)} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { pointer.current = null; setGhost(null); }} onClick={() => { if (!suppressClick.current) setSelected(label.id); suppressClick.current = false; }} className={`min-h-11 max-w-full touch-none rounded-xl border px-4 py-2 text-left text-sm font-bold disabled:opacity-50 ${selected === label.id ? 'border-emerald bg-emerald text-white' : 'border-line bg-white text-ink'}`}>
            {label.text}{index >= 0 && <span className="block text-xs font-normal">Đang ở vùng {index + 1}</span>}
          </button>;
        })}</div>
        <div className="mt-3 flex flex-wrap gap-2">{activity.zones.map((zone, index) => <button key={zone.id} type="button" disabled={!selected || !ready} onClick={() => chooseZone(zone.id)} className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink disabled:opacity-40">Đặt vào vùng {index + 1}</button>)}</div>
        {selected && <button type="button" onClick={() => { const next = { ...placements }; delete next[selected]; persist(next); setSelected(null); }} className="mt-3 min-h-11 text-sm font-bold text-red-600">Gỡ nhãn đang chọn</button>}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!ready} onClick={() => { if (placedCount !== activity.labels.length) { setFeedback('Hãy đặt đủ nhãn trước khi kiểm tra.'); setChecked(false); return; } const count = activity.labels.filter((label) => placements[label.id] === label.correctZoneId).length; setChecked(true); setFeedback(`Đúng ${count}/${activity.labels.length} nhãn. ${count === activity.labels.length ? 'Hoàn thành hoạt động!' : 'Bạn có thể sửa và kiểm tra lại.'}`); }} className="min-h-11 rounded-xl bg-emerald px-5 text-sm font-bold text-white disabled:opacity-50">Kiểm tra</button>
        <button type="button" onClick={() => { persist({}); setSelected(null); }} className="min-h-11 rounded-xl border border-line px-5 text-sm font-bold text-ink">Làm lại</button>
      </div>
      {feedback && <p role="status" className="text-sm font-bold text-ink">{feedback}</p>}
      {storageError && <div role="alert" className="text-sm text-red-600"><p>{storageError}</p><button type="button" onClick={() => persist(placements)} className="mt-2 min-h-11 font-bold underline">Thử lưu nhãn lại</button></div>}
      {ghost && ghostLabel && <div aria-hidden="true" style={{ left: ghost.x + 12, top: ghost.y + 12 }} className="pointer-events-none fixed z-50 max-w-40 rounded-xl bg-emerald px-3 py-2 text-sm font-bold text-white shadow-lg">{ghostLabel.text}</div>}
    </div>
  );
}

export default function DragImageBoard({ activity, storageKey }: { activity: DragImageActivity; storageKey?: string }) {
  const error = dragImageActivityError(activity);
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (activity.kind === 'label_zones') return <ImageLabelBoard key={`${storageKey}-${imageLabelSignature(activity)}`} activity={activity} storageKey={storageKey ? `${storageKey}-labels-v1` : undefined} />;
  return <LegacyImageBoard activity={activity} storageKey={storageKey} />;
}
