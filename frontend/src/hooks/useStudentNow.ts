import { useEffect, useState } from "react";

// Wake exactly at the nearest open deadline, and refresh when returning to the tab.
export function useStudentNow(deadlines: readonly number[]) {
  const [now, setNow] = useState(() => Date.now());
  const nearest = Math.min(...deadlines.filter((deadline) => Number.isFinite(deadline) && deadline > now));
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    if (!Number.isFinite(nearest)) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(Math.max(0, nearest - Date.now()), 60_000));
    return () => window.clearTimeout(timer);
  }, [nearest]);
  return now;
}
