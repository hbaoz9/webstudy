import { Link, useParams } from "react-router-dom";

import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ClipboardList,
  PlayCircle,
  School,
  Users,
} from "lucide-react";

import { useStudentAccount } from "../../contexts/StudentAccountContext";
import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";
import { useTeacherData } from "../../contexts/TeacherDataContext";

import { useStudentClassMemberships } from "../../hooks/useStudentClassMemberships";

import { geo10Lessons } from "../../data/geo10Curriculum";
import { getAssignmentResultVisibility } from "../../utils/assignmentQuestion";
import { loadTeacherVideos, videoClassIds } from "../../utils/teacherVideoStorage";

export default function StudentClassDetailPage() {
  const { classId } = useParams();

  const { student, hasStudentProfile } = useStudentAccount();

  const { classrooms } = useTeacherData();

  const { memberships } = useStudentClassMemberships();

  const { assignments, submissions } = useTeacherAssignments();

  const classroom = classrooms.find((item) => item.id === classId);

  const membership = memberships.find((item) => item.classroom.id === classId);

  if (!classroom) {
    return (
      <div className="mx-auto max-w-4xl">
        <section className="rounded-2xl border border-line bg-white p-8 text-center shadow-card">
          <School className="mx-auto size-10 text-muted" />

          <h1 className="mt-4 text-xl font-extrabold text-ink">
            Không tìm thấy lớp học
          </h1>

          <p className="mt-2 text-sm text-secondary">
            Lớp học không tồn tại hoặc đã bị xóa.
          </p>

          <Link
            to="/student/classes"
            className="mt-5 inline-flex rounded-xl bg-emerald px-5 py-3 text-sm font-bold text-white"
          >
            Quay về Lớp học của tôi
          </Link>
        </section>
      </div>
    );
  }

  if (!hasStudentProfile) {
    return (
      <div className="mx-auto max-w-4xl">
        <section className="rounded-2xl border border-line bg-white p-8 text-center shadow-card">
          <h1 className="text-xl font-extrabold text-ink">
            Chưa có hồ sơ học sinh
          </h1>

          <p className="mt-2 text-sm text-secondary">
            Bạn cần có hồ sơ học sinh trước khi truy cập lớp học.
          </p>

          <Link
            to="/student/join-class"
            className="mt-5 inline-flex rounded-xl bg-emerald px-5 py-3 text-sm font-bold text-white"
          >
            Tham gia lớp học
          </Link>
        </section>
      </div>
    );
  }

  if (!membership || membership.status !== "joined") {
    const message =
      membership?.status === "pending"
        ? "Yêu cầu tham gia lớp của bạn vẫn đang chờ giáo viên duyệt."
        : membership?.status === "needs_link"
          ? "Giáo viên đã duyệt yêu cầu nhưng tài khoản của bạn chưa được liên kết với danh sách lớp."
          : membership?.status === "rejected"
            ? "Yêu cầu tham gia lớp của bạn đã bị từ chối."
            : "Bạn chưa phải thành viên của lớp học này.";

    return (
      <div className="mx-auto max-w-4xl">
        <section className="rounded-2xl border border-line bg-white p-8 text-center shadow-card">
          <School className="mx-auto size-10 text-muted" />

          <h1 className="mt-4 text-xl font-extrabold text-ink">
            Chưa thể truy cập lớp học
          </h1>

          <p className="mx-auto mt-2 max-w-lg text-sm text-secondary">
            {message}
          </p>

          <Link
            to="/student/classes"
            className="mt-5 inline-flex rounded-xl bg-emerald px-5 py-3 text-sm font-bold text-white"
          >
            Quay về Lớp học của tôi
          </Link>
        </section>
      </div>
    );
  }

  const classAssignments = assignments.filter(
    (assignment) =>
      assignment.classroomId === classroom.id &&
      assignment.status === "published",
  );

  const videos = loadTeacherVideos();

  const classVideos = videos.filter(
    (video) =>
      video.status === "published" && videoClassIds(video).includes(classroom.id),
  );

  const studentSubmissions = submissions.filter(
    (submission) =>
      submission.studentId === student.id &&
      submission.classroomId === classroom.id,
  );

  const completedAssignmentCount = classAssignments.filter((assignment) =>
    studentSubmissions.some(
      (submission) => submission.assignmentId === assignment.id,
    ),
  ).length;

  const isArchived = classroom.status === "archived";

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <Link
        to="/student/classes"
        className="inline-flex items-center gap-2 text-sm font-bold text-emerald hover:underline"
      >
        <ArrowLeft className="size-4" />
        Lớp học của tôi
      </Link>

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div
          className="h-48 bg-gradient-to-br from-slate-600 to-ink bg-cover bg-center sm:h-56"
          style={
            classroom.coverImage
              ? {
                  backgroundImage: `url(${classroom.coverImage})`,
                }
              : undefined
          }
        />

        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald">
                Lớp học
              </p>

              <h1 className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">
                {classroom.name}
              </h1>

              {classroom.description && (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
                  {classroom.description}
                </p>
              )}
            </div>

            {isArchived && (
              <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-secondary">
                Lớp đã lưu trữ
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm text-secondary">
            <span className="inline-flex items-center gap-2">
              <Users className="size-4" />
              {classroom.studentCount} học sinh
            </span>

            {classroom.academicYear && (
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4" />
                Năm học {classroom.academicYear}
              </span>
            )}

            <span className="inline-flex items-center gap-2">
              <BookOpen className="size-4" />
              Địa lí 10
            </span>
          </div>
        </div>
      </section>

      {isArchived && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Lớp học này đã được giáo viên lưu trữ. Bạn vẫn có thể xem thông tin và
          nội dung đã xuất bản, nhưng lớp không còn hoạt động như bình thường.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="text-sm text-secondary">Bài tập</p>

          <p className="mt-2 text-3xl font-extrabold text-ink">
            {classAssignments.length}
          </p>
        </article>

        <article className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="text-sm text-secondary">Đã hoàn thành</p>

          <p className="mt-2 text-3xl font-extrabold text-ink">
            {completedAssignmentCount}
          </p>
        </article>

        <article className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="text-sm text-secondary">Video tương tác</p>

          <p className="mt-2 text-3xl font-extrabold text-ink">
            {classVideos.length}
          </p>
        </article>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-ink">Bài tập</h2>

            <p className="mt-1 text-sm text-secondary">
              Các bài tập giáo viên đã xuất bản cho lớp.
            </p>
          </div>

          <Link
            to={`/student/assignments?class=${encodeURIComponent(
              classroom.id,
            )}`}
            className="text-sm font-bold text-emerald hover:underline"
          >
            Xem tất cả
          </Link>
        </div>

        {classAssignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
            <ClipboardList className="mx-auto size-9 text-muted" />

            <p className="mt-3 text-sm text-secondary">
              Lớp này chưa có bài tập nào được xuất bản.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {classAssignments.map((assignment) => {
              const submission = studentSubmissions.find(
                (item) => item.assignmentId === assignment.id,
              );

              const lesson = geo10Lessons.find(
                (item) => item.id === assignment.lessonId,
              );

              const deadline = assignment.dueAt
                ? Date.parse(assignment.dueAt)
                : null;

              const isExpired =
                deadline !== null &&
                Number.isFinite(deadline) &&
                Date.now() >= deadline;

              return (
                <article
                  key={assignment.id}
                  className="rounded-2xl border border-line bg-white p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-ink">
                        {assignment.title}
                      </h3>

                      {lesson && (
                        <p className="mt-1 text-sm font-semibold text-emerald">
                          Bài {lesson.number}. {lesson.title}
                        </p>
                      )}
                    </div>

                    {submission && (
                      <span className="shrink-0 rounded-full bg-emerald/10 px-3 py-1 text-xs font-bold text-emerald">
                        Đã nộp
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-sm text-secondary">
                    {assignment.questions.length} câu hỏi
                  </p>

                  <p className="mt-1 text-sm text-secondary">
                    Hạn nộp:{" "}
                    {assignment.dueAt
                      ? new Intl.DateTimeFormat("vi-VN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(assignment.dueAt))
                      : "Chưa đặt"}
                  </p>

                  {submission ? (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-emerald/5 p-3">
                      <span className="text-sm font-semibold text-ink">
                        {getAssignmentResultVisibility(assignment) === "hidden"
                          ? "Kết quả chưa công bố"
                          : `Điểm: ${submission.score}/10`}
                      </span>

                      <Link
                        to={`/student/assignments/${assignment.id}`}
                        className="text-sm font-bold text-emerald"
                      >
                        Xem kết quả
                      </Link>
                    </div>
                  ) : isExpired ? (
                    <p className="mt-4 text-sm font-semibold text-amber-700">
                      Đã hết hạn nộp
                    </p>
                  ) : isArchived ? (
                    <p className="mt-4 text-sm font-semibold text-secondary">
                      Lớp đã lưu trữ
                    </p>
                  ) : (
                    <Link
                      to={`/student/assignments/${assignment.id}`}
                      className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-emerald px-4 text-sm font-bold text-white"
                    >
                      Làm bài
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-ink">Video tương tác</h2>

            <p className="mt-1 text-sm text-secondary">
              Video giáo viên đã xuất bản cho lớp.
            </p>
          </div>

          <Link
            to={`/student/videos?class=${encodeURIComponent(classroom.id)}`}
            className="text-sm font-bold text-emerald hover:underline"
          >
            Xem tất cả
          </Link>
        </div>

        {classVideos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
            <PlayCircle className="mx-auto size-9 text-muted" />

            <p className="mt-3 text-sm text-secondary">
              Lớp này chưa có video nào được xuất bản.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {classVideos.map((video) => {
              const lesson = geo10Lessons.find(
                (item) => item.id === video.lessonId,
              );

              return (
                <article
                  key={video.id}
                  className="rounded-2xl border border-line bg-white p-5 shadow-card"
                >
                  <h3 className="font-extrabold text-ink">{video.title}</h3>

                  {lesson && (
                    <p className="mt-1 text-sm font-semibold text-emerald">
                      Bài {lesson.number}. {lesson.title}
                    </p>
                  )}

                  <p className="mt-3 text-sm text-secondary">
                    {video.checkpoints.length} câu hỏi tương tác
                  </p>

                  <Link
                    to={`/student/videos?class=${encodeURIComponent(
                      classroom.id,
                    )}`}
                    className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-emerald px-4 text-sm font-bold text-emerald"
                  >
                    Xem video
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
