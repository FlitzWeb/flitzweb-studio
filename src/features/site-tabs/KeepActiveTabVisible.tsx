"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * On a phone the tab bar scrolls sideways. Without this, opening a tab further
 * along (Maandrapport, Tracking) left it off-screen, so you couldn't see which
 * tab you were on. Put it inside the tab bar.
 */
export function KeepActiveTabVisible() {
  const marker = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const bar = marker.current?.parentElement;
    const tab = bar?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!bar || !tab) return;
    const left = tab.getBoundingClientRect().left - bar.getBoundingClientRect().left + bar.scrollLeft;
    bar.scrollTo({ left: left - (bar.clientWidth - tab.offsetWidth) / 2 });
  }, [pathname]);

  return <span ref={marker} hidden />;
}
