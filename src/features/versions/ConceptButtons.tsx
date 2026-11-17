"use client";

import { Check, Rocket, Send, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { markConceptSent, publishConcept, setConceptApproved } from "./actions";
import styles from "./versions.module.css";

/** Opens WhatsApp or mail with the concept link, and remembers that it was sent. */
export function SendConcept({ siteId, href, channel }: { siteId: number; href: string; channel: "whatsapp" | "email" }) {
  const [, startTransition] = useTransition();
  return (
    <a
      href={href}
      target={channel === "whatsapp" ? "_blank" : undefined}
      rel={channel === "whatsapp" ? "noreferrer" : undefined}
      className="btn btn-primary"
      onClick={() => startTransition(() => markConceptSent(siteId))}
    >
      <Send aria-hidden="true" />
      Stuur naar klant
    </a>
  );
}

/** "Mark as sent" for when you shared the link some other way. */
export function MarkSent({ siteId }: { siteId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => startTransition(() => markConceptSent(siteId))}>
      {pending ? "…" : "Al zelf gestuurd"}
    </button>
  );
}

export function ApproveConcept({ siteId, approved }: { siteId: number; approved: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={`btn ${approved ? "btn-ghost" : ""}`}
      disabled={pending}
      onClick={() => startTransition(() => setConceptApproved(siteId, !approved))}
    >
      {approved ? <Undo2 aria-hidden="true" /> : <Check aria-hidden="true" />}
      {pending ? "…" : approved ? "Akkoord intrekken" : "Klant is akkoord"}
    </button>
  );
}

/** Asks once, then merges the concept into the live site. */
export function PublishConcept({ siteId, siteName, count }: { siteId: number; siteName: string; count: number }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <>
        <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>
          <Rocket aria-hidden="true" />
          Zet live
        </button>
        {error && <span className="field-error">{error}</span>}
      </>
    );
  }
  return (
    <div className={styles.confirm} role="alertdialog" aria-labelledby="publish-confirm">
      <p id="publish-confirm">
        {count === 1 ? "1 wijziging" : `${count} wijzigingen`} op de echte site van {siteName} zetten? Bezoekers zien het binnen een
        paar minuten.
      </p>
      <div>
        <button type="button" className="btn" disabled={pending} onClick={() => setConfirming(false)}>
          Annuleren
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          autoFocus
          onClick={() =>
            startTransition(async () => {
              const result = await publishConcept(siteId);
              setError(result.error ?? null);
              setConfirming(false);
            })
          }
        >
          {pending ? "Bezig…" : "Ja, zet live"}
        </button>
      </div>
    </div>
  );
}
