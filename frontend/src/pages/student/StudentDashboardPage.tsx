import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Box, Gamepad2, GraduationCap } from "lucide-react";
import { RegistrationNotice } from "../../components/common/RegistrationNotice";
import { StudentNotificationsPanel } from "../../components/student/StudentNotificationsPanel";
import { StudentAssessmentWidget } from "../../components/student/StudentAssessmentWidget";
import { GeographyArtwork } from "../../components/student/GeographyArtwork";
import { StudentEmptyState } from "../../components/student/StudentEmptyState";
import { useAuth } from "../../contexts/AuthContext";
import { getStudentActiveMemberships, getStudentJoinRequests, type ClassroomJoinRequest, type ClassroomMembership } from "../../service/api/joinRequests";
import { getStudentLessons, type StudentLessonSummary } from "../../service/api/lessons";

type ClassroomData = { memberships: ClassroomMembership[]; requests: ClassroomJoinRequest[] };
type LessonResult = { key: string; data?: StudentLessonSummary[]; error?: string };

export default function StudentDashboardPage() {
  const { session, status } = useAuth();
  return <DashboardSession key={`${status}:${session?.userId ?? "none"}`} name={session?.name ?? ""}
    isStudent={status === "ready" && session?.role === "student"} />;
}

function DashboardSession({ name, isStudent }: { name: string; isStudent: boolean }) {
  const [classroomData, setClassroomData] = useState<ClassroomData | null>(null);
  const [classroomError, setClassroomError] = useState("");
  const [classroomLoading, setClassroomLoading] = useState(true);
  const classroomGeneration = useRef(0);
  const [lessonRevision, setLessonRevision] = useState(0);
  const [lessonResult, setLessonResult] = useState<LessonResult | null>(null);
  const lessonKey = `${isStudent}:${lessonRevision}`;
  const currentLessons = lessonResult?.key === lessonKey ? lessonResult : null;

  useEffect(() => {
    if (!isStudent) return;
    let active = true;
    void getStudentLessons().then(data => { if (active) setLessonResult({ key: lessonKey, data }); })
      .catch(() => { if (active) setLessonResult({ key: lessonKey, error: "Không thể tải bài học mới cập nhật. Vui lòng thử lại." }); });
    return () => { active = false; };
  }, [isStudent, lessonKey]);

  const loadClassroomData = useCallback(async () => {
    if (!isStudent) return;
    const generation = ++classroomGeneration.current;
    setClassroomLoading(true); setClassroomError("");
    try {
      const memberships = await getStudentActiveMemberships();
      const requests = memberships.length === 0 ? await getStudentJoinRequests() : [];
      if (generation === classroomGeneration.current) setClassroomData({ memberships, requests });
    } catch {
      if (generation === classroomGeneration.current) {
        setClassroomData(null); setClassroomError("Không thể tải thông tin lớp học. Vui lòng thử lại.");
      }
    } finally {
      if (generation === classroomGeneration.current) setClassroomLoading(false);
    }
  }, [isStudent]);
  useEffect(() => { void loadClassroomData(); return () => { classroomGeneration.current += 1; }; }, [loadClassroomData]);

  const activeMemberships = classroomData?.memberships.filter(item => item.status === "active") ?? [];
  const latestRequest = classroomData?.requests[0];
  const pendingRequest = latestRequest?.status === "pending";
  const approvedWithoutMembership = activeMemberships.length === 0 && latestRequest?.status === "approved";
  const recentLessons = (currentLessons?.data ?? []).slice().sort((a, b) => {
    const first = Date.parse(a.publishedAt ?? "");
    const second = Date.parse(b.publishedAt ?? "");
    return (Number.isFinite(second) ? second : -Infinity) - (Number.isFinite(first) ? first : -Infinity)
      || a.number - b.number || a.id.localeCompare(b.id);
  }).slice(0, 3);

  return <main className="mx-auto min-w-0 max-w-6xl space-y-7 [overflow-wrap:anywhere]">
    <RegistrationNotice role="student" />
    <header className="relative isolate overflow-hidden rounded-[2rem] border border-emerald/15 bg-white px-6 py-8 shadow-card sm:px-10 sm:py-10">
      <div aria-hidden="true" className="absolute inset-y-0 right-0 -z-10 w-2/3 bg-[radial-gradient(circle_at_70%_35%,#dff4e9,transparent_65%)]" />
      <GeographyArtwork className="pointer-events-none absolute -right-16 top-1/2 -z-10 hidden w-[380px] -translate-y-1/2 opacity-90 sm:block lg:right-0" />
      <div className="max-w-xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald">Khám phá Địa lí 10</p>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{name ? `Chào ${name}!` : "Chào bạn!"}</h1>
        <p className="mt-3 text-base leading-7 text-secondary">Mỗi bài học là một góc nhìn mới về thế giới quanh mình.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={recentLessons[0] ? `/student/lessons?lesson=${encodeURIComponent(recentLessons[0].id)}` : "/student/lessons"}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald px-5 py-2 text-sm font-bold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald">
            {recentLessons[0] ? "Mở bài học mới" : "Khám phá bài học"}<ArrowRight className="size-4" />
          </Link>
          <Link to="/student/assessments" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 py-2 text-sm font-bold text-ink hover:border-emerald/50">Bài cần làm</Link>
        </div>
      </div>
    </header>
    <StudentAssessmentWidget />
    <StudentNotificationsPanel />
    <section aria-labelledby="student-explore-heading" className="space-y-3">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald">Khám phá thêm</p>
        <h2 id="student-explore-heading" className="mt-1 text-xl font-extrabold text-ink">Học Địa lí bằng tương tác</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/student/games" className="group flex min-h-28 items-center gap-4 rounded-3xl border border-line bg-white p-5 shadow-card transition hover:border-emerald/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Gamepad2 className="size-6" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-base text-ink">Trò chơi Địa lí</strong><span className="mt-1 block text-sm text-secondary">Luyện kiến thức qua 4 trò chơi.</span></span>
          <ArrowRight className="size-4 shrink-0 text-emerald transition group-hover:translate-x-1 motion-reduce:transform-none" />
        </Link>
        <Link to="/student/3d-lab" className="group flex min-h-28 items-center gap-4 rounded-3xl border border-line bg-white p-5 shadow-card transition hover:border-emerald/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700"><Box className="size-6" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-base text-ink">Phòng lab 3D</strong><span className="mt-1 block text-sm text-secondary">Quan sát và khám phá 4 mô hình.</span></span>
          <ArrowRight className="size-4 shrink-0 text-emerald transition group-hover:translate-x-1 motion-reduce:transform-none" />
        </Link>
      </div>
    </section>
    {classroomLoading ? <section role="status" className="rounded-2xl border border-line bg-white p-6 text-sm text-secondary">Đang tải lớp học của bạn…</section>
      : classroomError ? <section role="alert" className="rounded-2xl border border-line bg-white p-6">
        <h2 className="text-xl font-extrabold text-ink">Không thể tải lớp học</h2>
        <p className="mt-2 text-sm text-red-600">{classroomError}</p>
        <button type="button" onClick={() => void loadClassroomData()} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-emerald px-5 text-sm font-bold text-white">Thử lại</button>
      </section> : activeMemberships.length === 0 ? <StudentEmptyState
        title={pendingRequest ? "Đang chờ tham gia lớp" : "Bạn chưa tham gia lớp học nào"}
        description={pendingRequest ? "Yêu cầu tham gia đang chờ giáo viên xử lý. Xem trạng thái trong lịch sử yêu cầu."
          : approvedWithoutMembership ? "Yêu cầu trước đây đã được duyệt, nhưng hiện bạn không có lớp đang tham gia. Xem lịch sử yêu cầu để biết thêm chi tiết."
            : "Có mã lớp từ giáo viên? Hãy nhập mã để tham gia."}
        to="/student/join-class" action={pendingRequest || approvedWithoutMembership ? "Xem lịch sử yêu cầu" : "Nhập mã lớp"}
      /> : <section className="rounded-3xl border border-line bg-white p-6 shadow-card sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div><span className="inline-grid size-11 place-items-center rounded-2xl bg-emerald/10 text-emerald"><GraduationCap className="size-5" /></span>
        <h2 className="mt-3 text-xl font-extrabold text-ink">Lớp học của tôi</h2>
        <p className="mt-2 text-sm text-secondary">Bạn đang tham gia {activeMemberships.length} lớp. Xem bài học và bài được giao theo từng lớp.</p>
        <div className="mt-3 flex flex-wrap gap-2">{activeMemberships.map(({ classroom }) => <Link key={classroom.id} to={`/student/classes/${encodeURIComponent(classroom.id)}`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-bold text-ink hover:border-emerald/40">{classroom.name}</Link>)}</div>
        </div><Link to="/student/classes" className="mt-4 inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-emerald sm:mt-0">Xem lớp học <ArrowRight className="size-4" /></Link>
      </section>}
    <section className="space-y-3" aria-labelledby="student-recent-lessons-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="student-recent-lessons-heading" className="text-xl font-extrabold text-ink">Bài học mới cập nhật</h2>
        <Link to="/student/lessons" className="inline-flex min-h-11 items-center text-sm font-bold text-emerald">Xem tất cả bài học →</Link>
      </div>
      {!currentLessons ? <p role="status" className="rounded-2xl border border-line bg-white p-5 text-sm text-secondary">Đang tải bài học mới cập nhật...</p>
        : currentLessons.error ? <div role="alert" className="rounded-2xl border border-line bg-white p-5 text-sm text-secondary">
          <p>{currentLessons.error}</p>
          <button type="button" onClick={() => setLessonRevision(value => value + 1)} className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-emerald px-4 text-sm font-bold text-emerald">Thử lại bài học</button>
        </div> : recentLessons.length === 0 ? <StudentEmptyState title="Chưa có bài học được đăng cho lớp của bạn" description="Khi giáo viên chia sẻ bài mới, bạn sẽ tìm thấy bài học tại đây." to="/student/lessons" action="Xem danh sách bài học" />
          : <div className="grid gap-3 md:grid-cols-3">{recentLessons.map(lesson => <Link key={lesson.id}
            to={`/student/lessons?lesson=${encodeURIComponent(lesson.id)}`} className="group min-w-0 rounded-3xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-emerald/40 motion-reduce:transform-none">
            <span className="inline-grid size-10 place-items-center rounded-xl bg-emerald/10"><BookOpen className="size-5 text-emerald" /></span><h3 className="mt-4 font-bold text-ink">Bài {lesson.number}: {lesson.title}</h3>
            <p className="mt-1 text-xs text-secondary">{lesson.chapterTitle}</p>
            <p className="mt-2 text-sm font-bold text-emerald">Mở bài học →</p>
          </Link>)}</div>}
    </section>
  </main>;
}
