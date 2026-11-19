import { apiGet, apiRequest } from "./client";

export type InfographicAsset = {
  id: string;
  title: string;
  chapterId: string;
  lessonId: string | null;
  mimeType: string;
  byteSize: number;
  imageUrl: string;
  publishedAt: string | null;
  version?: number;
  classroomIds?: string[];
  classroomId?: string;
  classroomName?: string;
};
type Page = { data: InfographicAsset[]; meta: { currentPage: number; lastPage: number; total: number } };

export function infographicImageUrl(asset: InfographicAsset): string {
  const backend = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");
  return `${backend}${asset.imageUrl}`;
}

export function listTeacherInfographics(chapterId: string, page = 1): Promise<Page> {
  return apiGet<Page>(`/teacher/infographics?chapterId=${encodeURIComponent(chapterId)}&page=${page}`);
}
export function listStudentInfographics(page = 1, classroomId?: string): Promise<Page> {
  return apiGet<Page>(`/student/infographics?page=${page}${classroomId ? `&classroomId=${encodeURIComponent(classroomId)}` : ""}`);
}
export async function uploadInfographic(chapterId: string, title: string, image: File): Promise<InfographicAsset> {
  const form = new FormData();
  form.set("chapterId", chapterId);
  form.set("title", title);
  form.set("image", image);
  return (await apiRequest<{ data: InfographicAsset }>("/teacher/infographics", "POST", form, 40000)).data;
}
export async function publishInfographic(id: string, expectedVersion: number, classroomIds: string[]): Promise<InfographicAsset> {
  return (await apiRequest<{ data: InfographicAsset }>(`/teacher/infographics/${encodeURIComponent(id)}/publish`,
    "POST", { expectedVersion, classroomIds })).data;
}
