import { Suspense } from "react";
import { Outlet, useLocation } from 'react-router-dom';
import { PublicNavbar } from '../components/navigation/PublicNavbar';

export default function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-canvas">
      <PublicNavbar />
      <Suspense key={pathname} fallback={<p role="status" className="p-5 text-sm text-secondary">Đang tải trang…</p>}>
        <Outlet />
      </Suspense>
    </div>
  );
}
