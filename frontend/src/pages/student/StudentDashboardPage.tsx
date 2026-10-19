import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, GraduationCap, PlayCircle, Clock3, CircleCheckBig } from "lucide-react";
import { useStudentAccount } from "../../contexts/StudentAccountContext";
import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";
import { useStudentClassMemberships } from "../../hooks/useStudentClassMemberships";
import { useStudentNow } from "../../hooks/useStudentNow";
import { useLocalStorageRevision } from "../../hooks/useLocalStorageRevision";
import { getActiveStudentClassIds } from "../../utils/studentMembership";
import { getStudentAssignmentRows } from "../../utils/studentAssignments";
import { geo10Lessons } from "../../data/geo10Curriculum";
import { LESSON_CONTENT_KEY, loadLessonContents } from "../../utils/lessonContentStorage";
import { ASSIGNMENT_DRAFT_CHANGED, assignmentAnswerDraftKey, loadAssignmentAnswerDraft } from "../../utils/assignmentQuestion";

import { TEACHER_VIDEOS_KEY as VIDEOS_KEY, loadTeacherVideos as loadVideos, videoClassIds, TEACHER_VIDEOS_CHANGED } from "../../utils/teacherVideoStorage";

function formatAssignmentDeadline(dueAt?: string) {
  const date = new Date(dueAt ?? "");
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date)
    : "Chưa đặt hạn";
}

function formatTimeRemaining(milliseconds: number) {
  const hours = Math.ceil(milliseconds / 3600000);
  return hours < 24 ? `Còn ${hours} giờ` : `Còn ${Math.ceil(milliseconds / 86400000)} ngày`;
}

const localKeys = [LESSON_CONTENT_KEY, "webstudy-geo10-lesson-content-v1", VIDEOS_KEY];
const localEvents = [TEACHER_VIDEOS_CHANGED, ASSIGNMENT_DRAFT_CHANGED];

export default function StudentDashboardPage() {
  const { student, hasStudentProfile } = useStudentAccount();
  const { memberships } = useStudentClassMemberships();
  const { assignments, submissions, submissionStorageStatus } = useTeacherAssignments();
  const storageRevision = useLocalStorageRevision(localKeys, localEvents, assignmentAnswerDraftKey("", student.id));

  // Timer renders reuse these reads. Returning to the tab refreshes local data.
  const lessonContents = useMemo(loadLessonContents, [storageRevision]);
  const videos = useMemo(loadVideos, [storageRevision]);
  const drafts = useMemo(() => {
    if (!hasStudentProfile) return new Map();
    return new Map(assignments.filter((assignment) => assignment.status === "published")
      .map((assignment) => [assignment.id, loadAssignmentAnswerDraft(assignment, student.id)] as const));
  }, [assignments, student.id, hasStudentProfile, storageRevision]);
  const activeClassIds = getActiveStudentClassIds(memberships);
  const activeMemberships = memberships.filter(({ classroom }) => activeClassIds.has(classroom.id));
  const archivedMemberships = memberships.filter(({ classroom, status }) =>
    status === "joined" && classroom.status === "archived",
  );
  const pendingMemberships = memberships.filter(({ classroom, status }) =>
    classroom.status !== "archived" && (status === "pending" || status === "needs_link"),
  );
  const now = useStudentNow(assignments.filter((assignment) =>
    hasStudentProfile && assignment.status === "published" && activeClassIds.has(assignment.classroomId),
  ).map((assignment) => Date.parse(assignment.dueAt ?? "")));
  const rows = hasStudentProfile
    ? getStudentAssignmentRows(assignments, submissions, student.id, activeClassIds, drafts, now)
    : [];
  const pendingRows = rows
    .filter((row) => row.group === "todo")
    .sort((a, b) => a.deadline - b.deadline);
  const submittedCount = rows.filter((row) => row.submission).length;
  const expiredCount = rows.filter((row) => row.phase === "expired").length;
  const unavailableCount = rows.filter((row) => row.phase === "unavailable").length;

  const recentLessons = geo10Lessons
    .filter((lesson) => lessonContents[lesson.id]?.status === "published")
    .sort((a, b) => {
      const first = Date.parse(lessonContents[a.id].updatedAt);
      const second = Date.parse(lessonContents[b.id].updatedAt);
      return (Number.isFinite(second) ? second : 0) - (Number.isFinite(first) ? first : 0) || a.number - b.number;
    }).slice(0, 3);
  const visibleVideos = videos.filter((video) =>
    video.status === "published" && videoClassIds(video).some((id) => activeClassIds.has(id)),
  );

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-7 [overflow-wrap:anywhere]">
      <header className="rounded-3xl bg-ink p-6 text-white shadow-card sm:p-8">
        <p className="text-sm font-semibold text-emerald-300">WebStudy · Địa lí 10</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{hasStudentProfile ? `Chào ${student.name} 👋` : "Chào bạn 👋"}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Theo dõi việc cần làm và nội dung học tập của bạn.</p>
        {activeMemberships.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {activeMemberships.map(({ classroom }) => <Link key={classroom.id} to={`/student/classes/${classroom.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 hover:bg-white/10"><GraduationCap className="size-4 shrink-0" />{classroom.name}<ArrowRight className="size-4 shrink-0" /></Link>)}
        </div>}
      </header>

      {activeMemberships.length === 0 ? <section className="rounded-2xl border border-dashed border-line bg-white p-6">
        <h2 className="text-xl font-extrabold text-ink">{!hasStudentProfile ? "Bắt đầu học cùng lớp" : pendingMemberships.length > 0 ? "Đang chờ tham gia lớp" : archivedMemberships.length > 0 ? "Hiện không có lớp đang hoạt động" : "Bạn chưa tham gia lớp học nào"}</h2>
        <p className="mt-2 text-sm leading-6 text-secondary">{pendingMemberships.length > 0 ? "Yêu cầu của bạn đang chờ giáo viên duyệt hoặc liên kết với danh sách lớp. Xem trạng thái trong lớp học của tôi." : archivedMemberships.length > 0 ? "Lớp của bạn đã được lưu trữ. Bạn có thể xem lại thông tin trong danh sách lớp học." : "Tham gia bằng mã lớp do giáo viên cung cấp để xem bài tập và nội dung học tập."}</p>
        <Link to={pendingMemberships.length > 0 || archivedMemberships.length > 0 ? "/student/classes" : "/student/join-class"} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white">{pendingMemberships.length > 0 || archivedMemberships.length > 0 ? "Xem lớp học của tôi" : "Tham gia lớp học"}<ArrowRight className="size-4" /></Link>
      </section> : <>
        <section aria-labelledby="student-todo-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 id="student-todo-heading" className="text-xl font-extrabold text-ink">Việc cần làm</h2><p className="mt-1 text-sm text-secondary">Bài chưa nộp, ưu tiên hạn gần nhất.</p></div>
            <Link to="/student/assignments" className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-700">Xem tất cả bài tập →</Link>
          </div>
          {pendingRows.length === 0 ? <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-5"><CircleCheckBig className="size-6 shrink-0 text-emerald-700" /><div><p className="font-bold text-ink">Không có bài đang mở cần làm</p><p className="mt-1 text-sm text-secondary">{expiredCount + unavailableCount > 0 ? "Vẫn còn bài hết hạn hoặc chưa khả dụng. Xem danh sách bài tập để kiểm tra." : "Bạn chưa có bài cần nộp trong các lớp đang học."}</p></div></div> : pendingRows.slice(0, 3).map(({ assignment, deadline }) => {
            const urgent = deadline - now <= 86400000;
            const started = pendingRows.some((row) => row.assignment.id === assignment.id && row.phase === "in_progress");
            return <article key={assignment.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 gap-3"><Clock3 className={`mt-1 size-5 shrink-0 ${urgent ? "text-amber-700" : "text-emerald-700"}`} /><div className="min-w-0">
                <h3 className="font-extrabold text-ink">{assignment.title}</h3>
                <p className="mt-1 text-sm text-secondary">{activeMemberships.find(({ classroom }) => classroom.id === assignment.classroomId)?.classroom.name}</p>
                <p className="mt-2 text-sm text-secondary">Hạn nộp: {formatAssignmentDeadline(assignment.dueAt)}</p>
                <p className={`mt-1 text-sm font-bold ${urgent ? "text-amber-700" : "text-emerald-700"}`}>{urgent ? "Sắp hết hạn · " : ""}{formatTimeRemaining(deadline - now)}</p>
              </div></div>
              <Link to={`/student/assignments/${assignment.id}`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white">{started ? "Tiếp tục làm" : "Làm bài"}<ArrowRight className="size-4" /></Link>
            </article>;
          })}
        </section>
        <section aria-labelledby="student-progress-heading" className="rounded-2xl border border-line bg-white p-5">
          <h2 id="student-progress-heading" className="text-xl font-extrabold text-ink">Tiến độ nộp bài</h2>
          <p className="mt-2 text-sm text-secondary">{submittedCount}/{rows.length} bài có bài nộp trong lớp đang học.</p>
          {rows.length > 0 && <div role="progressbar" aria-label="Tỷ lệ bài có bài nộp" aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={submittedCount} className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${submittedCount / rows.length * 100}%` }} /></div>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm"><span className="text-secondary">{pendingRows.length} bài cần làm</span><span className={expiredCount > 0 ? "text-red-600" : "text-secondary"}>{expiredCount} bài hết hạn chưa nộp</span>{unavailableCount > 0 && <span className="text-secondary">{unavailableCount} bài chưa khả dụng</span>}</div>
          {submissionStorageStatus !== "saved" && <p role="status" className="mt-3 text-sm text-red-600">{submissionStorageStatus === "error" ? "Bài nộp chưa lưu được trên trình duyệt. Mở bài đã nộp để thử lưu lại trước khi đóng trang." : "Đang lưu bài nộp…"}</p>}
        </section>
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-extrabold text-ink">Bài học mới cập nhật</h2><Link to="/student/lessons" className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-700">Xem tất cả bài học →</Link></div>
          {recentLessons.length === 0 ? <p className="rounded-2xl border border-line bg-white p-5 text-sm text-secondary">Chưa có bài học được đăng.</p> : <div className="grid gap-3 md:grid-cols-3">{recentLessons.map((lesson) => <Link key={lesson.id} to={`/student/lessons?lesson=${lesson.id}`} className="min-w-0 rounded-2xl border border-line bg-white p-5 hover:bg-slate-50"><BookOpen className="size-5 text-emerald-700" /><h3 className="mt-3 font-bold text-ink">Bài {lesson.number}: {lesson.title}</h3><p className="mt-2 text-sm font-bold text-emerald-700">Mở bài học →</p></Link>)}</div>}
        </section>
        <Link to="/student/videos" className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-white p-5 hover:bg-slate-50"><PlayCircle className="size-6 shrink-0 text-emerald-700" /><div className="min-w-0"><p className="font-bold text-ink">Video tương tác</p><p className="mt-1 text-sm text-secondary">{visibleVideos.length > 0 ? `${visibleVideos.length} video đang khả dụng trong lớp đang học` : "Chưa có video được giao trong lớp đang học"}</p></div><ArrowRight className="ml-auto size-5 shrink-0 text-emerald-700" /></Link>
      </>}
    </div>
  );
}
