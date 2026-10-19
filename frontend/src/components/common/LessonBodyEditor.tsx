import { lazy, Suspense } from "react";
import type { LessonBodyEditorProps } from "./LessonBody";

const RichTextEditor = lazy(() => import("./LessonRichTextEditor"));

export function LessonBodyEditor(props: LessonBodyEditorProps) {
  return <Suspense fallback={<p role="status" className="p-4 text-sm text-secondary">Đang tải trình soạn…</p>}>
    <RichTextEditor {...props} />
  </Suspense>;
}
