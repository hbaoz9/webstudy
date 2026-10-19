import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, Trash2, Send, Undo2 } from "lucide-react";
import Dialog from "../common/Dialog";
import { UploadedInfographicImage as UploadedImage } from "./LearningAssetView";
import {
  addUploadedInfographic,
  deleteUploadedInfographic,
  listUploadedInfographics,
  setUploadedInfographicVisibility,
  type InfographicVisibility,
  type InfographicTarget,
  type UploadedInfographic,
} from "../../utils/uploadedInfographicStorage";

type Props = {
  targetType: InfographicTarget;
  targetId: string;
  hasAutoDiagram?: boolean;
  selectedId?: string | null;
  onSelectAuto?: () => void;
  onSelectUploaded?: (id: string) => void;
};

export default function UploadedInfographicGallery({
  targetType,
  targetId,
  hasAutoDiagram,
  selectedId,
  onSelectAuto,
  onSelectUploaded,
}: Props) {
  const [items, setItems] = useState<UploadedInfographic[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [operation, setOperation] = useState<"upload" | "delete" | "visibility" | null>(null);
  const busy = operation !== null;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadIndex, setReloadIndex] = useState(0);
  const [previewItem, setPreviewItem] = useState<UploadedInfographic | null>(null);
  const [deleteItem, setDeleteItem] = useState<UploadedInfographic | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [visibilityAction, setVisibilityAction] = useState<{ item: UploadedInfographic; next: InfographicVisibility } | null>(null);
  const [visibilityError, setVisibilityError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    setItems([]);

    listUploadedInfographics(targetType, targetId)
      .then((result) => {
        if (active) { setItems(result); setLoading(false); }
      })
      .catch(() => {
        if (active) { setLoadError("Chưa đọc được infographic đã tải lên. Ảnh đã lưu chưa bị thay đổi."); setLoading(false); }
      });

    return () => {
      active = false;
    };
  }, [targetType, targetId, reloadIndex]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || loadError) return;
    setMessage("");
    if (!file) {
      setError("Vui lòng chọn ảnh trước.");
      return;
    }

    setOperation("upload");
    setError("");

    try {
      const saved = await addUploadedInfographic(targetType, targetId, file, title);
      // The completed write returns the record. A second read failing must not
      // make a successful upload look failed and encourage duplicate retries.
      setItems(current => [saved, ...current]);
      setMessage("Đã lưu infographic trên trình duyệt này.");

      setTitle("");
      setFile(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Chưa tải được ảnh lên.",
      );
    } finally {
      setOperation(null);
    }
  }

  async function changeVisibility() {
    if (!visibilityAction || busy) return;
    setOperation("visibility");
    setVisibilityError("");
    setMessage("");
    try {
      const saved = await setUploadedInfographicVisibility(visibilityAction.item.id, visibilityAction.next);
      setItems(current => current.map(item => item.id === saved.id ? saved : item));
      setVisibilityAction(null);
      setMessage(saved.visibility === "published" ? "Đã đăng infographic." : "Đã gỡ đăng. Ảnh vẫn được giữ trong thư viện.");
    } catch (cause) {
      setVisibilityError(cause instanceof DOMException
        ? "Chưa lưu được thay đổi trên trình duyệt. Trạng thái cũ vẫn được giữ; hãy thử lại."
        : cause instanceof Error ? cause.message : "Chưa cập nhật được trạng thái. Hãy thử lại.");
    } finally {
      setOperation(null);
    }
  }

  async function remove() {
    if (!deleteItem || busy) return;
    const id = deleteItem.id;
    setOperation("delete");
    setDeleteError("");
    setMessage("");
    try {
      await deleteUploadedInfographic(id);
      if (id === selectedId) onSelectAuto?.();
      setItems(current => current.filter(item => item.id !== id));
      setDeleteItem(null);
      setMessage("Đã xóa infographic.");
    } catch {
      setDeleteError("Chưa xóa được infographic. Ảnh vẫn được giữ trong thư viện; hãy thử lại.");
    } finally {
      setOperation(null);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card">
      <div>
        <h2 className="text-lg font-extrabold text-ink">
          Infographic giáo viên tải lên
        </h2>

        <p className="mt-1 text-sm text-secondary">
          {hasAutoDiagram
            ? "Ảnh tải lên là một phương án hiển thị bên cạnh sơ đồ tự sinh."
            : targetType === "chapter"
              ? "Ảnh được lưu theo chương đang chọn. Chuyển chương để xem thư viện tương ứng."
              : "Ảnh infographic bổ sung cho bài học."}
        </p>
      </div>

      <form onSubmit={upload} noValidate>
        <fieldset disabled={busy || loading || Boolean(loadError)} className="space-y-4 disabled:opacity-60">
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <label className="min-w-0 text-sm font-semibold text-ink">
              Tên infographic
              <input
                value={title}
                maxLength={200}
                onChange={(event) => { setTitle(event.target.value); setError(""); setMessage(""); }}
                placeholder="Ví dụ: Tổng hợp kiến thức"
                className="mt-2 w-full rounded-lg border border-line p-3"
              />
            </label>

            <label className="min-w-0 text-sm font-semibold text-ink">
              Chọn ảnh PNG, JPG hoặc WebP
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(""); setMessage(""); }}
                className="mt-2 block w-full text-sm"
              />
            </label>
          </div>

          <button
            type="submit"
            className="min-h-11 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {operation === "upload" ? "Đang lưu..." : "Tải infographic lên"}
          </button>
          <p className="text-sm text-secondary">PNG, JPG hoặc WebP · Tối đa 15 MB mỗi ảnh.</p>
        </fieldset>
      </form>
      {message && <p role="status" className="text-sm font-semibold text-emerald-800">{message}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {targetType === "lesson" && items.length > 0 && (
        <div className="rounded-xl border border-line bg-canvas p-4">
          <p className="text-sm font-bold text-ink">
            Phiên bản hiển thị cho học sinh
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {hasAutoDiagram && onSelectAuto && (
              <button
                type="button"
                aria-pressed={!selectedId}
                onClick={onSelectAuto}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${!selectedId
                    ? "bg-emerald text-white"
                    : "border border-line bg-white text-ink hover:bg-slate-50"
                  }`}
              >
                Sơ đồ tự sinh
              </button>
            )}

            {onSelectUploaded &&
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selectedId === item.id}
                  onClick={() => onSelectUploaded(item.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${selectedId === item.id
                      ? "bg-emerald text-white"
                      : "border border-line bg-white text-ink hover:bg-slate-50"
                    }`}
                >
                  {item.title?.trim()
                    ? `Infographic: ${item.title}`
                    : "Infographic tải lên"}
                </button>
              ))}
          </div>

          <p className="mt-2 text-xs text-secondary">
            Chọn một phương án hiển thị. Thay đổi có hiệu lực sau khi lưu Bài.
          </p>
        </div>
      )}

      {loading ? <p role="status" className="text-sm text-secondary">Đang tải thư viện infographic…</p> : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p role="alert" className="text-sm text-red-800">{loadError}</p>
          <button type="button" onClick={() => setReloadIndex(index => index + 1)} className="mt-3 min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-bold">Thử lại</button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-secondary">Chưa có infographic tải lên.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <figure key={item.id} className="min-w-0 rounded-xl border border-line p-3">
              <UploadedImage item={item} />

              <figcaption className="mt-3 font-semibold text-ink [overflow-wrap:anywhere]">
                {item.title}
              </figcaption>

              <p className="mt-2 text-sm">
                <span className={`inline-flex rounded-full px-3 py-1 font-semibold ${item.visibility === "published" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                  {item.visibility === "published" ? "Đã đăng" : "Bản nháp"}
                </span>
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => { setVisibilityAction({ item, next: item.visibility === "published" ? "draft" : "published" }); setVisibilityError(""); }} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-50 ${item.visibility === "published" ? "border border-line text-ink" : "bg-emerald-700 text-white hover:bg-emerald-800"}`}>
                  {item.visibility === "published" ? <Undo2 size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
                  {item.visibility === "published" ? "Gỡ đăng" : "Đăng ảnh"}
                </button>
                <button type="button" disabled={busy} onClick={() => setPreviewItem(item)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold disabled:opacity-50">
                  <Eye size={17} aria-hidden="true" />Xem ảnh</button>
                <button type="button" disabled={busy} onClick={() => { setDeleteItem(item); setDeleteError(""); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold text-red-700 disabled:opacity-50">
                  <Trash2 size={17} aria-hidden="true" />Xóa ảnh</button>
              </div>
            </figure>
          ))}
        </div>
      )}
      {visibilityAction && <Dialog title={visibilityAction.next === "published" ? "Đăng infographic?" : "Gỡ đăng infographic?"} onClose={() => { if (!busy) setVisibilityAction(null); }}>
        <p className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">{visibilityAction.item.title}</p>
        <p className="mt-3 text-sm leading-6 text-secondary">{visibilityAction.next === "published" ? "Đăng ảnh infographic này? Trạng thái của ảnh độc lập với nội dung bài học." : "Ảnh sẽ trở lại Bản nháp và vẫn được giữ trong thư viện. Nội dung bài học không thay đổi."}</p>
        {visibilityError && <p role="alert" className="mt-3 text-sm text-red-700">{visibilityError}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => setVisibilityAction(null)} className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold disabled:opacity-50">Hủy</button>
          <button type="button" disabled={busy} onClick={changeVisibility} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{operation === "visibility" ? "Đang lưu…" : visibilityAction.next === "published" ? "Xác nhận đăng" : "Xác nhận gỡ đăng"}</button>
        </div>
      </Dialog>}
      {previewItem && <Dialog title={`Xem infographic: ${previewItem.title}`} onClose={() => setPreviewItem(null)}>
        <UploadedImage item={previewItem} large />
        <p className="mt-3 text-center text-sm text-secondary [overflow-wrap:anywhere]">{previewItem.title}</p>
      </Dialog>}
      {deleteItem && <Dialog title="Xóa infographic?" onClose={() => { if (!busy) setDeleteItem(null); }}>
        <p className="text-sm leading-6 text-secondary [overflow-wrap:anywhere]">Bạn muốn xóa ảnh “{deleteItem.title}”? Thao tác này không thể hoàn tác. Nếu ảnh đang được bài học sử dụng, liên kết đó sẽ không còn ảnh.</p>
        {deleteError && <p role="alert" className="mt-3 text-sm text-red-700">{deleteError}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => setDeleteItem(null)} className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold disabled:opacity-50">Giữ lại ảnh</button>
          <button type="button" disabled={busy} onClick={remove} className="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50">{operation === "delete" ? "Đang xóa…" : "Xác nhận xóa"}</button>
        </div>
      </Dialog>}
    </section>
  );
}
