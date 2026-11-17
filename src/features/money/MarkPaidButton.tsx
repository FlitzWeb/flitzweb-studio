"use client";

import { Check, Undo2 } from "lucide-react";
import { useTransition } from "react";
import { setPaid } from "./actions";
import styles from "./money.module.css";

/**
 * Unpaid: one click marks it paid today. Paid: shows the paid date, which you
 * can correct (the money may have arrived earlier), plus an undo.
 */
export function MarkPaidButton({
  kind,
  id,
  paid,
  paidDate,
  today,
}: {
  kind: "invoice" | "charge";
  id: number;
  paid: boolean;
  paidDate?: string | null;
  today?: string;
}) {
  const [pending, startTransition] = useTransition();

  if (!paid) {
    return (
      <button type="button" className="btn btn-sm" disabled={pending} onClick={() => startTransition(() => setPaid(kind, id, true))}>
        <Check aria-hidden="true" />
        {pending ? "…" : "Markeer betaald"}
      </button>
    );
  }

  return (
    <span className={styles.paidTools}>
      {paidDate && (
        <input
          type="date"
          className={`input ${styles.paidDate}`}
          aria-label="Betaald op"
          title="Betaald op (aanpassen kan)"
          value={paidDate}
          max={today}
          disabled={pending}
          onChange={(e) => {
            const date = e.target.value;
            if (date) startTransition(() => setPaid(kind, id, true, date));
          }}
        />
      )}
      <button type="button" className="btn btn-sm btn-ghost" disabled={pending} onClick={() => startTransition(() => setPaid(kind, id, false))}>
        <Undo2 aria-hidden="true" />
        {pending ? "…" : "Ongedaan maken"}
      </button>
    </span>
  );
}
