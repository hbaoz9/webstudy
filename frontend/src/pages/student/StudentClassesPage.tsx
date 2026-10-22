import { useState } from "react";
import { Link } from "react-router-dom";

import { Archive, Plus, School, Users } from "lucide-react";

import {
  useStudentClassMemberships,
  type StudentClassStatus,
} from "../../hooks/useStudentClassMemberships";

type ClassFilter = "all" | "joined" | "processing" | "rejected";

const statusMeta: Record<
  StudentClassStatus,
  {
    label: string;
    className: string;
    description: string;
  }
> = {
  joined: {
    label: "Đã tham gia",
    className: "bg-emerald/10 text-emerald",
    description: "Bạn đã là thành viên của lớp học.",
  },

  pending: {
    label: "Chờ giáo viên duyệt",
    className: "bg-amber-50 text-amber-700",
    description: "Yêu cầu đang chờ giáo viên xử lý.",
  },

  rejected: {
    label: "Bị từ chối",
    className: "bg-rose-50 text-rose-700",
    description: "Yêu cầu chưa được chấp nhận.",
  },

  needs_link: {
    label: "Cần kiểm tra",
    className: "bg-sky-50 text-sky-700",
    description:
      "Giáo viên đã duyệt nhưng tài khoản chưa liên kết với danh sách lớp. Vui lòng liên hệ giáo viên.",
  },
};

export default function StudentClassesPage() {
  const { memberships, hasStudentProfile } = useStudentClassMemberships();

  const [activeFilter, setActiveFilter] = useState<ClassFilter>("all");

  const joinedCount = memberships.filter(
    (item) => item.status === "joined",
  ).length;

  const processingCount = memberships.filter(
    (item) => item.status === "pending" || item.status === "needs_link",
  ).length;

  const rejectedCount = memberships.filter(
    (item) => item.status === "rejected",
  ).length;

  const filters: {
    value: ClassFilter;
    label: string;
    count: number;
  }[] = [
    {
      value: "all",
      label: "Tất cả",
      count: memberships.length,
    },
    {
      value: "joined",
      label: "Đã tham gia",
      count: joinedCount,
    },
    {
      value: "processing",
      label: "Đang xử lý",
      count: processingCount,
    },
    {
      value: "rejected",
      label: "Bị từ chối",
      count: rejectedCount,
    },
  ];

  const filteredClasses = memberships.filter((item) => {
    if (activeFilter === "all") return true;

    if (activeFilter === "processing") {
      return item.status === "pending" || item.status === "needs_link";
    }

    return item.status === activeFilter;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      {/* Tiêu đề */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Lớp học của tôi</h1>

          <p className="mt-2 text-sm text-secondary">
            Quản lý các lớp học và theo dõi yêu cầu tham gia.
          </p>
        </div>

        <Link
          to="/student/join-class"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
        >
          <Plus className="size-4" />
          Tham gia lớp mới
        </Link>
      </header>

      {/* Thống kê */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Đã tham gia", count: joinedCount },
          { label: "Đang xử lý", count: processingCount },
          { label: "Bị từ chối", count: rejectedCount },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-line bg-white p-5 shadow-card"
          >
            <p className="text-sm text-secondary">{item.label}</p>

            <p className="mt-3 text-3xl font-extrabold text-ink">
              {item.count}
            </p>
          </article>
        ))}
      </section>

      {/* Bộ lọc */}
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={activeFilter === filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeFilter === filter.value
                ? "bg-emerald text-white"
                : "border border-line bg-white text-secondary hover:bg-canvas"
            }`}
          >
            {filter.label} ({filter.count})
          </button>
        ))}
      </div>

      {/* Danh sách lớp */}
      {filteredClasses.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
          <School className="mx-auto size-10 text-muted" />

          <h2 className="mt-4 text-lg font-extrabold text-ink">
            {!hasStudentProfile
              ? "Bạn chưa có hồ sơ học sinh"
              : activeFilter === "all"
                ? "Bạn chưa tham gia lớp học nào"
                : "Không có lớp ở trạng thái này"}
          </h2>

          <p className="mt-2 text-sm text-secondary">
            {!hasStudentProfile
              ? "Hãy tạo hồ sơ và gửi yêu cầu tham gia lớp học."
              : "Danh sách sẽ được cập nhật khi có thay đổi."}
          </p>

          <Link
            to="/student/join-class"
            className="mt-5 inline-flex rounded-xl bg-emerald px-5 py-3 text-sm font-bold text-white"
          >
            Tham gia lớp học
          </Link>
        </section>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredClasses.map(({ classroom, request, status }) => {
            const meta = statusMeta[status];
            const isArchived = classroom.status === "archived";

            return (
              <article
                key={classroom.id}
                className="overflow-hidden rounded-2xl border border-line bg-white shadow-card"
              >
                {/* Ảnh bìa lớp */}
                <div
                  className="relative h-36 bg-gradient-to-br from-slate-600 to-ink bg-cover bg-center"
                  style={
                    classroom.coverImage
                      ? {
                          backgroundImage: `url(${classroom.coverImage})`,
                        }
                      : undefined
                  }
                >
                  {isArchived && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-secondary">
                      <Archive className="size-3.5" />
                      Đã lưu trữ
                    </span>
                  )}
                </div>

                {/* Nội dung card */}
                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="text-lg font-extrabold text-ink">
                      {classroom.name}
                    </h3>

                    {classroom.academicYear && (
                      <p className="mt-1 text-xs text-secondary">
                        Năm học {classroom.academicYear}
                      </p>
                    )}
                  </div>

                  <span
                    className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${meta.className}`}
                  >
                    {meta.label}
                  </span>

                  <p className="text-sm text-secondary">{meta.description}</p>

                  <div className="flex items-center gap-2 text-sm text-secondary">
                    <Users className="size-4" />
                    {classroom.studentCount} học sinh
                  </div>

                  {status !== "joined" && (
                    <div className="border-t border-line pt-3 text-xs text-secondary">
                      <p>Mã học sinh: {request.studentCode}</p>
                      <p className="mt-1">Gửi yêu cầu: {request.requestedAt}</p>
                    </div>
                  )}

                  {classroom.description && (
                    <p className="text-sm text-secondary">
                      {classroom.description}
                    </p>
                  )}

                  {status === "joined" && (
                    <Link
                      to={`/student/classes/${classroom.id}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald px-5 text-sm font-bold text-white transition hover:opacity-90"
                    >
                      Xem lớp học
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
