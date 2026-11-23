"use client";

import { Check, Footprints, Undo2 } from "lucide-react";
import { useTransition } from "react";
import { logVisit, undoVisit } from "./actions";
import styles from "./clients.module.css";

/** One tap on the Looproute: "I was at this door". Logs the visit; nothing is sent. The ↶ takes it back. */
export function VisitButton({ id, visitedToday }: { id: number; visitedToday: boolean }) {
  const [pending, startTransition] = useTransition();
  if (visitedToday) {
    return (
      <span className={styles.visitDone}>
        <span className="badge" data-tone="ok">
          <Check aria-hidden="true" width={13} height={13} />
          Vandaag geweest
        </span>
        <button
          type="button"
          className={styles.visitUndo}
          aria-label="Bezoek ongedaan maken"
          title="Ongedaan maken"
          disabled={pending}
          onClick={() => startTransition(() => undoVisit(id))}
        >
          <Undo2 aria-hidden="true" />
        </button>
      </span>
    );
  }
  return (
    <button type="button" className="btn btn-sm" disabled={pending} onClick={() => startTransition(() => logVisit(id))}>
      <Footprints aria-hidden="true" />
      {pending ? "Vastleggen…" : "Langs geweest"}
    </button>
  );
}
