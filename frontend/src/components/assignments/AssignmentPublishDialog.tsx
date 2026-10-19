import Dialog from "../common/Dialog";

type AssignmentPublishDialogProps = {
  publishingCount: number;
  assignmentTitle: string;
  classroomNames: string;
  deadline: string;
  errorMessage?: string;
  onDeadlineChange: (value: string) => void;
  onClose: () => void;
  onPublish: () => void;
};

export function AssignmentPublishDialog({
  publishingCount,
  assignmentTitle,
  classroomNames,
  deadline,
  errorMessage,
  onDeadlineChange,
  onClose,
  onPublish,
}: AssignmentPublishDialogProps) {
  return (
    <Dialog
      title={
        publishingCount > 1
          ? `Giao ${publishingCount} bản bài tập`
          : `Giao bài: ${assignmentTitle}`
      }
      onClose={onClose}
    >
      <p className="mb-4 text-sm text-secondary">
        Các bản sẽ được giao cùng hạn cho:{" "}
        {classroomNames}
        .
      </p>
      <label className="block text-sm font-semibold">
        Hạn nộp
        <input
          aria-label="Hạn nộp"
          type="datetime-local"
          value={deadline}
          onChange={(event) => onDeadlineChange(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-xl border border-line px-3"
        />
      </label>
      {errorMessage !== undefined && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={onPublish}
          className="min-h-11 rounded-xl bg-emerald px-4 text-sm font-bold text-white"
        >
          {publishingCount > 1
            ? `Giao cho ${publishingCount} lớp`
            : "Giao bài"}
        </button>
      </div>
    </Dialog>
  );
}
