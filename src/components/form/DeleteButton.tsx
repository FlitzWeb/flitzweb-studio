"use client";

import { useState, useTransition } from "react";
import styles from "./DeleteButton.module.css";

/**
 * Asks for confirmation in the page, then runs a server action
 * (e.g. deleteSite.bind(null, id)). No window.confirm(): it blocks the page.
 */
export function DeleteButton({
  action,
  label,
  confirmText,
}: {
  action: () => Promise<void>;
  label: string;
  confirmText: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }

  return (
    <div className={styles.confirm} role="alertdialog" aria-labelledby="delete-confirm-text">
      <p id="delete-confirm-text">{confirmText}</p>
      <div>
        <button type="button" className="btn" disabled={pending} onClick={() => setConfirming(false)}>
          Annuleren
        </button>
        <button
          type="button"
          className={`btn btn-danger ${styles.yes}`}
          disabled={pending}
          autoFocus
          onClick={() => startTransition(() => action())}
        >
          {pending ? "Bezig…" : "Ja, verwijderen"}
        </button>
      </div>
    </div>
  );
}
