"use client";

import { CornerDownLeft, LayoutGrid, Plus, Receipt, Search, User, Users, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./shell.module.css";
import { SiteLogo } from "@/components/SiteLogo";

const OPEN_EVENT = "fw:command-palette";

/** Opens the palette from anywhere (search field, tab bar). */
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_EVENT));

type Item = { id: string; label: string; hint?: string; href: string; group: string; icon: React.ReactNode; bare?: boolean };

/** ⌘K quick-jump to any page, site or client. */
export function CommandPalette({
  sites,
  clients,
}: {
  sites: { id: number; name: string; host: string }[];
  clients: { id: number; name: string }[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const items = useMemo<Item[]>(
    () => [
      { id: "p-home", label: "Overzicht", href: "/", group: "Pagina's", icon: <LayoutGrid /> },
      { id: "p-clients", label: "Klanten", href: "/klanten", group: "Pagina's", icon: <Users /> },
      { id: "p-money", label: "Geld", href: "/geld", group: "Pagina's", icon: <Wallet /> },
      { id: "p-costs", label: "Kosten", href: "/kosten", group: "Pagina's", icon: <Receipt /> },
      ...sites.map((s) => ({
        id: `s-${s.id}`,
        label: s.name,
        hint: s.host,
        href: `/sites/${s.id}`,
        group: "Sites",
        icon: <SiteLogo siteId={s.id} name={s.name} size={26} />,
        bare: true,
      })),
      ...clients.map((c) => ({ id: `c-${c.id}`, label: c.name, href: `/klanten/${c.id}`, group: "Klanten", icon: <User /> })),
      { id: "n-site", label: "Nieuwe site", href: "/sites/nieuw", group: "Maken", icon: <Plus /> },
      { id: "n-client", label: "Nieuwe klant", href: "/klanten/nieuw", group: "Maken", icon: <Plus /> },
      { id: "n-invoice", label: "Nieuwe factuur", href: "/geld/facturen/nieuw", group: "Maken", icon: <Plus /> },
      { id: "n-cost", label: "Nieuwe kosten", href: "/kosten/nieuw", group: "Maken", icon: <Plus /> },
    ],
    [sites, clients],
  );

  const q = query.trim().toLowerCase();
  const results = q
    ? items.filter((i) => i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q))
    : items;

  useEffect(() => {
    const open = () => {
      setQuery("");
      setCursor(0);
      dialog.current?.showModal();
      input.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else open();
      }
    };
    window.addEventListener(OPEN_EVENT, open);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, open);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function go(item: Item | undefined) {
    if (!item) return;
    dialog.current?.close();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setCursor((c) => (c + step + results.length) % Math.max(results.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[cursor]);
    }
  }

  let lastGroup = "";
  return (
    <dialog
      ref={dialog}
      className={styles.palette}
      aria-label="Zoeken"
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <div className={styles.paletteSearch}>
        <Search aria-hidden="true" />
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Zoek een site, klant of pagina…"
          aria-label="Zoeken"
          aria-controls="palette-results"
          aria-activedescendant={results[cursor] ? `pi-${results[cursor].id}` : undefined}
          role="combobox"
          aria-expanded="true"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="kbd">esc</span>
      </div>
      <ul id="palette-results" className={styles.paletteList} role="listbox">
        {results.length === 0 && <li className={styles.paletteEmpty}>Niets gevonden voor “{query}”.</li>}
        {results.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <li key={item.id} role="presentation">
              {header && <p className={styles.paletteGroup}>{header}</p>}
              <button
                type="button"
                id={`pi-${item.id}`}
                role="option"
                aria-selected={i === cursor}
                className={styles.paletteItem}
                onMouseMove={() => setCursor(i)}
                onClick={() => go(item)}
              >
                {item.bare ? (
                  item.icon
                ) : (
                  <span className={styles.paletteIcon} aria-hidden="true">
                    {item.icon}
                  </span>
                )}
                <span className={styles.navText}>{item.label}</span>
                {item.hint && <small>{item.hint}</small>}
                {i === cursor && <CornerDownLeft className={styles.paletteEnter} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}

/** The search field in the top bar; really a button that opens the palette. */
export function SearchField() {
  return (
    <button type="button" className={styles.search} onClick={openCommandPalette}>
      <Search aria-hidden="true" />
      <span>Zoek sites, klanten…</span>
      <span className="kbd">⌘K</span>
    </button>
  );
}
