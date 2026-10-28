import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, apiGet, apiRequest } from "../../service/api/client";
import { useAuth } from "../../contexts/AuthContext";
import { VerificationDocumentViewer } from "../../components/teacher/VerificationDocumentViewer";

type Submission = {
  id: number;
  teacher_email?: string;
  full_name: string;
  school_name: string;
  school_address: string;
  teacher_code: string | null;
  position: string;
  document: { name: string; type: string; size: number; available: boolean };
  status: "pending" | "verified" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
};
type Page = { data: Submission[]; meta: { current_page: number; last_page: number } };

export default function TeacherVerificationsPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiGet<Page>(`/admin/teacher-verifications?status=all&page=${page}`);
      setResult(response);
      setSelected((current) => response.data.some((item) => item.id === current) ? current : response.data[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải hồ sơ xác minh.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  const current = result?.data.find((item) => item.id === selected);
  const pending = result?.data.filter((item) => item.status === "pending") ?? [];
  const history = result?.data.filter((item) => item.status !== "pending") ?? [];

  const review = async (approve: boolean) => {
    if (!current || busy) return;
    if (!approve && !reason.trim()) { setError("Vui lòng nhập lý do từ chối."); return; }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/admin/teacher-verifications/${current.id}/${approve ? "approve" : "reject"}`, "POST", approve ? undefined : { reason: reason.trim() });
      setSuccess(approve ? "Đã chấp thuận hồ sơ." : "Đã từ chối hồ sơ và lưu lý do.");
      setReason("");
      await load();
    } catch (cause) {
      const validation = cause instanceof ApiError ? Object.values(cause.errors).flat()[0] : undefined;
      setError(validation ?? (cause instanceof Error ? cause.message : "Không thể xét duyệt hồ sơ."));
    } finally {
      setBusy(false);
    }
  };

  return <main className="min-h-dvh bg-canvas px-4 py-6 text-ink sm:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><Link to="/" className="text-sm font-extrabold text-emerald">WebStudy</Link><h1 className="mt-2 text-2xl font-extrabold">Xác minh giáo viên</h1><p className="mt-1 text-sm text-secondary">Xem minh chứng và ghi nhận quyết định xét duyệt.</p></div>
        <button type="button" onClick={async () => { if (await signOut()) navigate("/auth?role=admin", { replace: true }); }} className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">Đăng xuất</button>
      </header>
      {success && <p role="status" className="rounded-xl border border-emerald/30 bg-emerald/10 p-4 text-sm">{success}</p>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} <button type="button" onClick={() => void load()} className="ml-2 font-bold underline">Tải lại</button></div>}
      {loading && <p role="status" className="text-sm text-secondary">Đang tải hồ sơ…</p>}
      {!loading && result && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="text-lg font-extrabold">Chờ duyệt ({pending.length})</h2>
            {pending.length === 0 ? <p className="mt-3 text-sm text-secondary">Hiện không có hồ sơ chờ duyệt trên trang này.</p> : <ul className="mt-3 space-y-2">{pending.map((item) => <li key={item.id}><button type="button" onClick={() => { setSelected(item.id); setReason(""); }} aria-pressed={selected === item.id} className="min-h-14 w-full rounded-xl border border-line p-3 text-left text-sm hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald"><span className="block font-bold">{item.full_name}</span><span className="text-secondary">{item.school_name}</span></button></li>)}</ul>}
          </section>
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="text-lg font-extrabold">Lịch sử xét duyệt</h2>
            {history.length === 0 ? <p className="mt-3 text-sm text-secondary">Chưa có hồ sơ đã xử lý trên trang này.</p> : <ul className="mt-3 space-y-2">{history.map((item) => <li key={item.id}><button type="button" onClick={() => setSelected(item.id)} aria-pressed={selected === item.id} className="min-h-14 w-full rounded-xl border border-line p-3 text-left text-sm hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald"><span className="block font-bold">{item.full_name}</span><span className="text-secondary">{item.status === "verified" ? "Đã duyệt" : "Đã từ chối"} · {item.school_name}</span></button></li>)}</ul>}
          </section>
          <div className="flex items-center gap-3 text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="min-h-11 rounded-lg border border-line px-4 disabled:opacity-50">Trước</button><span>Trang {page}/{result.meta.last_page}</span><button type="button" disabled={page >= result.meta.last_page} onClick={() => setPage(page + 1)} className="min-h-11 rounded-lg border border-line px-4 disabled:opacity-50">Sau</button></div>
        </div>
        <section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6" aria-label="Chi tiết hồ sơ">
          {!current ? <p className="text-sm text-secondary">Chọn một hồ sơ để xem chi tiết.</p> : <div className="space-y-5">
            <div><h2 className="text-xl font-extrabold">{current.full_name}</h2><p className="mt-1 text-sm text-secondary">{current.teacher_email}</p><p className="mt-1 text-sm font-bold">{current.status === "pending" ? "Chờ duyệt" : current.status === "verified" ? "Đã duyệt" : "Đã từ chối"}</p></div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-secondary">Trường</dt><dd className="font-semibold">{current.school_name}</dd></div><div><dt className="text-secondary">Vị trí</dt><dd className="font-semibold">{current.position}</dd></div><div><dt className="text-secondary">Địa chỉ</dt><dd>{current.school_address}</dd></div><div><dt className="text-secondary">Mã giáo viên</dt><dd>{current.teacher_code || "—"}</dd></div></dl>
            <div className="rounded-xl bg-canvas p-4 text-sm"><p className="font-bold">Minh chứng: {current.document.name}</p><p className="mt-1 text-secondary">{(current.document.size / 1024 / 1024).toFixed(2)} MB · {current.document.type}</p>{current.document.available ? <VerificationDocumentViewer key={current.id} submissionId={current.id} label="Xem minh chứng" /> : <p className="mt-2 text-amber-700">Hồ sơ cũ chỉ có metadata, không có file để xem.</p>}</div>
            {current.rejection_reason && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Lý do từ chối: {current.rejection_reason}</p>}
            {current.status === "pending" && <div className="space-y-3 border-t border-line pt-5"><button type="button" disabled={busy || !current.document.available} onClick={() => void review(true)} className="min-h-11 rounded-full bg-emerald px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang xử lý…" : "Chấp thuận"}</button><label className="block text-sm font-bold">Lý do từ chối<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} rows={3} className="mt-2 w-full rounded-xl border border-line p-3 text-sm font-normal" /></label><button type="button" disabled={busy} onClick={() => void review(false)} className="min-h-11 rounded-full border border-red-300 px-5 text-sm font-bold text-red-700 disabled:opacity-50">Từ chối hồ sơ</button></div>}
          </div>}
        </section>
      </div>}
    </div>
  </main>;
}
