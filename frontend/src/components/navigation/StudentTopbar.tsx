import { Menu } from "lucide-react";

import { useStudentAccount } from "../../contexts/StudentAccountContext";

type StudentTopbarProps = {
  onOpenSidebar: () => void;
};

export function StudentTopbar({ onOpenSidebar }: StudentTopbarProps) {
  const { student, hasStudentProfile } = useStudentAccount();

  const displayName = hasStudentProfile ? student.name : "bạn";

  return (
    <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-4 border-b border-line bg-white px-5 py-3 lg:px-8">
      {/* Lời chào */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Menu mobile */}
        <button
          type="button"
          aria-label="Mở menu học sinh"
          onClick={onOpenSidebar}
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-ink hover:bg-canvas lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm font-extrabold text-ink sm:text-lg">
            Xin chào, {displayName} 👋
          </h1>

          <p className="mt-1 text-xs text-secondary">
            Chào mừng bạn đến với không gian học tập!
          </p>
        </div>
      </div>

      {/* Thông tin chương trình */}
      <div className="hidden shrink-0 rounded-full bg-emerald/10 px-4 py-2 text-xs font-bold text-emerald md:block">
        Địa lí 10 • Kết nối tri thức
      </div>
    </header>
  );
}
