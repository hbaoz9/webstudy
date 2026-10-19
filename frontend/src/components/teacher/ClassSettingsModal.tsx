import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  X,
} from 'lucide-react';

import type {
  Classroom,
} from '../../types/teacher';

import { ClassCoverPicker } from './ClassCoverPicker';

import {
  generateUniqueClassCode,
  getAcademicYearOptions,
  getComparableClassName,
  normalizeClassName,
} from '../../utils/classroom';

interface ClassSettingsModalProps {
  classroom: Classroom;
  classrooms: Classroom[];
  onClose: () => void;

  onSave: (
    changes: Partial<Classroom>,
  ) => void;

  onToggleArchive: () => void;
  onDelete: () => void;
}

export function ClassSettingsModal({
  classroom,
  classrooms,
  onClose,
  onSave,
  onToggleArchive,
  onDelete,
}: ClassSettingsModalProps) {
  const defaultAcademicYear =
    classroom.academicYear ??
    getAcademicYearOptions()[1];

  const [
    classNameValue,
    setClassNameValue,
  ] = useState(
    normalizeClassName(
      classroom.name,
    ),
  );

  const [
    academicYear,
    setAcademicYear,
  ] = useState(
    defaultAcademicYear,
  );

  const [
    description,
    setDescription,
  ] = useState(
    classroom.description ?? '',
  );

  const [
    classCode,
    setClassCode,
  ] = useState(classroom.code);

  const [coverImage, setCoverImage] = useState(classroom.coverImage ?? '');
  const [isCoverValid, setIsCoverValid] = useState(true);
  const [isProcessingCover, setIsProcessingCover] = useState(false);

  const [
    formError,
    setFormError,
  ] = useState('');

  const [
    showDeleteConfirmation,
    setShowDeleteConfirmation,
  ] = useState(false);

  const [
    deleteConfirmation,
    setDeleteConfirmation,
  ] = useState('');

  const canDelete =
    deleteConfirmation.trim() ===
    classroom.name;

  const academicYearOptions =
    Array.from(
      new Set([
        defaultAcademicYear,
        ...getAcademicYearOptions(),
      ]),
    );

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [onClose]);

  const handleRegenerateCode = () => {
    const nextCode =
      generateUniqueClassCode(
        classrooms.map(
          (item) => item.code,
        ),
      );

    setClassCode(nextCode);
    setFormError('');
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setFormError('');

    if (isProcessingCover || !isCoverValid) {
      return;
    }

    const normalizedClassName =
      normalizeClassName(
        classNameValue,
      );

    if (
      normalizedClassName.length < 2
    ) {
      setFormError(
        'Tên lớp phải có ít nhất 2 ký tự.',
      );

      return;
    }

    if (
      normalizedClassName.length > 30
    ) {
      setFormError(
        'Tên lớp không được vượt quá 30 ký tự.',
      );

      return;
    }

    const duplicateClass =
      classrooms.some(
        (item) =>
          item.id !== classroom.id &&
          getComparableClassName(
            item.name,
          ) ===
            getComparableClassName(
              normalizedClassName,
            ) &&
          item.academicYear ===
            academicYear,
      );

    if (duplicateClass) {
      setFormError(
        `Lớp ${normalizedClassName} đã tồn tại trong năm học ${academicYear}.`,
      );

      return;
    }

    onSave({
      name: `Lớp ${normalizedClassName}`,
      academicYear,
      description:
        description.trim(),
      code: classCode,
      coverImage: coverImage.trim(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="class-settings-title"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) =>
          event.stopPropagation()
        }
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5 sm:p-6">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="size-5 text-emerald" />

              <h2
                id="class-settings-title"
                className="text-xl font-extrabold text-ink"
              >
                Cài đặt lớp học
              </h2>
            </div>

            <p className="mt-1 text-sm text-secondary">
              Chỉnh sửa thông tin, ảnh bìa và mã
              truy cập của lớp.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-slate-100 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <label
              htmlFor="settings-class-name"
              className="text-sm font-bold text-ink"
            >
              Tên lớp
            </label>

            <div className="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-line bg-white focus-within:border-emerald focus-within:ring-2 focus-within:ring-emerald/10">
              <span className="flex items-center border-r border-line bg-slate-50 px-4 text-sm font-semibold text-secondary">
                Lớp
              </span>

              <input
                id="settings-class-name"
                value={classNameValue}
                onChange={(event) => {
                  setClassNameValue(
                    event.target.value,
                  );

                  setFormError('');
                }}
                maxLength={30}
                className="min-w-0 flex-1 px-4 text-sm text-ink outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="settings-academic-year"
              className="text-sm font-bold text-ink"
            >
              Năm học
            </label>

            <select
              id="settings-academic-year"
              value={academicYear}
              onChange={(event) => {
                setAcademicYear(
                  event.target.value,
                );

                setFormError('');
              }}
              className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10"
            >
              {academicYearOptions.map(
                (option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="settings-description"
                className="text-sm font-bold text-ink"
              >
                Mô tả lớp
              </label>

              <span className="text-xs text-muted">
                {description.length}/200
              </span>
            </div>

            <textarea
              id="settings-description"
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              rows={4}
              maxLength={200}
              className="mt-2 w-full resize-none rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10"
            />
          </div>

          <section aria-labelledby="settings-cover-title">
            <h3 id="settings-cover-title" className="text-sm font-bold text-ink">
              Ảnh bìa lớp
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted">
              Chọn ảnh từ máy hoặc dán liên kết. Ảnh chỉ được cập nhật khi lưu thay đổi.
            </p>
            <ClassCoverPicker
              value={coverImage}
              onChange={setCoverImage}
              onValidityChange={setIsCoverValid}
              onProcessingChange={setIsProcessingCover}
            />
          </section>

          <div className="rounded-xl border border-line bg-slate-50 p-4">
            <p className="text-sm font-bold text-ink">
              Mã lớp
            </p>

            <p className="mt-1 text-xs leading-5 text-muted">
              Nếu tạo mã mới, học sinh
              chưa tham gia sẽ phải sử dụng
              mã mới.
            </p>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="flex min-h-11 flex-1 items-center rounded-xl border border-line bg-white px-4 font-extrabold tracking-[0.2em] text-ink">
                {classCode}
              </div>

              <button
                type="button"
                onClick={
                  handleRegenerateCode
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:border-emerald hover:text-emerald"
              >
                <RefreshCw className="size-4" />
                Tạo mã mới
              </button>
            </div>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {formError}
            </div>
          )}

          <div className="border-t border-line pt-5">
            <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-600" />

                <h3 className="font-extrabold text-ink">
                Quản lý trạng thái lớp
                </h3>
            </div>

            <p className="mt-2 text-sm leading-6 text-secondary">
                Lưu trữ có thể hoàn tác. Xóa lớp
                sẽ loại bỏ toàn bộ dữ liệu liên quan
                trên thiết bị này.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                type="button"
                onClick={onToggleArchive}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-700 transition hover:bg-amber-100"
                >
                {classroom.status ===
                'archived' ? (
                    <>
                    <ArchiveRestore className="size-4" />
                    Khôi phục lớp
                    </>
                ) : (
                    <>
                    <Archive className="size-4" />
                    Lưu trữ lớp
                    </>
                )}
                </button>

                <button
                type="button"
                onClick={() => {
                    setShowDeleteConfirmation(
                    true,
                    );

                    setDeleteConfirmation('');
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-600 transition hover:bg-red-100"
                >
                <Trash2 className="size-4" />
                Xóa lớp
                </button>
            </div>

            {showDeleteConfirmation && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="font-bold text-red-700">
                    Xác nhận xóa lớp
                </p>

                <p className="mt-2 text-sm leading-6 text-red-600">
                    Nhập chính xác{' '}
                    <strong>
                    {classroom.name}
                    </strong>{' '}
                    để xác nhận. Hành động này
                    không thể hoàn tác.
                </p>

                <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(event) =>
                    setDeleteConfirmation(
                        event.target.value,
                    )
                    }
                    placeholder={classroom.name}
                    className="mt-3 min-h-11 w-full rounded-xl border border-red-200 bg-white px-4 text-sm text-ink outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />

                <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                    type="button"
                    onClick={() => {
                        setShowDeleteConfirmation(
                        false,
                        );

                        setDeleteConfirmation('');
                    }}
                    className="min-h-10 rounded-full border border-line bg-white px-4 text-sm font-bold text-ink"
                    >
                    Hủy xóa
                    </button>

                    <button
                    type="button"
                    disabled={!canDelete}
                    onClick={onDelete}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                    <Trash2 className="size-4" />
                    Xóa vĩnh viễn
                    </button>
                </div>
                </div>
            )}
            </div>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-line bg-white p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-line px-6 text-sm font-bold text-ink transition hover:bg-slate-50"
          >
            Hủy
          </button>

          <button
            type="submit"
            disabled={isProcessingCover || !isCoverValid}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald px-6 text-sm font-bold text-white transition hover:bg-emerald/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="size-4" />
            {isProcessingCover ? 'Đang xử lý ảnh...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  );
}
