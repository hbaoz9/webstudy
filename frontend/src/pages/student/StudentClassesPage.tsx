import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Plus, School } from "lucide-react";
import { ApiError } from "../../service/api/client";
import { getStudentActiveMembershipsPage, leaveStudentClassroom, type ApiPage, type ClassroomMembership } from "../../service/api/joinRequests";

export default function StudentClassesPage() {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: ApiPage<ClassroomMembership>; error?: string } | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<ClassroomMembership | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [notice, setNotice] = useState("");
  const leaveLock = useRef(false);
  const key = `${page}:${revision}`;
  const current = result?.key === key ? result : null;

  useEffect(() => {
    let active = true;
    void getStudentActiveMembershipsPage(page)
      .then((data) => { if (active) setResult({ key, data }); })
      .catch((cause) => { if (active) setResult({ key, error: cause instanceof Error ? cause.message : "Không thể tải lớp học." }); });
    return () => { active = false; };
  }, [page, revision, key]);

  const confirmLeave = async () => {
    if (!leaveTarget || leaveLock.current || leaveTarget.status !== "active") return;
    leaveLock.current = true;
    setLeaving(true);
    setLeaveError("");
    try {
      await leaveStudentClassroom(leaveTarget.id);
      setNotice(`Đã rời lớp ${leaveTarget.classroom.name}.`);
      setLeaveTarget(null);
      setPage(1);
      setResult(null);
      setRevision((value) => value + 1);
    } catch (cause) {
      const validation = cause instanceof ApiError ? Object.values(cause.errors).flat().join(" ") : "";
      const message = cause instanceof ApiError && cause.status === 401 ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
        : cause instanceof ApiError && cause.status === 403 ? "Bạn không có quyền rời membership này."
          : cause instanceof ApiError && cause.status === 404 ? "Không tìm thấy membership. Vui lòng tải lại trang."
            : cause instanceof ApiError && cause.status === 409 ? "Membership đã thay đổi. Vui lòng tải lại trang."
              : validation || (cause instanceof Error ? cause.message : "Không thể rời lớp. Vui lòng thử lại.");
      setLeaveError(message);
    } finally {
      leaveLock.current = false;
      setLeaving(false);
    }
  };

  return <div className="mx-auto max-w-6xl space-y-7">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Lớp học của tôi</h1>
        <p className="mt-2 text-sm text-secondary">Các lớp học bạn đang là thành viên.</p>
      </div>
      <Link to="/student/join-class" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald px-5 py-3 text-sm font-bold text-white transition hover:opacity-90">
        <Plus className="size-4" /> Tham gia lớp mới
      </Link>
    </header>

    {notice && <p role="status" className="rounded-xl border border-emerald/30 bg-emerald/10 p-4 text-sm text-emerald">{notice}</p>}
    {leaveTarget && <section role="dialog" aria-label="Xác nhận rời lớp" className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="font-extrabold text-ink">Rời lớp {leaveTarget.classroom.name}?</h2>
      <p className="mt-2 text-sm text-secondary">Bạn sẽ không còn là thành viên đang tham gia. Lịch sử yêu cầu tham gia được giữ lại.</p>
      {leaveError && <p role="alert" className="mt-3 text-sm text-red-600">{leaveError}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={leaving} onClick={() => { setLeaveTarget(null); setLeaveError(""); }} className="min-h-11 rounded-full border border-line bg-white px-5 text-sm font-bold text-secondary disabled:opacity-50">Hủy</button>
        <button type="button" disabled={leaving} onClick={() => void confirmLeave()} className="min-h-11 rounded-full bg-red-600 px-5 text-sm font-bold text-white disabled:opacity-50">{leaving ? "Đang xử lý…" : "Xác nhận rời lớp"}</button>
      </div>
    </section>}

    {!current && <p role="status" className="text-sm text-secondary">Đang tải lớp học…</p>}
    {current?.error && <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
      {current.error} <button type="button" onClick={() => setRevision((value) => value + 1)} className="ml-2 font-bold underline">Thử lại</button>
    </section>}
    {current?.data && <>
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <p className="text-sm text-secondary">Đã tham gia</p>
        <p className="mt-3 text-3xl font-extrabold text-ink">{current.data.meta.total}</p>
      </section>
      {current.data.data.length === 0 ? <section className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
        <School className="mx-auto size-10 text-muted" />
        <h2 className="mt-4 text-lg font-extrabold text-ink">Bạn chưa tham gia lớp học nào</h2>
        <p className="mt-2 text-sm text-secondary">Khi giáo viên duyệt yêu cầu, lớp học sẽ xuất hiện tại đây.</p>
        <Link to="/student/join-class" className="mt-5 inline-flex rounded-xl bg-emerald px-5 py-3 text-sm font-bold text-white">Tham gia lớp học</Link>
      </section> : <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {current.data.data.map((membership) => {
          const classroom = membership.classroom;
          return <article key={membership.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className={`relative bg-gradient-to-br from-slate-600 to-ink bg-cover bg-center ${classroom.coverImage ? "h-36" : "h-20"}`} style={classroom.coverImage ? { backgroundImage: `url(${classroom.coverImage})` } : undefined}>
              {classroom.status === "archived" && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-secondary"><Archive className="size-3.5" /> Đã lưu trữ</span>}
            </div>
            <div className="space-y-4 p-5">
              <div>
                <h3 className="text-lg font-extrabold text-ink">{classroom.name}</h3>
                <p className="mt-1 text-xs text-secondary">Năm học {classroom.academicYear}</p>
              </div>
              <div><span className="inline-flex rounded-full bg-emerald/10 px-3 py-1.5 text-xs font-bold text-emerald">Đã tham gia</span></div>
              {classroom.description && <p className="text-sm text-secondary">{classroom.description}</p>}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link to={`/student/classes/${classroom.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald px-5 text-sm font-bold text-white transition hover:opacity-90">Xem lớp học</Link>
                {membership.status === "active" && <button type="button" onClick={() => { setLeaveTarget(membership); setLeaveError(""); setNotice(""); }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 bg-white px-5 text-sm font-bold text-red-600 transition hover:bg-red-50">Rời lớp</button>}
              </div>
            </div>
          </article>;
        })}
      </section>}
      {current.data.meta.last_page > 1 && <nav aria-label="Phân trang lớp học" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-xl border border-line bg-white px-4 font-bold text-emerald disabled:opacity-50">Trang trước</button>
        <span>Trang {current.data.meta.current_page} / {current.data.meta.last_page}</span>
        <button type="button" disabled={page >= current.data.meta.last_page} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-xl border border-line bg-white px-4 font-bold text-emerald disabled:opacity-50">Trang sau</button>
      </nav>}
    </>}
  </div>;
}
