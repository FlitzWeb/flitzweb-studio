import Link from "next/link";
import { lastEventAt } from "@/features/stats/queries";
import {
  clickSnippet,
  eventDataSnippet,
  identifySnippet,
  ingestSnippet,
  queueStub,
  scriptTag,
  Snippet,
  trackerSnippet,
} from "@/features/stats/Snippets";
import styles from "@/features/stats/stats.module.css";
import { formatRelative } from "@/lib/format";
import type { TabProps } from "./registry";

/** Installation snippets and the tracker list for a site. */
export async function TrackingTab({ site }: TabProps) {
  const lastAt = await lastEventAt(site.id);

  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <h2 className={styles.h2}>Installatie</h2>
        <p className={styles.muted}>
          {lastAt ? `Laatste event ontvangen ${formatRelative(lastAt)}.` : "Nog niets ontvangen."} Geen
          cookies en niets opgeslagen in de browser: geen cookiebanner nodig.
        </p>
        <Snippet label="In de <head> van elke pagina" code={scriptTag(site.publicKey)} />
        <Snippet label="Klikken meten zonder JavaScript: zet data-flitz-event op een knop of link" code={clickSnippet} />
        <Snippet label="Event met eigenschappen (zie de Events-tab)" code={eventDataSnippet} />
        <details className={styles.details}>
          <summary>Meer opties</summary>
          <p className={styles.muted}>
            Overstappen van Umami? Vervang alleen de script-tag. Bestaande{" "}
            <code>data-umami-event</code>-attributen en <code>umami.track()</code>-aanroepen blijven werken.
          </p>
          <Snippet label="Een bezoeker herkennen (bijv. na inloggen); zichtbaar in de Bezoekers-tab" code={identifySnippet} />
          <Snippet label="Roep je flitz() aan vóór het script geladen is? Zet dit er dan boven:" code={queueStub} />
          <Snippet
            label="Server-naar-server (bijv. vanuit een boekings-API). Houd deze sleutel geheim:"
            code={ingestSnippet(site.ingestSecret, site.trackers[0]?.eventKey ?? "order_placed")}
          />
          <p className={styles.muted}>
            Je eigen bezoeken niet meetellen: open de site, open de console en typ{" "}
            <code>localStorage.setItem(&quot;flitz-ignore&quot;, &quot;1&quot;)</code>.
          </p>
        </details>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2 className={styles.h2}>Trackers</h2>
            <p className={styles.muted}>Eigen events voor deze site, zoals bestellingen of afspraken.</p>
          </div>
          <Link href={`/sites/${site.id}/trackers/nieuw`} className="btn btn-sm btn-primary">
            + Tracker
          </Link>
        </div>
        {site.trackers.length === 0 ? (
          <p className={styles.muted}>Nog geen trackers.</p>
        ) : (
          site.trackers.map((t) => (
            <div key={t.id} className={styles.trackerRow}>
              <Snippet label={`${t.name}: plak dit waar het gebeurt (bijv. na een geslaagde bestelling)`} code={trackerSnippet(t)} />
              <Link href={`/sites/${site.id}/trackers/${t.id}`} className="btn btn-sm">
                Bewerken
              </Link>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
