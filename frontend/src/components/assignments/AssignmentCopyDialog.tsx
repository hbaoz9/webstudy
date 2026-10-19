import type { FormEvent } from "react";
import type { Classroom } from "../../types/teacher";
import Dialog from "../common/Dialog";
import { AssignmentClassPicker } from "./AssignmentClassPicker";

type AssignmentCopyDialogProps = {
  sourceTitle: string;
  copyTitle: string;
  copyClasses: string[];
  copyError: string;
  classrooms: Classroom[];
  onTitleChange: (value: string) => void;
  onClassesChange: (ids: string[]) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AssignmentCopyDialog({
  sourceTitle,
  copyTitle,
  copyClasses,
  copyError,
  classrooms,
  onTitleChange,
  onClassesChange,
  onClose,
  onSubmit,
}: AssignmentCopyDialogProps) {
  return (
    <Dialog
      title={`Nhân bản: ${sourceTitle}`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <p className="text-sm text-secondary">
          Giữ bản sao câu hỏi và nội dung của bài gốc. Các bản mới là nháp,
          không có bài nộp, điểm hoặc hạn cũ.
        </p>
        <label className="block text-sm font-bold">
          Tên bản sao
          <input
            value={copyTitle}
            onChange={(event) => onTitleChange(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
        <AssignmentClassPicker
          classrooms={classrooms}
          value={copyClasses}
          onChange={onClassesChange}
        />
        {copyError && (
          <p role="alert" className="text-sm text-red-700">
            {copyError}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-emerald px-4 text-sm font-bold text-white"
          >
            Tạo {copyClasses.length} bản nháp
          </button>
        </div>
      </form>
    </Dialog>
  );
}
