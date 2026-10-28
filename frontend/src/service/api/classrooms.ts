import { apiGet, apiRequest } from "./client";

export type TeacherClassroom = {
  id: string;
  name: string;
  code: string;
  academicYear: string;
  description: string | null;
  coverImage: string | null;
  status: "active" | "archived";
  createdAt: string;
  studentCount: number;
};

export type CreateClassroomInput = {
  name: string;
  academic_year: string;
  description: string | null;
  cover_image_path: string | null;
};

type ClassroomPage = {
  data: TeacherClassroom[];
  meta: { last_page: number };
};

export async function listTeacherClassrooms(): Promise<TeacherClassroom[]> {
  const classrooms: TeacherClassroom[] = [];
  let page = 1;
  let lastPage = 1;

  while (page <= lastPage) {
    const response = await apiGet<ClassroomPage>(`/teacher/classrooms?page=${page}`);
    classrooms.push(...response.data);
    lastPage = response.meta.last_page;
    page += 1;
  }

  return classrooms;
}

export async function getTeacherClassroom(id: string): Promise<TeacherClassroom> {
  const response = await apiGet<{ data: TeacherClassroom }>(`/teacher/classrooms/${encodeURIComponent(id)}`);
  return response.data;
}

export async function createTeacherClassroom(input: CreateClassroomInput): Promise<TeacherClassroom> {
  const response = await apiRequest<{ data: TeacherClassroom }>("/teacher/classrooms", "POST", input);
  return response.data;
}

export async function updateTeacherClassroom(id: string, input: CreateClassroomInput): Promise<TeacherClassroom> {
  const response = await apiRequest<{ data: TeacherClassroom }>(`/teacher/classrooms/${encodeURIComponent(id)}`, "PUT", input);
  return response.data;
}

export async function archiveTeacherClassroom(id: string): Promise<TeacherClassroom> {
  const response = await apiRequest<{ data: TeacherClassroom }>(`/teacher/classrooms/${encodeURIComponent(id)}/archive`, "POST");
  return response.data;
}
