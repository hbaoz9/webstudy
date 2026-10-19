import { useEffect, useState } from "react";
import {
  Bell,
  Menu,
} from 'lucide-react';

import { useLocation } from 'react-router-dom';
import { loadTeacherVideos, TEACHER_VIDEOS_KEY, TEACHER_VIDEOS_CHANGED } from '../../utils/teacherVideoStorage';
import { useTeacherAccount } from '../../contexts/TeacherAccountContext';

type TeacherTopbarProps = {
  onOpenSidebar: () => void;
};

export function TeacherTopbar({
  onOpenSidebar,
}: TeacherTopbarProps) {
  const { teacherAccount } = useTeacherAccount();
  const { pathname } = useLocation();
  const onVideoPage = pathname === '/teacher/videos' || pathname.startsWith('/teacher/videos/');
  const onVisualMaterialsPage = pathname === '/teacher/infographics';
  const [videoTitle, setVideoTitle] = useState<string | undefined>();
  useEffect(() => {
    if (!onVideoPage) return;
    const refresh = () => {
      const id = pathname.startsWith('/teacher/videos/') ? pathname.slice('/teacher/videos/'.length) : null;
      setVideoTitle(id ? loadTeacherVideos().find((video) => video.id === id)?.title : undefined);
    };
    const storage = (event: StorageEvent) => { if (event.key === TEACHER_VIDEOS_KEY || event.key === null) refresh(); };
    refresh();
    window.addEventListener(TEACHER_VIDEOS_CHANGED, refresh);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(TEACHER_VIDEOS_CHANGED, refresh); window.removeEventListener('storage', storage); };
  }, [pathname, onVideoPage]);
  const teacherName = teacherAccount.submission?.fullName?.trim() || teacherAccount.profile?.name;

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-line bg-white px-5 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {/* Chỉ hiện trên điện thoại/tablet */}
        <button
          type="button"
          aria-label="Mở thanh điều hướng"
          onClick={onOpenSidebar}
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-ink transition hover:bg-canvas lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        <div className="min-w-0">
          <p title={onVisualMaterialsPage ? 'Học liệu trực quan' : onVideoPage ? videoTitle : teacherName} className="truncate text-sm font-extrabold text-ink sm:text-lg">
            {onVisualMaterialsPage ? 'Học liệu trực quan' : onVideoPage ? `Video tương tác${videoTitle ? ` › ${videoTitle}` : ''}` : teacherName ? `Xin chào, ${teacherName} 👋` : 'Xin chào 👋'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label="Thông báo"
          className="relative grid size-10 place-items-center rounded-full bg-canvas text-ink transition hover:bg-slate-200"
        >
          <Bell className="size-5" />

          <span className="absolute right-2 top-2 size-2 rounded-full bg-amber" />
        </button>
      </div>
    </header>
  );
}
