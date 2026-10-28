import { useEffect, useState, type FormEvent } from "react";
import { Clock3, ShieldCheck, TriangleAlert } from "lucide-react";
import { RegistrationNotice } from "../../components/common/RegistrationNotice";
import { VerificationDocumentViewer } from "../../components/teacher/VerificationDocumentViewer";
import { useAuth } from "../../contexts/AuthContext";
import { ApiError, apiGet, apiRequest } from "../../service/api/client";

type VerificationDetails = {
  verification_status: "unverified" | "pending" | "rejected" | "verified";
  submissions: {
    id: number;
    full_name: string;
    school_name: string;
    school_address: string;
    teacher_code: string | null;
    position: string;
    submitted_at: string | null;
    rejection_reason: string | null;
    document: { name: string; available: boolean };
  }[];
};

export default function TeacherVerificationPage() {
  const { session, refreshSession } = useAuth();
  const status = session?.teacherVerificationStatus ?? "unverified";
  const [details, setDetails] = useState<VerificationDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [fullName, setFullName] = useState(session?.name ?? "");
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [position, setPosition] = useState("Giáo viên");
  const [document, setDocument] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successSubmissionId, setSuccessSubmissionId] = useState<number | null>(null);
  const displayStatus = status === "pending" && (details?.verification_status === "rejected" || details?.verification_status === "verified")
    ? details.verification_status : status;
  const latest = details?.verification_status === displayStatus ? details.submissions[0] : undefined;
  const showSuccess = displayStatus === "pending" && latest?.id === successSubmissionId;

  useEffect(() => {
    if (successSubmissionId === null) return;
    const timer = window.setTimeout(() => setSuccessSubmissionId(null), 6000);
    return () => window.clearTimeout(timer);
  }, [successSubmissionId]);

  useEffect(() => {
    if (status !== "pending" && status !== "rejected") return;
    let active = true;
    setLoading(true);
    setError("");
    void apiGet<{ data: VerificationDetails }>("/teacher/verification")
      .then((response) => { if (active) setDetails(response.data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không thể tải trạng thái xác minh."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status, revision]);

  useEffect(() => {
    if (displayStatus !== "rejected" || details?.verification_status !== "rejected") return;
    const previous = details.submissions[0];
    if (!previous) return;
    setFullName(previous.full_name);
    setSchoolName(previous.school_name);
    setSchoolAddress(previous.school_address);
    setTeacherCode(previous.teacher_code ?? "");
    setPosition(previous.position);
  }, [displayStatus, details]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setSuccessSubmissionId(null);
    if (!document) { setFormError("Vui lòng chọn file minh chứng."); return; }
    if (document.size > 5 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(document.type)) {
      setFormError("Chọn file PDF, JPG hoặc PNG không quá 5 MB.");
      return;
    }
    const body = new FormData();
    body.append("full_name", fullName.trim());
    body.append("school_name", schoolName.trim());
    body.append("school_address", schoolAddress.trim());
    if (teacherCode.trim()) body.append("teacher_code", teacherCode.trim());
    body.append("position", position);
    body.append("document", document);
    setSubmitting(true);
    try {
      const response = await apiRequest<{ data: { id: number } }>("/teacher/verification", "POST", body);
      setSuccessSubmissionId(response.data.id);
      setDocument(null);
      await refreshSession();
    } catch (cause) {
      const validation = cause instanceof ApiError ? Object.values(cause.errors).flat()[0] : undefined;
      setFormError(validation ?? (cause instanceof Error ? cause.message : "Không thể gửi hồ sơ."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[820px] space-y-5 pb-2">
      <RegistrationNotice role="teacher" />
      {showSuccess && <p role="status" className="rounded-xl border border-emerald/30 bg-emerald/10 p-4 text-sm text-ink">Minh chứng đã được tải lên. Hồ sơ đang chờ xét duyệt.</p>}
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Xác minh tài khoản giáo viên</h1>
        <p className="mt-2 text-sm leading-6 text-secondary">
          Xác minh giúp bảo vệ học sinh và bảo đảm chỉ giáo viên hợp lệ được tạo lớp, quản lý học sinh và giao bài tập.
        </p>
      </div>

      <section aria-labelledby="verification-status-title" className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-7">
        <div className="flex items-start gap-4">
          <span className={displayStatus === "rejected" ? "grid size-12 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600" : displayStatus === "pending" ? "grid size-12 shrink-0 place-items-center rounded-xl bg-amber/10 text-amber-700" : "grid size-12 shrink-0 place-items-center rounded-xl bg-emerald/10 text-emerald"}>
            {displayStatus === "rejected" ? <TriangleAlert aria-hidden="true" className="size-6" /> : displayStatus === "pending" ? <Clock3 aria-hidden="true" className="size-6" /> : <ShieldCheck aria-hidden="true" className="size-6" />}
          </span>
          <div>
            <h2 id="verification-status-title" className="text-lg font-extrabold text-ink">
              {displayStatus === "verified" ? "Tài khoản đã được xác minh" : displayStatus === "pending" ? "Hồ sơ đang chờ xét duyệt" : displayStatus === "rejected" ? "Hồ sơ chưa được chấp nhận" : "Tài khoản chưa được xác minh"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-secondary">
              {displayStatus === "verified"
                ? "Bạn đã được cấp quyền giáo viên để tạo lớp, quản lý học sinh và sử dụng các chức năng dành cho giáo viên."
                : displayStatus === "pending"
                ? "Bạn không cần gửi lại hồ sơ. Trạng thái sẽ được cập nhật sau khi quản trị viên xét duyệt."
                : displayStatus === "rejected"
                  ? "Vui lòng xem lý do bên dưới, điều chỉnh thông tin và gửi lại minh chứng."
                  : "Để mở quyền quản lý lớp, bạn cần gửi thông tin trường và minh chứng công tác để được xét duyệt."}
            </p>
          </div>
        </div>

        {loading && <p role="status" className="mt-4 text-sm text-secondary">Đang tải trạng thái hồ sơ…</p>}
        {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error} <button type="button" onClick={() => setRevision((value) => value + 1)} className="ml-2 min-h-11 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600">Thử lại</button>
        </div>}
        {latest && <div className="mt-5 rounded-xl bg-canvas p-4 text-sm text-secondary">
          <p className="font-bold text-ink">{latest.school_name}</p>
          {latest.submitted_at && <p className="mt-1">Gửi lúc {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(latest.submitted_at))}</p>}
          <dl className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Người gửi</dt><dd className="font-medium text-ink">{latest.full_name}</dd></div>
            <div><dt className="text-xs text-muted">Vị trí công tác</dt><dd className="font-medium text-ink">{latest.position}</dd></div>
            <div><dt className="text-xs text-muted">Địa chỉ trường</dt><dd className="font-medium text-ink">{latest.school_address}</dd></div>
            {latest.teacher_code && <div><dt className="text-xs text-muted">Mã giáo viên</dt><dd className="font-medium text-ink">{latest.teacher_code}</dd></div>}
          </dl>
          {displayStatus === "rejected" && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-700">Lý do từ chối: {latest.rejection_reason || "Chưa có lý do cụ thể. Vui lòng liên hệ quản trị viên."}</p>}
          {latest.document?.available && <VerificationDocumentViewer key={latest.id} submissionId={latest.id} label="Xem minh chứng đã gửi" />}
          {latest.document && !latest.document.available && <p className="mt-2 text-amber-700">Hồ sơ cũ chỉ có thông tin file, không có nội dung minh chứng.</p>}
        </div>}
      </section>

      {(displayStatus === "unverified" || displayStatus === "rejected") && <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-7">
        <h2 className="text-lg font-extrabold text-ink">{displayStatus === "rejected" ? "Gửi lại hồ sơ" : "Gửi hồ sơ xác minh"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Họ và tên *<input required minLength={2} maxLength={255} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" className="mt-2 min-h-12 w-full rounded-xl border border-line px-4 font-normal" /></label>
          <label className="text-sm font-bold">Vị trí công tác *<select required value={position} onChange={(event) => setPosition(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 font-normal"><option>Giáo viên</option><option>Tổ trưởng chuyên môn</option><option>Giáo viên thỉnh giảng</option></select></label>
          <label className="text-sm font-bold">Tên trường *<input required minLength={2} maxLength={255} value={schoolName} onChange={(event) => setSchoolName(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-line px-4 font-normal" /></label>
          <label className="text-sm font-bold">Mã giáo viên<input maxLength={255} value={teacherCode} onChange={(event) => setTeacherCode(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-line px-4 font-normal" /></label>
        </div>
        <label className="block text-sm font-bold">Địa chỉ trường *<input required minLength={5} maxLength={255} value={schoolAddress} onChange={(event) => setSchoolAddress(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-line px-4 font-normal" /></label>
        <label className="block text-sm font-bold">Minh chứng công tác *<span className="mt-1 block text-xs font-normal leading-5 text-secondary">Thẻ giáo viên, quyết định công tác hoặc giấy xác nhận. PDF, JPG hoặc PNG; tối đa 5 MB. File chỉ được lưu khi máy chủ xác nhận gửi thành công.</span><input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setDocument(event.target.files?.[0] ?? null)} className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-canvas p-2 font-normal" /></label>
        {formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
        <button type="submit" disabled={submitting} className="min-h-12 rounded-full bg-emerald px-6 text-sm font-bold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald">{submitting ? "Đang tải lên…" : displayStatus === "rejected" ? "Gửi lại hồ sơ" : "Gửi hồ sơ"}</button>
      </form>}
      <p className="text-xs leading-5 text-muted">Trạng thái xác minh và quyền truy cập do máy chủ quyết định.</p>
    </div>
  );
}
