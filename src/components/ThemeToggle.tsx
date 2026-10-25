"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const label: Record<Theme, string> = {
  system: "Thema: systeem",
  light: "Thema: licht",
  dark: "Thema: donker",
};

/** Cycles system → light → dark. Saved per device in localStorage. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // Sync with the value the inline script in layout.tsx already applied.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme((document.documentElement.dataset.theme as Theme) ?? "system");
  }, []);

  function cycle() {
    const t = next[theme];
    setTheme(t);
    const root = document.documentElement;
    try {
      if (t === "system") {
        delete root.dataset.theme;
        localStorage.removeItem("fw-theme");
      } else {
        root.dataset.theme = t;
        localStorage.setItem("fw-theme", t);
      }
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className={className}
      aria-label={label[theme]}
      title={label[theme]}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        {theme === "dark" ? (
          <path fill="currentColor" d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        ) : theme === "light" ? (
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </g>
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="8.5" />
            <path fill="currentColor" stroke="none" d="M12 3.5a8.5 8.5 0 0 1 0 17Z" />
          </g>
        )}
      </svg>
    </button>
  );
}
