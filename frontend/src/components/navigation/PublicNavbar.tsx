import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Globe2, Menu, X } from 'lucide-react';

const links = [
  ['Hành trình', '/#journey'],
  ['Trong lớp học', '/#classroom'],
  ['Bắt đầu', '/#get-started'],
] as const;

export function PublicNavbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash, location.key]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const renderLinks = () => links.map(([label, to]) => {
    const active = location.pathname === '/' && location.hash === to.slice(1);
    return <Link key={to} to={to} aria-current={active ? 'location' : undefined} onClick={() => setOpen(false)} className={`flex min-h-11 items-center text-sm font-semibold transition hover:text-emerald ${active ? 'text-emerald' : 'text-secondary'}`}>{label}</Link>;
  });

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white">
      <div className="container-page relative flex h-20 items-center justify-between gap-2 lg:gap-6">
        <Link to="/" aria-label="WebStudy — Trang chủ" className="flex shrink-0 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald"><Globe2 aria-hidden="true" className="size-5 text-white" /></span>
          <span className="text-base font-extrabold text-ink sm:text-lg">Web<span className="text-emerald">Study</span></span>
        </Link>
        <nav aria-label="Điều hướng website" className="hidden items-center gap-6 lg:flex">{renderLinks()}</nav>
        <div className="flex shrink-0 items-center gap-2 lg:gap-3">
          <Link to="/auth" className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-3 text-sm font-bold text-ink hover:bg-canvas lg:px-5">Đăng nhập</Link>
          <Link to="/auth?tab=register" className="hidden min-h-11 items-center rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-slate-800 lg:inline-flex">Đăng ký</Link>
          <button ref={menuButton} type="button" aria-label={open ? 'Đóng menu website' : 'Mở menu website'} aria-expanded={open} aria-controls="public-mobile-menu" onClick={() => setOpen((value) => !value)} className="grid size-11 place-items-center rounded-xl border border-line text-ink lg:hidden">{open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}</button>
        </div>
      </div>
      {open && <nav id="public-mobile-menu" aria-label="Điều hướng website trên mobile" className="absolute inset-x-0 top-full max-h-[calc(100dvh-5rem)] overflow-y-auto border-b border-line bg-white px-5 py-3 shadow-card lg:hidden">
        {renderLinks()}
        <Link to="/auth?tab=register" onClick={() => setOpen(false)} className="mt-2 inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-bold text-white">Đăng ký</Link>
      </nav>}
    </header>
  );
}
