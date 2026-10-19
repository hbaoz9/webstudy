import { Suspense, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { StudentSidebar } from "../components/navigation/StudentSidebar";
import { StudentTopbar } from "../components/navigation/StudentTopbar";
import { useDesktopViewport } from "../hooks/useDesktopViewport";

export default function StudentLayout() {
  const { pathname } = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isDesktop = useDesktopViewport();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wasSidebarOpen = useRef(false);

  useEffect(() => {
    if (wasSidebarOpen.current && !isSidebarOpen && !isDesktop) {
      menuButtonRef.current?.focus();
    }
    wasSidebarOpen.current = isSidebarOpen;
  }, [isSidebarOpen, isDesktop]);

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="student-app min-h-screen bg-canvas">
      {/* Sidebar */}
      <StudentSidebar
        isOpen={isSidebarOpen}
        isDesktop={isDesktop}
        onClose={closeSidebar}
      />

      {/* Vùng nội dung */}
      <div inert={isSidebarOpen && !isDesktop} className="min-h-screen min-w-0 lg:pl-[260px]">
        {/* Topbar */}
        <StudentTopbar onOpenSidebar={() => setIsSidebarOpen(true)} menuButtonRef={menuButtonRef} />

        {/* Nội dung của từng trang Student */}
        <main className="min-w-0 p-5 lg:p-8">
          <Suspense key={pathname} fallback={<p role="status" className="p-5 text-sm text-secondary">Đang tải trang…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
