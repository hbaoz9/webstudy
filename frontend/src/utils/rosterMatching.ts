import type {
    ClassRosterEntry,
    RosterImportRow,
    JoinRequest,
    VerificationStatus,
} from '../types/teacher';

function normalizeText(value: string) {
    return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function normalizeClassName(value: string) {
    return normalizeText(value)
    .replace(/^lop\s*/, '')
    .replace(/\s+/g, '');
}

export function normalizeStudentCode(
    value: string,
) {
    return value
        .trim()
        .replace(/\s+/g, '')
        .toUpperCase();
}

export function resolveJoinRequestVerification(
  request: JoinRequest,
  rosterEntries: ClassRosterEntry[],
  classroomName: string,
): VerificationStatus {
  /*
   * Giáo viên đã xác minh thủ công thì
   * không ghi đè kết quả đó.
   */
  if (
    request.verificationStatus ===
    'manual_verified'
  ) {
    return 'manual_verified';
  }

  const requestedClass =
    normalizeClassName(
      request.declaredClass,
    );

  const currentClass =
    normalizeClassName(classroomName);

  /*
   * Học sinh nhập đúng mã nhưng
   * khai báo xin vào lớp khác.
   */
  if (requestedClass !== currentClass) {
    return 'mismatch';
  }

  const requestCode =
    normalizeStudentCode(
      request.studentCode,
    );

  const rosterEntry = rosterEntries.find(
    (entry) =>
      normalizeStudentCode(
        entry.studentCode,
      ) === requestCode,
  );

  /*
   * Mã không tồn tại trong danh sách Excel.
   */
  if (!rosterEntry) {
    return 'unverified';
  }

  /*
   * Mã đã thuộc về tài khoản khác.
   */
  if (
    rosterEntry.linkedUserId &&
    rosterEntry.linkedUserId !==
      request.studentId
  ) {
    return 'conflict';
  }

  return 'matched';
}
export function isCodeBlocked(
  request: JoinRequest,
  requests: readonly JoinRequest[],
  rosterEntries: readonly ClassRosterEntry[],
  studentCode = request.studentCode,
): boolean {
  const code = normalizeStudentCode(studentCode);

  const anotherPendingRequest = requests.some(
    (other) =>
      other.id !== request.id &&
      other.status === "pending" &&
      normalizeStudentCode(other.studentCode) === code,
  );

  const linkedToAnotherAccount = rosterEntries.some(
    (entry) =>
      normalizeStudentCode(entry.studentCode) === code &&
      !!entry.linkedUserId &&
      entry.linkedUserId !== request.studentId,
  );

  return anotherPendingRequest || linkedToAnotherAccount;
}

export function buildImportedRoster(
  rows: readonly RosterImportRow[],
  rosterEntries: readonly ClassRosterEntry[],
  classId: string,
): ClassRosterEntry[] {
  return rows.map((row) => {
    /*
     * Nếu giáo viên nhập lại Excel,
     * giữ liên kết tài khoản đã có.
     */
    const existingEntry = rosterEntries.find(
      (entry) =>
        normalizeStudentCode(entry.studentCode) ===
        normalizeStudentCode(row.studentCode),
    );

    return {
      id: existingEntry?.id ?? `${classId}-${row.studentCode}`,

      orderNumber: row.orderNumber,
      fullName: row.fullName,
      studentCode: row.studentCode,

      linkedUserId: existingEntry?.linkedUserId,

      status: existingEntry?.status ?? "not_joined",
    };
  });
}
