import {
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

type RosterImportModalProps = {
  isOpen: boolean;
  className: string;
  onClose: () => void;
  onImport: (
    rows: RosterImportRow[],
  ) => void;
};

export function RosterImportModal({
  isOpen,
  className,
  onClose,
  onImport,
}: RosterImportModalProps) {
  const [fileName, setFileName] =
    useState('');

  const [rows, setRows] = useState<
    RosterImportRow[]
  >([]);

  const [error, setError] = useState('');

  const [isReading, setIsReading] =
    useState(false);

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
    !isReading;

  const resetModal = () => {
    setFileName('');
    setRows([]);
    setError('');
  };

  const handleClose = () => {
    if (isReading) {
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
    setIsReading(true);

    try {
      const parsedRows =
        await parseRosterExcel(
          selectedFile,
          className,
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

  const handleConfirmImport = () => {
    if (!canImport) {
      return;
    }

    onImport(rows);
    resetModal();
    onClose();
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
                  Gồm STT, Họ và tên và
                  Mã học sinh.
                </span>
              </span>
            </button>

            {/* Chọn file */}
            <label className="flex min-h-28 cursor-pointer items-center gap-4 rounded-xl border border-dashed border-emerald/40 bg-emerald/5 p-5 transition hover:bg-emerald/10">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isReading}
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
                    Mã được tự sinh
                  </p>

                  <p className="mt-1 text-xl font-extrabold text-emerald">
                    {generatedCodeCount}
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
                <table className="min-w-full text-left text-sm">
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
        </div>

        {/* Nút cuối modal */}
        <footer className="flex flex-col-reverse gap-3 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={isReading}
            className="min-h-11 rounded-full border border-line px-5 text-sm font-bold text-secondary transition hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={!canImport}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald px-5 text-sm font-bold text-white transition hover:bg-emerald/90 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            <FileSpreadsheet className="size-4" />
            Nhập {rows.length || ''} học sinh
          </button>
        </footer>
      </div>
    </div>
  );
}