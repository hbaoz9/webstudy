import { useEffect, useState, useRef, type FormEvent } from "react";
import { ArrowLeft, Archive, Check, Copy, Pencil, UsersRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../service/api/client";
import { archiveTeacherClassroom, getTeacherClassroom, updateTeacherClassroom, type TeacherClassroom } from "../../service/api/classrooms";
import { getAcademicYearOptions } from "../../utils/classroom";
import { TeacherRosterReadSection } from "../../components/teacher/TeacherRosterReadSection";

export default function TeacherClassCoreDetailPage() {
  const { classId } = useParams();
  const [classroom, setClassroom] = useState<TeacherClassroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const actionLock = useRef(false);

  useEffect(() => {
    if (!classId) { setError("Không tìm thấy lớp học."); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError("");
    setClassroom(null);
    setEditing(false);
    setConfirmArchive(false);
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
    setName(classroom.name);
    setAcademicYear(classroom.academicYear);
    setDescription(classroom.description ?? "");
    setCoverImage(classroom.coverImage ?? "");
    setFieldErrors({});
    setActionError("");
    setNotice("");
    setConfirmArchive(false);
    setEditing(true);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!classroom || actionLock.current) return;
    setFieldErrors({});
    setActionError("");
    const trimmedName = name.trim();
    const coverUrl = coverImage.trim();
    if (trimmedName.length < 2 || trimmedName.length > 255) {
      setFieldErrors({ name: "Tên lớp phải có từ 2 đến 255 ký tự." });
      return;
    }
    if (!/^\d{4}-\d{4}$/.test(academicYear)) {
      setFieldErrors({ academic_year: "Năm học phải có dạng YYYY-YYYY." });
      return;
    }
    if (coverUrl && (coverUrl.length > 255 || (coverUrl !== (classroom.coverImage ?? "") && !/^https?:\/\//i.test(coverUrl)))) {
      setFieldErrors({ cover_image_path: "Liên kết ảnh bìa phải là URL http(s) và không quá 255 ký tự." });
      return;
    }
    actionLock.current = true;
    setSaving(true);
    try {
      const updated = await updateTeacherClassroom(classroom.id, {
        name: trimmedName,
        academic_year: academicYear,
        description: description.trim() || null,
        cover_image_path: coverUrl || null,
      });
      setClassroom(updated);
      setEditing(false);
      setNotice("Đã lưu thông tin lớp học.");
    } catch (cause) {
      if (cause instanceof ApiError && Object.keys(cause.errors).length) {
        const errors = Object.fromEntries(Object.entries(cause.errors).map(([key, messages]) => [key, messages[0]]));
        setFieldErrors(errors);
        if (Object.keys(errors).some((key) => !["name", "academic_year", "description", "cover_image_path"].includes(key))) setActionError(Object.values(errors)[0]);
      } else {
        setActionError(cause instanceof Error ? cause.message : "Không thể lưu lớp học. Vui lòng thử lại.");
      }
    } finally {
      actionLock.current = false;
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!classroom || actionLock.current || classroom.status === "archived") return;
    actionLock.current = true;
    setSaving(true);
    setActionError("");
    try {
      setClassroom(await archiveTeacherClassroom(classroom.id));
      setConfirmArchive(false);
      setNotice("Đã lưu trữ lớp học. Lịch sử lớp vẫn được giữ lại.");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Không thể lưu trữ lớp học. Vui lòng thử lại.");
    } finally {
      actionLock.current = false;
      setSaving(false);
    }
  };

  return <div className="space-y-6">
    <Link to="/teacher/classes" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-secondary hover:text-emerald focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">
      <ArrowLeft className="size-4" aria-hidden="true" /> Danh sách lớp học
    </Link>

    {loading && <p role="status" className="rounded-2xl border border-line bg-white p-5 text-sm text-secondary">Đang tải thông tin lớp học…</p>}
    {error && !loading && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
      <p>{error}</p>
      {classId && <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-3 min-h-11 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">Thử lại</button>}
    </div>}

    {!loading && !error && classroom && <>
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-600 to-ink bg-cover bg-center p-6 text-white shadow-card sm:p-8" style={classroom.coverImage ? { backgroundImage: `linear-gradient(#10202db3, #10202dcc), url(${classroom.coverImage})` } : undefined}>
        <div className="relative space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">Năm học {classroom.academicYear}</span>
            {classroom.status === "archived" && <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold"><Archive className="size-3.5" aria-hidden="true" /> Đã lưu trữ</span>}
          </div>
          <h1 className="text-3xl font-extrabold">{classroom.name}</h1>
          <p className="max-w-2xl text-sm leading-6 text-white/80">{classroom.description || "Lớp chưa có mô tả."}</p>
        </div>
      </header>

      <section aria-label="Thông tin lớp học" className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
          <p className="text-sm font-bold text-secondary">Mã lớp</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <strong className="text-xl tracking-[0.16em] text-ink">{classroom.code}</strong>
            <button type="button" onClick={() => void copyCode()} aria-label="Sao chép mã lớp" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-bold text-emerald focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}{copied ? "Đã sao chép" : "Sao chép"}
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-secondary"><UsersRound className="size-4" aria-hidden="true" /> Học sinh đang tham gia</p>
          <p className="mt-3 text-2xl font-extrabold text-ink">{classroom.studentCount}</p>
        </div>
      </section>
      {notice && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}

      <section aria-labelledby="manage-classroom-title" className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="manage-classroom-title" className="text-lg font-extrabold text-ink">Quản lý lớp học</h2>
            <p className="mt-1 text-sm text-secondary">Cập nhật thông tin hoặc lưu trữ lớp khi không còn sử dụng.</p>
          </div>
          {classroom.status === "active" && !editing && !confirmArchive && <button type="button" onClick={beginEdit} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald px-4 text-sm font-bold text-white hover:bg-emerald/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald"><Pencil className="size-4" aria-hidden="true" />Chỉnh sửa</button>}
        </div>

        {classroom.status === "archived" && <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-secondary">Lớp đã được lưu trữ. Không thể chỉnh sửa hoặc khôi phục qua Classroom API hiện tại.</p>}

        {editing && <form onSubmit={save} className="mt-5 grid gap-4 border-t border-line pt-5" noValidate>
          <div>
            <label htmlFor="edit-class-name" className="text-sm font-bold text-ink">Tên lớp</label>
            <input id="edit-class-name" value={name} onChange={(event) => { setName(event.target.value); setFieldErrors((current) => ({ ...current, name: "" })); }} maxLength={255} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "edit-class-name-error" : undefined} className="mt-2 min-h-11 w-full rounded-xl border border-line px-4 text-sm focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20" />
            {fieldErrors.name && <p id="edit-class-name-error" role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.name}</p>}
          </div>
          <div>
            <label htmlFor="edit-class-year" className="text-sm font-bold text-ink">Năm học</label>
            <select id="edit-class-year" value={academicYear} onChange={(event) => { setAcademicYear(event.target.value); setFieldErrors((current) => ({ ...current, academic_year: "" })); }} aria-invalid={Boolean(fieldErrors.academic_year)} className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-4 text-sm focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20">
              {Array.from(new Set([academicYear, ...getAcademicYearOptions()])).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            {fieldErrors.academic_year && <p role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.academic_year}</p>}
          </div>
          <div>
            <label htmlFor="edit-class-description" className="text-sm font-bold text-ink">Mô tả</label>
            <textarea id="edit-class-description" value={description} onChange={(event) => { setDescription(event.target.value); setFieldErrors((current) => ({ ...current, description: "" })); }} rows={3} className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-sm focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20" />
            {fieldErrors.description && <p role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.description}</p>}
          </div>
          <div>
            <label htmlFor="edit-class-cover" className="text-sm font-bold text-ink">Liên kết ảnh bìa (không bắt buộc)</label>
            <input id="edit-class-cover" type="url" value={coverImage} onChange={(event) => { setCoverImage(event.target.value); setFieldErrors((current) => ({ ...current, cover_image_path: "" })); }} maxLength={255} placeholder="https://example.com/anh-bia.jpg" aria-invalid={Boolean(fieldErrors.cover_image_path)} className="mt-2 min-h-11 w-full rounded-xl border border-line px-4 text-sm focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20" />
            {fieldErrors.cover_image_path && <p role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.cover_image_path}</p>}
          </div>
          {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-emerald px-5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald disabled:opacity-60">{saving ? "Đang lưu…" : "Lưu thay đổi"}</button>
            <button type="button" disabled={saving} onClick={() => { setEditing(false); setActionError(""); }} className="min-h-11 rounded-xl border border-line px-5 text-sm font-bold text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald disabled:opacity-60">Hủy</button>
          </div>
        </form>}

        {classroom.status === "active" && !editing && <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm font-bold text-ink">Lưu trữ lớp</p>
          <p className="mt-1 text-sm leading-6 text-secondary">Học sinh đang tham gia sẽ rời lớp, yêu cầu chờ duyệt sẽ bị từ chối. Lịch sử lớp và thành viên vẫn được giữ lại. Hiện chưa thể khôi phục lớp.</p>
          {!confirmArchive ? <button type="button" onClick={() => { setConfirmArchive(true); setActionError(""); setNotice(""); }} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 px-4 text-sm font-bold text-amber-800 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700"><Archive className="size-4" aria-hidden="true" />Lưu trữ lớp</button>
            : <div role="group" aria-label="Xác nhận lưu trữ lớp" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="font-bold text-amber-900">Xác nhận lưu trữ {classroom.name}?</p>
              <p className="mt-1 text-sm text-amber-800">Thao tác này không thể hoàn tác trên giao diện hiện tại.</p>
              {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" disabled={saving} onClick={() => void archive()} className="min-h-11 rounded-xl bg-amber-700 px-4 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60">{saving ? "Đang lưu trữ…" : "Xác nhận lưu trữ"}</button>
                <button type="button" disabled={saving} onClick={() => { setConfirmArchive(false); setActionError(""); }} className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-bold text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700 disabled:opacity-60">Hủy</button>
              </div>
            </div>}
        </div>}
      </section>
      <TeacherRosterReadSection key={classroom.id} classroomId={classroom.id} archived={classroom.status === "archived"} />
    </>}
  </div>;
}
