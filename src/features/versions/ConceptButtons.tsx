"use client";

import { ArrowDownToLine, Check, RefreshCw, Rocket, Send, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { markConceptSent, moveToConcept, publishConcept, pullLiveIntoConcept, resetConceptToLive, setConceptApproved } from "./actions";
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

/** The concept is behind: merges live's changes into it and keeps the concept's own work. */
export function PullLive({ siteId, primary }: { siteId: number; primary?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        className={`btn ${primary ? "btn-primary" : ""}`}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await pullLiveIntoConcept(siteId);
            setError(result.error ?? null);
          })
        }
      >
        <ArrowDownToLine aria-hidden="true" />
        {pending ? "Bezig…" : "Haal live binnen"}
      </button>
      {error && <span className="field-error">{error}</span>}
    </>
  );
}

/**
 * Makes the concept exactly the live site. With concept changes that would go, it asks first;
 * when the concept is only behind there is nothing to lose, so it just does it.
 */
export function MatchLive({ siteId, discards, primary }: { siteId: number; discards: number; primary?: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const result = await resetConceptToLive(siteId);
      setError(result.error ?? null);
      setConfirming(false);
    });

  if (!confirming) {
    return (
      <>
        <button
          type="button"
          className={`btn ${primary ? "btn-primary" : "btn-ghost"}`}
          disabled={pending}
          onClick={() => (discards > 0 ? setConfirming(true) : run())}
        >
          <RefreshCw aria-hidden="true" />
          {pending ? "Bezig…" : "Zet gelijk aan live"}
        </button>
        {error && <span className="field-error">{error}</span>}
      </>
    );
  }
  return (
    <div className={styles.confirm} role="alertdialog" aria-labelledby="match-confirm">
      <p id="match-confirm">
        Het concept wordt weer precies de live site. {discards === 1 ? "De wijziging" : `De ${discards} wijzigingen`} die nog niet live{" "}
        {discards === 1 ? "staat, gaat" : "staan, gaan"} van het concept af. GitHub bewaart {discards === 1 ? "hem" : "ze"} in de
        geschiedenis.
      </p>
      <div>
        <button type="button" className="btn" disabled={pending} onClick={() => setConfirming(false)}>
          Annuleren
        </button>
        <button type="button" className="btn btn-danger" disabled={pending} autoFocus onClick={run}>
          {pending ? "Bezig…" : "Ja, zet gelijk"}
        </button>
      </div>
    </div>
  );
}

/** Merges a loose branch into the concept, so its changes get the concept link. */
export function MoveToConcept({ siteId, branch }: { siteId: number; branch: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        className="btn btn-sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await moveToConcept(siteId, branch);
            setError(result.error ?? null);
          })
        }
      >
        {pending ? "Bezig…" : "Zet op concept"}
      </button>
      {error && <span className="field-error">{error}</span>}
    </>
  );
}
