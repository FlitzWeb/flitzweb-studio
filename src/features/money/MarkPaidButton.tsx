"use client";

import { Check, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
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
        <PaidDateInput
          key={paidDate}
          paidDate={paidDate}
          today={today}
          onSave={(date) => startTransition(() => setPaid(kind, id, true, date))}
        />
      )}
      <button type="button" className="btn btn-sm btn-ghost" disabled={pending} onClick={() => startTransition(() => setPaid(kind, id, false))}>
        <Undo2 aria-hidden="true" />
        {pending ? "…" : "Ongedaan maken"}
      </button>
    </span>
  );
}

// Typing a date by keyboard passes through half-typed values ("0002-11-17"
// while typing the year), so the field keeps its own draft and only saves
// once you pause or leave it, and never a date that can't be right.
const SAVE_AFTER_MS = 900;
const EARLIEST = "2020-01-01";

function PaidDateInput({
  paidDate,
  today,
  onSave,
}: {
  paidDate: string;
  today?: string;
  onSave: (date: string) => void;
}) {
  const [draft, setDraft] = useState(paidDate);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = (date: string) => {
    clearTimeout(timer.current);
    if (date === paidDate) return;
    if (date >= EARLIEST && (!today || date <= today)) onSave(date);
    else setDraft(paidDate);
  };

  return (
    <input
      type="date"
      className={`input ${styles.paidDate}`}
      aria-label="Betaald op"
      title="Betaald op (aanpassen kan)"
      value={draft}
      min={EARLIEST}
      max={today}
      onChange={(e) => {
        const date = e.target.value;
        setDraft(date);
        clearTimeout(timer.current);
        if (date) timer.current = setTimeout(() => save(date), SAVE_AFTER_MS);
      }}
      onBlur={() => save(draft || paidDate)}
    />
  );
}
