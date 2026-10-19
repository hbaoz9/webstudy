import {
  Check,
  Clock3,
  GraduationCap,
  IdCard,
  Mail,
  ShieldCheck,
  X,
} from 'lucide-react';

import type {
  JoinRequest,
  ManualVerificationReason,
} from '../../types/teacher';

import {
  VerificationStatusBadge,
} from './VerificationStatusBadge';

type JoinRequestCardProps = {
  request: JoinRequest;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;

  onManualVerify: (
    request: JoinRequest,
  ) => void;

  showActions?: boolean;
};

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(-2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

export function JoinRequestCard({
  request,
  onApprove,
  onReject,
  onManualVerify,
  showActions = true,
}: JoinRequestCardProps) {
  const canApprove =
    request.verificationStatus === 'matched';
    request.verificationStatus === 'manual_verified'

  const manualReasonLabels: Record<
    ManualVerificationReason,
    string
  > = {
    wrong_student_code:
      'Học sinh nhập sai mã',

    wrong_declared_class:
      'Học sinh khai báo sai lớp',

    account_name_difference:
      'Tên tài khoản khác danh sách lớp',

    other: 'Lý do khác',
  };

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        {/* Thông tin học sinh */}
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald/10 text-sm font-extrabold text-emerald">
            {getInitials(request.studentName)}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-extrabold text-ink">
                {request.studentName}
              </h3>

              <VerificationStatusBadge
                status={request.verificationStatus}
              />
            </div>

            <details className="mt-3 text-xs text-muted">
                <summary className="cursor-pointer font-semibold transition hover:text-secondary">
                    Thông tin tài khoản
                </summary>

                <p className="mt-2 flex items-center gap-2">
                    <Mail className="size-4" />
                    {request.email}
                </p>
            </details>

              <p className="flex items-center gap-2">
                <IdCard className="size-4 text-muted" />

                <span>
                  Mã học sinh:{' '}
                  <strong className="text-ink">
                  {request.studentCode}
                  </strong>
                </span>
              </p>

              <p className="flex items-center gap-2">
                <GraduationCap className="size-4 text-muted" />

                <span>
                  Lớp khai báo:{' '}
                  <strong className="text-ink">
                    {request.declaredClass}
                  </strong>
                </span>
              </p>

              <p className="flex items-center gap-2">
                <Clock3 className="size-4 text-muted" />

                <span>{request.requestedAt}</span>
              </p>
            </div>
          </div>

        {/* Nút xử lý */}
        {showActions && (
          <div className="flex shrink-0 flex-wrap items-center gap-3 xl:justify-end">
          <button
            type="button"
            onClick={() => onReject(request.id)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-4 text-xs font-bold text-red-600 transition hover:bg-red-50"
          >
            <X className="size-4" />
            Từ chối
          </button>

          <div className="group relative">
            <button
              type="button"
              disabled={!canApprove}
              onClick={() => onApprove(request.id)}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold transition ${
                canApprove
                  ? 'bg-emerald text-white hover:bg-emerald/90'
                  : 'cursor-not-allowed bg-slate-200 text-slate-400'
              }`}
            >
              <Check className="size-4" />
              Duyệt
            </button>

            {!canApprove && (
              <button
                type="button"
                onClick={() =>
                  onManualVerify(request)
                }
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-4 text-xs font-bold text-amber-700 transition hover:bg-amber/20"
              >
                <ShieldCheck className="size-4" />
                Xác minh thủ công
              </button>
            )}

            {!canApprove && (
              <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-3 w-64 translate-y-1 rounded-lg bg-ink px-3 py-2 text-xs leading-5 text-white opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100">
                Hãy xác minh thông tin học sinh trước khi duyệt.

                <span className="absolute -bottom-1.5 right-7 size-3 rotate-45 bg-ink" />
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {request.verificationStatus === 'mismatch' && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-600">
          Học sinh đang xin vào lớp này nhưng lớp khai báo không khớp. Không nên duyệt trước khi kiểm tra lại.
        </div>
      )}

      {request.verificationStatus ===
        'unverified' && (
        <div className="mt-4 rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-xs leading-5 text-amber-700">
          Hệ thống chưa tìm thấy học sinh trong danh sách lớp được cung cấp.
        </div>
      )}

      {request.verificationStatus ===
        'conflict' && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-600">
          Mã học sinh này đã thuộc về một tài khoản khác. Hãy kiểm tra lại học sinh hoặc yêu cầu sử dụng đúng tài khoản đã được xác nhận.
        </div>
      )}

      {request.status === 'approved' && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald/30 bg-emerald/10 px-3 py-1.5 text-xs font-bold text-emerald">
          <Check className="size-4" />
          Đã duyệt
        </span>
      )}

      {request.status === 'rejected' && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">
          <X className="size-4" />
          Đã từ chối
        </span>
      )}

      {request.manualVerification && (
        <details className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <summary className="cursor-pointer text-xs font-bold text-blue-700">
            Xem thông tin xác nhận thủ công
          </summary>

          <div className="mt-3 grid gap-2 text-xs leading-5 text-secondary sm:grid-cols-2">
            <p>
              <span className="text-muted">
                Lý do:
              </span>{' '}

              <strong className="text-ink">
                {
                  manualReasonLabels[
                    request.manualVerification
                      .reason
                  ]
                }
              </strong>
            </p>

            <p>
              <span className="text-muted">
                Thời gian:
              </span>{' '}

              <strong className="text-ink">
                {new Date(
                  request.manualVerification
                    .verifiedAt,
                ).toLocaleString('vi-VN')}
              </strong>
            </p>

            <p>
              <span className="text-muted">
                Mã học sinh nhập ban đầu:
              </span>{' '}

              <strong className="text-ink">
                {
                  request.manualVerification
                    .originalStudentCode
                }
              </strong>
            </p>

            <p>
              <span className="text-muted">
                Mã được xác nhận:
              </span>{' '}

              <strong className="text-ink">
                {
                  request.manualVerification
                    .resolvedStudentCode
                }
              </strong>
            </p>

            <p className="sm:col-span-2">
              <span className="text-muted">
                Ghi chú:
              </span>{' '}

              <strong className="text-ink">
                {request.manualVerification.note}
              </strong>
            </p>
          </div>
        </details>
      )}
    </article>
  );
}
