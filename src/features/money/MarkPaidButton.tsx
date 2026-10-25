"use client";

import { useTransition } from "react";
import { setPaid } from "./actions";

export function MarkPaidButton({
  kind,
  id,
  paid,
}: {
  kind: "invoice" | "charge";
  id: number;
  paid: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={`btn btn-sm ${paid ? "" : "btn-primary"}`}
      disabled={pending}
      onClick={() => startTransition(() => setPaid(kind, id, !paid))}
    >
      {pending ? "…" : paid ? "Ongedaan maken" : "Betaald"}
    </button>
  );
}
