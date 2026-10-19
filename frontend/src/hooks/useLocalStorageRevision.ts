import { useEffect, useState } from "react";

// For direct localStorage readers. Context-owned data continues to use its Context.
export function useLocalStorageRevision(
  keys: readonly string[],
  changedEvents: readonly string[] = [],
  keyPrefix?: string,
) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || keys.includes(event.key) || (keyPrefix && event.key.startsWith(keyPrefix))) refresh();
    };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    for (const event of changedEvents) window.addEventListener(event, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      for (const event of changedEvents) window.removeEventListener(event, refresh);
    };
  }, [keys, changedEvents, keyPrefix]);
  return revision;
}
