import { Suspense, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TeacherSidebar } from '../components/navigation/TeacherSidebar';
import { TeacherTopbar } from '../components/navigation/TeacherTopbar';

export default function TeacherLayout() {
  const { pathname } = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] =
    useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      <TeacherSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="min-h-screen lg:pl-[260px]">
        <TeacherTopbar
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="p-5 lg:p-8">
          <Suspense key={pathname} fallback={<p role="status" className="p-5 text-sm text-secondary">Đang tải trang…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
