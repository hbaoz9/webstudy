import { Link, NavLink } from "react-router-dom";
import {
  BookOpenText,
  CircleHelp,
  Globe2,
  LayoutDashboard,
  Map,
  Video,
  X,
  ClipboardList,
  BookOpen,
  LogOut,
} from "lucide-react";

import { useTeacherAccount } from "../../contexts/TeacherAccountContext";
import { useAuth } from "../../contexts/AuthContext";

type TeacherSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const mainNavigationItems = [
  {
    label: "Tổng quan",
    path: "/teacher/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Lớp học",
    path: "/teacher/classes",
    icon: BookOpenText,
  },
];

const contentNavigationItems = [
  {
    label: "Nội dung bài học",
    path: "/teacher/lessons",
    icon: BookOpen,
  },
  {
    label: "Video tương tác",
    path: "/teacher/videos",
    icon: Video,
  },
  {
    label: "Học liệu trực quan",
    path: "/teacher/infographics",
    icon: Map,
  },
];

const activityNavigationItems = [
  {
    label: "Bài tập & Kiểm tra",
    path: "/teacher/assignments",
    icon: ClipboardList,
  },
  {
    label: "Ngân hàng câu hỏi",
    path: "/teacher/questions",
    icon: CircleHelp,
  },
];

export function TeacherSidebar({ isOpen, onClose }: TeacherSidebarProps) {
  const { teacherAccount } = useTeacherAccount();
  const teacherName = teacherAccount.submission?.fullName?.trim() || teacherAccount.profile?.name;
  const { signOut, error } = useAuth();

  const renderNavigationItems = (items: typeof mainNavigationItems) => {
    return items.map((item) => {
      const Icon = item.icon;

      return (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={onClose}
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-3 rounded-lg px-4 text-sm font-medium transition ${
              isActive
                ? "bg-emerald text-white"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`
          }
        >
          <Icon className="size-[18px]" />
          <span>{item.label}</span>
        </NavLink>
      );
    });
  };
  return (
    <>
      {/* Lớp nền tối khi mở sidebar trên điện thoại */}
      {isOpen && (
        <button
          type="button"
          aria-label="Đóng thanh điều hướng"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        aria-label="Thanh điều hướng giáo viên"
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-ink px-5 py-6 text-white transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between">
          <Link
            to="/teacher"
            aria-label="WebStudy — Tổng quan giáo viên"
            className="flex items-center gap-3"
            onClick={onClose}
          >
            <span className="grid size-10 place-items-center rounded-lg bg-emerald">
              <Globe2 className="size-5" />
            </span>

            <span className="text-lg font-extrabold text-white">
              Web<span className="text-emerald">Study</span>
            </span>
          </Link>

          <button
            type="button"
            aria-label="Đóng thanh điều hướng"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10 lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Danh sách điều hướng */}
        <nav className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-2">
            {renderNavigationItems(mainNavigationItems)}
          </div>
          <div className="mt-7">
            <p className="mb-2 px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Nội dung
            </p>

            <div className="space-y-2">
              {renderNavigationItems(contentNavigationItems)}
            </div>
          </div>
          <div className="mt-7">
            <p className="mb-2 px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Hoạt động
            </p>

            <div className="space-y-2">
              {renderNavigationItems(activityNavigationItems)}
            </div>
          </div>
        </nav>

        {/* Hồ sơ giáo viên dưới cùng */}
        <div className="mt-5 shrink-0 border-t border-white/15 pt-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-white/20 bg-amber text-sm font-extrabold text-ink">
              GV
            </div>

            <div className="min-w-0">
              <p title={teacherName} className="truncate text-sm font-bold text-white">
                {teacherName || "Chưa có tên giáo viên"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Địa lí 10 • Kết nối tri thức
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { signOut(); }}
            className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4 shrink-0" />
            Đăng xuất
          </button>
          {error && <p role="alert" className="mt-2 text-xs text-red-300 [overflow-wrap:anywhere]">{error}</p>}
        </div>
      </aside>
    </>
  );
}
