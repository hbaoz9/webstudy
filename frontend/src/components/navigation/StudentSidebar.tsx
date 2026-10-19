import { Link, NavLink } from "react-router-dom";
import { useEffect, useRef, type KeyboardEvent } from "react";

import {
  BookOpen,
  ClipboardList,
  Globe2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Video,
  X,
} from "lucide-react";

import { useStudentAccount } from "../../contexts/StudentAccountContext";
import { useAuth } from "../../contexts/AuthContext";
import { getStudentInitials } from "../../utils/studentPresentation";

type StudentSidebarProps = {
  isOpen: boolean;
  isDesktop: boolean;
  onClose: () => void;
};

const navigationItems = [
  {
    label: "Tổng quan",
    path: "/student/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Lớp học",
    path: "/student/classes",
    icon: GraduationCap,
  },
  {
    label: "Bài học",
    path: "/student/lessons",
    icon: BookOpen,
  },
  {
    label: "Video tương tác",
    path: "/student/videos",
    icon: Video,
  },
  {
    label: "Bài tập",
    path: "/student/assignments",
    icon: ClipboardList,
  },
];

export function StudentSidebar({ isOpen, isDesktop, onClose }: StudentSidebarProps) {
  const { student, hasStudentProfile } = useStudentAccount();
  const { signOut, error } = useAuth();

  const displayName = hasStudentProfile ? student.name : "Học sinh";
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isOpen && !isDesktop) closeButtonRef.current?.focus();
  }, [isOpen, isDesktop]);

  const handleDrawerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!isOpen || isDesktop) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <>
      {isOpen && !isDesktop && (
        <button
          type="button"
          aria-label="Đóng menu học sinh"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        ref={sidebarRef}
        role={isDesktop ? "complementary" : "dialog"}
        aria-modal={isOpen && !isDesktop ? true : undefined}
        aria-hidden={!isDesktop && !isOpen}
        inert={!isDesktop && !isOpen}
        onKeyDown={handleDrawerKeyDown}
        aria-label="Thanh điều hướng học sinh"
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-ink px-5 py-6 text-white transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between">
          <Link
            to="/student"
            aria-label="WebStudy — Tổng quan học sinh"
            onClick={onClose}
            className="flex items-center gap-3"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-700">
              <Globe2 className="size-5 text-white" />
            </span>

            <span className="text-lg font-extrabold text-white">
              Web<span className="text-emerald-300">Study</span>
            </span>
          </Link>

          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Đóng thanh điều hướng"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10 lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Menu */}
        <nav aria-label="Điều hướng chính" className="mt-8 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition ${
                    isActive
                      ? "bg-emerald-700 text-white"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <Icon className="size-[18px] shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Hồ sơ Student */}
        <div className="mt-5 shrink-0 border-t border-white/15 pt-5">
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald/20 text-sm font-extrabold text-emerald-300">
              {getStudentInitials(hasStudentProfile ? student.name : undefined)}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {displayName}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Học sinh • Địa lí 10
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { signOut(); }}
            className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
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
