import ContourBackground from "../../components/common/ContourBackground";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { authHomePath, useAuth, type AuthRole } from "../../contexts/AuthContext";
import { ApiError } from "../../service/api/client";
import { BookOpenCheck, GraduationCap, ArrowLeft, Compass } from "lucide-react";

type AuthTab = "login" | "register";

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, status, error, signIn, registerAccount, refreshSession } = useAuth();
  const role: AuthRole =
    searchParams.get("role") === "teacher" ? "teacher" : "student";
  const tab: AuthTab =
    searchParams.get("tab") === "register" ? "register" : "login";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const navigatingAfterSubmit = useRef(false);

  useEffect(() => {
    setFormError("");
  }, [role, tab]);

  const setMode = (nextTab: AuthTab, nextRole = role) => {
    const params = new URLSearchParams();
    params.set("role", nextRole);
    if (nextTab === "register") params.set("tab", "register");
    setSearchParams(params, { replace: true });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError("Vui lòng nhập email hợp lệ.");
      return;
    }
    if (tab === "register" && normalizedName.length < 2) {
      setFormError("Vui lòng nhập họ và tên có ít nhất 2 ký tự.");
      return;
    }
    if (tab === "register" && password !== confirmation) {
      setFormError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setPending(true);
    try {
      const authenticated = tab === "register"
        ? await registerAccount(role, normalizedName, normalizedEmail, password, confirmation)
        : await signIn(normalizedEmail, password);
      navigatingAfterSubmit.current = true;
      navigate(authHomePath(authenticated), {
        replace: true,
        state: tab === "register" ? { registrationComplete: true } : null,
      });
    } catch (cause) {
      const validation = cause instanceof ApiError
        ? Object.values(cause.errors).flat()[0]
        : undefined;
      setFormError(validation ?? (cause instanceof Error ? cause.message : "Không thể xác thực."));
    } finally {
      setPending(false);
    }
  };

  if (session && !pending && !navigatingAfterSubmit.current)
    return <Navigate to={authHomePath(session)} replace />;

  if (status === "loading")
    return <main role="status" className="grid min-h-dvh place-items-center bg-canvas px-4 text-sm text-secondary">Đang kiểm tra phiên đăng nhập…</main>;

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <ContourBackground className="absolute inset-0 h-full w-full text-[#14866E]/10" />
      </div>
      <Link
        to="/"
        className="absolute left-4 top-4 z-10 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-secondary transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald sm:left-8 sm:top-6"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Về trang chủ
      </Link>

      <section className="flex min-h-dvh items-center justify-center px-4 pb-10 pt-24 sm:px-6">
        <div className="w-full min-w-0 max-w-[440px]">
          <Link
            to="/"
            aria-label="WebStudy — về trang chủ"
            className="mb-6 flex items-center justify-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-ink text-white">
              <Compass aria-hidden="true" className="size-6" />
            </span>

            <span className="text-2xl font-extrabold tracking-tight text-ink">
              Web<span className="text-emerald">Study</span>
            </span>
          </Link>

          <div className="rounded-3xl border border-line bg-white px-5 py-7 shadow-card sm:px-8 sm:py-9">
            <h1 className="text-2xl font-extrabold leading-tight text-ink sm:text-3xl">
              {tab === "register"
                ? role === "teacher"
                  ? "Tạo tài khoản giáo viên"
                  : "Tạo tài khoản học sinh"
                : "Chào mừng trở lại!"}
            </h1>

            <p className="mt-3 text-sm leading-6 text-secondary">
              {role === "teacher"
                ? tab === "register"
                  ? "Bắt đầu tổ chức lớp học và giao bài tập trên WebStudy."
                  : "Quản lý lớp học, bài tập và học liệu Địa lí 10."
                : tab === "register"
                  ? "Tham gia lớp học và khám phá học liệu Địa lí 10."
                  : "Vào lớp, làm bài tập và theo dõi tiến độ học tập."}
            </p>
            <div
              role="group"
              aria-label="Chế độ tài khoản"
              className="mt-7 grid grid-cols-2 border-b border-line"
            >
              {(["login", "register"] as const).map((value) => {
                const selected = tab === value;

                return (
                  <button
                    key={value}
                    type="button"
                    disabled={pending}
                    onClick={() => setMode(value)}
                    aria-pressed={selected}
                    className={`relative min-h-12 px-4 py-3 text-sm font-semibold transition-colors
          focus-visible:z-10 focus-visible:rounded-md
          focus-visible:outline focus-visible:outline-2
          focus-visible:outline-offset-2 focus-visible:outline-emerald
          disabled:opacity-50 ${
            selected ? "text-ink" : "text-secondary hover:text-ink"
          }`}
                  >
                    {value === "login" ? "Đăng nhập" : "Đăng ký"}

                    {selected && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-full bg-emerald"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <form className="mt-7 space-y-4" onSubmit={submit}>
              <fieldset disabled={pending}>
                <legend className="mb-2 text-sm font-semibold text-ink">
                  Vai trò
                </legend>

                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      {
                        value: "student",
                        label: "Học sinh",
                        Icon: GraduationCap,
                      },
                      {
                        value: "teacher",
                        label: "Giáo viên",
                        Icon: BookOpenCheck,
                      },
                    ] as const
                  ).map(({ value, label, Icon }) => {
                    const selected = role === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={pending}
                        onClick={() => setMode(tab, value)}
                        aria-pressed={selected}
                        className={`flex min-h-16 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald disabled:opacity-50 ${
                          selected
                            ? "border-emerald bg-emerald/10 text-ink"
                            : "border-line bg-white text-secondary hover:bg-canvas"
                        }`}
                      >
                        <Icon
                          aria-hidden="true"
                          className="size-5 shrink-0"
                        />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {tab === "register" && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-ink">
                    Họ và tên
                  </span>

                  <input
                    required
                    type="text"
                    disabled={pending}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Nhập đầy đủ họ và tên"
                    className="h-12 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/10"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-ink">
                  Địa chỉ Email
                </span>
                <input
                  required
                  type="email"
                  disabled={pending}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  placeholder="ban@example.com"
                  className="h-12 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/10"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-ink">Mật khẩu</span>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={tab === "register" ? 8 : undefined}
                  autoComplete={tab === "register" ? "new-password" : "current-password"}
                  className="h-12 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/10"
                />
              </label>
              {tab === "register" && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-ink">Xác nhận mật khẩu</span>
                  <input
                    required
                    type="password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    className="h-12 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/10"
                  />
                </label>
              )}
              {status === "error" && (
                <button type="button" onClick={() => void refreshSession()} className="text-sm font-semibold text-emerald">
                  Thử kiểm tra phiên lại
                </button>
              )}
              {(formError || error) && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600"
                >
                  {formError || error}
                </p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="min-h-12 w-full rounded-full bg-emerald px-5 text-sm font-bold text-white hover:bg-emerald/90 disabled:opacity-50"
              >
                {pending
                  ? "Đang xử lý..."
                  : tab === "register"
                    ? "Tạo tài khoản"
                    : "Đăng nhập"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
