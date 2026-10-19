import type { AssignmentContent } from "../types/assignment";
import { getYouTubeVideoId } from "./youtube";

const MAX_LOCAL_IMAGE_LENGTH = 600_000;
export function isLocalImage(value: string) {
  return value.length <= MAX_LOCAL_IMAGE_LENGTH && /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
export function isImageUrl(value: string) {
  if (isLocalImage(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch { return false; }
}

export function assignmentContentError(content?: AssignmentContent): string | null {
  if (!content) return null;
  if (content.text.length > 10_000) return "Hướng dẫn tối đa 10.000 ký tự.";
  if (content.imageUrl.trim() && !isImageUrl(content.imageUrl.trim())) return "Ảnh minh họa cần ảnh tải lên hợp lệ hoặc liên kết HTTP / HTTPS.";
  if (content.videoUrl.trim() && !getYouTubeVideoId(content.videoUrl)) return "Liên kết video YouTube không hợp lệ.";
  return null;
}

export function normalizeAssignmentContent(content?: AssignmentContent): AssignmentContent | undefined {
  if (!content) return undefined;
  const next = { text: content.text.trim(), imageUrl: content.imageUrl.trim(), videoUrl: content.videoUrl.trim() };
  return next.text || next.imageUrl || next.videoUrl ? next : undefined;
}
