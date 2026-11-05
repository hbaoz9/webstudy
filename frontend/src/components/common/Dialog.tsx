import { useId, useLayoutEffect, useRef, type ReactNode } from "react";

let openCount = 0;
let previousOverflow = "";

export default function Dialog({ title, children, onClose, side = false, footer }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  side?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    if (openCount++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (dialog.open) dialog.close();
      if (--openCount === 0) document.body.style.overflow = previousOverflow;
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }} className={`fixed w-[calc(100%-2rem)] rounded-2xl border border-line bg-white text-ink shadow-xl backdrop:bg-ink/50 ${footer ? "flex h-[min(48rem,calc(100dvh-2rem))] flex-col overflow-hidden p-0" : "max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6"} ${side ? `inset-y-4 left-auto right-4 m-0 max-w-lg ${footer ? "" : "h-[calc(100dvh-2rem)]"}` : `inset-0 m-auto max-w-2xl ${footer ? "" : "h-fit"}`}`}>
    <header className={`flex shrink-0 items-start justify-between gap-3 ${footer ? "border-b border-line px-5 py-4 sm:px-6" : "mb-5"}`}>
      <h2 id={titleId} title={title} className="min-w-0 line-clamp-2 text-lg font-extrabold">{title}</h2>
      <button type="button" autoFocus onClick={onClose} aria-label="Đóng hộp thoại" className="min-h-11 shrink-0 rounded-xl border border-line px-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Đóng</button>
    </header>
    {footer ? <><div data-dialog-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">{children}</div><footer data-dialog-footer className="flex shrink-0 justify-end border-t border-line bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</footer></> : children}
  </dialog>;
}
