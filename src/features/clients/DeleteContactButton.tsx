"use client";

import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteContact } from "./actions";
import styles from "./clients.module.css";

/** Small × on a log line; asks once before removing it. */
export function DeleteContactButton({ id }: { id: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" className={styles.logDelete} aria-label="Regel verwijderen" title="Verwijderen" onClick={() => setConfirming(true)}>
        <X aria-hidden="true" />
      </button>
    );
  }
  return (
    <span className={styles.logConfirm}>
      <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => startTransition(() => deleteContact(id))}>
        {pending ? "…" : "Verwijderen"}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" disabled={pending} onClick={() => setConfirming(false)}>
        Toch niet
      </button>
    </span>
  );
}
