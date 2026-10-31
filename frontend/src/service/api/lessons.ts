import { apiGet, apiRequest } from "./client";
import type { LessonContent } from "../../types/curriculum";

export type TeacherLessonRecord = {
  id: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  partId: string;
  partNumber: number;
  partTitle: string;
  number: number;
  title: string;
  status: "uncreated" | "draft" | "published";
  draftContent: LessonContent | null;
  publishedContent: LessonContent | null;
  publishedAt: string | null;
  classroomIds: string[];
};

export type StudentLessonSummary = Pick<
  TeacherLessonRecord,
  "id" | "chapterId" | "chapterNumber" | "chapterTitle" |
  "partId" | "partNumber" | "partTitle" | "number" | "title" | "publishedAt"
>;

export type PublishedLessonContent = Omit<LessonContent, "status" | "draft"> & { status: "published" };

export type StudentLessonDetail = StudentLessonSummary & {
  content: PublishedLessonContent;
};

const path = (id: string) => `/teacher/lessons/${encodeURIComponent(id)}`;
const studentPath = (id: string) => `/student/lessons/${encodeURIComponent(id)}`;

export async function getStudentLessons(): Promise<StudentLessonSummary[]> {
  return (await apiGet<{ data: StudentLessonSummary[] }>("/student/lessons")).data;
}

export async function getStudentLesson(id: string): Promise<StudentLessonDetail> {
  return (await apiGet<{ data: StudentLessonDetail }>(studentPath(id))).data;
}

export async function getTeacherLessons(): Promise<TeacherLessonRecord[]> {
  return (await apiGet<{ data: TeacherLessonRecord[] }>("/teacher/lessons")).data;
}

export async function saveTeacherLessonDraft(id: string, content: LessonContent): Promise<TeacherLessonRecord> {
  return (await apiRequest<{ data: TeacherLessonRecord }>(`${path(id)}/draft`, "PUT", { content })).data;
}

export async function publishTeacherLesson(id: string, classroomIds: string[]): Promise<TeacherLessonRecord> {
  return (await apiRequest<{ data: TeacherLessonRecord }>(`${path(id)}/publish`, "POST", { classroomIds })).data;
}

export async function withdrawTeacherLesson(id: string): Promise<TeacherLessonRecord> {
  return (await apiRequest<{ data: TeacherLessonRecord }>(`${path(id)}/withdraw`, "POST")).data;
}
