"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
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
      {theme === "dark" ? <Moon aria-hidden="true" /> : theme === "light" ? <Sun aria-hidden="true" /> : <SunMoon aria-hidden="true" />}
    </button>
  );
}
