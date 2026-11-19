import { apiGet, apiRequest } from "./client";
import type { VideoCheckpoint } from "../../utils/teacherVideoStorage";

type One<T> = { data: T };
export type VideoPage<T> = { data: T[]; meta: { currentPage: number; lastPage: number; total: number } };
export type TeacherVideo = { id: string; title: string; youtubeId: string; lessonId: string | null;
  checkpoints: VideoCheckpoint[]; version: number; status: "draft" | "published";
  classroomIds: string[]; publications: { id: string; classroomId: string;
    snapshot: VideoDraftInput; publishedAt: string }[];
  publishedAt: string | null; createdAt: string; updatedAt: string };
export type StudentVideo = { id: string; videoId: string; classroomId: string; classroomName: string;
  title: string; youtubeId: string; lessonId: string | null; checkpoints: VideoCheckpoint[]; publishedAt: string };
export type VideoDraftInput = { title: string; youtubeId: string; lessonId: string | null; checkpoints: VideoCheckpoint[] };
const teacherPath = (id: string) => `/teacher/interactive-videos/${encodeURIComponent(id)}`;

export const listTeacherVideos = (page = 1) => apiGet<VideoPage<TeacherVideo>>(`/teacher/interactive-videos?page=${page}`);
export const getTeacherVideo = (id: string) => apiGet<One<TeacherVideo>>(teacherPath(id)).then(response => response.data);
export const createTeacherVideo = (input: VideoDraftInput) =>
  apiRequest<One<TeacherVideo>>("/teacher/interactive-videos", "POST", input).then(response => response.data);
export const updateTeacherVideo = (id: string, input: VideoDraftInput, expectedVersion: number) =>
  apiRequest<One<TeacherVideo>>(teacherPath(id), "PUT", { ...input, expectedVersion }).then(response => response.data);
export const publishTeacherVideo = (id: string, classroomIds: string[], expectedVersion: number) =>
  apiRequest<One<TeacherVideo>>(`${teacherPath(id)}/publish`, "POST", { classroomIds, expectedVersion }).then(response => response.data);
export const deleteTeacherVideo = (id: string, expectedVersion: number) =>
  apiRequest<null>(teacherPath(id), "DELETE", { expectedVersion });
export const listStudentVideos = (page = 1, classroomId?: string) => {
  const query = new URLSearchParams({ page: String(page) });
  if (classroomId) query.set("classroomId", classroomId);
  return apiGet<VideoPage<StudentVideo>>(`/student/interactive-videos?${query}`);
};
export const getStudentVideo = (publicationId: string) =>
  apiGet<One<StudentVideo>>(`/student/interactive-videos/${encodeURIComponent(publicationId)}`).then(response => response.data);
