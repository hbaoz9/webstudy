import { useId, useLayoutEffect, useRef, type ReactNode } from "react";

let openCount = 0;
let previousOverflow = "";

export default function Dialog({ title, children, onClose, side = false }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  side?: boolean;
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
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }} className={`fixed max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-ink/50 sm:p-6 ${side ? "inset-y-4 left-auto right-4 m-0 h-[calc(100dvh-2rem)] max-w-lg" : "inset-0 m-auto h-fit max-w-2xl"}`}>
    <header className="mb-5 flex items-start justify-between gap-3">
      <h2 id={titleId} title={title} className="min-w-0 line-clamp-2 text-lg font-extrabold">{title}</h2>
      <button type="button" autoFocus onClick={onClose} aria-label="Đóng hộp thoại" className="min-h-11 shrink-0 rounded-xl border border-line px-3 text-sm font-bold">Đóng</button>
    </header>
    {children}
  </dialog>;
}
