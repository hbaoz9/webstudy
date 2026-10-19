import {
  useId,
  useState,
  type ChangeEvent,
} from 'react';

import {
  ImageIcon,
  Link2,
  LoaderCircle,
  Trash2,
  Upload,
} from 'lucide-react';

import { compressCoverImage } from "../../utils/imageCompression";

type CoverInputMode = 'upload' | 'url';

type CoverUrlStatus =
  | 'idle'
  | 'loading'
  | 'valid'
  | 'invalid';

interface ClassCoverPickerProps {
  value: string;
  onChange: (value: string) => void;
  onValidityChange?: (isValid: boolean) => void;
  onProcessingChange?: (
    isProcessing: boolean,
  ) => void;
}

const MAX_IMAGE_FILE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

function isValidPublicImageUrl(
  value: string,
) {
  try {
    const parsedUrl = new URL(value);

    return (
      parsedUrl.protocol === 'http:' ||
      parsedUrl.protocol === 'https:'
    );
  } catch {
    return false;
  }
}

export function ClassCoverPicker({
  value,
  onChange,
  onValidityChange,
  onProcessingChange,
}: ClassCoverPickerProps) {
  const coverUrlInputId = useId();

  const [inputMode, setInputMode] =
    useState<CoverInputMode>(() =>
      isValidPublicImageUrl(value)
        ? 'url'
        : 'upload',
    );

  const [
    uploadedFileName,
    setUploadedFileName,
  ] = useState(
    value.startsWith('data:image/')
      ? 'Ảnh bìa hiện tại'
      : '',
  );

  const [
    coverUrlStatus,
    setCoverUrlStatus,
  ] = useState<CoverUrlStatus>(() =>
    isValidPublicImageUrl(value)
      ? 'valid'
      : 'idle',
  );

  const [coverError, setCoverError] =
    useState('');

  const [
    isProcessingCover,
    setIsProcessingCover,
  ] = useState(false);

  const normalizedCoverUrl =
    value.trim();

  const changeInputMode = (
    nextMode: CoverInputMode,
  ) => {
    if (nextMode === inputMode) {
      return;
    }

    setInputMode(nextMode);
    setUploadedFileName('');
    setCoverUrlStatus('idle');
    setCoverError('');

    onChange('');
    onValidityChange?.(true);
  };

  const handleCoverFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile =
      event.target.files?.[0];

    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    setCoverError('');

    if (
      !ALLOWED_IMAGE_TYPES.includes(
        selectedFile.type,
      )
    ) {
      setCoverError(
        'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.',
      );

      onValidityChange?.(false);
      return;
    }

    if (
      selectedFile.size >
      MAX_IMAGE_FILE_SIZE
    ) {
      setCoverError(
        'Ảnh gốc không được lớn hơn 5 MB.',
      );

      onValidityChange?.(false);
      return;
    }

    setIsProcessingCover(true);
    onProcessingChange?.(true);

    try {
      const compressedImage =
        await compressCoverImage(
          selectedFile,
        );

      onChange(compressedImage);

      setUploadedFileName(
        selectedFile.name,
      );

      onValidityChange?.(true);
    } catch (caughtError) {
      setCoverError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Không thể xử lý ảnh đã chọn.',
      );

      onValidityChange?.(false);
    } finally {
      setIsProcessingCover(false);
      onProcessingChange?.(false);
    }
  };

  const handleCoverUrlChange = (
    nextValue: string,
  ) => {
    onChange(nextValue);
    setCoverError('');

    const normalizedValue =
      nextValue.trim();

    if (!normalizedValue) {
      setCoverUrlStatus('idle');
      onValidityChange?.(true);
      return;
    }

    if (
      !isValidPublicImageUrl(
        normalizedValue,
      )
    ) {
      setCoverUrlStatus('invalid');

      setCoverError(
        'Liên kết phải bắt đầu bằng http:// hoặc https://.',
      );

      onValidityChange?.(false);
      return;
    }

    setCoverUrlStatus('loading');
    onValidityChange?.(false);
  };

  const handleRemoveCover = () => {
    onChange('');

    setUploadedFileName('');
    setCoverUrlStatus('idle');
    setCoverError('');

    onValidityChange?.(true);
  };

  return (
    <div className="mt-3">
      <div className="inline-flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() =>
            changeInputMode('upload')
          }
          className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-4 text-xs font-bold transition ${
            inputMode === 'upload'
              ? 'bg-white text-ink shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          <Upload className="size-4" />
          Tải từ máy
        </button>

        <button
          type="button"
          onClick={() =>
            changeInputMode('url')
          }
          className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-4 text-xs font-bold transition ${
            inputMode === 'url'
              ? 'bg-white text-ink shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          <Link2 className="size-4" />
          Dán liên kết
        </button>
      </div>

      {inputMode === 'upload' ? (
        <div className="mt-4">
          {value ? (
            <div className="overflow-hidden rounded-xl border border-line">
              <img
                src={value}
                alt="Ảnh bìa đã chọn"
                className="h-52 w-full object-cover"
              />

              <div className="px-4 py-3">
                <p className="truncate text-sm font-bold text-ink">
                  {uploadedFileName ||
                    'Ảnh bìa hiện tại'}
                </p>

                <p className="mt-1 text-xs text-muted">
                  Ảnh đã được thu nhỏ và nén tự động.
                </p>
              </div>
            </div>
          ) : (
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-emerald/40 bg-emerald/5 px-6 text-center transition hover:bg-emerald/10">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={
                  handleCoverFileChange
                }
                disabled={
                  isProcessingCover
                }
                className="hidden"
              />

              {isProcessingCover ? (
                <LoaderCircle className="size-7 animate-spin text-emerald" />
              ) : (
                <Upload className="size-7 text-emerald" />
              )}

              <p className="mt-3 text-sm font-bold text-ink">
                {isProcessingCover
                  ? 'Đang xử lý ảnh...'
                  : 'Chọn ảnh từ máy'}
              </p>

              <p className="mt-1 text-xs text-muted">
                JPG, PNG hoặc WebP · Tối đa
                5 MB
              </p>
            </label>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <label
            htmlFor={coverUrlInputId}
            className="text-sm font-bold text-ink"
          >
            Liên kết ảnh công khai
          </label>

          <div className="relative mt-2">
            <Link2 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />

            <input
              id={coverUrlInputId}
              type="url"
              value={value}
              onChange={(event) =>
                handleCoverUrlChange(
                  event.target.value,
                )
              }
              placeholder="https://example.com/anh-bia.jpg"
              className="min-h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10"
            />
          </div>

          {normalizedCoverUrl &&
            isValidPublicImageUrl(
              normalizedCoverUrl,
            ) && (
              <div className="mt-4 overflow-hidden rounded-xl border border-line">
                <div className="relative h-48 bg-slate-100">
                  {coverUrlStatus ===
                    'loading' && (
                    <div className="absolute inset-0 z-10 grid place-items-center bg-white/70">
                      <LoaderCircle className="size-7 animate-spin text-emerald" />
                    </div>
                  )}

                  <img
                    key={normalizedCoverUrl}
                    src={normalizedCoverUrl}
                    alt="Xem trước ảnh từ liên kết"
                    onLoad={() => {
                      setCoverUrlStatus(
                        'valid',
                      );

                      setCoverError('');
                      onValidityChange?.(
                        true,
                      );
                    }}
                    onError={() => {
                      setCoverUrlStatus(
                        'invalid',
                      );

                      setCoverError(
                        'Không thể tải ảnh từ liên kết này.',
                      );

                      onValidityChange?.(
                        false,
                      );
                    }}
                    className="size-full object-cover"
                  />
                </div>
              </div>
            )}

          <p className="mt-2 text-xs leading-5 text-muted">
            Link phải công khai và cho phép
            hiển thị trực tiếp.
          </p>
        </div>
      )}

      {value && (
        <button
          type="button"
          onClick={handleRemoveCover}
          className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-red-600"
        >
          <Trash2 className="size-4" />
          Xóa ảnh bìa
        </button>
      )}

      {coverError && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {coverError}
        </div>
      )}

      {!value && !coverError && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <ImageIcon className="size-4" />
          Lớp sẽ sử dụng nền mặc định.
        </div>
      )}
    </div>
  );
}