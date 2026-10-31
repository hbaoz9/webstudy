import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from 'lucide-react';

import type {
  VerificationStatus,
} from '../../types/teacher';

type VerificationStatusBadgeProps = {
  status: VerificationStatus;
};

const statusConfig = {
  matched: {
    label: 'Mã khớp danh sách lớp',
    icon: CheckCircle2,
    className:
      'border-emerald/30 bg-emerald/10 text-emerald',
  },

  unverified: {
    label: 'Chưa xác minh thông tin',
    icon: AlertTriangle,
    className:
      'border-amber/30 bg-amber/10 text-amber-700',
  },

  mismatch: {
    label: 'Thông tin không khớp',
    icon: XCircle,
    className:
      'border-red-200 bg-red-50 text-red-600',
  },

  conflict: {
    label: "Mã đã có tài khoản",
    icon: ShieldAlert,
    className:
      'border-red-200 bg-red-50 text-red-600',
  },

  manual_verified: {
    label: 'Đã xác minh thủ công',
    icon: CheckCircle2,
    className:
        'border-blue-200 bg-blue-50 text-blue-600',
    },

} satisfies Record<
  VerificationStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    className: string;
  }
>;

export function VerificationStatusBadge({
  status,
}: VerificationStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${config.className}`}
    >
      <Icon className="size-4" />

      {config.label}
    </span>
  );
}
