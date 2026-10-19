import type { LessonContent } from "../types/curriculum";
import { dragImageActivityError } from "./lessonContentStorage";
import { getYouTubeVideoId } from "./youtube";

function validVideoUrl(value: string): boolean {
  return getYouTubeVideoId(value) !== null;
}

export function validateLessonContent(
  content: LessonContent,
  status: "draft" | "published",
): string | null {
  const sections = content.sections ?? [];
  const invalidVideo = sections.some(
    (item) => item.videoUrl?.trim() && !validVideoUrl(item.videoUrl.trim()),
  );
  if (invalidVideo) {
    return "Liên kết video đã nhập phải là đường dẫn YouTube HTTPS hợp lệ.";
  }
  if (status === "published") {
    const incompleteActivity = sections.find(
      (item) =>
        item.imageMode === "drag_drop" &&
        dragImageActivityError(item.dragImageActivity),
    );
    if (incompleteActivity) {
      return dragImageActivityError(incompleteActivity.dragImageActivity) ??
          "Hoạt động chưa sẵn sàng để đăng.";
    }

    const body = content.explanation.trim();

    if (!body) {
      return "Vui lòng nhập nội dung bài học trước khi đăng.";
    }
  }
  return null;
}

export function buildLessonSavePayload(
  content: LessonContent,
  status: "draft" | "published",
  timestamp: string,
): LessonContent {
  const sections = content.sections ?? [];
  return {
    ...content,
    draft: undefined,
    objectives: content.objectives.map((item) => item.trim()).filter(Boolean),
    keyPoints: content.keyPoints.map((item) => item.trim()).filter(Boolean),
    sections: sections.map((item) => ({
      ...item,
      title: item.title.trim(),
      keyPoints: item.keyPoints.map((point) => point.trim()).filter(Boolean),
      videoUrl: item.videoUrl?.trim(),
    })),
    status,
    updatedAt: timestamp,
  };
}
