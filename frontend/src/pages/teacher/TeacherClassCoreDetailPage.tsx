import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Archive, Check, Copy, Settings, UsersRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../service/api/client";
import { archiveTeacherClassroom, getTeacherClassroom, updateTeacherClassroom, type CreateClassroomInput, type TeacherClassroom } from "../../service/api/classrooms";
import { ClassSettingsModal } from "../../components/teacher/ClassSettingsModal";
import { TeacherRosterReadSection } from "../../components/teacher/TeacherRosterReadSection";
import { TeacherStatCard } from "../../components/teacher/TeacherStatCard";

export default function TeacherClassCoreDetailPage() {
  const { classId } = useParams();
  const [classroom, setClassroom] = useState<TeacherClassroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const actionLock = useRef(false);

  useEffect(() => {
    if (!classId) { setError("Không tìm thấy lớp học."); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError("");
    setClassroom(null);
    setEditing(false);
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
            </div>
          </div>
        </div>
      </header>

      <section aria-label="Tổng quan lớp học" className="grid gap-5 md:grid-cols-3">
        <TeacherStatCard label="Sĩ số lớp" value={classroom.studentCount} description="Học sinh đang tham gia" icon={UsersRound} tone="green" />
      </section>
      {notice && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}

      <TeacherRosterReadSection key={classroom.id} classroomId={classroom.id} classroomName={classroom.name} archived={classroom.status === "archived"} />
      {editing && classroom.status === "active" && <ClassSettingsModal backendClassroom={classroom} onClose={() => setEditing(false)} onSave={save} onArchive={archive} />}
    </>}
  </div>;
}
