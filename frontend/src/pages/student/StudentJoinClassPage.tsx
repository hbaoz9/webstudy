import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useStudentAccount } from "../../contexts/StudentAccountContext";
import { useTeacherData } from "../../contexts/TeacherDataContext";

import type { JoinRequest } from "../../types/teacher";
import { resolveJoinRequestVerification } from "../../utils/rosterMatching";

export default function StudentJoinClassPage() {
  const {
    classrooms,
    getJoinRequests,
    getRosterEntries,
    isStudentJoinedClass,
    updateClassJoinRequests,
  } = useTeacherData();

  const { student, updateStudent } = useStudentAccount();
  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email);
  const [classCode, setClassCode] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [declaredClass, setDeclaredClass] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const normalizedClassCode = classCode.trim().toUpperCase();

  const targetClassroom = classrooms.find(
    (item) =>
      item.status !== "archived" &&
      item.code.trim().toUpperCase() === normalizedClassCode,
  );

  const studentRequests = targetClassroom
    ? getJoinRequests(targetClassroom.id).filter(
        (request) => request.studentId === student.id,
      )
    : [];

  const latestRequest = studentRequests.at(-1);

  const isJoined = targetClassroom
    ? isStudentJoinedClass(targetClassroom.id, student.id)
    : false;

  const hasApprovedRequest = studentRequests.some(
    (request) => request.status === "approved",
  );

  type JoinState = "none" | "joined" | "pending" | "rejected" | "needs_link";

  const joinState: JoinState = isJoined
    ? "joined"
    : hasApprovedRequest
      ? "needs_link"
      : latestRequest?.status === "pending"
        ? "pending"
        : latestRequest?.status === "rejected"
          ? "rejected"
          : "none";

  const isSubmitLocked =
    joinState === "joined" ||
    joinState === "pending" ||
    joinState === "needs_link";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    // 1. Chuẩn hóa dữ liệu nhập
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedStudentCode = studentCode.trim();
    const trimmedDeclaredClass = declaredClass.trim();

    // 2. Kiểm tra thông tin bắt buộc
    if (!trimmedName || !trimmedEmail) {
      setError("Vui lòng nhập đầy đủ họ tên và email.");
      return;
    }

    if (!classCode.trim()) {
      setError("Vui lòng nhập mã lớp học.");
      return;
    }

    if (!trimmedStudentCode || !trimmedDeclaredClass) {
      setError("Vui lòng nhập mã học sinh và lớp đang học.");
      return;
    }

    // 3. Kiểm tra lớp có tồn tại và đang hoạt động
    const classroom = targetClassroom;

    if (!classroom) {
      setError("Không tìm thấy lớp đang hoạt động với mã lớp này.");
      return;
    }

    // 4. Kiểm tra quyền thành viên
    if (isStudentJoinedClass(classroom.id, student.id)) {
      setError("Bạn đã là thành viên của lớp học này.");
      return;
    }

    // 5. Không cho gửi trùng yêu cầu chưa bị từ chối
    const alreadyRequested = getJoinRequests(classroom.id).some(
      (request) =>
        request.studentId === student.id && request.status !== "rejected",
    );

    if (alreadyRequested) {
      setError("Bạn đã có yêu cầu đang xử lý hoặc đã được duyệt vào lớp này.");
      return;
    }

    // 6. Tạo yêu cầu mới
    const request: JoinRequest = {
      id: `request-${crypto.randomUUID()}`,
      studentId: student.id,

      studentName: trimmedName,
      email: trimmedEmail,

      studentCode: trimmedStudentCode,
      declaredClass: trimmedDeclaredClass,

      requestedAt: new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date()),

      verificationStatus: "unverified",
      status: "pending",
    };

    // 7. Đối chiếu với danh sách học sinh
    request.verificationStatus = resolveJoinRequestVerification(
      request,
      getRosterEntries(classroom.id),
      classroom.name,
    );

    // 8. Cập nhật yêu cầu của lớp
    updateClassJoinRequests(classroom.id, (currentRequests) => [
      ...currentRequests,
      request,
    ]);

    // 9. Cập nhật hồ sơ Student
    updateStudent({
      name: trimmedName,
      email: trimmedEmail,
    });

    // 10. Phản hồi kết quả
    setSuccess(
      `Đã gửi yêu cầu tham gia ${classroom.name}. Vui lòng chờ giáo viên duyệt.`,
    );
  };

  return (
    <div className="px-4 py-6">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-xl space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card"
      >
        <h1 className="text-2xl font-extrabold text-ink">Tham gia lớp học</h1>

        <p className="text-sm text-secondary">
          Nhập mã lớp do giáo viên cung cấp và thông tin học sinh để gửi yêu cầu
          tham gia.
        </p>

        <label className="block text-sm font-semibold text-ink">
          Họ và tên
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-line px-4"
          />
        </label>

        <label className="block text-sm font-semibold text-ink">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-line px-4"
          />
        </label>

        <label className="block text-sm font-semibold text-ink">
          Mã lớp do giáo viên cung cấp
          <input
            required
            value={classCode}
            onChange={(event) => {
              setClassCode(event.target.value);
              setError("");
              setSuccess("");
            }}
            className="mt-2 h-12 w-full rounded-lg border border-line px-4"
          />
        </label>

        {targetClassroom && (
          <div className="space-y-3 rounded-xl border border-line bg-canvas p-4">
            <div>
              <p className="text-xs font-semibold text-secondary">
                LỚP HỌC ĐƯỢC TÌM THẤY
              </p>

              <h2 className="mt-1 text-lg font-extrabold text-ink">
                {targetClassroom.name}
              </h2>

              {targetClassroom.academicYear && (
                <p className="mt-1 text-xs text-secondary">
                  Năm học {targetClassroom.academicYear}
                </p>
              )}
            </div>

            {joinState === "joined" && (
              <p
                role="status"
                className="rounded-lg bg-emerald/10 p-3 text-sm text-emerald-700"
              >
                Bạn đã là thành viên của lớp học này.
              </p>
            )}

            {joinState === "pending" && (
              <p
                role="status"
                className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700"
              >
                Yêu cầu của bạn đang chờ giáo viên duyệt. Bạn không cần gửi lại.
              </p>
            )}

            {joinState === "needs_link" && (
              <p
                role="status"
                className="rounded-lg bg-sky-50 p-3 text-sm text-sky-700"
              >
                Giáo viên đã duyệt yêu cầu nhưng tài khoản chưa được liên kết
                với danh sách lớp. Vui lòng liên hệ giáo viên để kiểm tra.
              </p>
            )}

            {joinState === "rejected" && (
              <p
                role="status"
                className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
              >
                Yêu cầu trước đó đã bị từ chối. Bạn có thể kiểm tra thông tin và
                gửi lại.
              </p>
            )}

            {joinState === "none" && (
              <p className="text-sm text-secondary">
                Lớp đang nhận yêu cầu tham gia. Vui lòng nhập chính xác thông
                tin học sinh.
              </p>
            )}
          </div>
        )}

        <label className="block text-sm font-semibold text-ink">
          Mã học sinh trong danh sách lớp
          <input
            required
            value={studentCode}
            onChange={(event) => setStudentCode(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-line px-4"
          />
        </label>

        <label className="block text-sm font-semibold text-ink">
          Lớp đang học (ví dụ: 10A1)
          <input
            required
            value={declaredClass}
            onChange={(event) => setDeclaredClass(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-line px-4"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-emerald-700">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitLocked}
          className={`min-h-12 rounded-xl px-6 py-3 text-sm font-bold transition ${
            isSubmitLocked
              ? "cursor-not-allowed bg-slate-200 text-slate-500"
              : "bg-emerald-700 text-white hover:opacity-90"
          }`}
        >
          {joinState === "joined"
            ? "Đã tham gia lớp"
            : joinState === "pending"
              ? "Đang chờ giáo viên duyệt"
              : joinState === "needs_link"
                ? "Đang chờ kiểm tra liên kết"
                : joinState === "rejected"
                  ? "Gửi lại yêu cầu tham gia"
                  : "Gửi yêu cầu tham gia"}
        </button>

        <div>
          <Link
            to="/student/classes"
            className="text-sm font-bold text-emerald-700 hover:underline"
          >
            ← Quay về Lớp học của tôi
          </Link>
        </div>
      </form>
    </div>
  );
}
