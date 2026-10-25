"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FilterField } from "@/lib/analytics/filterFields";
import { withFilter } from "./FilterBar";
import styles from "./stats.module.css";

export type BreakdownTab = {
  label: string;
  /** Column header for the number, e.g. "Bezoekers" or "Weergaven". */
  measure: string;
  /** `value` is the raw value (for filtering) when `label` is prettified. */
  rows: { label: string; count: number; value?: string }[];
  /** What the percentages are of (all visitors or views in the period). */
  total: number;
  /** Clicking a row adds this filter (like Umami). */
  filter?: FilterField;
};

/** A card with one or more ranked lists, switchable with tabs (like Umami's panels). */
export function BreakdownCard({ tabs, empty = "Nog geen data in deze periode." }: { tabs: BreakdownTab[]; empty?: string }) {
  const [active, setActive] = useState(0);
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = tabs[active];
  const max = Math.max(1, ...tab.rows.map((r) => r.count));
  const total = Math.max(tab.total, 1);

  return (
    <section className={styles.panel}>
      <div className={styles.cardTabs} role="tablist">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={styles.cardTab}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
        <span className={styles.measure}>{tab.measure}</span>
      </div>
      {tab.rows.length === 0 ? (
        <p className={styles.muted}>{empty}</p>
      ) : (
        <ul className={styles.topList}>
          {tab.rows.map((r) => {
            const inner = (
              <>
                <span className={styles.topBar} style={{ width: `${(r.count / max) * 100}%` }} />
                <span className={styles.topLabel}>{r.label}</span>
                <span className={styles.topValue}>
                  <span className="num">{r.count.toLocaleString("nl-NL")}</span>
                  <small>{Math.round((r.count / total) * 100)}%</small>
                </span>
              </>
            );
            const href = tab.filter
              ? `${pathname}?${withFilter(params, { field: tab.filter, op: "eq", value: r.value ?? r.label })}`
              : null;
            return (
              <li key={r.label}>
                {href ? (
                  <Link href={href} scroll={false} className={styles.topLink} title={`Filter op ${r.label}`}>
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
