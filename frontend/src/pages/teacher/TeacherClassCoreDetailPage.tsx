import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Archive, ArchiveRestore, Check, Copy, Settings, Trash2, UsersRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../service/api/client";
import { archiveTeacherClassroom, deleteTeacherClassroom, getTeacherClassroom, regenerateTeacherClassroomCode, restoreTeacherClassroom, updateTeacherClassroom, type CreateClassroomInput, type TeacherClassroom } from "../../service/api/classrooms";
import { ClassSettingsModal } from "../../components/teacher/ClassSettingsModal";
import { TeacherRosterReadSection } from "../../components/teacher/TeacherRosterReadSection";
import { TeacherJoinRequestsSection } from "../../components/teacher/TeacherJoinRequestsSection";
import { TeacherStatCard } from "../../components/teacher/TeacherStatCard";

export default function TeacherClassCoreDetailPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState<TeacherClassroom | null>(null);
  const [rosterRevision, setRosterRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const actionLock = useRef(false);

  useEffect(() => {
    if (!classId) { setError("Không tìm thấy lớp học."); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError("");
    setClassroom(null);
    setEditing(false);
    setConfirmRestore(false);
    setConfirmDelete(false);
    setNotice("");
    void getTeacherClassroom(classId)
      .then((item) => { if (active) setClassroom(item); })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof ApiError && cause.status === 404 ? "Không tìm thấy lớp học."
          : cause instanceof ApiError && cause.status === 403 ? "Bạn không có quyền xem lớp học này."
            : cause instanceof Error ? cause.message : "Không thể tải thông tin lớp học.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classId, revision]);

  const copyCode = async () => {
    if (!classroom) return;
    try {
      await navigator.clipboard.writeText(classroom.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const beginEdit = () => {
    if (!classroom) return;
    setNotice("");
    setEditing(true);
  };

  const save = async (input: CreateClassroomInput) => {
    if (!classroom || actionLock.current) return;
    actionLock.current = true;
    try {
      const updated = await updateTeacherClassroom(classroom.id, input);
      setClassroom(updated);
      setEditing(false);
      setNotice("Đã lưu thông tin lớp học.");
    } finally {
      actionLock.current = false;
    }
  };

  const archive = async () => {
    if (!classroom || actionLock.current || classroom.status === "archived") return;
    actionLock.current = true;
    try {
      setClassroom(await archiveTeacherClassroom(classroom.id));
      setEditing(false);
      setNotice("Đã lưu trữ lớp học. Lịch sử lớp vẫn được giữ lại.");
    } finally {
      actionLock.current = false;
    }
  };

  const restore = async () => {
    if (!classroom || classroom.status !== "archived" || !confirmRestore || actionLock.current) return;
    actionLock.current = true;
    setRestoring(true);
    setRestoreError("");
    try {
      const restored = await restoreTeacherClassroom(classroom.id);
      setClassroom(restored);
      setConfirmRestore(false);
      setNotice("Đã khôi phục lớp học. Học sinh từng rời lớp cần gửi yêu cầu tham gia mới.");
      try {
        setClassroom(await getTeacherClassroom(classroom.id));
      } catch {
        setNotice("Đã khôi phục lớp học, nhưng chưa tải lại được chi tiết. Vui lòng làm mới trang.");
      }
    } catch (cause) {
      setRestoreError(cause instanceof Error ? cause.message : "Không thể khôi phục lớp học. Vui lòng thử lại.");
    } finally {
      actionLock.current = false;
      setRestoring(false);
    }
  };

  const regenerateCode = async () => {
    if (!classroom || classroom.status !== "active" || actionLock.current) return;
    actionLock.current = true;
    try {
      setClassroom(await regenerateTeacherClassroomCode(classroom.id));
      setCopied(false);
      setEditing(false);
      setNotice("Đã đổi mã lớp. Mã cũ không còn dùng được.");
    } finally {
      actionLock.current = false;
    }
  };

  const deleteClassroom = async () => {
    if (!classroom || classroom.status !== "archived" || !confirmDelete || actionLock.current) return;
    actionLock.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteTeacherClassroom(classroom.id);
      navigate("/teacher/classes", { replace: true });
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Không thể xóa lớp học. Vui lòng thử lại.");
    } finally {
      actionLock.current = false;
      setDeleting(false);
    }
  };

  return <div className="space-y-7">
    <Link to="/teacher/classes" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-secondary hover:text-emerald focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">
      <ArrowLeft className="size-4" aria-hidden="true" /> Danh sách lớp học
    </Link>

    {loading && <p role="status" className="rounded-2xl border border-line bg-white p-5 text-sm text-secondary">Đang tải thông tin lớp học…</p>}
    {error && !loading && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
      <p>{error}</p>
      {classId && <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-3 min-h-11 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">Thử lại</button>}
    </div>}

    {!loading && !error && classroom && <>
      <header className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="relative min-h-48 bg-gradient-to-br from-slate-600 to-ink bg-cover bg-center px-6 py-7 sm:px-8" style={classroom.coverImage ? { backgroundImage: `url(${classroom.coverImage})` } : undefined}>
          <div className="absolute inset-0 bg-ink/65" aria-hidden="true" />
          <div className="relative z-10 flex min-h-32 flex-col justify-between gap-5 text-white sm:flex-row sm:items-end">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/75">Chi tiết lớp học</p>
              <h1 className="mt-2 break-words text-3xl font-extrabold">{classroom.name}</h1>
              <p className="mt-2 text-sm font-semibold text-white/80">Năm học {classroom.academicYear}</p>
              <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-white/80">{classroom.description || "Lớp chưa có mô tả."}</p>
              {classroom.status === "archived" && <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold"><Archive className="size-3.5" aria-hidden="true" />Đã lưu trữ</span>}
            </div>
            <div className="flex max-w-full flex-wrap gap-3 self-start sm:self-auto">
              <button type="button" onClick={() => void copyCode()} aria-label={`Sao chép mã lớp ${classroom.code}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/15 px-5 text-sm font-bold backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}{copied ? "Đã sao chép" : `Mã lớp: ${classroom.code}`}
              </button>
              {classroom.status === "active" && <button type="button" onClick={beginEdit} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/15 px-5 text-sm font-bold backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><Settings className="size-4" aria-hidden="true" />Cài đặt</button>}
              {classroom.status === "archived" && <button type="button" onClick={() => { setRestoreError(""); setConfirmRestore(true); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/15 px-5 text-sm font-bold backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><ArchiveRestore className="size-4" aria-hidden="true" />Khôi phục lớp</button>}
              {classroom.status === "archived" && <button type="button" onClick={() => { setDeleteError(""); setConfirmDelete(true); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-red-950/40 px-5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-red-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><Trash2 className="size-4" aria-hidden="true" />Xóa lớp</button>}
            </div>
          </div>
        </div>
      </header>

      <section aria-label="Tổng quan lớp học" className="grid gap-5 md:grid-cols-3">
        <TeacherStatCard label="Sĩ số lớp" value={classroom.studentCount} description="Học sinh đang tham gia" icon={UsersRound} tone="green" />
      </section>
      {notice && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}

      <TeacherRosterReadSection key={classroom.id} classroomId={classroom.id} classroomName={classroom.name} archived={classroom.status === "archived"} refreshToken={rosterRevision} />
      <TeacherJoinRequestsSection key={`requests-${classroom.id}`} classroomId={classroom.id} archived={classroom.status === "archived"} onMembershipChange={async () => setClassroom(await getTeacherClassroom(classroom.id))} onRosterChange={() => setRosterRevision((value) => value + 1)} />
      {editing && classroom.status === "active" && <ClassSettingsModal backendClassroom={classroom} onClose={() => setEditing(false)} onSave={save} onArchive={archive} onRegenerateCode={regenerateCode} />}
      {confirmRestore && classroom.status === "archived" && <div role="dialog" aria-modal="true" aria-labelledby="restore-classroom-title" onClick={() => { if (!actionLock.current) setConfirmRestore(false); }} className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm">
        <div onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-center gap-2"><ArchiveRestore className="size-5 text-emerald" aria-hidden="true" /><h2 id="restore-classroom-title" className="text-xl font-extrabold text-ink">Khôi phục lớp học</h2></div>
          <p className="mt-3 text-sm leading-6 text-secondary">Khôi phục {classroom.name} để tiếp tục quản lý lớp và nhận yêu cầu tham gia mới. Học sinh từng rời lớp sẽ không tự động tham gia lại; các yêu cầu đã bị từ chối vẫn giữ nguyên.</p>
          <p className="mt-2 text-sm leading-6 text-secondary">Thay đổi thông tin chưa lưu sẽ không được áp dụng.</p>
          {restoreError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{restoreError}</p>}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" disabled={restoring} onClick={() => setConfirmRestore(false)} className="min-h-11 rounded-full border border-line px-6 text-sm font-bold text-ink disabled:opacity-50">Hủy</button>
            <button type="button" disabled={restoring} onClick={() => void restore()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald px-6 text-sm font-bold text-white disabled:opacity-50"><ArchiveRestore className="size-4" aria-hidden="true" />{restoring ? "Đang khôi phục…" : "Xác nhận khôi phục"}</button>
          </div>
        </div>
      </div>}
      {confirmDelete && classroom.status === "archived" && <div role="dialog" aria-modal="true" aria-labelledby="delete-classroom-title" onClick={() => { if (!actionLock.current) setConfirmDelete(false); }} className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm">
        <div onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-center gap-2"><Trash2 className="size-5 text-red-700" aria-hidden="true" /><h2 id="delete-classroom-title" className="text-xl font-extrabold text-ink">Xóa lớp đã lưu trữ</h2></div>
          <p className="mt-3 text-sm leading-6 text-secondary">Xóa mềm {classroom.name} khỏi danh sách lớp và các API sử dụng thông thường. Roster, yêu cầu tham gia, thành viên và lịch sử xác minh vẫn được lưu trên Backend. Hiện chưa hỗ trợ khôi phục lớp đã xóa.</p>
          {deleteError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</p>}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)} className="min-h-11 rounded-full border border-line px-6 text-sm font-bold text-ink disabled:opacity-50">Hủy</button>
            <button type="button" disabled={deleting} onClick={() => void deleteClassroom()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-700 px-6 text-sm font-bold text-white disabled:opacity-50"><Trash2 className="size-4" aria-hidden="true" />{deleting ? "Đang xóa…" : "Xác nhận xóa lớp"}</button>
          </div>
        </div>
      </div>}
    </>}
  </div>;
}
