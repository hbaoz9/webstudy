import {
  useEffect,
  useState,
} from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  X,
} from 'lucide-react';

import type {
  ClassRosterEntry,
  JoinRequest,
  ManualVerificationPayload,
  ManualVerificationReason,
} from '../../types/teacher';
import type { ClassroomJoinRequest } from '../../service/api/joinRequests';
import type { TeacherRosterEntry } from '../../service/api/classrooms';

import {
  normalizeStudentCode,
} from '../../utils/rosterMatching';

type ManualVerificationModalProps = {
  request: JoinRequest | ClassroomJoinRequest | null;
  rosterEntries: (ClassRosterEntry | TeacherRosterEntry)[];
  onClose: () => void;
  onConfirm: (
    payload: ManualVerificationPayload,
  ) => void;
  backendMode?: boolean;
  busy?: boolean;
  error?: string;
};

const reasonOptions: {
  value: ManualVerificationReason;
  label: string;
}[] = [
  {
    value: 'wrong_student_code',
    label: 'Học sinh nhập sai mã',
  },
  {
    value: 'wrong_declared_class',
    label: 'Học sinh khai báo sai lớp',
  },
  {
    value: 'account_name_difference',
    label:
      'Tên tài khoản khác với danh sách lớp',
  },
  {
    value: 'other',
    label: 'Lý do khác',
  },
];

export function ManualVerificationModal({
  request,
  rosterEntries,
  onClose,
  onConfirm,
  backendMode = false,
  busy = false,
  error = '',
}: ManualVerificationModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [
    selectedRosterEntryId,
    setSelectedRosterEntryId,
  ] = useState('');

  const [reason, setReason] = useState<
    ManualVerificationReason | ''
  >('');

  const [note, setNote] = useState('');

  useEffect(() => {
    if (!request) {
      return;
    }

    /*
     * Nếu mã học sinh đang nhập đã khớp
     * một dòng chưa bị tài khoản khác nhận,
     * hệ thống chọn sẵn dòng đó.
     */
    const matchingEntry =
      rosterEntries.find((entry) => {
        const hasMatchingCode =
          normalizeStudentCode(
            entry.studentCode,
          ) ===
          normalizeStudentCode(
            request.studentCode,
          );

        const isAvailable =
          !entry.linkedUserId ||
          String(entry.linkedUserId) === String(request.studentId);

        return (
          hasMatchingCode && isAvailable
        );
      });

    setSelectedRosterEntryId(
      matchingEntry?.id ?? '',
    );

    setReason('');
    setNote('');
    setConfirmed(false);
  }, [request, rosterEntries]);

  if (!request) {
    return null;
  }

  const selectedEntry =
    rosterEntries.find(
      (entry) =>
        entry.id ===
        selectedRosterEntryId,
    );

  const selectedEntryClaimedByOther =
    Boolean(
      selectedEntry?.linkedUserId &&
        String(selectedEntry.linkedUserId) !== String(request.studentId),
    );

  const canConfirm =
    Boolean(selectedEntry) &&
    !selectedEntryClaimedByOther &&
    Boolean(reason) &&
    note.trim().length >= 5 &&
    note.trim().length <= 2000 &&
    !busy;

  const handleConfirm = () => {
    if (
      !canConfirm ||
      !selectedEntry ||
      !reason
    ) {
      return;
    }

    if (backendMode && !confirmed) {
      setConfirmed(true);
      return;
    }
    onConfirm({
      requestId: request.id,
      rosterEntryId: selectedEntry.id,
      reason,
      note: note.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-verification-title"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Tiêu đề */}
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2
              id="manual-verification-title"
              className="text-xl font-extrabold text-ink"
            >
              Xác nhận tài khoản học sinh
            </h2>

            <p className="mt-1 text-sm text-secondary">
              Chọn đúng học sinh trong danh sách lớp để xác nhận tài khoản này.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="grid size-10 shrink-0 place-items-center rounded-full text-secondary transition hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          {/* Thông tin yêu cầu */}
          <section className="rounded-xl border border-line bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Tài khoản đang yêu cầu vào lớp
            </p>

            <h3 className="mt-2 font-extrabold text-ink">
              {request.studentName}
            </h3>

            <div className="mt-3 grid gap-2 text-sm text-secondary sm:grid-cols-2">
              <p>
                Email:{' '}
                <strong className="text-ink">
                  {request.email}
                </strong>
              </p>

              <p>
                Mã đã nhập:{' '}
                <strong className="text-ink">
                  {request.studentCode}
                </strong>
              </p>

              <p>
                Lớp khai báo:{' '}
                <strong className="text-ink">
                  {request.declaredClass}
                </strong>
              </p>

              <p>
                Thời gian:{' '}
                <strong className="text-ink">
                  {request.requestedAt}
                </strong>
              </p>
            </div>
          </section>

          {rosterEntries.length === 0 ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber-700">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />

              <div>
                <p className="font-bold">
                  Chưa có danh sách học sinh
                </p>

                <p className="mt-1 leading-6">
                  Hãy nhập danh sách Excel
                  trước khi xác minh thủ công.
                  Giáo viên cần chọn một học
                  sinh cụ thể để tránh duyệt
                  nhầm tài khoản.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chọn học sinh thật */}
              <div className="mt-5">
                <label
                  htmlFor="roster-entry"
                  className="text-sm font-bold text-ink"
                >
                  Chọn học sinh tương ứng trong danh sách lớp
                </label>

                <select
                  id="roster-entry"
                  value={
                    selectedRosterEntryId
                  }
                  onChange={(event) => {
                    setSelectedRosterEntryId(event.target.value);
                    setConfirmed(false);
                  }}
                  className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10"
                >
                  <option value="">
                    Chọn đúng học sinh
                  </option>

                  {rosterEntries.map(
                    (entry) => {
                      const claimedByOther =
                        Boolean(
                          entry.linkedUserId &&
                            String(entry.linkedUserId) !== String(request.studentId),
                        );

                      return (
                        <option
                          key={entry.id}
                          value={entry.id}
                          disabled={
                            claimedByOther
                          }
                        >
                          {entry.orderNumber}.{' '}
                          {entry.fullName} —{' '}
                          {entry.studentCode}
                          {claimedByOther
                            ? ' — Đã có tài khoản'
                            : ''}
                        </option>
                      );
                    },
                  )}
                </select>

                <p className="mt-2 text-xs leading-5 text-muted">
                  Học sinh "Đã có tài khoản" không thể
                  được chọn cho một tài khoản khác.
                </p>
              </div>

              {/* Kết quả lựa chọn */}
              {selectedEntry && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald/30 bg-emerald/10 px-4 py-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald" />

                  <div>
                    <p className="text-sm font-bold text-ink">
                      Tài khoản này sẽ được xác nhận là{' '}
                      {selectedEntry.fullName}
                    </p>

                    <p className="mt-1 text-xs text-secondary">
                      Mã học sinh:{' '}
                      <strong>
                        {
                          selectedEntry.studentCode
                        }
                      </strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Lý do */}
              <div className="mt-5">
                <label
                  htmlFor="verification-reason"
                  className="text-sm font-bold text-ink"
                >
                  Ghi chú xác nhận
                </label>

                <select
                  id="verification-reason"
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value as ManualVerificationReason | '');
                    setConfirmed(false);
                  }}
                  className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10"
                >
                  <option value="">
                    Chọn lý do
                  </option>

                  {reasonOptions.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {/* Ghi chú */}
              <div className="mt-5">
                <label
                  htmlFor="verification-note"
                  className="text-sm font-bold text-ink"
                >
                  Ghi chú đối chiếu
                </label>

                <textarea
                  id="verification-note"
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setConfirmed(false);
                  }}
                  rows={3}
                  placeholder="Ví dụ: Đã kiểm tra trực tiếp với học sinh và xác nhận đúng người."
                  className="mt-2 w-full resize-none rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10"
                />

                <p className="mt-1 text-xs text-muted">
                  Nhập ít nhất 5 ký tự để lưu
                  căn cứ xác minh.
                </p>
              </div>
            </>
          )}
        </div>

        {confirmed && backendMode && <p className="mx-6 mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Xác nhận liên kết tài khoản với học sinh đã chọn và duyệt yêu cầu? Thao tác này tạo membership khi Backend chấp nhận.</p>}
        {error && <p role="alert" className="mx-6 mb-3 text-sm text-red-600">{error}</p>}
        <footer className="flex flex-col-reverse gap-3 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-11 rounded-full border border-line px-5 text-sm font-bold text-secondary transition hover:bg-slate-50"
          >
            Hủy
          </button>

          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald px-5 text-sm font-bold text-white transition hover:bg-emerald/90 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            <ShieldCheck className="size-4" />
            {busy ? 'Đang xử lý…' : confirmed && backendMode ? 'Đồng ý xác minh và duyệt' : 'Xác nhận và duyệt'}
          </button>
        </footer>
      </div>
    </div>
  );
}
