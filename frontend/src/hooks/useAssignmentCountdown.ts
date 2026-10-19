import { useEffect, useState } from "react";

export function useAssignmentCountdown(enabled: boolean, deadline: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    refresh();
    if (!enabled || !Number.isFinite(deadline) || Date.now() >= deadline) return;
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) window.clearInterval(timer);
    }, 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled, deadline]);
  return { now, refreshNow: () => setNow(Date.now()) };
}
