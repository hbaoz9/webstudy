import {
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  FileCheck2,
  FileUp,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import {
  useTeacherAccount,
} from '../../contexts/TeacherAccountContext';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError, apiRequest } from '../../service/api/client';

import type {
  VerificationDocument,
} from '../../types/teacherAccount';

const MAX_DOCUMENT_SIZE =
  5 * 1024 * 1024;

const ACCEPTED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

function formatFileSize(
  size: number,
) {
  if (size < 1024 * 1024) {
    return `${Math.ceil(
      size / 1024,
    )} KB`;
  }

  return `${(
    size /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function formatDateTime(
  value?: string,
) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'vi-VN',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(new Date(value));
}

export default function TeacherVerificationPage() {
  const {
    teacherAccount,
    submitVerification,
  } = useTeacherAccount();
  const { session, refreshSession } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const previousSubmission =
    teacherAccount.submission;

  const [
    fullName,
    setFullName,
  ] = useState(
    previousSubmission?.fullName ??
      teacherAccount.profile?.name ?? '',
  );

  const [
    schoolName,
    setSchoolName,
  ] = useState(
    previousSubmission?.schoolName ??
      '',
  );

  const [
    schoolAddress,
    setSchoolAddress,
  ] = useState(
    previousSubmission
      ?.schoolAddress ?? '',
  );

  const [
    teacherCode,
    setTeacherCode,
  ] = useState(
    previousSubmission?.teacherCode ??
      '',
  );

  const [
    position,
    setPosition,
  ] = useState(
    previousSubmission?.position ??
      'Giáo viên',
  );

  const [
    selectedDocument,
    setSelectedDocument,
  ] =
    useState<VerificationDocument | null>(
      previousSubmission?.document ??
        null,
    );

  const [
    hasConfirmed,
    setHasConfirmed,
  ] = useState(false);

  const [
    formError,
    setFormError,
  ] = useState('');

  const status = session?.teacherVerificationStatus ?? 'unverified';

  const handleDocumentChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    setFormError('');

    if (
      !ACCEPTED_DOCUMENT_TYPES.includes(
        file.type,
      )
    ) {
      setFormError(
        'Chỉ chấp nhận file PDF, JPG hoặc PNG.',
      );

      return;
    }

    if (
      file.size >
      MAX_DOCUMENT_SIZE
    ) {
      setFormError(
        'Minh chứng không được lớn hơn 5 MB.',
      );

      return;
    }

    // BE-03 chỉ nhận metadata của file; nội dung file chưa được tải lên.
    setSelectedDocument({
      name: file.name,
      type: file.type,
      size: file.size,
    });
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setFormError('');

    if (fullName.trim().length < 2) {
      setFormError(
        'Vui lòng nhập họ và tên giáo viên.',
      );

      return;
    }

    if (schoolName.trim().length < 2) {
      setFormError(
        'Vui lòng nhập tên trường.',
      );

      return;
    }

    if (
      schoolAddress.trim().length < 5
    ) {
      setFormError(
        'Vui lòng nhập địa chỉ trường.',
      );

      return;
    }

    if (!selectedDocument) {
      setFormError(
        'Vui lòng tải lên ít nhất một minh chứng.',
      );

      return;
    }

    if (!hasConfirmed) {
      setFormError(
        'Bạn cần xác nhận thông tin đã cung cấp là chính xác.',
      );

      return;
    }

    const payload = {
      fullName:
        fullName.trim(),

      schoolName:
        schoolName.trim(),

      schoolAddress:
        schoolAddress.trim(),

      teacherCode:
        teacherCode.trim() ||
        undefined,

      position,
      document:
        selectedDocument,
    };
    setSubmitting(true);
    try {
      await apiRequest('/teacher/verification', 'POST', {
        full_name: payload.fullName,
        school_name: payload.schoolName,
        school_address: payload.schoolAddress,
        teacher_code: payload.teacherCode,
        position: payload.position,
        document: payload.document,
      });
      submitVerification(payload);
      await refreshSession();
    } catch (cause) {
      const validation = cause instanceof ApiError ? Object.values(cause.errors).flat()[0] : undefined;
      setFormError(validation ?? (cause instanceof Error ? cause.message : 'Không thể gửi hồ sơ xác minh.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/teacher/dashboard"
        className="inline-flex items-center gap-2 text-sm font-bold text-secondary transition hover:text-emerald"
      >
        <ArrowLeft className="size-4" />
        Quay lại Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold text-ink">
          Xác minh tài khoản giáo viên
        </h1>

        <p className="mt-2 text-sm leading-6 text-secondary">
          Xác minh giúp bảo vệ học sinh
          và giới hạn quyền tạo lớp cho
          giáo viên hợp lệ.
        </p>
      </div>

      {/* Đang chờ duyệt */}
      {status === 'pending' && (
        <section className="rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-card sm:p-8">
          <span className="mx-auto grid size-20 place-items-center rounded-full bg-amber/10 text-amber-600">
            <Clock3 className="size-9" />
          </span>

          <h2 className="mt-5 text-xl font-extrabold text-ink">
            Hồ sơ đang được xem xét
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-secondary">
            Hệ thống đã tiếp nhận hồ sơ
            xác minh của bạn. Bạn vẫn có
            thể sử dụng các chức năng
            không yêu cầu quyền tạo lớp.
          </p>

          {previousSubmission && (
            <div className="mx-auto mt-6 max-w-xl rounded-xl border border-line bg-slate-50 p-4 text-left text-sm">
              <p className="font-bold text-ink">
                {previousSubmission.schoolName}
              </p>

              <p className="mt-1 text-secondary">
                {previousSubmission.position}
                {previousSubmission.teacherCode
                  ? ` · Mã GV: ${previousSubmission.teacherCode}`
                  : ''}
              </p>

              <p className="mt-2 text-xs text-muted">
                Gửi lúc{' '}
                {formatDateTime(
                  previousSubmission.submittedAt,
                )}
              </p>
            </div>
          )}

        </section>
      )}

      {/* Đã xác minh */}
      {status === 'verified' && (
        <section className="rounded-2xl border border-emerald/30 bg-white p-6 text-center shadow-card sm:p-8">
          <span className="mx-auto grid size-20 place-items-center rounded-full bg-emerald/10 text-emerald">
            <BadgeCheck className="size-10" />
          </span>

          <h2 className="mt-5 text-xl font-extrabold text-ink">
            Tài khoản đã được xác minh
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-secondary">
            Bạn có thể tạo lớp, quản lý
            học sinh và sử dụng đầy đủ
            công cụ dành cho giáo viên.
          </p>

          {teacherAccount.verifiedAt && (
            <p className="mt-3 text-xs text-muted">
              Xác minh lúc{' '}
              {formatDateTime(
                teacherAccount.verifiedAt,
              )}
            </p>
          )}

          <Link
            to="/teacher/dashboard"
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald px-6 text-sm font-bold text-white"
          >
            <ShieldCheck className="size-4" />
            Về Dashboard
          </Link>

        </section>
      )}

      {/* Form chưa xác minh hoặc gửi lại */}
      {(status === 'unverified' ||
        status === 'rejected') && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6"
        >
          {status === 'rejected' && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-600" />

              <div>
                <p className="font-bold text-red-700">
                  Hồ sơ chưa được chấp nhận
                </p>

                <p className="mt-1 text-sm leading-6 text-red-600">
                  {teacherAccount
                    .rejectionReason ??
                    'Vui lòng kiểm tra và gửi lại thông tin.'}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 border-b border-line pb-5">
            <span className="grid size-11 place-items-center rounded-xl bg-emerald/10 text-emerald">
              <ShieldCheck className="size-5" />
            </span>

            <div>
              <h2 className="font-extrabold text-ink">
                {status === 'rejected'
                  ? 'Gửi lại hồ sơ'
                  : 'Thông tin xác minh'}
              </h2>

              <p className="mt-1 text-xs text-muted">
                Các trường có dấu * là bắt buộc.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="verification-full-name"
                className="text-sm font-bold text-ink"
              >
                Họ và tên *
              </label>

              <input
                id="verification-full-name"
                value={fullName}
                onChange={(event) =>
                  setFullName(
                    event.target.value,
                  )
                }
                className="mt-2 min-h-12 w-full rounded-xl border border-line px-4 text-sm text-ink outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/10"
              />
            </div>

            <div>
              <label
                htmlFor="verification-position"
                className="text-sm font-bold text-ink"
              >
                Vị trí công tác *
              </label>

              <select
                id="verification-position"
                value={position}
                onChange={(event) =>
                  setPosition(
                    event.target.value,
                  )
                }
                className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/10"
              >
                <option value="Giáo viên">
                  Giáo viên
                </option>

                <option value="Tổ trưởng chuyên môn">
                  Tổ trưởng chuyên môn
                </option>

                <option value="Giáo viên thỉnh giảng">
                  Giáo viên thỉnh giảng
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="verification-school-name"
                className="text-sm font-bold text-ink"
              >
                Tên trường *
              </label>

              <input
                id="verification-school-name"
                value={schoolName}
                onChange={(event) =>
                  setSchoolName(
                    event.target.value,
                  )
                }
                placeholder="Ví dụ: THPT Nguyễn Du"
                className="mt-2 min-h-12 w-full rounded-xl border border-line px-4 text-sm text-ink outline-none placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10"
              />
            </div>

            <div>
              <label
                htmlFor="verification-teacher-code"
                className="text-sm font-bold text-ink"
              >
                Mã giáo viên
              </label>

              <input
                id="verification-teacher-code"
                value={teacherCode}
                onChange={(event) =>
                  setTeacherCode(
                    event.target.value,
                  )
                }
                placeholder="Không bắt buộc"
                className="mt-2 min-h-12 w-full rounded-xl border border-line px-4 text-sm text-ink outline-none placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10"
              />
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="verification-school-address"
              className="text-sm font-bold text-ink"
            >
              Địa chỉ trường *
            </label>

            <input
              id="verification-school-address"
              value={schoolAddress}
              onChange={(event) =>
                setSchoolAddress(
                  event.target.value,
                )
              }
              placeholder="Địa chỉ đang công tác"
              className="mt-2 min-h-12 w-full rounded-xl border border-line px-4 text-sm text-ink outline-none placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10"
            />
          </div>

          <div className="mt-5">
            <p className="text-sm font-bold text-ink">
              Minh chứng công tác *
            </p>

            <p className="mt-1 text-xs leading-5 text-muted">
              Có thể sử dụng thẻ giáo viên,
              quyết định công tác hoặc giấy
              xác nhận của nhà trường.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Hiện hệ thống chỉ lưu thông tin file, chưa tải nội dung file lên máy chủ.
            </p>

            <label className="mt-3 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-emerald/40 bg-emerald/5 px-6 text-center transition hover:bg-emerald/10">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={
                  handleDocumentChange
                }
                className="hidden"
              />

              <FileUp className="size-7 text-emerald" />

              <p className="mt-3 text-sm font-bold text-ink">
                Chọn file minh chứng
              </p>

              <p className="mt-1 text-xs text-muted">
                PDF, JPG hoặc PNG · Tối đa 5 MB
              </p>
            </label>

            {selectedDocument && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-slate-50 p-4">
                <FileCheck2 className="size-5 shrink-0 text-emerald" />

                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">
                    {selectedDocument.name}
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    {formatFileSize(
                      selectedDocument.size,
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={hasConfirmed}
              onChange={(event) =>
                setHasConfirmed(
                  event.target.checked,
                )
              }
              className="mt-1 size-4 accent-emerald"
            />

            <span className="text-sm leading-6 text-secondary">
              Tôi xác nhận thông tin và
              minh chứng đã cung cấp là
              chính xác.
            </span>
          </label>

          {formError && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-emerald px-6 text-sm font-extrabold text-white transition hover:bg-emerald/90 disabled:opacity-50"
          >
            {status === 'rejected'
              ? 'Gửi lại hồ sơ'
              : 'Gửi hồ sơ xác minh'}
          </button>
        </form>
      )}
    </div>
  );
}
