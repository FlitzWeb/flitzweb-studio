"use client";

import { useTransition } from "react";
import { addDays, formatDue } from "@/lib/dates";
import { setFollowUp } from "./actions";
import styles from "./clients.module.css";

const QUICK = [
  { label: "Morgen", days: 1 },
  { label: "3 dagen", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weken", days: 14 },
];

/** When to get in touch again: a date field plus one-tap shortcuts. */
export function FollowUpControl({ id, date, today }: { id: number; date: string | null; today: string }) {
  const [pending, startTransition] = useTransition();
  const set = (value: string | null) => startTransition(() => setFollowUp(id, value));

  return (
    <div className={styles.followUp}>
      <div className={styles.followUpRow}>
        <input
          type="date"
          className="input"
          aria-label="Opvolgen op"
          value={date ?? ""}
          disabled={pending}
          onChange={(e) => set(e.target.value || null)}
        />
        {date && (
          <span className={styles.due} data-due={date <= today || undefined}>
            {formatDue(date, today)}
          </span>
        )}
      </div>
      <div className={styles.quick}>
        {QUICK.map((q) => (
          <button key={q.days} type="button" className="btn btn-sm" disabled={pending} onClick={() => set(addDays(today, q.days))}>
            {q.label}
          </button>
        ))}
        {date && (
          <button type="button" className="btn btn-sm btn-ghost" disabled={pending} onClick={() => set(null)}>
            Wissen
          </button>
        )}
      </div>
    </div>
  );
}
