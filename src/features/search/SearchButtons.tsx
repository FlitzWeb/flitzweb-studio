"use client";

import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { useFormStatus } from "react-dom";
import { syncSearchNow } from "./actions";
import styles from "./search.module.css";

/** "Nu ophalen": the latest days from Google, without waiting for the cron. */
export function SyncNowButton({ siteId }: { siteId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={pending}
      onClick={() => startTransition(() => syncSearchNow(siteId))}
    >
      <RefreshCw className={pending ? styles.spin : undefined} aria-hidden="true" />
      {pending ? "Ophalen…" : "Nu ophalen"}
    </button>
  );
}

/** The submit button of the link form. The first fetch takes 16 months, so it says so. */
export function LinkSubmit({ label = "Koppelen" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
      {pending && <RefreshCw className={styles.spin} aria-hidden="true" />}
      {pending ? "16 maanden ophalen…" : label}
    </button>
  );
}
