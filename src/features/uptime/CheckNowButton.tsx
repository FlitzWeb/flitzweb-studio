"use client";

import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { checkNow } from "./actions";
import styles from "./uptime.module.css";

export function CheckNowButton({ siteId, small }: { siteId?: number; small?: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={`btn ${small ? "btn-sm" : ""}`}
      disabled={pending}
      onClick={() => startTransition(() => checkNow(siteId))}
    >
      <RefreshCw className={pending ? styles.spin : undefined} aria-hidden="true" />
      {pending ? "Checken…" : "Check nu"}
    </button>
  );
}
