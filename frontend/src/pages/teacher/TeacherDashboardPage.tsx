import { useEffect, useState } from "react";
import { BookOpenText, Clock3, ListPlus, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { VerificationBanner } from "../../components/teacher/VerificationBanner";
import { useTeacherData } from "../../contexts/TeacherDataContext";
import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";
import { useAuth } from "../../contexts/AuthContext";
import { listTeacherClassrooms, type TeacherClassroom } from "../../service/api/classrooms";

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : "Chưa có thời gian hợp lệ";
}

function deadlineLabel(value: string | undefined, now: number) {
  if (!value) return "Không có hạn";

  const deadline = new Date(value);
  if (!Number.isFinite(deadline.getTime())) return "Hạn chưa rõ";

  const remaining = deadline.getTime() - now;
  if (remaining <= 0) return "Đã hết hạn";
  if (remaining < 3600000)
    return `Còn ${Math.max(1, Math.ceil(remaining / 60000))} phút`;
  if (remaining < 6 * 3600000)
    return `Còn ${Math.ceil(remaining / 3600000)} giờ`;
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sameDay = (day: Date) =>
    deadline.getFullYear() === day.getFullYear() &&
    deadline.getMonth() === day.getMonth() &&
    deadline.getDate() === day.getDate();
  const time = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(deadline);
  if (sameDay(today)) return `Hôm nay ${time}`;
  if (sameDay(tomorrow)) return `Ngày mai ${time}`;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(deadline);
}

export default function TeacherDashboardPage() {
  const { classrooms, getRosterEntries } = useTeacherData();
  const { assignments, submissions, submissionStorageStatus } =
    useTeacherAssignments();
  const { session } = useAuth();
  const isVerified = session?.teacherVerificationStatus === "verified";
  const [now, setNow] = useState(() => Date.now());
  const [apiClassrooms, setApiClassrooms] = useState<TeacherClassroom[]>([]);
  const [classroomsLoading, setClassroomsLoading] = useState(true);
  const [classroomsError, setClassroomsError] = useState("");

  useEffect(() => {
    if (!isVerified) return;
    let active = true;
    setClassroomsLoading(true);
    setClassroomsError("");
    void listTeacherClassrooms()
      .then((items) => { if (active) setApiClassrooms(items.filter((item) => item.status === "active")); })
      .catch((cause) => { if (active) setClassroomsError(cause instanceof Error ? cause.message : "Không thể tải danh sách lớp."); })
      .finally(() => { if (active) setClassroomsLoading(false); });
    return () => { active = false; };
  }, [isVerified]);
  const activeClassrooms = isVerified
    ? classrooms.filter((item) => item.status !== "archived")
    : [];
  const activeClassIds = new Set(activeClassrooms.map((item) => item.id));
  const publishedAssignments = assignments.filter(
    (item) =>
      item.status === "published" && activeClassIds.has(item.classroomId),
  );
  const activeSubmissions = submissions.filter((item) =>
    publishedAssignments.some(
      (assignment) =>
        assignment.id === item.assignmentId &&
        assignment.classroomId === item.classroomId,
    ),
  );
  const hasUpcomingDeadline = publishedAssignments.some(
    (item) => Date.parse(item.dueAt ?? "") > now,
  );
  const submissionsToday = activeSubmissions.filter((item) => {
    const submittedAt = Date.parse(item.submittedAt);
    return submittedAt <= now && submittedAt > now - 86400000;
  });
  const hasTrackedTime = hasUpcomingDeadline || submissionsToday.length > 0;

  useEffect(() => {
    if (!hasTrackedTime) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasTrackedTime]);

  const assignmentRows = publishedAssignments.map((assignment) => {
    const studentIds = new Set(
      getRosterEntries(assignment.classroomId).flatMap((entry) =>
        entry.status === "joined" && entry.linkedUserId
          ? [entry.linkedUserId]
          : [],
      ),
    );
    const submittedIds = new Set(
      activeSubmissions
        .filter(
          (item) =>
            item.assignmentId === assignment.id &&
            item.classroomId === assignment.classroomId,
        )
        .map((item) => item.studentId),
    );
    const submittedCount = [...studentIds].filter((id) =>
      submittedIds.has(id),
    ).length;
    const totalCount = studentIds.size;
    const missingCount = totalCount - submittedCount;
    const deadline = Date.parse(assignment.dueAt ?? "");
    return { assignment, deadline, missingCount, submittedCount, totalCount };
  });
  const attentionRows = assignmentRows
    .filter((row) => {
      if (row.missingCount <= 0) return false;
      if (!Number.isFinite(row.deadline)) return false;

      const timeUntilDeadline = row.deadline - now;

      const threeDays = 3 * 24 * 60 * 60 * 1000;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      return timeUntilDeadline <= threeDays && timeUntilDeadline >= -sevenDays;
    })
    .sort((a, b) => a.deadline - b.deadline);
  const openAssignmentRows = assignmentRows
    .filter((row) => !Number.isFinite(row.deadline) || row.deadline > now)
    .sort(
      (a, b) =>
        (Number.isFinite(a.deadline) ? a.deadline : Infinity) -
          (Number.isFinite(b.deadline) ? b.deadline : Infinity) ||
        a.assignment.title.localeCompare(b.assignment.title, "vi"),
    );
  const submissionGroups = publishedAssignments
    .map((assignment) => {
      const entries = activeSubmissions.filter(
        (item) => item.assignmentId === assignment.id,
      );
      const scores = entries
        .map((item) => item.score)
        .filter((score) => Number.isFinite(score) && score >= 0 && score <= 10);
      const averageLabel = scores.length
        ? new Intl.NumberFormat("vi-VN", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(
            scores.reduce((sum, score) => sum + score, 0) / scores.length,
          )
        : null;
      const latestAt = entries.reduce(
        (latest, entry) =>
          Math.max(
            latest,
            Number.isFinite(Date.parse(entry.submittedAt))
              ? Date.parse(entry.submittedAt)
              : -Infinity,
          ),
        -Infinity,
      );
      const recentCount = entries.filter(
        (entry) =>
          Date.parse(entry.submittedAt) <= now &&
          Date.parse(entry.submittedAt) > now - 86400000,
      ).length;
      return {
        assignment,
        count: entries.length,
        averageLabel,
        latestAt,
        recentCount,
      };
    })
    .filter((group) => group.count > 0)
    .sort(
      (a, b) =>
        b.latestAt - a.latestAt ||
        a.assignment.title.localeCompare(b.assignment.title, "vi"),
    );
  const upcomingCount = attentionRows.filter(
    (row) => row.deadline > now,
  ).length;
  const overdueCount = attentionRows.length - upcomingCount;
  const workCards = [
    ...(attentionRows.length
      ? [
          {
            title: "bài tập cần chú ý",
            count: attentionRows.length,
            icon: Clock3,
            description:
              upcomingCount > 0 && overdueCount > 0
                ? `${upcomingCount} bài sắp đến hạn · ${overdueCount} bài đã hết hạn. Vẫn còn học sinh chưa nộp.`
                : upcomingCount > 0
                  ? `${upcomingCount} bài sắp đến hạn trong 3 ngày, vẫn còn học sinh chưa nộp.`
                  : `${overdueCount} bài đã hết hạn, vẫn còn học sinh chưa nộp.`,
            action: "Xem các bài →",
            to:
              upcomingCount > 0 && overdueCount > 0
                ? "/teacher/assignments?status=all"
                : overdueCount > 0
                  ? "/teacher/assignments?status=expired"
                  : "/teacher/assignments?status=open",
            tone: "border-amber-200 bg-amber-50 text-amber-900",
          },
        ]
      : []),
  ];

  return (
    <div className="min-w-0 space-y-7 [overflow-wrap:anywhere]">
      <VerificationBanner />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">
            Tổng quan giảng dạy
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Theo dõi hạn nộp và bài làm trong các lớp đang dạy.
          </p>
        </div>
      </header>
      {!isVerified ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-secondary">
          Hoàn thành xác minh tài khoản để xem công việc và quản lý lớp học.
        </p>
      ) : (
        <>
          <section aria-labelledby="dashboard-work-title" className="space-y-3">
            <h2
              id="dashboard-work-title"
              className="text-xl font-extrabold text-ink"
            >
              Việc cần làm
            </h2>
            {workCards.length === 0 ? (
              <p className="rounded-2xl bg-white p-5 text-sm text-secondary shadow-card">
                Hiện không có bài tập cần chú ý.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {workCards.map((card) => (
                  <article
                    key={card.title}
                    className="flex min-w-0 flex-col rounded-2xl bg-white p-5 shadow-card"
                  >
                    <div
                      className={`mb-3 grid size-11 place-items-center rounded-xl border ${card.tone}`}
                    >
                      <card.icon aria-hidden="true" className="size-5" />
                    </div>
                    <h3 className="text-lg font-bold text-ink">
                      <span className="text-3xl font-extrabold">
                        {card.count}
                      </span>{" "}
                      {card.title}
                    </h3>
                    <p className="mb-4 mt-2 text-sm leading-6 text-secondary">
                      {card.description}
                    </p>
                    <Link
                      to={card.to}
                      className="mt-auto inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-bold text-ink hover:bg-canvas"
                    >
                      {card.action}
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              <section
                aria-labelledby="dashboard-open-title"
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2
                    id="dashboard-open-title"
                    className="text-xl font-extrabold text-ink"
                  >
                    Bài tập đang mở
                  </h2>
                  <Link
                    to="/teacher/assignments?status=all"
                    className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-800"
                  >
                    Xem tất cả ({openAssignmentRows.length}) →
                  </Link>
                </div>
                {openAssignmentRows.length === 0 ? (
                  <p className="rounded-2xl bg-white p-4 text-sm text-secondary shadow-card">
                    Chưa có bài tập đang mở trong các lớp của bạn.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-2xl bg-white shadow-card">
                    {openAssignmentRows
                      .slice(0, 5)
                      .map(
                        ({
                          assignment,
                          deadline,
                          submittedCount,
                          totalCount,
                        }) => {
                          const classroomName =
                            activeClassrooms.find(
                              (item) => item.id === assignment.classroomId,
                            )?.name ?? "Lớp chưa có tên";
                          const dueLabel = deadlineLabel(assignment.dueAt, now);
                          const nearDeadline =
                            Number.isFinite(deadline) &&
                            deadline <= now + 3 * 86400000;
                          const completeDate = assignment.dueAt
                            ? formatDateTime(assignment.dueAt)
                            : "Không có hạn nộp";
                          const submissionLabel =
                            totalCount === 0
                              ? "Chưa có học sinh kết nối tài khoản"
                              : `${submittedCount}/${totalCount} học sinh đã nộp`;
                          return (
                            <Link
                              key={assignment.id}
                              to={`/teacher/assignments/${assignment.id}`}
                              aria-label={`${assignment.title} · ${classroomName} · ${dueLabel} · ${submissionLabel}`}
                              title={`${assignment.title} · ${classroomName} · ${completeDate} · ${submissionLabel}`}
                              className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-line px-3 py-3 last:border-b-0 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 sm:grid-cols-[minmax(0,1fr)_8.5rem_8rem] sm:gap-4 sm:py-2 sm:px-4"
                            >
                              <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                                <span
                                  title={classroomName}
                                  className="max-w-14 shrink-0 truncate text-[13px] text-secondary sm:order-2 sm:max-w-24"
                                >
                                  {classroomName}
                                </span>
                                <h3 className="min-w-0 truncate text-sm font-bold text-ink sm:flex-1">
                                  {assignment.title}
                                </h3>
                              </div>
                              <span
                                title={completeDate}
                                className={`min-w-0 truncate rounded-lg px-2 py-1 text-left text-[13px] font-semibold sm:text-center ${nearDeadline ? "bg-amber-50 text-amber-900" : "text-secondary"}`}
                              >
                                <span className="sm:hidden">
                                  Hạn:{" "}
                                  {dueLabel
                                    .replace(/^Còn /, "")
                                    .replace(/^Hôm nay /, "Nay ")
                                    .replace(/^Ngày mai /, "Mai ")
                                    .replace("Không có hạn", "Không hạn")}
                                </span>
                                <span className="hidden sm:inline">
                                  Hạn: {dueLabel}
                                </span>
                              </span>
                              <div
                                title={
                                  totalCount === 0
                                    ? "Chưa có học sinh tham gia lớp và kết nối tài khoản"
                                    : "Chỉ tính học sinh đã tham gia lớp và kết nối tài khoản"
                                }
                                className="flex min-w-0 items-center justify-end gap-2 whitespace-nowrap"
                              >
                                {totalCount === 0 ? (
                                  <span className="text-right text-[13px] text-secondary">
                                    <span className="sm:hidden">
                                      Chưa có HS
                                    </span>
                                    <span className="hidden sm:inline">
                                      Chưa có HS kết nối
                                    </span>
                                  </span>
                                ) : (
                                  <>
                                    <progress
                                      aria-label={`Tiến độ nộp ${assignment.title}`}
                                      value={submittedCount}
                                      max={totalCount}
                                      className="hidden h-1.5 w-10 shrink-0 accent-emerald sm:block"
                                    />

                                    <span className="min-w-0 text-right text-[13px] text-secondary">
                                      <span className="sm:hidden">
                                        Đã nộp:{" "}
                                      </span>

                                      <span className="font-semibold text-ink sm:block">
                                        {submittedCount}/{totalCount}
                                      </span>

                                      <span className="hidden sm:block">
                                        HS đã nộp
                                      </span>
                                    </span>
                                  </>
                                )}
                              </div>
                            </Link>
                          );
                        },
                      )}
                  </div>
                )}
              </section>
              <section
                aria-labelledby="dashboard-submissions-title"
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2
                    id="dashboard-submissions-title"
                    className="text-xl font-extrabold text-ink"
                  >
                    Bài nộp gần đây
                  </h2>
                  <Link
                    to="/teacher/assignments?status=all"
                    className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-800"
                  >
                    Xem tất cả ({submissionGroups.length}) →
                  </Link>
                </div>
                {submissionStorageStatus !== "saved" && (
                  <p role="status" className="text-sm text-red-600">
                    {submissionStorageStatus === "error"
                      ? "Bài nộp chưa lưu được trên trình duyệt. Mở bài để kiểm tra và thử lưu lại."
                      : "Đang lưu bài nộp…"}
                  </p>
                )}
                {submissionGroups.length === 0 ? (
                  <p className="rounded-2xl bg-white p-4 text-sm text-secondary shadow-card">
                    Chưa có bài nộp trong các lớp đang dạy.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-2xl bg-white shadow-card">
                    {submissionGroups
                      .slice(0, 3)
                      .map(
                        ({
                          assignment,
                          count,
                          averageLabel,
                          latestAt,
                          recentCount,
                        }) => {
                          const classroomName =
                            activeClassrooms.find(
                              (item) => item.id === assignment.classroomId,
                            )?.name ?? "Lớp chưa có tên";
                          const scoreDescription =
                            averageLabel === null
                              ? "Chưa có điểm của bài đã nộp"
                              : `Điểm trung bình của các bài nộp có điểm hợp lệ: ${averageLabel}/10`;
                          return (
                            <Link
                              key={assignment.id}
                              to={`/teacher/assignments/${assignment.id}`}
                              aria-label={`${assignment.title} · ${classroomName} · ${count} bài nộp · ${scoreDescription}`}
                              title={`${assignment.title} · ${classroomName} · Nộp gần nhất: ${Number.isFinite(latestAt) ? formatDateTime(new Date(latestAt).toISOString()) : "Chưa rõ thời gian"}`}
                              className="flex min-h-16 items-center justify-between gap-3 border-b border-line px-3 py-3 last:border-b-0 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 sm:px-4"
                            >
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-bold text-ink">
                                  {assignment.title}
                                </h3>
                                <div className="mt-1 space-y-0.5 text-[13px] text-secondary">
                                  <p className="truncate">
                                    {classroomName} · {count} bài nộp
                                  </p>

                                  <p className="truncate">
                                    {recentCount > 0
                                      ? `${recentCount} bài nộp trong 24 giờ qua`
                                      : Number.isFinite(latestAt)
                                        ? `Nộp gần nhất: ${new Intl.DateTimeFormat(
                                            "vi-VN",
                                            {
                                              day: "2-digit",
                                              month: "2-digit",
                                              year: "numeric",
                                            },
                                          ).format(new Date(latestAt))}`
                                        : "Chưa rõ thời gian nộp"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                                <span className="text-sm font-bold text-ink">
                                  {averageLabel === null
                                    ? "—"
                                    : `${averageLabel}/10`}
                                </span>

                                <span className="text-xs text-secondary">
                                  {averageLabel === null
                                    ? "Chưa có điểm"
                                    : "Điểm TB"}
                                </span>
                              </div>
                            </Link>
                          );
                        },
                      )}
                  </div>
                )}
                {submissionGroups.length > 0 && ""}
              </section>
            </div>
            <div className="min-w-0 space-y-6">
              <section
                aria-labelledby="dashboard-classes-title"
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2
                    id="dashboard-classes-title"
                    className="text-xl font-extrabold text-ink"
                  >
                    Lớp của tôi
                  </h2>
                  <Link
                    to="/teacher/classes"
                    className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-800"
                  >
                    Xem tất cả{!classroomsLoading && !classroomsError ? ` (${apiClassrooms.length})` : ""} →
                  </Link>
                </div>
                {classroomsLoading ? (
                  <p role="status" className="rounded-2xl bg-white p-4 text-sm text-secondary shadow-card">Đang tải lớp học…</p>
                ) : classroomsError ? (
                  <p role="alert" className="rounded-2xl bg-white p-4 text-sm text-red-700 shadow-card">{classroomsError} <Link to="/teacher/classes" className="font-bold underline">Mở danh sách lớp</Link></p>
                ) : apiClassrooms.length === 0 ? (
                  <p className="rounded-2xl bg-white p-4 text-sm text-secondary shadow-card">
                    Chưa có lớp đang hoạt động.{" "}
                    <Link
                      to="/teacher/classes/new"
                      className="inline-flex min-h-11 items-center font-bold text-emerald-800"
                    >
                      Tạo lớp mới →
                    </Link>
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-2xl bg-white shadow-card">
                    {apiClassrooms.slice(0, 6).map((classroom) => (
                        <article
                          key={classroom.id}
                          className="flex min-w-0 items-center gap-2 border-b border-line px-3 py-2 last:border-b-0 sm:px-4"
                        >
                          <Link
                            to={`/teacher/classes/${classroom.id}`}
                            aria-label={`Mở lớp ${classroom.name}`}
                            title={classroom.name}
                            className="min-w-0 flex-1 rounded-lg py-2 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                          >
                            <h3 className="truncate text-sm font-bold text-ink">
                              {classroom.name}
                            </h3>
                            <p className="mt-1 truncate text-[13px] text-secondary">
                              {classroom.studentCount} học sinh · Năm học {classroom.academicYear}
                            </p>
                          </Link>
                        </article>
                    ))}
                  </div>
                )}
              </section>
              <section
                aria-labelledby="dashboard-shortcuts-title"
                className="space-y-3"
              >
                <h2
                  id="dashboard-shortcuts-title"
                  className="text-xl font-extrabold text-ink"
                >
                  Thao tác nhanh
                </h2>
                <div className="grid grid-cols-1 gap-2 rounded-2xl bg-white p-3 shadow-card min-[1500px]:grid-cols-2">
                  <Link
                    to="/teacher/assignments/new"
                    className="flex min-h-11 items-center gap-3 rounded-xl bg-emerald px-3 py-2 text-sm font-bold text-white"
                  >
                    <Plus aria-hidden="true" className="size-4 shrink-0" />
                    Tạo bài tập
                  </Link>
                  <Link
                    to="/teacher/lessons"
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-ink hover:bg-canvas"
                  >
                    <BookOpenText
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                    Soạn bài học
                  </Link>
                  <Link
                    to="/teacher/questions/new"
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-ink hover:bg-canvas min-[1500px]:col-span-2"
                  >
                    <ListPlus aria-hidden="true" className="size-4 shrink-0" />
                    Thêm câu hỏi
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
