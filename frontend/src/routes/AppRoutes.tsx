import { lazy } from "react";
import {
  Route,
  Routes,
  Navigate,
  useLocation,
  useParams,
  Outlet,
  Link,
} from "react-router-dom";

import { useAuth, type AuthRole } from "../contexts/AuthContext";

import PublicLayout from "../layouts/PublicLayout";
import TeacherLayout from "../layouts/TeacherLayout";
import StudentLayout from "../layouts/StudentLayout";
import VerifiedTeacherRoute from "./VerifiedTeacherRoute";

const LandingPage = lazy(() => import("../pages/public/LandingPage"));
const AuthPage = lazy(() => import("../pages/auth/AuthPage"));
const RegisterSuccessPage = lazy(() => import("../pages/auth/RegisterSuccessPage"));

const TeacherDashboardPage = lazy(() => import("../pages/teacher/TeacherDashboardPage"));
const TeacherClassDetailPage = lazy(() => import("../pages/teacher/TeacherClassDetailPage"));
const TeacherCreateClassPage = lazy(() => import("../pages/teacher/TeacherCreateClassPage"));
const TeacherClassesPage = lazy(() => import("../pages/teacher/TeacherClassesPage"));
const TeacherVerificationPage = lazy(() => import("../pages/teacher/TeacherVerificationPage"));

const TeacherQuestionsPage = lazy(() => import("../pages/teacher/TeacherQuestionsPage"));
const TeacherCreateQuestionPage = lazy(() => import("../pages/teacher/TeacherCreateQuestionPage"));

const TeacherAssignmentsPage = lazy(() => import("../pages/teacher/TeacherAssignmentsPage"));
const TeacherAssignmentDetailPage = lazy(() => import("../pages/teacher/TeacherAssignmentDetailPage"));

const TeacherVideosPage = lazy(() => import("../pages/teacher/TeacherVideosPage"));
const TeacherInfographicsPage = lazy(() => import("../pages/teacher/TeacherInfographicsPage"));
const TeacherLessonsPage = lazy(() => import("../pages/teacher/TeacherLessonsPage"));

const StudentAssignmentsPage = lazy(() => import("../pages/student/StudentAssignmentsPage"));
const StudentAssignmentWorkPage = lazy(() => import("../pages/student/StudentAssignmentWorkPage"));
const StudentJoinClassPage = lazy(() => import("../pages/student/StudentJoinClassPage"));
const StudentLessonsPage = lazy(() => import("../pages/student/StudentLessonsPage"));
const StudentVideosPage = lazy(() => import("../pages/student/StudentVideosPage"));
const StudentClassesPage = lazy(() => import("../pages/student/StudentClassesPage"));
const StudentClassDetailPage = lazy(() => import("../pages/student/StudentClassDetailPage"));
const StudentDashboardPage = lazy(() => import("../pages/student/StudentDashboardPage"));

function LegacyStudentRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  const { assignmentId } = useParams();

  const destination = assignmentId
    ? to.replace(":assignmentId", encodeURIComponent(assignmentId))
    : to;

  const params = new URLSearchParams(search);

  params.delete("studentId");

  const query = params.toString();

  return (
    <Navigate to={`${destination}${query ? `?${query}` : ""}${hash}`} replace />
  );
}

function RequireRole({ role }: { role: AuthRole }) {
  const { session, status, error, refreshSession } = useAuth();
  if (status === "loading") {
    return <p role="status" className="p-5 text-sm text-secondary">Đang kiểm tra phiên đăng nhập...</p>;
  }
  if (status === "error" && !session) {
    return <main role="alert" className="mx-auto my-10 max-w-lg rounded-2xl border border-line bg-white p-6">
      <p className="text-sm text-red-600">{error}</p>
      <button type="button" onClick={() => void refreshSession()} className="mt-4 min-h-11 rounded-full bg-emerald px-5 text-sm font-bold text-white">Thử lại</button>
    </main>;
  }
  if (!session) return <Navigate to={`/auth?role=${role}`} replace />;
  if (session.role !== role) return <Navigate to={`/${session.role}`} replace />;
  return <Outlet />;
}

function NotFoundPage() {
  const { session } = useAuth();
  return <main className="mx-auto my-10 w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-white p-6 text-ink shadow-card">
    <p className="text-sm font-bold text-secondary">404</p>
    <h1 className="mt-2 text-xl font-extrabold">Không tìm thấy trang</h1>
    <p className="mt-3 text-sm leading-6 text-secondary">Đường dẫn có thể đã thay đổi hoặc không còn tồn tại. Bạn có thể quay về để tiếp tục sử dụng WebStudy.</p>
    <Link to={session ? `/${session.role}` : "/"} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white">{session ? "Về Tổng quan" : "Về trang giới thiệu"}</Link>
  </main>;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
      </Route>

      {/* Authentication */}
      <Route path="/auth" element={<AuthPage />} />

      <Route element={<RequireRole role="student" />}>
        <Route path="/auth/register/success/student" element={<RegisterSuccessPage role="student" />} />
      </Route>
      <Route element={<RequireRole role="teacher" />}>
        <Route path="/auth/register/success/teacher" element={<RegisterSuccessPage role="teacher" />} />
      </Route>

      {/* Teacher */}
      <Route element={<RequireRole role="teacher" />}>
      <Route path="teacher" element={<TeacherLayout />}>
        {/* Mặc định */}
        <Route index element={<Navigate to="dashboard" replace />} />

        {/* Dashboard */}
        <Route path="dashboard" element={<TeacherDashboardPage />} />

        {/* Xác minh giáo viên */}
        <Route path="verification" element={<TeacherVerificationPage />} />

        {/* Các trang yêu cầu xác minh */}
        <Route element={<VerifiedTeacherRoute />}>
          <Route path="classes" element={<TeacherClassesPage />} />

          <Route path="classes/new" element={<TeacherCreateClassPage />} />

          <Route path="classes/:classId" element={<TeacherClassDetailPage />} />

          <Route path="questions" element={<TeacherQuestionsPage />} />

          <Route path="questions/new" element={<TeacherCreateQuestionPage />} />

          <Route
            path="questions/:questionId/edit"
            element={<TeacherCreateQuestionPage />}
          />

          <Route path="assignments" element={<TeacherAssignmentsPage />} />
          <Route path="assignments/new" element={<TeacherAssignmentsPage />} />
          <Route
            path="assignments/:assignmentId"
            element={<TeacherAssignmentDetailPage />}
          />

          <Route path="videos" element={<TeacherVideosPage />} />
          <Route path="videos/:videoId" element={<TeacherVideosPage />} />

          <Route path="infographics" element={<TeacherInfographicsPage />} />

          <Route path="lessons" element={<TeacherLessonsPage />} />
        </Route>
      </Route>
      </Route>

      {/* Student */}
      <Route element={<RequireRole role="student" />}>
      <Route path="student" element={<StudentLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />

        {/* Chưa xây chức năng thật */}
        <Route path="dashboard" element={<StudentDashboardPage />} />

        <Route path="classes" element={<StudentClassesPage />} />

        <Route path="classes/:classId" element={<StudentClassDetailPage />} />

        {/* Tham gia lớp */}
        <Route path="join-class" element={<StudentJoinClassPage />} />

        {/* Bài học */}
        <Route path="lessons" element={<StudentLessonsPage />} />

        {/* Video */}
        <Route path="videos" element={<StudentVideosPage />} />

        {/* Danh sách bài tập */}
        <Route path="assignments" element={<StudentAssignmentsPage />} />

        {/* Chi tiết làm bài */}
        <Route
          path="assignments/:assignmentId"
          element={<StudentAssignmentWorkPage />}
        />
      </Route>
      </Route>
      {/* Legacy Student Routes - chỉ dùng trong DEV */}
      {import.meta.env.DEV && (
        <>
          <Route
            path="/demo/student/join-class"
            element={<LegacyStudentRedirect to="/student/join-class" />}
          />

          <Route
            path="/demo/student/lessons"
            element={<LegacyStudentRedirect to="/student/lessons" />}
          />

          <Route
            path="/demo/student/videos"
            element={<LegacyStudentRedirect to="/student/videos" />}
          />

          <Route
            path="/demo/student/assignments"
            element={<LegacyStudentRedirect to="/student/assignments" />}
          />

          <Route
            path="/demo/student/assignments/:assignmentId"
            element={
              <LegacyStudentRedirect to="/student/assignments/:assignmentId" />
            }
          />
        </>
      )}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
