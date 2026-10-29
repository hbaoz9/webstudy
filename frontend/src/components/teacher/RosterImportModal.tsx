import {
  useRef,
  useState,
  type ChangeEvent,
} from 'react';

import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
  X,
} from 'lucide-react';

import type {
  RosterImportRow,
} from '../../types/teacher';

import {
  downloadRosterTemplate,
  parseRosterExcel,
} from '../../utils/excelRoster';
import { ApiError } from '../../service/api/client';

type RosterImportModalProps = {
  isOpen: boolean;
  className: string;
  onClose: () => void;
  onImport: (
    rows: RosterImportRow[],
  ) => void | Promise<void>;
  backendImport?: boolean;
};

export function RosterImportModal({
  isOpen,
  className,
  onClose,
  onImport,
  backendImport = false,
}: RosterImportModalProps) {
  const [fileName, setFileName] =
    useState('');

  const [rows, setRows] = useState<
    RosterImportRow[]
  >([]);

  const [error, setError] = useState('');

  const [isReading, setIsReading] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const importLock = useRef(false);
  const [confirming, setConfirming] = useState(false);

  if (!isOpen) {
    return null;
  }

  const invalidRowCount = rows.filter(
    (row) => row.errors.length > 0,
  ).length;

  const generatedCodeCount = rows.filter(
    (row) =>
      row.codeSource === 'generated',
  ).length;

  const canImport =
    rows.length > 0 &&
    invalidRowCount === 0 &&
    !isReading && !isSubmitting;

  const resetModal = () => {
    setFileName('');
    setRows([]);
    setError('');
    setConfirming(false);
  };

  const handleClose = () => {
    if (isReading || isSubmitting || importLock.current) {
      return;
    }

    resetModal();
    onClose();
  };

  const handleDownloadTemplate =
    async () => {
      try {
        setError('');

        await downloadRosterTemplate(
          className,
          backendImport,
        );
      } catch {
        setError(
          'Không thể tạo file Excel mẫu.',
        );
      }
    };

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile =
      event.target.files?.[0];

    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    setFileName(selectedFile.name);
    setRows([]);
    setError('');
    setConfirming(false);
    setIsReading(true);

    try {
      const parsedRows =
        await parseRosterExcel(
          selectedFile,
          className,
          { backendImport },
        );

      setRows(parsedRows);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Không thể đọc file Excel.';

      setError(message);
    } finally {
      setIsReading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!canImport || importLock.current) {
      return;
    }
    if (backendImport && !confirming) {
      setConfirming(true);
      return;
    }
    importLock.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      await onImport(rows);
      resetModal();
      onClose();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 422) {
        const rowErrors = Object.entries(cause.errors).filter(([key]) => /^rows\.\d+/.test(key));
        if (rowErrors.length > 0) {
          setRows((current) => current.map((row, index) => ({
            ...row,
            errors: [...row.errors, ...rowErrors.filter(([key]) => key.startsWith(`rows.${index}.`) || key === `rows.${index}`)
              .flatMap(([, messages]) => messages)],
          })));
        }
        setError(`${cause.message} Vui lòng kiểm tra lỗi từng dòng hoặc chọn lại file.`);
      } else if (cause instanceof ApiError && cause.status === 401) {
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      } else if (cause instanceof ApiError && cause.status === 403) {
        setError('Bạn không có quyền nhập danh sách cho lớp này.');
      } else if (cause instanceof ApiError && cause.status === 404) {
        setError('Không tìm thấy lớp học.');
      } else if (cause instanceof ApiError && cause.status === 409) {
        setError(cause.message);
      } else {
        setError(cause instanceof Error ? cause.message : 'Không thể nhập danh sách học sinh.');
      }
    } finally {
      importLock.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-import-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Tiêu đề */}
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2
              id="roster-import-title"
              className="text-xl font-extrabold text-ink"
            >
              Nhập danh sách học sinh
            </h2>

            <p className="mt-1 text-sm text-secondary">
              {className} · Hỗ trợ file
              .xlsx và .xls
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isReading}
            className="grid size-10 shrink-0 place-items-center rounded-full text-secondary transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </header>

        {/* Nội dung có thể cuộn */}
        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Tải file mẫu */}
            <button
              type="button"
              onClick={
                handleDownloadTemplate
              }
              className="flex min-h-28 items-center gap-4 rounded-xl border border-line bg-white p-5 text-left transition hover:border-emerald/40 hover:bg-emerald/5"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald/10 text-emerald">
                <Download className="size-5" />
              </span>

              <span>
                <strong className="block text-sm text-ink">
                  Tải file Excel mẫu
                </strong>

                <span className="mt-1 block text-xs leading-5 text-muted">
                  Gồm STT, Họ và tên và Mã học sinh.{backendImport ? ' Hãy điền mã thật trước khi nhập.' : ''}
                </span>
              </span>
            </button>

            {/* Chọn file */}
            <label className="flex min-h-28 cursor-pointer items-center gap-4 rounded-xl border border-dashed border-emerald/40 bg-emerald/5 p-5 transition hover:bg-emerald/10">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isReading || isSubmitting}
                className="hidden"
              />

              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald text-white">
                {isReading ? (
                  <LoaderCircle className="size-5 animate-spin" />
                ) : (
                  <Upload className="size-5" />
                )}
              </span>

              <span className="min-w-0">
                <strong className="block text-sm text-ink">
                  {isReading
                    ? 'Đang đọc file...'
                    : 'Chọn file Excel'}
                </strong>

                <span className="mt-1 block truncate text-xs text-muted">
                  {fileName ||
                    'Dung lượng tối đa 5 MB'}
                </span>
              </span>
            </label>
          </div>

          {/* Lỗi đọc file */}
          {error && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 size-5 shrink-0" />

              <span>{error}</span>
            </div>
          )}

          {/* Tổng kết dữ liệu */}
          {backendImport && rows.length > 0 && <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-secondary">Mã học sinh đã có sẽ được cập nhật họ tên và STT; mã mới sẽ được thêm. Dòng không có trong file vẫn được giữ. Backend có thể đối chiếu lại yêu cầu tham gia đang chờ. Việc nhập không tự tạo tài khoản hoặc membership.</p>}
          {rows.length > 0 && (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-muted">
                    Tổng học sinh
                  </p>

                  <p className="mt-1 text-xl font-extrabold text-ink">
                    {rows.length}
                  </p>
                </div>

                <div className="rounded-xl bg-emerald/10 px-4 py-3">
                  <p className="text-xs text-emerald">
                    {backendImport ? 'Dòng hợp lệ' : 'Mã được tự sinh'}
                  </p>

                  <p className="mt-1 text-xl font-extrabold text-emerald">
                    {backendImport ? rows.length - invalidRowCount : generatedCodeCount}
                  </p>
                </div>

                <div
                  className={`rounded-xl px-4 py-3 ${
                    invalidRowCount > 0
                      ? 'bg-red-50'
                      : 'bg-emerald/10'
                  }`}
                >
                  <p
                    className={`text-xs ${
                      invalidRowCount > 0
                        ? 'text-red-600'
                        : 'text-emerald'
                    }`}
                  >
                    Dòng có lỗi
                  </p>

                  <p
                    className={`mt-1 text-xl font-extrabold ${
                      invalidRowCount > 0
                        ? 'text-red-600'
                        : 'text-emerald'
                    }`}
                  >
                    {invalidRowCount}
                  </p>
                </div>
              </div>

              {/* Bảng xem trước */}
              <div className="mt-5 overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-secondary">
                    <tr>
                      <th className="px-4 py-3">
                        Dòng
                      </th>

                      <th className="px-4 py-3">
                        STT
                      </th>

                      <th className="px-4 py-3">
                        Họ và tên
                      </th>

                      <th className="px-4 py-3">
                        Mã học sinh
                      </th>

                      <th className="px-4 py-3">
                        Trạng thái
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-line">
                    {rows.map((row) => {
                      const hasError =
                        row.errors.length > 0;

                      return (
                        <tr
                          key={`${row.excelRow}-${row.studentCode}`}
                          className={
                            hasError
                              ? 'bg-red-50/60'
                              : 'bg-white'
                          }
                        >
                          <td className="px-4 py-3 text-muted">
                            {row.excelRow}
                          </td>

                          <td className="px-4 py-3 text-ink">
                            {row.orderNumber}
                          </td>

                          <td className="px-4 py-3 font-semibold text-ink">
                            {row.fullName ||
                              'Chưa có tên'}
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-bold text-ink">
                              {
                                row.studentCode
                              }
                            </span>

                            {row.codeSource ===
                              'generated' && (
                              <span className="ml-2 rounded-full bg-emerald/10 px-2 py-1 text-[10px] font-bold text-emerald">
                                Tự sinh
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {hasError ? (
                              <span className="inline-flex items-start gap-1.5 text-xs font-semibold text-red-600">
                                <AlertCircle className="mt-0.5 size-4 shrink-0" />

                                {row.errors.join(
                                  '; ',
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald">
                                <CheckCircle2 className="size-4" />
                                Hợp lệ
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {backendImport && confirming && <p role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Xác nhận gửi {rows.length} dòng lên Backend? Các mục trùng mã sẽ được cập nhật theo file.</p>}
        </div>

        {/* Nút cuối modal */}
        <footer className="flex flex-col-reverse gap-3 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={isReading || isSubmitting}
            className="min-h-11 rounded-full border border-line px-5 text-sm font-bold text-secondary transition hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={() => void handleConfirmImport()}
            disabled={!canImport}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald px-5 text-sm font-bold text-white transition hover:bg-emerald/90 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            <FileSpreadsheet className="size-4" />
            {isSubmitting ? 'Đang nhập…' : backendImport && !confirming ? `Kiểm tra và xác nhận ${rows.length || ''} học sinh` : `Nhập ${rows.length || ''} học sinh`}
          </button>
        </footer>
      </div>
    </div>
  );
}
