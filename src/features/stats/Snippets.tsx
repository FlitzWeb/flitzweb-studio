import { CopyButton } from "@/components/CopyButton";
import type { Tracker } from "@/db";
import { appUrl } from "@/lib/email";
import styles from "./stats.module.css";

/** A code block with a copy button. */
export function Snippet({ code, label }: { code: string; label?: string }) {
  return (
    <div className={styles.snippet}>
      {label && <p className={styles.snippetLabel}>{label}</p>}
      <div className={styles.snippetBody}>
        <pre>
          <code>{code}</code>
        </pre>
        <CopyButton text={code} />
      </div>
    </div>
  );
}

export const scriptTag = (publicKey: string) =>
  `<script defer src="${appUrl()}/t.js" data-site="${publicKey}"></script>`;

/** The exact line(s) to paste for one tracker. */
export function trackerSnippet(t: Pick<Tracker, "eventKey" | "aggregation">) {
  return t.aggregation === "sum"
    ? `flitz("${t.eventKey}", { value: 24.50 });`
    : `flitz("${t.eventKey}");`;
}

/** Server-to-server example (curl) for a booking API etc. */
export const ingestSnippet = (secret: string, eventKey: string) =>
  `curl -X POST ${appUrl()}/api/ingest \\
  -H "Authorization: Bearer ${secret}" \\
  -H "Content-Type: application/json" \\
  -d '{"event": "${eventKey}", "value": 24.50}'`;

/** For code that may run before t.js has loaded (put it above the script tag). */
export const queueStub = `<script>window.flitz=window.flitz||function(){(flitz.q=flitz.q||[]).push(arguments)}</script>`;

/** Click tracking with only HTML attributes (no JavaScript needed). */
export const clickSnippet = `<a href="tel:+31401234567" data-flitz-event="bel_klik" data-flitz-event-plek="header">
  Bel ons
</a>`;

/** Attach your own id/properties to a visitor (e.g. after login or a booking). */
export const identifySnippet = `flitz.identify("klant-123", { soort: "vaste klant" });`;

/** Event with properties, Umami-style. */
export const eventDataSnippet = `flitz.track("bestelling", { soort: "afhalen", bedrag: 24.5 });`;
