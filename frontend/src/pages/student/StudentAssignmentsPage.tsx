import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";
import { useStudentAccount } from "../../contexts/StudentAccountContext";
import { useStudentClassMemberships } from "../../hooks/useStudentClassMemberships";
import { geo10Lessons } from "../../data/geo10Curriculum";
import { getAssignmentResultVisibility, hasAssignmentDraftAnswers, loadAssignmentAnswerDraft } from "../../utils/assignmentQuestion";

type AssignmentTab = "todo" | "submitted" | "graded" | "closed";
const tabs: { id: AssignmentTab; label: string }[] = [
  { id: "todo", label: "Cần làm" },
  { id: "submitted", label: "Đã nộp" },
  { id: "graded", label: "Đã chấm" },
  { id: "closed", label: "Hết hạn / Chưa khả dụng" },
];

export default function StudentAssignmentsPage() {
  const [searchParams] = useSearchParams();
  const requestedLessonId = searchParams.get("lesson");
  const requestedClassId = searchParams.get("class");
  const selectedLesson = geo10Lessons.find((lesson) => lesson.id === requestedLessonId);
  const { assignments, submissions, submissionStorageStatus } = useTeacherAssignments();
  const { student, hasStudentProfile } = useStudentAccount();
  const { memberships } = useStudentClassMemberships();
  const [tab, setTab] = useState<AssignmentTab>("todo");
  const [now, setNow] = useState(() => Date.now());
  const [draftRevision, setDraftRevision] = useState(0);

  useEffect(() => {
    const refresh = () => { setDraftRevision((value) => value + 1); setNow(Date.now()); };
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const drafts = useMemo(() => new Map(assignments.map((assignment) => [
    assignment.id,
    hasStudentProfile ? loadAssignmentAnswerDraft(assignment, student.id) : null,
  ])), [assignments, student.id, hasStudentProfile, draftRevision]);

  const activeClassIds = new Set(memberships
    .filter(({ classroom, status }) => status === "joined" && classroom.status !== "archived")
    .map(({ classroom }) => classroom.id));

  const rows = assignments.filter((assignment) =>
    hasStudentProfile && assignment.status === "published" &&
    activeClassIds.has(assignment.classroomId) &&
    (requestedClassId === null || assignment.classroomId === requestedClassId) &&
    (requestedLessonId === null || assignment.lessonId === requestedLessonId),
  ).map((assignment) => {
    const submission = submissions.find((item) => item.assignmentId === assignment.id && item.studentId === student.id);
    const deadline = Date.parse(assignment.dueAt ?? "");
    const closed = !Number.isFinite(deadline) || now >= deadline || assignment.questions.length === 0;
    const draft = drafts.get(assignment.id);
    const started = draft?.status === "restored" && hasAssignmentDraftAnswers(draft.answers);
    const showScore = getAssignmentResultVisibility(assignment) !== "hidden";
    const group: AssignmentTab = submission ? showScore ? "graded" : "submitted" : closed ? "closed" : "todo";
    const status = submission ? showScore ? "Đã chấm" : "Đã nộp" : !Number.isFinite(deadline) || assignment.questions.length === 0
      ? "Chưa khả dụng" : closed ? "Hết hạn" : draft?.status === "error"
        ? "Nháp cần kiểm tra" : started ? "Đang làm" : "Chưa làm";
    return { assignment, submission, deadline, group, status, started };
  });

  const hasUpcomingDeadline = rows.some((row) => row.group === "todo");
  useEffect(() => {
    if (!hasUpcomingDeadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasUpcomingDeadline]);

  const visibleRows = rows.filter((row) => row.group === tab).sort((a, b) =>
    tab === "graded" || tab === "submitted"
      ? (b.submission?.submittedAt ?? "").localeCompare(a.submission?.submittedAt ?? "")
      : (Number.isFinite(a.deadline) ? a.deadline : Infinity) -
        (Number.isFinite(b.deadline) ? b.deadline : Infinity) || a.assignment.title.localeCompare(b.assignment.title),
  );

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-6 py-2">
      <header>
        <h1 className="text-2xl font-extrabold text-ink">Bài tập &amp; Kiểm tra</h1>
        <p className="mt-2 text-sm text-secondary">
          {selectedLesson ? `Bài ${selectedLesson.number}. ${selectedLesson.title}` : "Ưu tiên bài cần làm và theo dõi kết quả đã nộp."}
        </p>
      </header>

      {!hasStudentProfile ? (
        <div className="rounded-2xl border border-line bg-white p-6">
          <p className="text-sm text-secondary">Tạo hồ sơ học sinh để xem bài được giao.</p>
          <Link to="/student/join-class" className="mt-3 inline-flex min-h-11 items-center font-bold text-emerald">Tạo hồ sơ và tham gia lớp</Link>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Lọc trạng thái bài tập" className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)}
                className={`min-h-11 rounded-full border px-4 text-sm font-bold ${tab === item.id ? "border-emerald bg-emerald text-white" : "border-line bg-white text-secondary"}`}>
                {item.label} ({rows.filter((row) => row.group === item.id).length})
              </button>
            ))}
          </div>
          {visibleRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
              <ClipboardList className="mx-auto size-8 text-muted" />
              <p className="mt-3 text-sm text-secondary">
                {rows.length === 0 ? "Chưa có bài được giao trong lớp đang học hoặc bộ lọc này."
                  : tab === "todo" ? "Hiện không có bài còn hạn cần làm. Bạn có thể xem bài đã chấm hoặc hết hạn."
                  : tab === "graded" ? "Chưa có bài đã chấm được công bố." : tab === "submitted" ? "Chưa có bài đã nộp đang chờ công bố kết quả." : "Không có bài hết hạn hoặc chưa khả dụng."}
              </p>
            </div>
          ) : (
            <section aria-label="Danh sách bài tập" className="space-y-3">
              {visibleRows.map(({ assignment, submission, deadline, status, started, group }) => (
                <article key={assignment.id} className="rounded-2xl border border-line bg-white p-5 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="min-w-0 flex-1 break-words font-extrabold text-ink">{assignment.title}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${submission ? "bg-emerald/10 text-emerald" : "bg-amber/15 text-ink"}`}>{status}</span>
                  </div>
                  <p className="mt-2 text-sm text-secondary">Bài tập · {assignment.questions.length} câu</p>
                  <p className="mt-2 text-sm text-secondary">Hạn nộp: {Number.isFinite(deadline)
                    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(deadline))
                    : "Chưa có hạn hợp lệ"}</p>
                  {submission && (getAssignmentResultVisibility(assignment) !== "hidden"
                    ? <p className="mt-2 text-sm font-bold text-emerald">Điểm: {submission.score}/10</p>
                    : <p className="mt-2 text-sm text-secondary">Giáo viên chưa công bố kết quả.</p>)}
                  {submission && submissionStorageStatus !== "saved" && (
                    <p role="status" className="mt-2 text-sm text-red-600">{submissionStorageStatus === "error" ? "Bài nộp chưa lưu được trên trình duyệt. Hãy thử lưu lại trước khi đóng trang." : "Đang lưu bài nộp…"}</p>
                  )}
                  <Link to={`/student/assignments/${assignment.id}`} className={`mt-4 inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold ${group === "todo" ? "bg-emerald text-white" : "border border-line text-ink"}`}>
                    {submission ? "Xem kết quả" : group === "closed" ? "Xem bài" : status === "Nháp cần kiểm tra" ? "Kiểm tra bản nháp" : started ? "Tiếp tục làm" : "Bắt đầu làm"}
                  </Link>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
