import { useEffect, useState } from "react";
import { ApiError } from "../../service/api/client";
import { getTeacherClassroomRoster, type TeacherRosterPage } from "../../service/api/classrooms";

const statusText: Record<string, string> = {
  joined: "Đã liên kết tài khoản",
  not_joined: "Chưa liên kết tài khoản",
  conflict: "Xung đột",
};

export function TeacherRosterReadSection({ classroomId, archived }: { classroomId: string; archived: boolean }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [roster, setRoster] = useState<TeacherRosterPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setRoster(null);
    void getTeacherClassroomRoster(classroomId, page)
      .then((response) => { if (active) setRoster(response); })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof ApiError && cause.status === 401 ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
          : cause instanceof ApiError && cause.status === 403 ? "Bạn không có quyền xem danh sách học sinh của lớp này."
            : cause instanceof ApiError && cause.status === 404 ? "Không tìm thấy lớp học hoặc danh sách học sinh."
              : cause instanceof Error ? cause.message : "Không thể tải danh sách học sinh.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classroomId, archived, page, revision]);

  return <section aria-labelledby="roster-title" className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
    <h2 id="roster-title" className="text-lg font-extrabold text-ink">Danh sách học sinh</h2>
    <p className="mt-1 text-sm leading-6 text-secondary">
      Danh sách đối chiếu của lớp; học sinh có tên trong danh sách chưa chắc đã tham gia lớp. Số học sinh đang tham gia được hiển thị riêng ở phần thông tin lớp.
    </p>
    {archived && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-secondary">Lớp đã lưu trữ. Danh sách lịch sử chỉ có thể xem.</p>}
    {loading && <p role="status" className="mt-5 text-sm text-secondary">Đang tải danh sách học sinh…</p>}
    {!loading && error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p>{error}</p>
      <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-2 min-h-11 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">Thử lại</button>
    </div>}
    {!loading && !error && roster && roster.meta.total === 0 && <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-secondary">
      <p className="font-bold text-ink">Lớp chưa có danh sách học sinh.</p>
      <p className="mt-1">Tính năng nhập danh sách sẽ được triển khai sau.</p>
    </div>}
    {!loading && !error && roster && roster.meta.total > 0 && <>
      <p className="mt-5 text-sm text-secondary">{roster.meta.total} học sinh trong danh sách đối chiếu</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-secondary"><tr><th scope="col" className="p-3">STT</th><th scope="col" className="p-3">Họ và tên</th><th scope="col" className="p-3">Mã học sinh</th><th scope="col" className="p-3">Trạng thái danh sách</th></tr></thead>
          <tbody className="divide-y divide-line">{roster.data.map((entry) => <tr key={entry.id}>
            <td className="p-3 text-secondary">{entry.orderNumber}</td><td className="p-3 font-semibold text-ink">{entry.fullName}</td>
            <td className="p-3 text-secondary">{entry.studentCode}</td><td className="p-3 text-secondary">{statusText[entry.status] ?? entry.status}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {roster.meta.last_page > 1 && <nav aria-label="Phân trang danh sách học sinh" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-xl border border-line px-4 font-bold text-emerald disabled:opacity-50">Trang trước</button>
        <span>Trang {roster.meta.current_page} / {roster.meta.last_page}</span>
        <button type="button" disabled={page >= roster.meta.last_page} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-xl border border-line px-4 font-bold text-emerald disabled:opacity-50">Trang sau</button>
      </nav>}
    </>}
  </section>;
}
