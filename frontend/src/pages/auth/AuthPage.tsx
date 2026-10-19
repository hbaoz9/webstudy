import ContourBackground from "../../components/common/ContourBackground";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, type AuthRole } from "../../contexts/AuthContext";
import { useStudentAccount } from "../../contexts/StudentAccountContext";
import { useTeacherAccount } from "../../contexts/TeacherAccountContext";
import { BookOpenCheck, GraduationCap, ArrowLeft, Compass } from "lucide-react";

type AuthTab = "login" | "register";

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, error, signIn } = useAuth();
  const { student, hasStudentProfile, updateStudent } = useStudentAccount();
  const { teacherAccount, initializeProfile } = useTeacherAccount();
  const role: AuthRole =
    searchParams.get("role") === "teacher" ? "teacher" : "student";
  const tab: AuthTab =
    searchParams.get("tab") === "register" ? "register" : "login";
  const profile =
    role === "student"
      ? hasStudentProfile
        ? student
        : undefined
      : teacherAccount.profile;
  const storedName =
    role === "teacher"
      ? teacherAccount.submission?.fullName?.trim() ||
        teacherAccount.profile?.name ||
        ""
      : student.name;
  const [name, setName] = useState(storedName);
  const [email, setEmail] = useState(profile?.email ?? "");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState<{
    role: AuthRole;
    tab: AuthTab;
  } | null>(null);
  const isOpeningSession = useRef(false);

  useEffect(() => {
    setName(storedName);
    setEmail(profile?.email ?? "");
    setFormError("");
  }, [role, tab, storedName, profile?.email]);

  useEffect(() => {
    if (!pending || !profile) return;
    isOpeningSession.current = true;
    if (signIn(pending.role)) {
      navigate(
        pending.tab === "register"
          ? `/auth/register/success/${pending.role}`
          : `/${pending.role}`,
        { replace: true },
      );
    } else {
      isOpeningSession.current = false;
    }
    setPending(null);
  }, [pending, profile, signIn, navigate]);

  const setMode = (nextTab: AuthTab, nextRole = role) => {
    const params = new URLSearchParams();
    params.set("role", nextRole);
    if (nextTab === "register") params.set("tab", "register");
    setSearchParams(params, { replace: true });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError("Vui lòng nhập email hợp lệ.");
      return;
    }
    if (tab === "login") {
      if (!profile) {
        setFormError(
          "Chưa có hồ sơ cho vai trò này trên trình duyệt. Vui lòng chuyển sang Đăng ký.",
        );
        return;
      }

      if (profile.email.trim().toLowerCase() !== normalizedEmail) {
        setFormError(
          "Email không khớp hồ sơ hiện có. Dữ liệu của bạn vẫn được giữ nguyên.",
        );
        return;
      }

      isOpeningSession.current = true;

      if (signIn(role)) {
        navigate(`/${role}`, { replace: true });
      } else {
        isOpeningSession.current = false;
      }

      return;
    }

    if (profile) {
      setFormError(
        "Vai trò này đã có hồ sơ trên trình duyệt. Hãy chuyển sang Đăng nhập.",
      );
      return;
    }
    if (normalizedName.length < 2) {
      setFormError("Vui lòng nhập họ và tên có ít nhất 2 ký tự.");
      return;
    }
    if (role === "student")
      updateStudent({ name: normalizedName, email: normalizedEmail });
    else initializeProfile(normalizedName, normalizedEmail);
    setPending({ role, tab });
  };

  if (session && !pending && !isOpeningSession.current)
    return <Navigate to={`/${session.role}`} replace />;

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
                    disabled={pending !== null}
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
              <fieldset disabled={pending !== null}>
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
                        disabled={pending !== null}
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
                    disabled={pending !== null}
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
                  disabled={pending !== null}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  placeholder="ban@example.com"
                  className="h-12 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/10"
                />
              </label>
              {import.meta.env.DEV && !profile && (
                <p className="text-xs leading-5 text-secondary">
                  Chưa có hồ sơ {role === "teacher" ? "giáo viên" : "học sinh"}{" "}
                  local. Lần đầu sẽ khởi tạo hồ sơ mock và giữ dữ liệu dự án
                  hiện có.
                </p>
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
                disabled={pending !== null}
                className="min-h-12 w-full rounded-full bg-emerald px-5 text-sm font-bold text-white hover:bg-emerald/90 disabled:opacity-50"
              >
                {pending
                  ? "Đang mở phiên..."
                  : tab === "register"
                    ? "Tạo hồ sơ mock"
                    : "Đăng nhập"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
