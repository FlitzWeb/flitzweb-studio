"use client";

import { Check, Footprints } from "lucide-react";
import { useTransition } from "react";
import { logVisit } from "./actions";

/** One tap on the Looproute: "I was at this door". Logs the visit; nothing is sent. */
export function VisitButton({ id, visitedToday }: { id: number; visitedToday: boolean }) {
  const [pending, startTransition] = useTransition();
  if (visitedToday) {
    return (
      <span className="badge" data-tone="ok">
        <Check aria-hidden="true" width={13} height={13} />
        Vandaag geweest
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
