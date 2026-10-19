import type { AnswerOption } from "../types/question";

export const TEACHER_VIDEOS_KEY = "webstudy-geo10-teacher-videos-v1";
export type VideoCheckpoint = {
  id: string;
  atSeconds: number;
  prompt: string;
  options?: Record<AnswerOption, string>;
  correctOption?: AnswerOption;
};
export type InteractiveVideo = {
  id: string;
  title: string;
  youtubeId: string;
  status: "draft" | "published";
  classroomId?: string;
  classroomIds?: string[];
  publishedAt?: string;
  checkpoints: VideoCheckpoint[];
  createdAt: string;
  lessonId?: string;
};

export function videoClassIds(video: InteractiveVideo): string[] {
  if (video.status !== "published") return [];
  return [...new Set(Array.isArray(video.classroomIds)
    ? video.classroomIds.filter((id) => typeof id === "string" && id.length > 0)
    : video.classroomId ? [video.classroomId] : [])];
}

export function loadTeacherVideos(): InteractiveVideo[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TEACHER_VIDEOS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed as InteractiveVideo[] : [];
  } catch {
    return [];
  }
}

export function formatVideoTime(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export const TEACHER_VIDEOS_CHANGED = "webstudy-videos-changed";
export function saveTeacherVideos(videos: InteractiveVideo[]): void {
  localStorage.setItem(TEACHER_VIDEOS_KEY, JSON.stringify(videos));
  window.dispatchEvent(new Event(TEACHER_VIDEOS_CHANGED));
}
