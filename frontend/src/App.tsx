import AppRoutes from './routes/AppRoutes';
import { Component, Suspense, type ReactNode } from 'react';

class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main role="alert" className="mx-auto my-10 max-w-lg rounded-2xl border border-line bg-white p-6">
          <h1 className="text-xl font-extrabold text-ink">Không thể mở trang</h1>
          <p className="mt-3 text-sm leading-6 text-secondary">Hãy kiểm tra kết nối và thử tải lại. Nếu lỗi vẫn xảy ra, hãy báo lại để kiểm tra.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-full bg-emerald px-5 text-sm font-bold text-white">Tải lại trang</button>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<p role="status" className="p-5 text-sm text-secondary">Đang tải trang…</p>}>
        <AppRoutes />
      </Suspense>
    </PageErrorBoundary>
  );
}
