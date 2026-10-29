import { useEffect, useState } from "react";
import { FileSpreadsheet, Search } from "lucide-react";
import { ApiError } from "../../service/api/client";
import { getTeacherClassroomRoster, importTeacherClassroomRoster, type TeacherRosterPage, type TeacherRosterStatusFilter } from "../../service/api/classrooms";
import { RosterImportModal } from "./RosterImportModal";
import type { RosterImportRow } from "../../types/teacher";

const statusText: Record<string, string> = {
  joined: "Đã liên kết tài khoản",
  not_joined: "Chưa liên kết tài khoản",
  conflict: "Xung đột",
};

const statusClasses: Record<string, string> = {
  joined: "bg-emerald/10 text-emerald",
  not_joined: "bg-slate-100 text-secondary",
  conflict: "bg-red-50 text-red-600",
};

export function TeacherRosterReadSection({ classroomId, classroomName, archived }: { classroomId: string; classroomName: string; archived: boolean }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [rosterSearch, setRosterSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeacherRosterStatusFilter>("all");
  const [knownRosterTotal, setKnownRosterTotal] = useState<number | null>(null);
  const [result, setResult] = useState<{ key: string; roster?: TeacherRosterPage; error?: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const queryKey = JSON.stringify([classroomId, page, debouncedSearch, statusFilter, revision]);
  const searchPending = rosterSearch.trim() !== debouncedSearch;
  const currentResult = !searchPending && result?.key === queryKey ? result : null;
  const loading = currentResult === null;
  const roster = currentResult?.roster;
  const error = currentResult?.error ?? "";
  const hasFilters = debouncedSearch !== "" || statusFilter !== "all";

  const importRows = async (rows: RosterImportRow[]) => {
    const result = await importTeacherClassroomRoster(classroomId, rows.map(({ orderNumber, fullName, studentCode }) => ({
      orderNumber, fullName, studentCode,
    })));
    setImportNotice(`Đã nhập danh sách: thêm ${result.created}, cập nhật ${result.updated}.`);
    setPage(1);
    setRevision((value) => value + 1);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(rosterSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [rosterSearch]);

  useEffect(() => {
    let active = true;
    void getTeacherClassroomRoster(classroomId, page, debouncedSearch, statusFilter)
      .then((response) => {
        if (!active) return;
        setResult({ key: queryKey, roster: response });
        if (!hasFilters) setKnownRosterTotal(response.meta.total);
      })
      .catch((cause) => {
        if (!active) return;
        const message = cause instanceof ApiError && cause.status === 401 ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
          : cause instanceof ApiError && cause.status === 403 ? "Bạn không có quyền xem danh sách học sinh của lớp này."
            : cause instanceof ApiError && cause.status === 404 ? "Không tìm thấy lớp học hoặc danh sách học sinh."
              : cause instanceof Error ? cause.message : "Không thể tải danh sách học sinh.";
        setResult({ key: queryKey, error: message });
      });
    return () => { active = false; };
  }, [classroomId, archived, page, revision, debouncedSearch, statusFilter, queryKey, hasFilters]);

  return <section aria-labelledby="roster-title" className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h2 id="roster-title" className="text-xl font-extrabold text-ink">Danh sách học sinh</h2>
        <p className="mt-1 text-sm text-secondary">Dùng để đối chiếu mã học sinh khi có yêu cầu tham gia lớp.</p>
      </div>
      {!archived && !loading && !error && <button type="button" onClick={() => { setImportNotice(""); setImportOpen(true); }} className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:self-auto"><FileSpreadsheet className="size-4" aria-hidden="true" />Nhập danh sách Excel</button>}
    </div>
    <p className="mt-3 text-xs leading-5 text-muted">Có tên trong danh sách đối chiếu không đồng nghĩa với đang tham gia lớp. Sĩ số đang tham gia được hiển thị riêng ở phần tổng quan.</p>
    {archived && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-secondary">Lớp đã lưu trữ. Danh sách lịch sử chỉ có thể xem.</p>}
    {importNotice && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{importNotice}</p>}
    {!loading && !error && roster && knownRosterTotal !== null && knownRosterTotal > 0 &&
      <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-secondary">{hasFilters ? "Kết quả" : "Danh sách"}: {roster.meta.total}</span></div>}
    {knownRosterTotal !== null && knownRosterTotal > 0 && <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input type="search" aria-label="Tìm theo tên hoặc mã học sinh" value={rosterSearch} maxLength={100}
          onChange={(event) => { setRosterSearch(event.target.value); setPage(1); }}
          placeholder="Tìm theo tên hoặc mã học sinh..."
          className="min-h-11 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10" />
      </div>
      <select aria-label="Lọc trạng thái danh sách học sinh" value={statusFilter}
        onChange={(event) => { setStatusFilter(event.target.value as TeacherRosterStatusFilter); setPage(1); }}
        className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10">
        <option value="all">Tất cả trạng thái</option>
        <option value="joined">Đã liên kết tài khoản</option>
        <option value="not_joined">Chưa liên kết tài khoản</option>
        <option value="conflict">Có xung đột</option>
      </select>
    </div>}
    {loading && <p role="status" className="mt-5 text-sm text-secondary">Đang tải danh sách học sinh…</p>}
    {!loading && error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p>{error}</p>
      <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-2 min-h-11 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">Thử lại</button>
    </div>}
    {!loading && !error && roster && roster.meta.total === 0 && !hasFilters && <div className="mt-5 rounded-xl border border-dashed border-line bg-slate-50 px-6 py-10 text-center">
      <FileSpreadsheet className="mx-auto size-8 text-muted" aria-hidden="true" />
      <p className="mt-3 font-bold text-ink">Chưa có danh sách đối chiếu</p>
      <p className="mt-1 text-sm text-muted">{archived ? "Lớp đã lưu trữ và không có danh sách học sinh." : "Bạn có thể nhập danh sách Excel để đối chiếu mã học sinh."}</p>
    </div>}
    {!loading && !error && roster && roster.meta.total === 0 && hasFilters && <div className="mt-5 rounded-xl border border-line px-6 py-10 text-center">
      <Search className="mx-auto size-7 text-muted" aria-hidden="true" />
      <p className="mt-3 font-bold text-ink">Không tìm thấy học sinh</p>
      <button type="button" onClick={() => { setRosterSearch(""); setDebouncedSearch(""); setStatusFilter("all"); setPage(1); }} className="mt-3 min-h-11 text-sm font-bold text-emerald">Xóa bộ lọc</button>
    </div>}
    {!loading && !error && roster && roster.meta.total > 0 && <>
      <div className="mt-5 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-secondary"><tr><th scope="col" className="px-4 py-3">STT</th><th scope="col" className="px-4 py-3">Họ và tên</th><th scope="col" className="px-4 py-3">Mã học sinh</th><th scope="col" className="px-4 py-3">Trạng thái</th></tr></thead>
          <tbody className="divide-y divide-line">{roster.data.map((entry) => <tr key={entry.id}>
            <td className="px-4 py-3 text-muted">{entry.orderNumber}</td><td className="px-4 py-3 font-semibold text-ink">{entry.fullName}</td>
            <td className="px-4 py-3 font-bold text-ink">{entry.studentCode}</td><td className="px-4 py-3"><span className={`inline-block rounded-full px-3 py-1.5 text-xs font-semibold ${statusClasses[entry.status] ?? "bg-slate-100 text-secondary"}`}>{statusText[entry.status] ?? entry.status}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
      {roster.meta.last_page > 1 && <nav aria-label="Phân trang danh sách học sinh" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-xl border border-line px-4 font-bold text-emerald disabled:opacity-50">Trang trước</button>
        <span>Trang {roster.meta.current_page} / {roster.meta.last_page}</span>
        <button type="button" disabled={page >= roster.meta.last_page} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-xl border border-line px-4 font-bold text-emerald disabled:opacity-50">Trang sau</button>
      </nav>}
    </>}
    <RosterImportModal isOpen={importOpen} className={classroomName} backendImport onClose={() => setImportOpen(false)} onImport={importRows} />
  </section>;
}
