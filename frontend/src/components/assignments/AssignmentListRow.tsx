import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import AssignmentActions from "../teacher/AssignmentActions";
import type { AssignmentV2 as Assignment } from "../../types/assignment";

type AssignmentListRowProps = {
  assignment: Assignment;
  classroomName: string;
  isClassroomArchived: boolean;
  status: "Bản nháp" | "Đang mở" | "Đã hết hạn";
  soon: boolean;
  submittedCount: number;
  joinedStudentCount: number;
  progressMax: number;
  average: string;
  detailHref: string;
  deadlineTitle: string;
  deadlineLabel: string;
  onEdit: (assignment: Assignment) => void;
  onCopy: (assignment: Assignment) => void;
  onPublish: (assignment: Assignment) => void;
  onDelete: (assignment: Assignment) => void;
};

export function AssignmentListRow({
  assignment,
  classroomName,
  isClassroomArchived,
  status,
  soon,
  submittedCount,
  joinedStudentCount,
  progressMax,
  average,
  detailHref,
  deadlineTitle,
  deadlineLabel,
  onEdit,
  onCopy,
  onPublish,
  onDelete,
}: AssignmentListRowProps) {
  return (
    <article
      key={assignment.id}
      className="flex min-w-0 items-center gap-2 border-b border-line px-3 last:border-b-0"
    >
      <Link
        to={detailHref}
        aria-label={`${assignment.title} · ${classroomName} · ${status} · ${submittedCount}/${joinedStudentCount} đã nộp · Điểm TB ${average}`}
        title={`${assignment.title} · ${classroomName} · ${deadlineTitle}`}
        className="grid min-h-14 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-lg px-1 py-2 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 md:grid-cols-[minmax(0,1fr)_5.5rem_8rem_5.5rem_4.5rem]"
      >
        <div className="col-span-2 min-w-0 md:col-span-1">
          <h2 className="truncate text-sm font-bold text-ink">
            {assignment.title}
          </h2>
          <p className="mt-1 truncate text-[13px] text-secondary">
            <span
              className={
                status === "Đang mở"
                  ? "text-emerald-800"
                  : status === "Đã hết hạn"
                    ? "text-red-800"
                    : "text-amber-900"
              }
            >
              {status}
            </span>{" "}
            · {assignment.questions.length} câu
            <span className="md:hidden"> · {classroomName}</span>
          </p>
        </div>
        <span
          title={
            isClassroomArchived
              ? `${classroomName} · Đã lưu trữ`
              : classroomName
          }
          className="hidden truncate text-[13px] text-secondary md:block"
        >
          {classroomName}
          {isClassroomArchived
            ? " · Đã lưu trữ"
            : ""}
        </span>
        <span
          title={deadlineTitle}
          className={`truncate rounded-lg px-2 py-1 text-center text-[13px] ${soon ? "bg-amber-50 font-semibold text-amber-900" : status === "Đã hết hạn" ? "bg-red-50 text-red-800" : "text-secondary"}`}
        >
          {deadlineLabel}
        </span>
        <span className="flex items-center justify-end gap-2 text-[13px] text-secondary md:justify-start">
          <progress
            aria-label={`Tiến độ ${assignment.title}`}
            value={submittedCount}
            max={progressMax}
            className="hidden h-1.5 w-6 accent-emerald md:block"
          />
          {submittedCount}/{joinedStudentCount}
          <span className="md:hidden"> · TB {average}</span>
        </span>
        <span className="hidden text-[13px] font-semibold text-emerald-800 md:block">
          {average}
        </span>
      </Link>
      <details className="relative shrink-0">
        <summary
          aria-label={`Thao tác bài ${assignment.title}`}
          className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-xl border border-line"
        >
          <MoreHorizontal aria-hidden="true" className="size-5" />
        </summary>
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-line bg-white p-2 shadow-lg">
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget
                .closest("details")
                ?.removeAttribute("open");
              onEdit(assignment);
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-ink hover:bg-canvas"
          >
            <Pencil aria-hidden="true" className="size-4" />
            Chỉnh sửa
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget
                .closest("details")
                ?.removeAttribute("open");
              onCopy(assignment);
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-ink hover:bg-canvas"
          >
            <Copy aria-hidden="true" className="size-4" />
            Nhân bản
          </button>
          <AssignmentActions
            assignment={assignment}
            variant="menu"
          />
          {assignment.status === "draft" && (
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget
                  .closest("details")
                  ?.removeAttribute("open");
                onPublish(assignment);
              }}
              className="flex min-h-11 w-full items-center rounded-lg px-2 text-left text-sm font-semibold text-emerald-800 hover:bg-canvas"
            >
              Giao bài
            </button>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget
                .closest("details")
                ?.removeAttribute("open");
              onDelete(assignment);
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg border-t border-line px-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Xóa bài tập
          </button>
        </div>
      </details>
    </article>
  );
}
