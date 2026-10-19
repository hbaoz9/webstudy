import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";
import { useStudentAccount } from "../../contexts/StudentAccountContext";
import { useStudentClassMemberships } from "../../hooks/useStudentClassMemberships";
import { useStudentNow } from "../../hooks/useStudentNow";
import { useLocalStorageRevision } from "../../hooks/useLocalStorageRevision";
import { getActiveStudentClassIds } from "../../utils/studentMembership";
import { getStudentAssignmentRows } from "../../utils/studentAssignments";
import { geo10Lessons } from "../../data/geo10Curriculum";
import StudentPageHeader from "../../components/student/StudentPageHeader";
import StudentStatusBadge from "../../components/student/StudentStatusBadge";
import { getAssignmentBadge } from "../../utils/studentPresentation";
import {
  getAssignmentResultVisibility,
  ASSIGNMENT_DRAFT_CHANGED,
  assignmentAnswerDraftKey,
  loadAssignmentAnswerDraft,
} from "../../utils/assignmentQuestion";

type AssignmentTab = "todo" | "submitted" | "graded" | "closed";
const tabs: { id: AssignmentTab; label: string }[] = [
  { id: "todo", label: "Cần làm" },
  { id: "submitted", label: "Đã nộp" },
  { id: "graded", label: "Đã chấm" },
  { id: "closed", label: "Hết hạn / Chưa khả dụng" },
];
const draftEvents = [ASSIGNMENT_DRAFT_CHANGED];
const noKeys: string[] = [];

export default function StudentAssignmentsPage() {
  const [searchParams] = useSearchParams();
  const requestedLessonId = searchParams.get("lesson");
  const requestedClassId = searchParams.get("class");
  const selectedLesson = geo10Lessons.find(
    (lesson) => lesson.id === requestedLessonId,
  );
  const { assignments, submissions, submissionStorageStatus } =
    useTeacherAssignments();
  const { student, hasStudentProfile } = useStudentAccount();
  const { memberships } = useStudentClassMemberships();
  const [tab, setTab] = useState<AssignmentTab>("todo");
  const draftRevision = useLocalStorageRevision(noKeys, draftEvents, assignmentAnswerDraftKey("", student.id));

  const drafts = useMemo(
    () =>
      new Map(
        assignments.map((assignment) => [
          assignment.id,
          hasStudentProfile
            ? loadAssignmentAnswerDraft(assignment, student.id)
            : null,
        ]),
      ),
    [assignments, student.id, hasStudentProfile, draftRevision],
  );

  const activeClassIds = getActiveStudentClassIds(memberships);
  const now = useStudentNow(assignments.filter((assignment) =>
    assignment.status === "published" && activeClassIds.has(assignment.classroomId),
  ).map((assignment) => Date.parse(assignment.dueAt ?? "")));
  const rows = getStudentAssignmentRows(assignments, submissions, student.id, activeClassIds, drafts, now)
    .filter(({ assignment }) => hasStudentProfile &&
      (requestedClassId === null || assignment.classroomId === requestedClassId) &&
      (requestedLessonId === null || assignment.lessonId === requestedLessonId))
    .map((row) => ({ ...row, badge: getAssignmentBadge(row.phase) }));

  const visibleRows = rows
    .filter((row) => row.group === tab)
    .sort((a, b) =>
      tab === "graded" || tab === "submitted"
        ? (b.submission?.submittedAt ?? "").localeCompare(
            a.submission?.submittedAt ?? "",
          )
        : (Number.isFinite(a.deadline) ? a.deadline : Infinity) -
            (Number.isFinite(b.deadline) ? b.deadline : Infinity) ||
          a.assignment.title.localeCompare(b.assignment.title),
    );

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-6 py-2">
      <StudentPageHeader title="Bài tập & Kiểm tra" description={selectedLesson
        ? `Bài ${selectedLesson.number}. ${selectedLesson.title}`
        : "Ưu tiên bài cần làm và theo dõi kết quả đã nộp."} />

      {!hasStudentProfile ? (
        <div className="rounded-2xl border border-line bg-white p-6">
          <p className="text-sm text-secondary">
            Tạo hồ sơ học sinh để xem bài được giao.
          </p>
          <Link
            to="/student/join-class"
            className="mt-3 inline-flex min-h-11 items-center font-bold text-emerald-700"
          >
            Tạo hồ sơ và tham gia lớp
          </Link>
        </div>
      ) : (
        <>
          <div
            role="group"
            aria-label="Lọc trạng thái bài tập"
            className="flex flex-wrap gap-2"
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`min-h-11 rounded-full border px-4 text-sm font-bold ${tab === item.id ? "border-emerald bg-emerald-700 text-white" : "border-line bg-white text-secondary"}`}
              >
                {item.label} (
                {rows.filter((row) => row.group === item.id).length})
              </button>
            ))}
          </div>
          {visibleRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
              <ClipboardList className="mx-auto size-8 text-secondary" />
              <p className="mt-3 text-sm text-secondary">
                {rows.length === 0
                  ? "Chưa có bài được giao trong lớp đang học hoặc bộ lọc này."
                  : tab === "todo"
                    ? "Hiện không có bài còn hạn cần làm. Bạn có thể xem bài đã chấm hoặc hết hạn."
                    : tab === "graded"
                      ? "Chưa có bài đã chấm được công bố."
                      : tab === "submitted"
                        ? "Chưa có bài đã nộp đang chờ công bố kết quả."
                        : "Không có bài hết hạn hoặc chưa khả dụng."}
              </p>
            </div>
          ) : (
            <section aria-label="Danh sách bài tập" className="space-y-3">
              {visibleRows.map(
                ({
                  assignment,
                  submission,
                  deadline,
                  badge,
                  phase,
                  started,
                  group,
                }) => (
                  <article
                    key={assignment.id}
                    className="rounded-2xl border border-line bg-white p-5 shadow-card"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="min-w-0 flex-1 break-words font-extrabold text-ink">
                        {assignment.title}
                      </h2>
                      <StudentStatusBadge label={badge.label} tone={badge.tone} />
                    </div>
                    <p className="mt-2 text-sm text-secondary">
                      Bài tập · {assignment.questions.length} câu
                    </p>
                    <p className="mt-2 text-sm text-secondary">
                      Hạn nộp:{" "}
                      {Number.isFinite(deadline)
                        ? new Intl.DateTimeFormat("vi-VN", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(deadline))
                        : "Chưa có hạn hợp lệ"}
                    </p>
                    {submission &&
                      (getAssignmentResultVisibility(assignment) !==
                      "hidden" ? (
                        <p className="mt-2 text-sm font-bold text-emerald-700">
                          Điểm: {submission.score}/10
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-secondary">
                          Giáo viên chưa công bố kết quả.
                        </p>
                      ))}
                    {submission && submissionStorageStatus !== "saved" && (
                      <p role="status" className="mt-2 text-sm text-red-600">
                        {submissionStorageStatus === "error"
                          ? "Bài nộp chưa lưu được trên trình duyệt. Hãy thử lưu lại trước khi đóng trang."
                          : "Đang lưu bài nộp…"}
                      </p>
                    )}
                    <Link
                      to={`/student/assignments/${assignment.id}`}
                      className={`mt-4 inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold ${group === "todo" ? "bg-emerald-700 text-white" : "border border-line text-ink"}`}
                    >
                      {submission
                        ? "Xem kết quả"
                        : group === "closed"
                          ? "Xem bài"
                          : phase === "draft_error"
                            ? "Kiểm tra bản nháp"
                            : started
                              ? "Tiếp tục làm"
                              : "Bắt đầu làm"}
                    </Link>
                  </article>
                ),
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
