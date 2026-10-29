import { apiGet, apiRequest } from "./client";

export type ClassroomPreview = {
  id: string;
  name: string;
  code: string;
  academicYear: string;
  description: string | null;
  coverImage: string | null;
  status: "active" | "archived";
  createdAt: string;
};

export type ClassroomJoinRequest = {
  id: string;
  classroomId: string;
  studentId: number;
  studentName: string;
  email: string;
  studentCode: string;
  declaredClass: string;
  requestedAt: string;
  verificationStatus: "matched" | "unverified" | "mismatch" | "conflict" | "manual_verified";
  status: "pending" | "approved" | "rejected";
  manualVerification?: {
    rosterEntryId: string;
    originalStudentCode: string;
    resolvedStudentCode: string;
    reason: "wrong_student_code" | "wrong_declared_class" | "account_name_difference" | "other";
    note: string;
    verifiedAt: string;
  };
};

export type ClassroomMembership = {
  id: string;
  classroom: ClassroomPreview;
  status: "active" | "left";
  joinedAt: string;
  leftAt: string | null;
};

export type ApiPage<T> = {
  data: T[];
  meta: { current_page: number; last_page: number; total: number };
};

export async function lookupStudentClassroom(code: string): Promise<ClassroomPreview> {
  const response = await apiGet<{ data: ClassroomPreview }>(`/student/classrooms/lookup/${encodeURIComponent(code.trim())}`);
  return response.data;
}

export async function createStudentJoinRequest(input: { class_code: string; student_code: string; declared_class: string }): Promise<ClassroomJoinRequest> {
  const response = await apiRequest<{ data: ClassroomJoinRequest }>("/student/join-requests", "POST", input);
  return response.data;
}

export async function getStudentJoinRequests(): Promise<ClassroomJoinRequest[]> {
  const requests: ClassroomJoinRequest[] = [];
  for (let page = 1, lastPage = 1; page <= lastPage; page += 1) {
    const response = await apiGet<ApiPage<ClassroomJoinRequest>>(`/student/join-requests?page=${page}`);
    requests.push(...response.data);
    lastPage = response.meta.last_page;
  }
  return requests;
}

export async function getStudentActiveMemberships(): Promise<ClassroomMembership[]> {
  const memberships: ClassroomMembership[] = [];
  for (let page = 1, lastPage = 1; page <= lastPage; page += 1) {
    const response = await apiGet<ApiPage<ClassroomMembership>>(`/student/classrooms?page=${page}`);
    memberships.push(...response.data);
    lastPage = response.meta.last_page;
  }
  return memberships;
}

export async function getStudentActiveMembershipsPage(page = 1): Promise<ApiPage<ClassroomMembership>> {
  return apiGet(`/student/classrooms?page=${page}`);
}

export async function getStudentClassroom(classroomId: string): Promise<ClassroomPreview> {
  const response = await apiGet<{ data: ClassroomPreview }>(`/student/classrooms/${encodeURIComponent(classroomId)}`);
  return response.data;
}

export async function leaveStudentClassroom(membershipId: string): Promise<ClassroomMembership> {
  const response = await apiRequest<{ data: ClassroomMembership }>(`/student/memberships/${encodeURIComponent(membershipId)}/leave`, "POST");
  return response.data;
}

export type ManualVerificationInput = {
  roster_entry_id: string;
  reason: "wrong_student_code" | "wrong_declared_class" | "account_name_difference" | "other";
  note: string;
};

export async function manuallyVerifyTeacherJoinRequest(classroomId: string, requestId: string, input: ManualVerificationInput): Promise<ClassroomMembership> {
  const response = await apiRequest<{ data: ClassroomMembership }>(`/teacher/classrooms/${encodeURIComponent(classroomId)}/join-requests/${encodeURIComponent(requestId)}/manual-verify`, "POST", input);
  return response.data;
}

export function getTeacherJoinRequests(classroomId: string, page = 1): Promise<ApiPage<ClassroomJoinRequest>> {
  return apiGet(`/teacher/classrooms/${encodeURIComponent(classroomId)}/join-requests?page=${page}`);
}

export async function approveTeacherJoinRequest(classroomId: string, requestId: string): Promise<ClassroomMembership> {
  const response = await apiRequest<{ data: ClassroomMembership }>(`/teacher/classrooms/${encodeURIComponent(classroomId)}/join-requests/${encodeURIComponent(requestId)}/approve`, "POST");
  return response.data;
}

export async function rejectTeacherJoinRequest(classroomId: string, requestId: string): Promise<ClassroomJoinRequest> {
  const response = await apiRequest<{ data: ClassroomJoinRequest }>(`/teacher/classrooms/${encodeURIComponent(classroomId)}/join-requests/${encodeURIComponent(requestId)}/reject`, "POST");
  return response.data;
}
