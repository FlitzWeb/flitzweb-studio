"use client";

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
      <svg
        className={pending ? styles.spin : undefined}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" />
      </svg>
      {pending ? "Bezig met checken…" : "Check nu"}
    </button>
  );
}
