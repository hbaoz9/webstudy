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

import { authHomePath, useAuth, type AuthRole } from "../contexts/AuthContext";

import PublicLayout from "../layouts/PublicLayout";
import TeacherLayout from "../layouts/TeacherLayout";
import StudentLayout from "../layouts/StudentLayout";
import VerifiedTeacherRoute from "./VerifiedTeacherRoute";

const LandingPage = lazy(() => import("../pages/public/LandingPage"));
const AuthPage = lazy(() => import("../pages/auth/AuthPage"));
const TeacherVerificationsPage = lazy(() => import("../pages/admin/TeacherVerificationsPage"));

const TeacherDashboardPage = lazy(() => import("../pages/teacher/TeacherDashboardPage"));
const TeacherClassDetailPage = lazy(() => import("../pages/teacher/TeacherClassCoreDetailPage"));
const TeacherCreateClassPage = lazy(() => import("../pages/teacher/TeacherCreateClassPage"));
const TeacherClassesPage = lazy(() => import("../pages/teacher/TeacherClassesPage"));
const TeacherVerificationPage = lazy(() => import("../pages/teacher/TeacherVerificationPage"));

const TeacherQuestionsPage = lazy(() => import("../pages/teacher/TeacherQuestionsPage"));
const TeacherCreateQuestionPage = lazy(() => import("../pages/teacher/TeacherCreateQuestionPage"));

const TeacherAssignmentsPage = lazy(() => import("../pages/teacher/TeacherAssignmentsPage"));
const TeacherAssessmentsPage = lazy(() => import("../pages/teacher/TeacherAssessmentsPage"));
const TeacherGradingPage = lazy(() => import("../pages/teacher/TeacherGradingPage"));
const TeacherAssignmentDetailPage = lazy(() => import("../pages/teacher/TeacherAssignmentDetailPage"));

const TeacherVideosPage = lazy(() => import("../pages/teacher/TeacherVideosPage"));
const TeacherInteractiveVideosPage = lazy(() => import("../pages/teacher/TeacherInteractiveVideosPage"));
const TeacherInfographicsPage = lazy(() => import("../pages/teacher/TeacherInfographicsPage"));
const TeacherServerInfographicsPage = lazy(() => import("../pages/teacher/TeacherServerInfographicsPage"));
const TeacherLessonsPage = lazy(() => import("../pages/teacher/TeacherLessonsPage"));

const StudentAssessmentsPage = lazy(() => import("../pages/student/StudentAssessmentsPage"));
const StudentAssessmentWorkPage = lazy(() => import("../pages/student/StudentAssessmentWorkPage"));
const StudentJoinClassPage = lazy(() => import("../pages/student/StudentJoinClassPage"));
const StudentLessonsPage = lazy(() => import("../pages/student/StudentLessonsPage"));
const StudentInteractiveVideosPage = lazy(() => import("../pages/student/StudentInteractiveVideosPage"));
const StudentInfographicsPage = lazy(() => import("../pages/student/StudentInfographicsPage"));
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
  if (session.role !== role) return <Navigate to={authHomePath(session)} replace />;
  return <Outlet />;
}

function NotFoundPage() {
  const { session } = useAuth();
  return <main className="mx-auto my-10 w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-white p-6 text-ink shadow-card">
    <p className="text-sm font-bold text-secondary">404</p>
    <h1 className="mt-2 text-xl font-extrabold">Không tìm thấy trang</h1>
    <p className="mt-3 text-sm leading-6 text-secondary">Đường dẫn có thể đã thay đổi hoặc không còn tồn tại. Bạn có thể quay về để tiếp tục sử dụng WebStudy.</p>
    <Link to={session ? authHomePath(session) : "/"} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white">{session ? "Về khu vực của tôi" : "Về trang giới thiệu"}</Link>
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

      <Route path="/auth/register/success/student" element={<Navigate to="/student/dashboard" replace />} />
      <Route path="/auth/register/success/teacher" element={<Navigate to="/teacher/verification" replace />} />

      <Route element={<RequireRole role="admin" />}>
        <Route path="/admin/teacher-verifications" element={<TeacherVerificationsPage />} />
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
          <Route path="assessments" element={<TeacherAssessmentsPage />} />
          <Route path="assessments/:assessmentId" element={<TeacherAssessmentsPage />} />
          <Route path="distributions/:distributionId" element={<TeacherGradingPage />} />
          <Route path="distributions/:distributionId/grade" element={<TeacherGradingPage />} />
          <Route path="assignments/new" element={<TeacherAssignmentsPage />} />
          <Route
            path="assignments/:assignmentId"
            element={<TeacherAssignmentDetailPage />}
          />

          <Route path="videos" element={<TeacherInteractiveVideosPage />} />
          <Route path="videos/local" element={<TeacherVideosPage />} />
          <Route path="videos/local/:videoId" element={<TeacherVideosPage />} />
          <Route path="videos/:videoId" element={<TeacherInteractiveVideosPage />} />

          <Route path="infographics" element={<TeacherServerInfographicsPage />} />
          <Route path="infographics/local" element={<TeacherInfographicsPage />} />

          <Route path="lessons" element={<TeacherLessonsPage />} />
        </Route>
      </Route>
      </Route>

      {/* Student */}
      <Route element={<RequireRole role="student" />}>
      <Route path="student" element={<StudentLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />

        <Route path="dashboard" element={<StudentDashboardPage />} />

        <Route path="classes" element={<StudentClassesPage />} />

        <Route path="classes/:classId" element={<StudentClassDetailPage />} />

        {/* Tham gia lớp */}
        <Route path="join-class" element={<StudentJoinClassPage />} />

        {/* Bài học */}
        <Route path="lessons" element={<StudentLessonsPage />} />

        {/* Video */}
        <Route path="videos" element={<StudentInteractiveVideosPage />} />
        <Route path="videos/local" element={<Navigate to="/student/videos" replace />} />
        <Route path="videos/local/:videoId" element={<Navigate to="/student/videos" replace />} />
        <Route path="infographics" element={<StudentInfographicsPage />} />
        <Route path="videos/:publicationId" element={<StudentInteractiveVideosPage />} />

        {/* Danh sách bài tập */}
        <Route path="assessments" element={<StudentAssessmentsPage />} />
        <Route path="assessments/:distributionId" element={<StudentAssessmentWorkPage />} />
        <Route path="assignments" element={<Navigate to="/student/assessments" replace />} />

        {/* Chi tiết làm bài */}
        <Route
          path="assignments/:assignmentId"
          element={<Navigate to="/student/assessments" replace />}
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
            element={<LegacyStudentRedirect to="/student/assessments" />}
          />

          <Route
            path="/demo/student/assignments/:assignmentId"
            element={
              <LegacyStudentRedirect to="/student/assessments" />
            }
          />
        </>
      )}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
