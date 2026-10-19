import { Children, isValidElement, useMemo, useState, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import type { LessonTextFormat } from "../../types/curriculum";
import { parseLearningAssetReferenceHref } from "../../utils/lessonContentStorage";
import LearningAssetView from "../infographic/LearningAssetView";
import InteractiveVideoPlayer, {
  getYouTubeVideoId,
} from "../media/InteractiveVideoPlayer";

export function safeUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : "";
  } catch {
    return "";
  }
}

export function formatImageCaption(value: string): string {
  const text = value.trim();
  if (!text) return "";
  return text.startsWith("(") && text.endsWith(")") ? text : `(${text})`;
}

function ContentImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <p role="alert" className="text-sm text-red-600">
        Không tải được ảnh trong nội dung. Hãy kiểm tra liên kết hoặc báo giáo
        viên.
      </p>
    );
  return (
    <figure className="space-y-2">
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className="mx-auto h-auto max-h-[480px] max-w-full rounded-xl object-contain"
      />
      {formatImageCaption(alt) && (
        <figcaption className="text-center text-sm leading-6 text-secondary [overflow-wrap:anywhere]">
          {formatImageCaption(alt)}
        </figcaption>
      )}
    </figure>
  );
}

function ContentLink({ href, children }: { href?: string; children?: ReactNode }) {
  if (!href) return <span>{children}</span>;
  const videoId = getYouTubeVideoId(href);
  return videoId ? <InteractiveVideoPlayer videoId={videoId} title="Video trong nội dung bài học" /> :
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 underline">{children}</a>;
}

const components: Components = {
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,

  em: ({ children }) => <em className="italic">{children}</em>,

  p: ({ children }) => {
    const nodes = Children.toArray(children);
    return <div className="whitespace-pre-line text-sm leading-7 text-secondary">
      {nodes.map((child, index) => {
        const previous = nodes[index - 1];
        // Markdown emits both <br> and a newline; pre-line must not count both.
        return typeof child === "string" && isValidElement(previous) && previous.type === "br"
          ? child.replace(/^\n/, "")
          : child;
      })}
    </div>;
  },
  h1: ({ children }) => (
    <h3 className="text-xl font-bold leading-7 text-ink">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="text-lg font-bold leading-7 text-ink">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-base font-bold leading-7 text-ink">{children}</h4>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-bold leading-7 text-ink">{children}</h4>
  ),
  h5: ({ children }) => (
    <h4 className="text-base font-bold leading-7 text-ink">{children}</h4>
  ),
  h6: ({ children }) => (
    <h4 className="text-base font-bold leading-7 text-ink">{children}</h4>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 text-sm leading-7 text-secondary">
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol
      start={start}
      className="list-decimal pl-5 text-sm leading-7 text-secondary"
    >
      {children}
    </ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-line pl-4 text-sm text-secondary">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="max-w-full overflow-x-auto rounded-xl bg-slate-100 p-3 text-sm">
      {children}
    </pre>
  ),
  a: ContentLink,
  img: ({ src, alt }) =>
    typeof src === "string" && src ? (
      <ContentImage key={src} src={src} alt={alt ?? ""} />
    ) : (
      <span className="text-sm text-red-600">
        Liên kết ảnh trong nội dung không hợp lệ.
      </span>
    ),
};

export function LessonBody({
  value,
  format,
  teacherPreview = false,
  lessonPublished = false,
}: {
  value: string;
  format?: LessonTextFormat;
  teacherPreview?: boolean;
  lessonPublished?: boolean;
}) {
  // Keep link components mounted when practice answers or other page state change.
  const markdownComponents = useMemo<Components>(() => ({
    ...components,
    a: props => {
      const reference = parseLearningAssetReferenceHref(props.href);
      if (reference) return teacherPreview || lessonPublished
        ? <LearningAssetView assetId={reference.assetId} audience={teacherPreview ? "teacher" : "student"} />
        : null;
      return <ContentLink href={props.href}>{props.children}</ContentLink>;
    },
  }), [teacherPreview, lessonPublished]);
  if (!value.trim()) return null;
  if (format !== "markdown")
    return (
      <p className="whitespace-pre-line text-sm leading-7 text-secondary [overflow-wrap:anywhere]">
        {value}
      </p>
    );
  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <Markdown skipHtml
        urlTransform={url => parseLearningAssetReferenceHref(url) ? url : safeUrl(url)}
        components={markdownComponents}>
        {value}
      </Markdown>
    </div>
  );
}

export type LessonBodyEditorProps = {
  title: string;
  number?: number;
  value: string;
  format?: LessonTextFormat;
  onChange: (value: string, format?: LessonTextFormat) => void;
  hidePreview?: boolean;
  layout?: "stacked" | "split";
  lessonId?: string;
  chapterId?: string;
};
