import { useEffect, useRef, useState } from "react";
import { compressCoverImage } from "../../utils/imageCompression";
import type { AssignmentContent } from "../../types/assignment";
import InteractiveVideoPlayer from "../media/InteractiveVideoPlayer";
import { getYouTubeVideoId } from "../../utils/youtube";
import {
  assignmentContentError,
  normalizeAssignmentContent,
  isLocalImage,
  isImageUrl,
} from "../../utils/assignmentValidation";

export const EMPTY_ASSIGNMENT_CONTENT: AssignmentContent = {
  text: "",
  imageUrl: "",
  videoUrl: "",
};

export function AssignmentContentEditor({
  value,
  onChange,
  disabled = false,
  onProcessingChange,
}: {
  value: AssignmentContent;
  onChange: (value: AssignmentContent) => void;
  disabled?: boolean;
  onProcessingChange?: (processing: boolean) => void;
}) {
  const latestValue = useRef(value);
  latestValue.current = value;
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;
  const [uploadError, setUploadError] = useState("");
  const [processing, setProcessing] = useState(false);
  const uploadAttempt = useRef(0);
  const processingCallback = useRef(onProcessingChange);
  processingCallback.current = onProcessingChange;
  useEffect(
    () => () => {
      uploadAttempt.current++;
      processingCallback.current?.(false);
    },
    [],
  );
  function cancelUpload() {
    uploadAttempt.current++;
    setProcessing(false);
    processingCallback.current?.(false);
    setUploadError("");
  }
  useEffect(() => {
    if (disabled) cancelUpload();
  }, [disabled]);
  async function uploadImage(file?: File) {
    if (!file) return;
    const attempt = ++uploadAttempt.current;
    setUploadError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setProcessing(false);
      processingCallback.current?.(false);
      setUploadError("Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.");
      return;
    }
    setProcessing(true);
    processingCallback.current?.(true);
    try {
      const imageUrl = await compressCoverImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
      });
      if (attempt !== uploadAttempt.current) return;
      if (!isLocalImage(imageUrl))
        throw new Error("Ảnh sau khi nén còn quá lớn. Hãy chọn ảnh nhỏ hơn.");
      latestOnChange.current({ ...latestValue.current, imageUrl });
    } catch (cause) {
      if (attempt === uploadAttempt.current)
        setUploadError(
          cause instanceof Error ? cause.message : "Không thể đọc ảnh.",
        );
    } finally {
      if (attempt === uploadAttempt.current) {
        setProcessing(false);
        processingCallback.current?.(false);
      }
    }
  }
  const [previewOpen, setPreviewOpen] = useState(false);
  const error = assignmentContentError(value);
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-4 rounded-xl border border-line p-4 disabled:opacity-60"
    >
      <legend className="px-1 text-sm font-bold text-ink">
        Hướng dẫn và tư liệu (tùy chọn)
      </legend>
      <label className="block text-sm font-bold text-ink">
        Hướng dẫn làm bài
        <textarea
          aria-label="Hướng dẫn làm bài"
          value={value.text}
          maxLength={10_000}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
          rows={4}
          placeholder="Yêu cầu, cách làm bài hoặc tư liệu cần đọc trước khi trả lời…"
          className="mt-2 block w-full resize-y rounded-xl border border-line bg-white p-3 font-normal outline-none focus:border-emerald"
        />
      </label>
      <div className="min-w-0 space-y-3">
        <label className="block text-sm font-bold text-ink">
          Tải ảnh lên
          <input
            aria-label="Tải ảnh minh họa lên"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void uploadImage(file);
            }}
            className="mt-2 block min-h-11 w-full min-w-0 text-sm font-normal file:mr-3 file:min-h-11 file:rounded-xl file:border file:border-line file:bg-white file:px-3 file:text-sm file:font-bold"
          />
          <span className="mt-1 block text-sm font-normal text-secondary">
            JPG, PNG hoặc WebP, tối đa 5 MB. Ảnh được thu nhỏ để lưu trên trình
            duyệt.
          </span>
        </label>
        {processing && (
          <p role="status" className="text-sm text-secondary">
            Đang xử lý ảnh…
          </p>
        )}
        {uploadError && (
          <p role="alert" className="text-sm text-red-700">
            {uploadError}
          </p>
        )}
        {isLocalImage(value.imageUrl) ? (
          <p className="text-sm text-secondary">Đang dùng ảnh tải lên.</p>
        ) : (
          <label className="block text-sm font-bold text-ink">
            Hoặc dán liên kết ảnh
            <input
              aria-label="Liên kết ảnh minh họa"
              type="url"
              value={value.imageUrl}
              onChange={(event) => {
                cancelUpload();
                onChange({ ...value, imageUrl: event.target.value });
              }}
              placeholder="https://…"
              className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-white px-3 font-normal"
            />
          </label>
        )}
        {value.imageUrl && (
          <>
            {isImageUrl(value.imageUrl) && (
              <ContentImage key={value.imageUrl} url={value.imageUrl} />
            )}
            <button
              type="button"
              onClick={() => {
                cancelUpload();
                onChange({ ...value, imageUrl: "" });
              }}
              className="min-h-11 rounded-xl border border-line px-3 text-sm font-bold"
            >
              Bỏ ảnh
            </button>
          </>
        )}
      </div>
      <label className="block text-sm font-bold text-ink">
        Liên kết video YouTube
        <input
          aria-label="Liên kết video YouTube"
          type="url"
          value={value.videoUrl}
          onChange={(event) =>
            onChange({ ...value, videoUrl: event.target.value })
          }
          placeholder="https://www.youtube.com/watch?v=…"
          className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-emerald"
        />
      </label>
      {disabled ? (
        <p className="text-xs text-secondary">
          Nội dung đã khóa vì bài tập có bài nộp.
        </p>
      ) : (
        <details
          onToggle={(event) => setPreviewOpen(event.currentTarget.open)}
          className="min-w-0 text-sm"
        >
          <summary className="min-h-11 cursor-pointer font-bold text-emerald">
            Xem trước hướng dẫn và tư liệu
          </summary>
          {previewOpen &&
            (error ? (
              <p role="alert" className="mt-3 text-red-600">
                {error}
              </p>
            ) : normalizeAssignmentContent(value) ? (
              <AssignmentContentView content={value} />
            ) : (
              <p className="mt-3 text-secondary">
                Chưa thêm hướng dẫn hoặc tư liệu.
              </p>
            ))}
        </details>
      )}
    </fieldset>
  );
}

function ContentImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <p role="alert" className="text-sm text-red-600">
      Không tải được ảnh minh họa. Hãy kiểm tra liên kết hoặc báo giáo viên.
    </p>
  ) : (
    <img
      src={url}
      alt="Ảnh minh họa bài tập"
      onError={() => setFailed(true)}
      className="mx-auto block h-auto max-h-[36rem] max-w-full rounded-xl object-contain"
    />
  );
}

export function AssignmentContentView({
  content,
}: {
  content?: AssignmentContent;
}) {
  const value = normalizeAssignmentContent(content);
  if (!value) return null;
  const videoId = getYouTubeVideoId(value.videoUrl);
  return (
    <section
      aria-label="Hướng dẫn và tư liệu bài tập"
      className="min-w-0 space-y-4 rounded-2xl border border-line bg-white p-5 [overflow-wrap:anywhere]"
    >
      <h2 className="font-extrabold text-ink">Hướng dẫn và tư liệu</h2>
      {value.text && (
        <p className="whitespace-pre-wrap text-sm leading-7 text-ink">
          {value.text}
        </p>
      )}
      {value.imageUrl &&
        (isImageUrl(value.imageUrl) ? (
          <ContentImage key={value.imageUrl} url={value.imageUrl} />
        ) : (
          <p role="alert" className="text-sm text-red-600">
            Liên kết ảnh minh họa không hợp lệ.
          </p>
        ))}
      {value.videoUrl &&
        (videoId ? (
          <InteractiveVideoPlayer
            videoId={videoId}
            title="Video tư liệu bài tập"
          />
        ) : (
          <p role="alert" className="text-sm text-red-600">
            Liên kết video YouTube không hợp lệ.
          </p>
        ))}
    </section>
  );
}
