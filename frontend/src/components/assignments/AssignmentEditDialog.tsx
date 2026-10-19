import type { AssignmentV2, AssignmentContent } from "../../types/assignment";
import type { Classroom } from "../../types/teacher";
import Dialog from "../common/Dialog";
import { AssignmentContentEditor } from "./AssignmentContent";

type AssignmentEditDialogProps = {
  assignment: Pick<AssignmentV2, "id" | "title" | "status">;
  submissionCount: number;
  isStructureLocked: boolean;
  values: {
    title: string;
    classroomId: string;
    questionIds: string[];
    deadline: string;
    content: AssignmentContent;
    error: string;
  };
  classrooms: Classroom[];
  bankQuestions: { id: string; content: string }[];
  savedQuestions: { id: string; content: string }[];
  onTitleChange: (value: string) => void;
  onClassroomChange: (id: string) => void;
  onDeadlineChange: (value: string) => void;
  onContentChange: (value: AssignmentContent) => void;
  onProcessingChange: (processing: boolean) => void;
  onToggleQuestion: (id: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export function AssignmentEditDialog({
  assignment, submissionCount, isStructureLocked, values, classrooms,
  bankQuestions, savedQuestions, onTitleChange, onClassroomChange,
  onDeadlineChange, onContentChange, onProcessingChange, onToggleQuestion,
  onSave, onClose,
}: AssignmentEditDialogProps) {
  return (
    <Dialog title={`Chỉnh sửa: ${assignment.title}`} onClose={onClose}>
      <div className="mt-4 space-y-4 rounded-xl bg-slate-50 p-4">
        {isStructureLocked && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Bài tập đã có <strong>{submissionCount} bài nộp</strong>. Để không
            làm sai điểm đã chấm, bạn chỉ có thể thay đổi{" "}
            <strong>tên bài tập và hạn nộp</strong>.
          </div>
        )}
        <label className="block text-sm font-bold text-ink">
          Tên bài tập
          <input
            value={values.title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-4 font-normal outline-none focus:border-emerald"
          />
        </label>

        <label className="block text-sm font-bold text-ink">
          Lớp nhận bài
          <select
            value={values.classroomId}
            onChange={(event) => onClassroomChange(event.target.value)}
            disabled={isStructureLocked}
            className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-4 font-normal outline-none focus:border-emerald disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-muted"
          >
            <option value="">Chọn lớp học</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
              </option>
            ))}
          </select>
        </label>

        {assignment.status === "published" && (
          <label className="block text-sm font-bold text-ink">
            Hạn nộp
            <input
              type="datetime-local"
              value={values.deadline}
              onChange={(event) => onDeadlineChange(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-4 font-normal outline-none focus:border-emerald"
            />
            <span className="mt-1 block text-xs font-normal text-secondary">
              Thay đổi hạn nộp sẽ được cập nhật ngay cho học sinh.
            </span>
          </label>
        )}

        <AssignmentContentEditor
          key={assignment.id}
          value={values.content}
          onChange={onContentChange}
          disabled={isStructureLocked}
          onProcessingChange={onProcessingChange}
        />

        <fieldset>
          <legend className="text-sm font-bold text-ink">
            Câu hỏi trong bài tập
          </legend>

          <p className="mt-1 text-sm text-secondary">
            Đã chọn {values.questionIds.length} câu.
          </p>

          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {bankQuestions.map((question) => (
              <label
                key={question.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3"
              >
                <input
                  type="checkbox"
                  checked={values.questionIds.includes(question.id)}
                  disabled={isStructureLocked}
                  onChange={() => onToggleQuestion(question.id)}
                  className="mt-1 size-4 accent-emerald"
                />

                <span className="text-sm text-ink">
                  {question.content}
                </span>
              </label>
            ))}

            {savedQuestions.map((savedQuestion) => (
              <label
                key={savedQuestion.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber/40 bg-amber/5 p-3"
              >
                <input
                  type="checkbox"
                  checked={values.questionIds.includes(savedQuestion.id)}
                  disabled={isStructureLocked}
                  onChange={() => onToggleQuestion(savedQuestion.id)}
                  className="mt-1 size-4 accent-emerald"
                />

                <span className="text-sm text-ink">
                  {savedQuestion.content}

                  <span className="mt-1 block text-sm text-secondary">
                    Câu này đã bị xóa khỏi ngân hàng, nhưng vẫn lưu trong bài
                    tập.
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {values.error && (
          <p role="alert" className="text-sm text-red-600">
            {values.error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSave}
            className="rounded-full bg-emerald px-5 py-2 text-sm font-bold text-white"
          >
            Lưu thay đổi
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line bg-white px-5 py-2 text-sm font-bold text-ink"
          >
            Hủy
          </button>
        </div>
      </div>
    </Dialog>
  );
}
