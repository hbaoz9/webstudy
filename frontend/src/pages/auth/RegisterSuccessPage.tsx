import { useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";

type RegisterRole = "student" | "teacher";

type RegisterSuccessPageProps = {
  role: RegisterRole;
};

const contentByRole = {
  student: {
    description:
      "Hồ sơ học sinh mock đã được lưu trên trình duyệt này. Bạn có thể bắt đầu học và tham gia lớp bằng mã giáo viên cung cấp.",
    note: "Bạn có thể khám phá các bài học hoặc tham gia lớp học bằng mã lớp được giáo viên cung cấp.",
    primaryLabel: "Bắt đầu khám phá",
    secondaryLabel: "Tham gia lớp học",
    primaryPath: "/student/dashboard",
    secondaryPath: "/student/join-class",
  },

  teacher: {
    description:
      "Hồ sơ giáo viên mock đã được lưu trên trình duyệt này. Hãy hoàn tất xác minh để tạo lớp và giao bài theo luồng frontend hiện có.",
    note: "Để tạo lớp học và quản lý học sinh, vui lòng hoàn tất bước xác minh tài khoản giáo viên.",
    primaryLabel: "Xác minh tài khoản giáo viên",
    secondaryLabel: "Vào tổng quan",
    primaryPath: "/teacher/verification",
    secondaryPath: "/teacher/dashboard",
  },
} satisfies Record<
  RegisterRole,
  {
    description: string;
    note: string;
    primaryLabel: string;
    secondaryLabel: string;
    primaryPath: string;
    secondaryPath: string;
  }
>;

export default function RegisterSuccessPage({
  role,
}: RegisterSuccessPageProps) {
  const navigate = useNavigate();
  const content = contentByRole[role];

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <section className="w-full max-w-[620px] rounded-3xl border border-line bg-white px-6 py-10 text-center shadow-card sm:px-12 sm:py-14">
        <div className="mx-auto grid size-44 place-items-center rounded-full bg-emerald/10">
          <div className="grid size-24 place-items-center rounded-full bg-emerald/15 text-5xl font-bold text-emerald">
            ✓
          </div>
        </div>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald/15 px-4 py-2 text-xs font-bold text-emerald">
          <span className="size-2 rounded-full bg-emerald" />
          ĐÃ TẠO HỒ SƠ MOCK
        </div>

        <h1 className="mt-5 text-2xl font-extrabold text-ink sm:text-3xl">
          Hồ sơ đã sẵn sàng!
        </h1>

        <p className="mx-auto mt-4 max-w-[510px] text-sm leading-7 text-secondary sm:text-base">
          {content.description}
        </p>

        <p className="mx-auto mt-4 max-w-[510px] text-sm leading-6 text-muted sm:text-base">
          {content.note}
        </p>

        <div className="my-8 border-t border-line" />

        <div className="space-y-3">
          <Button
            variant="dark"
            className="w-full"
            onClick={() => navigate(content.primaryPath)}
          >
            {content.primaryLabel}
          </Button>

          <Button
            variant="outline"
            className="w-full border-ink"
            onClick={() => navigate(content.secondaryPath)}
          >
            {content.secondaryLabel}
          </Button>
        </div>
      </section>
    </main>
  );
}
