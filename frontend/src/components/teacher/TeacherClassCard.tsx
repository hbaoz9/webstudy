import { Link } from "react-router-dom";
import type { Classroom } from "../../types/teacher";
import { Archive } from "lucide-react";

type TeacherClassCardProps = {
  classroom: Classroom;
};

export function TeacherClassCard({ classroom }: TeacherClassCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-card transition hover:-translate-y-1 hover:shadow-lg">
      <div
        className="relative h-24 bg-gradient-to-br from-slate-600 to-ink bg-cover bg-center"
        style={
          classroom.coverImage
            ? {
                backgroundImage: `url(${classroom.coverImage})`,
              }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-ink/45" />

        {classroom.status === "archived" && (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-secondary backdrop-blur-sm">
            <Archive className="size-3.5" />
            Đã lưu trữ
          </span>
        )}

        <h3 className="absolute inset-x-4 bottom-4 text-lg font-extrabold text-white">
          {classroom.name}
        </h3>
      </div>

      <div className="p-4">
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-secondary">Sĩ số lớp:</dt>

            <dd className="font-bold text-ink">
              {classroom.studentCount} học sinh
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-secondary">Tiến độ học:</dt>
            <dd className="font-bold text-muted">Chưa theo dõi</dd>
          </div>
        </dl>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="rounded-md bg-canvas px-2.5 py-1.5 text-xs font-bold text-secondary">
            Mã: {classroom.code}
          </span>

          <Link
            to={`/teacher/classes/${classroom.id}`}
            className="rounded-full bg-emerald px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald/90"
          >
            Xem chi tiết
          </Link>
        </div>
      </div>
    </article>
  );
}
