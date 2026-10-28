import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function RegistrationNotice({ role }: { role: "student" | "teacher" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(() => location.state?.registrationComplete === true);

  useEffect(() => {
    if (!visible) return;
    navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null });
    const timer = window.setTimeout(() => setVisible(false), 8000);
    return () => window.clearTimeout(timer);
  }, [visible, navigate, location.pathname, location.search, location.hash]);

  if (!visible) return null;

  return (
    <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-emerald/30 bg-emerald/10 px-4 py-3 text-sm text-ink">
      <p>
        <span className="font-bold">Tài khoản đã được tạo.</span>{" "}
        {role === "student" ? "Bạn có thể bắt đầu khám phá bài học." : "Xem các bước xác minh tài khoản giáo viên bên dưới."}
      </p>
      <button type="button" onClick={() => setVisible(false)} aria-label="Đóng thông báo" className="shrink-0 rounded px-2 font-bold text-emerald focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">Đóng</button>
    </div>
  );
}
