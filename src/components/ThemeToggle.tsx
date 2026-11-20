"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

/** Switches dark (the default) ↔ light. Saved per device in localStorage. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Sync with the value the inline script in layout.tsx already applied.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const t: Theme = theme === "dark" ? "light" : "dark";
    setTheme(t);
    const root = document.documentElement;
    try {
      if (t === "dark") {
        delete root.dataset.theme;
        localStorage.removeItem("fw-theme");
      } else {
        root.dataset.theme = t;
        localStorage.setItem("fw-theme", t);
      }
    } catch {}
  }

  const label = theme === "dark" ? "Lichte weergave" : "Donkere weergave";
  return (
    <button type="button" onClick={toggle} className={className} aria-label={label} title={label}>
      {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}
