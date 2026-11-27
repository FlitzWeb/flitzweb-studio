"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetches server data every `seconds` while the tab is visible. Not on a path ending in one of
 * `pauseOn` (the Aanpassen tab: a refresh there would reload the page you are typing in).
 */
export function AutoRefresh({ seconds = 60, pauseOn = [] }: { seconds?: number; pauseOn?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const paused = pauseOn.some((end) => pathname.endsWith(end));
  useEffect(() => {
    if (paused) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds, paused]);
  return null;
}
