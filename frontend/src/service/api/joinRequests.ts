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
  studentCode: string | null;
  declaredClass: string | null;
  requestedAt: string;
  verificationStatus: "matched" | "unverified" | "mismatch" | "conflict" | "manual_verified";
  status: "pending" | "approved" | "rejected";
  manualVerification?: {
    rosterEntryId: string;
    originalStudentCode: string | null;
    resolvedStudentCode: string;
    reason: "wrong_student_code" | "student_code_unknown" | "wrong_declared_class" | "account_name_difference" | "other";
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

export type TeacherJoinRequestStatus = "all" | "pending" | "processed";
export type TeacherJoinRequestPage = ApiPage<ClassroomJoinRequest> & {
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  statusCounts: { pending: number; approved: number; rejected: number; processed: number; total: number };
};

export type BulkApprovalPreview = {
  data: {
    requestId: string;
    studentName: string;
    studentEmail: string;
    submittedStudentCode: string;
    rosterEntryId: string;
    rosterStudentName: string;
    rosterStudentCode: string;
  }[];
  summary: { eligibleTotal: number; requiresIndividualReviewTotal: number; pendingTotal: number };
  meta: { currentPage: number; lastPage: number; perPage: number; hasMore: boolean };
};

export type BulkApprovalResult = {
  approvedCount: number;
  skippedCount: number;
  results: { requestId: string; status: "approved" | "skipped"; reason?: string }[];
  statusCounts: TeacherJoinRequestPage["statusCounts"];
};

export async function lookupStudentClassroom(code: string): Promise<ClassroomPreview> {
  const response = await apiGet<{ data: ClassroomPreview }>(`/student/classrooms/lookup/${encodeURIComponent(code.trim())}`);
  return response.data;
}

export async function createStudentJoinRequest(input: { class_code: string; student_code?: string }): Promise<ClassroomJoinRequest> {
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
  reason: "wrong_student_code" | "student_code_unknown" | "wrong_declared_class" | "account_name_difference" | "other";
  note: string;
};

export async function manuallyVerifyTeacherJoinRequest(classroomId: string, requestId: string, input: ManualVerificationInput): Promise<ClassroomMembership> {
  const response = await apiRequest<{ data: ClassroomMembership }>(`/teacher/classrooms/${encodeURIComponent(classroomId)}/join-requests/${encodeURIComponent(requestId)}/manual-verify`, "POST", input);
  return response.data;
}

export function getTeacherJoinRequests(classroomId: string, page = 1, status?: TeacherJoinRequestStatus): Promise<TeacherJoinRequestPage> {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set("status", status);
  return apiGet(`/teacher/classrooms/${encodeURIComponent(classroomId)}/join-requests?${params}`);
}

export function previewTeacherBulkApproval(classroomId: string, page = 1): Promise<BulkApprovalPreview> {
  return apiRequest(`/teacher/classrooms/${encodeURIComponent(classroomId)}/join-requests/bulk-approve/preview`, "POST", { page });
}

export function executeTeacherBulkApproval(classroomId: string, requestIds: string[]): Promise<BulkApprovalResult> {
  return apiRequest(`/teacher/classrooms/${encodeURIComponent(classroomId)}/join-requests/bulk-approve`, "POST", { request_ids: requestIds });
}

export async function approveTeacherJoinRequest(classroomId: string, requestId: string): Promise<ClassroomMembership> {
  const response = await apiRequest<{ data: ClassroomMembership }>(`/teacher/classrooms/${encodeURIComponent(classroomId)}/join-requests/${encodeURIComponent(requestId)}/approve`, "POST");
  return response.data;
}

export async function rejectTeacherJoinRequest(classroomId: string, requestId: string): Promise<ClassroomJoinRequest> {
  const response = await apiRequest<{ data: ClassroomJoinRequest }>(`/teacher/classrooms/${encodeURIComponent(classroomId)}/join-requests/${encodeURIComponent(requestId)}/reject`, "POST");
  return response.data;
}
