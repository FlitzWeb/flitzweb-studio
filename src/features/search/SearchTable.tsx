"use client";

import { ArrowDown, ArrowUp, ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
import stats from "@/features/stats/stats.module.css";
import { formatCtr, formatPosition } from "./labels";
import styles from "./search.module.css";

export type SearchTableRow = {
  label: string;
  clicks: number;
  impressions: number;
  position: number | null;
  /** Pages link to themselves. */
  href?: string;
};

export type SearchTableTab = {
  label: string;
  rows: SearchTableRow[];
  /** A line under the tabs, e.g. that Google leaves out rare search terms. */
  note?: string | null;
  /** Show the filter box (long lists: search terms, pages). */
  searchable?: boolean;
};

type SortKey = "clicks" | "impressions" | "ctr" | "position";

const COLUMNS: { key: SortKey; label: string; short: string }[] = [
  { key: "clicks", label: "Klikken", short: "Klik." },
  { key: "impressions", label: "Vertoningen", short: "Vert." },
  { key: "ctr", label: "CTR", short: "CTR" },
  { key: "position", label: "Positie", short: "Pos." },
];

const PAGE = 25;
const ctr = (r: SearchTableRow) => (r.impressions ? r.clicks / r.impressions : 0);

/** Search Console's table: tabs for terms, pages, countries and devices, sortable on each column. */
export function SearchTable({ tabs }: { tabs: SearchTableTab[] }) {
  const [active, setActive] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "clicks", desc: true });
  const [filter, setFilter] = useState("");
  const [shown, setShown] = useState(PAGE);
  const tab = tabs[active];

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f ? tab.rows.filter((r) => r.label.toLowerCase().includes(f)) : [...tab.rows];
    const value = (r: SearchTableRow) =>
      sort.key === "ctr" ? ctr(r) : sort.key === "position" ? (r.position ?? Number.POSITIVE_INFINITY) : r[sort.key];
    // Position: a lower number is better, so "best first" means ascending.
    const dir = sort.key === "position" ? (sort.desc ? 1 : -1) : sort.desc ? -1 : 1;
    return list.sort((a, b) => (value(a) - value(b)) * dir || b.impressions - a.impressions);
  }, [tab, filter, sort]);

  const switchTab = (i: number) => {
    setActive(i);
    setSort({ key: "clicks", desc: true });
    setFilter("");
    setShown(PAGE);
  };

  return (
    <section className={stats.panel}>
      <div className={styles.tableHead}>
        <div className={stats.cardTabs} role="tablist">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`${stats.cardTab} ${styles.tab}`}
              onClick={() => switchTab(i)}
            >
              {t.label}
              <small>{t.rows.length.toLocaleString("nl-NL")}</small>
            </button>
          ))}
        </div>
        {tab.searchable && tab.rows.length > 10 && (
          <label className={styles.filter}>
            <Search aria-hidden="true" />
            <input
              type="search"
              className="input"
              placeholder="Zoeken…"
              aria-label={`Zoeken in ${tab.label.toLowerCase()}`}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setShown(PAGE);
              }}
            />
          </label>
        )}
      </div>
      {tab.note && <p className={styles.note}>{tab.note}</p>}

      {rows.length === 0 ? (
        <p className={stats.muted}>{filter ? "Niets gevonden." : "Nog geen gegevens in deze periode."}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{tab.label}</th>
              {COLUMNS.map((c) => {
                const on = sort.key === c.key;
                // "Best first" is the lowest number for position, the highest for the rest.
                const ascending = c.key === "position" ? sort.desc : !sort.desc;
                return (
                  <th key={c.key} scope="col" aria-sort={on ? (ascending ? "ascending" : "descending") : undefined}>
                    <button
                      type="button"
                      className={styles.sortButton}
                      data-active={on || undefined}
                      onClick={() => setSort(on ? { key: c.key, desc: !sort.desc } : { key: c.key, desc: true })}
                      title={c.key === "position" ? "Gemiddelde plek in Google (1 = bovenaan)" : undefined}
                    >
                      <span className={styles.long}>{c.label}</span>
                      <span className={styles.short}>{c.short}</span>
                      {on && (sort.desc ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((r) => (
              <tr key={r.label}>
                <th scope="row" title={r.href ?? r.label}>
                  {r.href ? (
                    <a href={r.href} target="_blank" rel="noreferrer">
                      <span>{r.label}</span>
                      <ExternalLink aria-hidden="true" />
                    </a>
                  ) : (
                    <span>{r.label}</span>
                  )}
                </th>
                <td className="num">{r.clicks.toLocaleString("nl-NL")}</td>
                <td className="num">{r.impressions.toLocaleString("nl-NL")}</td>
                <td className="num">{formatCtr(r.clicks, r.impressions)}</td>
                <td className="num" data-top={r.position != null && r.position <= 10 ? "" : undefined}>
                  {formatPosition(r.position)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > shown && (
        <button type="button" className={`btn btn-sm ${styles.more}`} onClick={() => setShown(rows.length)}>
          Toon alle {rows.length.toLocaleString("nl-NL")}
        </button>
      )}
    </section>
  );
}
