import { Menu } from "lucide-react";
import type { RefObject } from "react";

type StudentTopbarProps = {
  onOpenSidebar: () => void;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
};

export function StudentTopbar({ onOpenSidebar, menuButtonRef }: StudentTopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-4 border-b border-line bg-white px-5 py-3 lg:px-8">
      {/* Nhận diện khu vực Student */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Menu mobile */}
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Mở menu học sinh"
          onClick={onOpenSidebar}
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-ink hover:bg-canvas lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        <div className="min-w-0">
          <p className="text-sm font-extrabold text-ink sm:text-lg">Không gian học tập</p>

          <p className="mt-1 text-xs text-secondary">
            Theo dõi bài học và lớp của bạn
          </p>
        </div>
      </div>

      {/* Thông tin chương trình */}
      <div className="hidden shrink-0 rounded-full bg-emerald/10 px-4 py-2 text-xs font-bold text-emerald-700 md:block">
        Địa lí 10 • Kết nối tri thức
      </div>
    </header>
  );
}
