"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  FILTER_FIELDS,
  filterParam,
  OPERATORS,
  type Filter,
  type FilterField,
  type Operator,
} from "@/lib/analytics/filterFields";
import { browserLabel, countryLabel, deviceLabel, languageLabel, regionLabel } from "@/lib/analytics/labels";
import styles from "./stats.module.css";

const PRETTY: Partial<Record<FilterField, (v: string) => string>> = {
  browser: browserLabel,
  apparaat: deviceLabel,
  land: countryLabel,
  regio: regionLabel,
  taal: languageLabel,
};

/** Adds a filter to the current URL's query string. */
export function withFilter(params: URLSearchParams, f: Filter) {
  const next = new URLSearchParams(params);
  if (!next.getAll("f").includes(filterParam(f))) next.append("f", filterParam(f));
  return next.toString();
}

/** Active filters as removable chips, plus a small form to add one (Umami's filter bar). */
export function FilterBar({ filters }: { filters: Filter[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<FilterField>("pad");
  const [op, setOp] = useState<Operator>("eq");
  const [value, setValue] = useState("");

  const without = (f: Filter) => {
    const next = new URLSearchParams(params);
    next.delete("f");
    for (const other of filters) if (other !== f) next.append("f", filterParam(other));
    return `${pathname}?${next}`;
  };

  return (
    <div className={styles.filterBar}>
      {filters.map((f) => (
        <span key={filterParam(f)} className={styles.chip}>
          {FILTER_FIELDS[f.field].label} {OPERATORS[f.op]}{" "}
          <strong>{f.op === "eq" || f.op === "neq" ? (PRETTY[f.field]?.(f.value) ?? f.value) : f.value}</strong>
          <Link href={without(f)} scroll={false} aria-label="Filter weghalen">
            ×
          </Link>
        </span>
      ))}
      {open ? (
        <form
          className={styles.filterForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (!value.trim()) return;
            router.push(`${pathname}?${withFilter(params, { field, op, value: value.trim() })}`, { scroll: false });
            setOpen(false);
            setValue("");
          }}
        >
          <select className="input" value={field} onChange={(e) => setField(e.target.value as FilterField)} aria-label="Veld">
            {Object.entries(FILTER_FIELDS).map(([k, d]) => (
              <option key={k} value={k}>
                {d.label}
              </option>
            ))}
          </select>
          <select className="input" value={op} onChange={(e) => setOp(e.target.value as Operator)} aria-label="Voorwaarde">
            {Object.entries(OPERATORS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Waarde" aria-label="Waarde" autoFocus />
          <button className="btn btn-sm btn-primary" type="submit">
            Toepassen
          </button>
          <button className="btn btn-sm" type="button" onClick={() => setOpen(false)}>
            Annuleren
          </button>
        </form>
      ) : (
        <button type="button" className={`btn btn-sm ${styles.addFilter}`} onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
          Filter
        </button>
      )}
    </div>
  );
}
