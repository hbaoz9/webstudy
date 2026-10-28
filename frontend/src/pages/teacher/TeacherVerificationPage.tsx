import { useEffect, useState } from "react";
import { Clock3, ShieldCheck, TriangleAlert } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { RegistrationNotice } from "../../components/common/RegistrationNotice";
import { useAuth } from "../../contexts/AuthContext";
import { apiGet } from "../../service/api/client";

type VerificationDetails = {
  verification_status: "unverified" | "pending" | "rejected" | "verified";
  submissions: {
    id: number;
    school_name: string;
    submitted_at: string | null;
    rejection_reason: string | null;
  }[];
};

export default function TeacherVerificationPage() {
  const { session } = useAuth();
  const status = session?.teacherVerificationStatus ?? "unverified";
  const [details, setDetails] = useState<VerificationDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

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

  if (status === "verified") return <Navigate to="/teacher/dashboard" replace />;

  const latest = details?.verification_status === status ? details.submissions[0] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <RegistrationNotice role="teacher" />
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Xác minh tài khoản giáo viên</h1>
        <p className="mt-2 text-sm leading-6 text-secondary">
          Xác minh giúp bảo vệ học sinh và bảo đảm chỉ giáo viên hợp lệ được tạo lớp, quản lý học sinh và giao bài tập.
        </p>
      </div>

      <section aria-labelledby="verification-status-title" className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-7">
        <div className="flex items-start gap-4">
          <span className={status === "rejected" ? "grid size-12 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600" : status === "pending" ? "grid size-12 shrink-0 place-items-center rounded-xl bg-amber/10 text-amber-700" : "grid size-12 shrink-0 place-items-center rounded-xl bg-emerald/10 text-emerald"}>
            {status === "rejected" ? <TriangleAlert aria-hidden="true" className="size-6" /> : status === "pending" ? <Clock3 aria-hidden="true" className="size-6" /> : <ShieldCheck aria-hidden="true" className="size-6" />}
          </span>
          <div>
            <h2 id="verification-status-title" className="text-lg font-extrabold text-ink">
              {status === "pending" ? "Hồ sơ đang chờ xét duyệt" : status === "rejected" ? "Hồ sơ chưa được chấp nhận" : "Tài khoản chưa được xác minh"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-secondary">
              {status === "pending"
                ? "Bạn không cần gửi lại hồ sơ. Trạng thái sẽ được cập nhật sau khi quản trị viên xét duyệt."
                : status === "rejected"
                  ? "Vui lòng xem lý do bên dưới. Chức năng gửi lại minh chứng sẽ mở khi hệ thống hỗ trợ tiếp nhận file."
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
          {status === "rejected" && <p className="mt-2 text-red-700">Lý do: {latest.rejection_reason || "Chưa có lý do cụ thể. Vui lòng liên hệ quản trị viên."}</p>}
        </div>}
      </section>

      {(status === "unverified" || status === "rejected") && <section className="rounded-2xl border border-amber/40 bg-amber/10 p-5 sm:p-6">
        <h2 className="font-extrabold text-ink">Tiếp nhận minh chứng đang được hoàn thiện</h2>
        <p className="mt-2 text-sm leading-6 text-secondary">
          WebStudy hiện chưa tải và lưu file minh chứng lên máy chủ. Vì vậy, bạn chưa thể hoàn tất hoặc gửi lại hồ sơ xác minh tại đây. Chúng tôi sẽ mở bước này khi hệ thống tiếp nhận tài liệu an toàn.
        </p>
      </section>}

      <div className="flex flex-wrap gap-3">
        <Link to="/teacher/dashboard" className="inline-flex min-h-11 items-center rounded-full bg-emerald px-5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald">Về tổng quan</Link>
        <Link to="/" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald">Trang chủ</Link>
      </div>
      <p className="text-xs leading-5 text-muted">Trạng thái xác minh và quyền truy cập do máy chủ quyết định.</p>
    </div>
  );
}
