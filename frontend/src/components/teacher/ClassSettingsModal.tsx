import {
  useEffect,
  useRef,
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
import { ApiError } from '../../service/api/client';
import type { CreateClassroomInput, TeacherClassroom } from '../../service/api/classrooms';

import { ClassCoverPicker } from './ClassCoverPicker';

import {
  generateUniqueClassCode,
  getAcademicYearOptions,
  getComparableClassName,
  normalizeClassName,
} from '../../utils/classroom';

interface PrototypeClassSettingsModalProps {
  classroom: Classroom;
  classrooms: Classroom[];
  onClose: () => void;

  onSave: (
    changes: Partial<Classroom>,
  ) => void;

  onToggleArchive: () => void;
  onDelete: () => void;
}

interface BackendClassSettingsModalProps {
  backendClassroom: TeacherClassroom;
  onClose: () => void;
  onSave: (input: CreateClassroomInput) => Promise<void>;
  onArchive: () => Promise<void>;
  onRegenerateCode: () => Promise<void>;
}

export function ClassSettingsModal(props: PrototypeClassSettingsModalProps | BackendClassSettingsModalProps) {
  if ('backendClassroom' in props) return <BackendClassSettingsModal {...props} />;
  return <PrototypeClassSettingsModal {...props} />;
}

function PrototypeClassSettingsModal({
  classroom,
  classrooms,
  onClose,
  onSave,
  onToggleArchive,
  onDelete,
}: PrototypeClassSettingsModalProps) {
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

function BackendClassSettingsModal({ backendClassroom, onClose, onSave, onArchive, onRegenerateCode }: BackendClassSettingsModalProps) {
  const [name, setName] = useState(backendClassroom.name);
  const [academicYear, setAcademicYear] = useState(backendClassroom.academicYear);
  const [description, setDescription] = useState(backendClassroom.description ?? '');
  const [coverImage, setCoverImage] = useState(backendClassroom.coverImage ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [confirmCode, setConfirmCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const submitLock = useRef(false);
  const academicYearOptions = Array.from(new Set([backendClassroom.academicYear, ...getAcademicYearOptions()]));

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitLock.current) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmArchive || confirmCode || submitLock.current) return;
    setFieldErrors({});
    setFormError('');
    const trimmedName = name.trim();
    const coverUrl = coverImage.trim();
    if (trimmedName.length < 2 || trimmedName.length > 255) {
      setFieldErrors({ name: 'Tên lớp phải có từ 2 đến 255 ký tự.' });
      return;
    }
    if (!/^\d{4}-\d{4}$/.test(academicYear)) {
      setFieldErrors({ academic_year: 'Năm học phải có dạng YYYY-YYYY.' });
      return;
    }
    if (coverUrl && (coverUrl.length > 255 || (coverUrl !== (backendClassroom.coverImage ?? '') && !/^https?:\/\//i.test(coverUrl)))) {
      setFieldErrors({ cover_image_path: 'Liên kết ảnh bìa phải là URL http(s) và không quá 255 ký tự.' });
      return;
    }
    submitLock.current = true;
    setSaving(true);
    try {
      await onSave({
        name: trimmedName,
        academic_year: academicYear,
        description: description.trim() || null,
        cover_image_path: coverUrl || null,
      });
    } catch (cause) {
      if (cause instanceof ApiError && Object.keys(cause.errors).length > 0) {
        const errors = Object.fromEntries(Object.entries(cause.errors).map(([key, messages]) => [key, messages[0]]));
        setFieldErrors(errors);
        const otherError = Object.entries(errors).find(([key]) => !['name', 'academic_year', 'description', 'cover_image_path'].includes(key));
        if (otherError) setFormError(otherError[1]);
      } else {
        setFormError(cause instanceof Error ? cause.message : 'Không thể lưu lớp học. Vui lòng thử lại.');
      }
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!confirmArchive || confirmCode || submitLock.current || backendClassroom.status !== 'active') return;
    submitLock.current = true;
    setArchiving(true);
    setArchiveError('');
    try {
      await onArchive();
    } catch (cause) {
      setArchiveError(cause instanceof Error ? cause.message : 'Không thể lưu trữ lớp học. Vui lòng thử lại.');
    } finally {
      submitLock.current = false;
      setArchiving(false);
    }
  };

  const regenerate = async () => {
    if (!confirmCode || confirmArchive || submitLock.current || backendClassroom.status !== 'active') return;
    submitLock.current = true;
    setRegenerating(true);
    setCodeError('');
    try {
      await onRegenerateCode();
    } catch (cause) {
      setCodeError(cause instanceof Error ? cause.message : 'Không thể đổi mã lớp. Vui lòng thử lại.');
    } finally {
      submitLock.current = false;
      setRegenerating(false);
    }
  };

  const busy = saving || archiving || regenerating;

  return <div role="dialog" aria-modal="true" aria-labelledby="class-settings-title"
    onClick={() => { if (!submitLock.current) onClose(); }}
    className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm">
    <form onSubmit={(event) => void submit(event)} onClick={(event) => event.stopPropagation()} noValidate
      className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-line p-5 sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="size-5 text-emerald" aria-hidden="true" />
            <h2 id="class-settings-title" className="text-xl font-extrabold text-ink">Cài đặt lớp học</h2>
          </div>
          <p className="mt-1 text-sm text-secondary">Chỉnh sửa thông tin và quản lý trạng thái lớp học.</p>
        </div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Đóng"
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-slate-100 hover:text-ink disabled:opacity-50">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <label htmlFor="settings-class-name" className="text-sm font-bold text-ink">Tên lớp</label>
          <input id="settings-class-name" value={name} onChange={(event) => { setName(event.target.value); setFieldErrors((current) => ({ ...current, name: '' })); }}
            maxLength={255} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'settings-class-name-error' : undefined}
            className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10" />
          {fieldErrors.name && <p id="settings-class-name-error" role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.name}</p>}
        </div>
        <div>
          <label htmlFor="settings-academic-year" className="text-sm font-bold text-ink">Năm học</label>
          <select id="settings-academic-year" value={academicYear} onChange={(event) => { setAcademicYear(event.target.value); setFieldErrors((current) => ({ ...current, academic_year: '' })); }}
            aria-invalid={Boolean(fieldErrors.academic_year)}
            className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10">
            {academicYearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          {fieldErrors.academic_year && <p role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.academic_year}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="settings-description" className="text-sm font-bold text-ink">Mô tả lớp</label>
            <span className="text-xs text-muted">{description.length} ký tự</span>
          </div>
          <textarea id="settings-description" value={description} onChange={(event) => { setDescription(event.target.value); setFieldErrors((current) => ({ ...current, description: '' })); }} rows={4}
            aria-invalid={Boolean(fieldErrors.description)}
            className="mt-2 w-full resize-none rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10" />
          {fieldErrors.description && <p role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.description}</p>}
        </div>
        <div>
          <label htmlFor="settings-cover-url" className="text-sm font-bold text-ink">Liên kết ảnh bìa (không bắt buộc)</label>
          <input id="settings-cover-url" type="url" value={coverImage} onChange={(event) => { setCoverImage(event.target.value); setFieldErrors((current) => ({ ...current, cover_image_path: '' })); }}
            maxLength={255} placeholder="https://example.com/anh-bia.jpg" aria-invalid={Boolean(fieldErrors.cover_image_path)}
            className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10" />
          {fieldErrors.cover_image_path && <p role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.cover_image_path}</p>}
        </div>
        {formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>}
        {backendClassroom.status === 'active' && <div className="border-t border-line pt-5">
          <h3 className="font-extrabold text-ink">Mã lớp</h3>
          <p className="mt-2 text-sm leading-6 text-secondary">Mã hiện tại: <strong>{backendClassroom.code}</strong>. Đổi mã sẽ khiến mã cũ ngừng dùng được để tra lớp hoặc gửi yêu cầu mới. Thành viên và yêu cầu đang chờ được giữ nguyên.</p>
          {!confirmCode ? <button type="button" disabled={busy || confirmArchive} onClick={() => { setConfirmCode(true); setCodeError(''); }}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className="size-4" aria-hidden="true" />Đổi mã lớp
          </button> : <div role="group" aria-label="Xác nhận đổi mã lớp" className="mt-4 rounded-xl border border-line bg-slate-50 p-4">
            <p className="font-bold text-ink">Xác nhận đổi mã của {backendClassroom.name}?</p>
            <p className="mt-1 text-sm text-secondary">Mã cũ sẽ ngừng hoạt động ngay sau khi Backend xác nhận. Thay đổi thông tin chưa lưu sẽ không được áp dụng.</p>
            {codeError && <p role="alert" className="mt-3 text-sm text-red-700">{codeError}</p>}
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" disabled={busy} onClick={() => { setConfirmCode(false); setCodeError(''); }} className="min-h-11 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink disabled:opacity-50">Hủy đổi mã</button>
              <button type="button" disabled={busy} onClick={() => void regenerate()} className="min-h-11 rounded-full bg-emerald px-5 text-sm font-bold text-white disabled:opacity-50">{regenerating ? 'Đang đổi mã…' : 'Xác nhận đổi mã'}</button>
            </div>
          </div>}
        </div>}
        {backendClassroom.status === 'active' && <div className="border-t border-line pt-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />
            <h3 className="font-extrabold text-ink">Quản lý trạng thái lớp</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-secondary">Khi lưu trữ, học sinh đang tham gia sẽ rời lớp và yêu cầu tham gia đang chờ sẽ bị từ chối. Lịch sử lớp và thành viên vẫn được giữ lại. Bạn có thể khôi phục lớp sau đó, nhưng học sinh sẽ không tự tham gia lại.</p>
          {!confirmArchive ? <button type="button" disabled={busy || confirmCode}
            onClick={() => { setConfirmArchive(true); setArchiveError(''); }}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50">
            <Archive className="size-4" aria-hidden="true" />Lưu trữ lớp
          </button> : <div role="group" aria-label="Xác nhận lưu trữ lớp" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-bold text-amber-900">Xác nhận lưu trữ {backendClassroom.name}?</p>
            <p className="mt-1 text-sm leading-6 text-amber-800">Có thể khôi phục lớp sau khi lưu trữ, nhưng membership đã rời và yêu cầu đã bị từ chối sẽ không tự được phục hồi. Thay đổi thông tin chưa lưu sẽ không được áp dụng.</p>
            {archiveError && <p role="alert" className="mt-3 text-sm text-red-700">{archiveError}</p>}
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" disabled={busy} onClick={() => { setConfirmArchive(false); setArchiveError(''); }}
                className="min-h-11 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink disabled:opacity-50">Hủy lưu trữ</button>
              <button type="button" disabled={busy} onClick={() => void archive()}
                className="min-h-11 rounded-full bg-amber-700 px-5 text-sm font-bold text-white disabled:opacity-50">{archiving ? 'Đang lưu trữ…' : 'Xác nhận lưu trữ'}</button>
            </div>
          </div>}
        </div>}
      </div>
      <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-line bg-white p-5 sm:flex-row sm:justify-end sm:p-6">
        <button type="button" onClick={onClose} disabled={busy}
          className="min-h-11 rounded-full border border-line px-6 text-sm font-bold text-ink transition hover:bg-slate-50 disabled:opacity-50">Hủy</button>
        <button type="submit" disabled={busy || confirmArchive || confirmCode}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald px-6 text-sm font-bold text-white transition hover:bg-emerald/90 disabled:cursor-not-allowed disabled:opacity-50">
          <Save className="size-4" aria-hidden="true" />{saving ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  </div>;
}
