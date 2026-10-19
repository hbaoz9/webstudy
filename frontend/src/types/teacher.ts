export type Classroom = {
  id: string;
  name: string;
  code: string;
  studentCount: number;
  completionRate: number;
  coverImage: string;

  academicYear?: string;
  description?: string;

  status?: "active" | "archived";
  createdAt?: string;
};

export type VerificationStatus =
  | "matched"
  | "unverified"
  | "mismatch"
  | "conflict"
  | "manual_verified";

export type JoinRequestStatus = "pending" | "approved" | "rejected";

export interface ClassRosterEntry {
  id: string;

  /**
   * Số thứ tự ban đầu trong danh sách Excel.
   */
  orderNumber: number;

  fullName: string;

  /**
   * Mã học sinh dùng trong phạm vi lớp.
   * Giáo viên có thể nhập hoặc hệ thống tự sinh.
   * Ví dụ: 10A1-01.
   */
  studentCode: string;

  linkedUserId?: string;

  status: "not_joined" | "joined" | "conflict";
}

export type ManualVerificationReason =
  | "wrong_student_code"
  | "wrong_declared_class"
  | "account_name_difference"
  | "other";

export interface ManualVerificationPayload {
  requestId: string;
  rosterEntryId: string;
  reason: ManualVerificationReason;
  note: string;
}

export interface ManualVerificationData {
  rosterEntryId: string;

  originalStudentCode: string;
  resolvedStudentCode: string;

  reason: ManualVerificationReason;
  note: string;
  verifiedAt: string;
}

export interface JoinRequest {
  id: string;

  /**
   * ID tài khoản trên hệ thống.
   */
  studentId: string;
  studentName: string;
  email: string;

  /**
   * Mã học sinh đã nhập khi tham gia lớp.
   */
  studentCode: string;

  declaredClass: string;
  requestedAt: string;

  verificationStatus: VerificationStatus;
  status: JoinRequestStatus;

  manualVerification?: ManualVerificationData;
}

export type RosterCodeSource = "provided" | "generated";

export interface RosterImportRow {
  /**
   * Số dòng thật trong file Excel.
   * Dùng để báo lỗi cho giáo viên.
   */
  excelRow: number;

  orderNumber: number;
  fullName: string;
  studentCode: string;

  /**
   * provided: mã có sẵn trong Excel.
   * generated: hệ thống tự sinh mã.
   */
  codeSource: RosterCodeSource;

  /**
   * Mảng rỗng nghĩa là dòng hợp lệ.
   */
  errors: string[];
}
