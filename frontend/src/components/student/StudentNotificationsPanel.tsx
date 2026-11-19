import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { listStudentNotifications, markStudentNotificationRead, type StudentNotification } from "../../service/api/distributions";

export function StudentNotificationsPanel() {
  const { session, status } = useAuth();
  const [result, setResult] = useState<{ key: string; data?: StudentNotification[]; lastPage?: number; error?: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [readError, setReadError] = useState("");
  const key = `${status}:${session?.role ?? "none"}:${session?.userId ?? "none"}:${retry}:${page}`;
  const currentKey = useRef(key);
  currentKey.current = key;
  const current = result?.key === key ? result : null;

  useEffect(() => { setPage(1); }, [session?.userId, status]);

  useEffect(() => {
    if (status !== "ready" || session?.role !== "student") return;
    let live = true;
    setReadError("");
    void listStudentNotifications(page).then(response => { if (live) setResult({ key, data: response.data, lastPage: response.meta.lastPage }); })
      .catch(() => { if (live) setResult({ key, error: true }); });
    return () => { live = false; };
  }, [status, session?.role, key, page]);

  if (status !== "ready" || session?.role !== "student") return null;
  if (current?.data?.length === 0) return null;
  return <section className="rounded-2xl border border-line bg-white p-5 shadow-card" aria-label="Thông báo của bạn">
    <h2 className="text-lg font-extrabold text-ink">Thông báo</h2>
    {readError && <p role="alert" className="mt-2 text-sm text-red-700">{readError}</p>}
    {!current ? <p role="status" className="mt-2 text-sm text-secondary">Đang tải thông báo...</p>
      : current.error ? <div role="alert" className="mt-2 text-sm"><p>Không thể tải thông báo.</p><button type="button" className="mt-2 min-h-11 text-emerald-700 underline" onClick={() => setRetry(n => n + 1)}>Thử lại</button></div>
        : <ul className="mt-3 space-y-2">{current.data?.map(item => <li key={item.id} className="rounded-xl border border-line p-3 text-sm">
            <p className="font-semibold">{item.title}</p><p className="mt-1">{item.body}</p>
            <p className="mt-1 text-xs text-secondary">{new Date(item.createdAt).toLocaleString("vi-VN")}</p>
            {!item.readAt && <button type="button" className="mt-2 min-h-11 text-emerald-700 underline" onClick={() => {
              setReadError("");
              void markStudentNotificationRead(item.id).then(updated => setResult(previous => previous?.key === key && previous.data
                ? { ...previous, data: previous.data.map(notice => notice.id === updated.id ? updated : notice) } : previous))
                .catch(() => { if (currentKey.current === key) setReadError("Không thể đánh dấu đã đọc. Vui lòng thử lại."); });
            }}>Đánh dấu đã đọc</button>}
          </li>)}</ul>}
    {(current?.lastPage ?? 1) > 1 && <div className="mt-3 flex items-center gap-2 text-sm"><button type="button" className="min-h-11 text-emerald-700 underline disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page}/{current?.lastPage}</span><button type="button" className="min-h-11 text-emerald-700 underline disabled:opacity-50" disabled={page >= (current?.lastPage ?? 1)} onClick={() => setPage(page + 1)}>Sau</button></div>}
  </section>;
}
