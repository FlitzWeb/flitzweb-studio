"use client";

import { Check, Undo2 } from "lucide-react";
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
      className={`btn btn-sm ${paid ? "btn-ghost" : ""}`}
      disabled={pending}
      onClick={() => startTransition(() => setPaid(kind, id, !paid))}
    >
      {paid ? <Undo2 aria-hidden="true" /> : <Check aria-hidden="true" />}
      {pending ? "…" : paid ? "Ongedaan maken" : "Betaald"}
    </button>
  );
}
