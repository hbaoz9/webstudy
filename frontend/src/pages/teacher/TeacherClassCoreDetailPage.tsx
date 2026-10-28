import { useEffect, useState } from "react";
import { ArrowLeft, Archive, Check, Copy, UsersRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../service/api/client";
import { getTeacherClassroom, type TeacherClassroom } from "../../service/api/classrooms";

export default function TeacherClassCoreDetailPage() {
  const { classId } = useParams();
  const [classroom, setClassroom] = useState<TeacherClassroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!classId) { setError("Không tìm thấy lớp học."); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError("");
    setClassroom(null);
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
    </>}
  </div>;
}
