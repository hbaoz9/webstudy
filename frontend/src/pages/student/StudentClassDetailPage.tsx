import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { getStudentClassroom, type ClassroomPreview } from "../../service/api/joinRequests";

export default function StudentClassDetailPage() {
  const { classId } = useParams();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ id: string; classroom?: ClassroomPreview; error?: string } | null>(null);
  const current = result?.id === classId ? result : null;

  useEffect(() => {
    if (!classId) return;
    let active = true;
    void getStudentClassroom(classId)
      .then((classroom) => { if (active) setResult({ id: classId, classroom }); })
      .catch((cause) => { if (active) setResult({ id: classId, error: cause instanceof Error ? cause.message : "Không thể tải lớp học." }); });
    return () => { active = false; };
  }, [classId, revision]);

  return <div className="mx-auto max-w-6xl space-y-7">
    <Link to="/student/classes" className="inline-flex items-center gap-2 text-sm font-bold text-emerald hover:underline">
      <ArrowLeft className="size-4" /> Lớp học của tôi
    </Link>
    {!current && <p role="status" className="text-sm text-secondary">Đang tải lớp học…</p>}
    {current?.error && <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      {current.error} <button type="button" onClick={() => { setResult(null); setRevision((value) => value + 1); }} className="ml-2 font-bold underline">Thử lại</button>
    </section>}
    {current?.classroom && <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="h-48 bg-gradient-to-br from-slate-600 to-ink bg-cover bg-center sm:h-56" style={current.classroom.coverImage ? { backgroundImage: `url(${current.classroom.coverImage})` } : undefined} />
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald">Lớp học</p>
            <h1 className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">{current.classroom.name}</h1>
            {current.classroom.description && <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">{current.classroom.description}</p>}
          </div>
          {current.classroom.status === "archived" && <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-secondary">Lớp đã lưu trữ</span>}
        </div>
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-secondary"><CalendarDays className="size-4" /> Năm học {current.classroom.academicYear}</p>
      </div>
    </section>}
  </div>;
}
