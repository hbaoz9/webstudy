import {
  AlertTriangle,
  Clock3,
  ShieldX,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import {
  useTeacherAccount,
} from '../../contexts/TeacherAccountContext';

export function VerificationBanner() {
  const {
    teacherAccount,
  } = useTeacherAccount();

  const status =
    teacherAccount.verificationStatus;

  if (status === 'verified') {
    return null;
  }

  const isPending =
    status === 'pending';

  const isRejected =
    status === 'rejected';

  const Icon = isPending
    ? Clock3
    : isRejected
      ? ShieldX
      : AlertTriangle;

  const title = isPending
    ? 'Hồ sơ xác minh đang được xem xét.'
    : isRejected
      ? 'Hồ sơ xác minh chưa được chấp nhận.'
      : 'Tài khoản giáo viên chưa được xác minh.';

  const description = isPending
    ? 'Bạn sẽ có thể tạo và quản lý lớp học sau khi hồ sơ được duyệt.'
    : isRejected
      ? teacherAccount.rejectionReason ??
        'Vui lòng kiểm tra thông tin và gửi lại hồ sơ.'
      : 'Hãy hoàn tất xác minh để tạo và quản lý lớp học.';

  const actionLabel = isPending
    ? 'Xem trạng thái'
    : isRejected
      ? 'Gửi lại hồ sơ'
      : 'Xác minh ngay';

  return (
    <section
      className={`flex flex-col overflow-hidden rounded-xl border sm:flex-row sm:items-stretch ${
        isRejected
          ? 'border-red-200 bg-red-50'
          : 'border-amber/40 bg-amber/10'
      }`}
    >
      <div className="flex flex-1 items-start gap-4 px-5 py-5">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full ${
            isRejected
              ? 'bg-red-100 text-red-600'
              : 'bg-amber/15 text-amber-700'
          }`}
        >
          <Icon className="size-5" />
        </span>

        <div>
          <h2
            className={`text-sm font-extrabold ${
              isRejected
                ? 'text-red-700'
                : 'text-amber-700'
            }`}
          >
            {title}
          </h2>

          <p
            className={`mt-1 text-xs leading-5 ${
              isRejected
                ? 'text-red-600'
                : 'text-amber-700/80'
            }`}
          >
            {description}
          </p>
        </div>
      </div>

      <Link
        to="/teacher/verification"
        className={`flex min-h-16 items-center justify-center px-7 text-sm font-extrabold transition sm:min-h-full ${
          isRejected
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-amber text-ink hover:bg-amber/90'
        }`}
      >
        {actionLabel}
      </Link>
    </section>
  );
}