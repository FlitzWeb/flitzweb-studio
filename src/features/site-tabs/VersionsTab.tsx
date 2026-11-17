import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { messageLink } from "@/features/clients/messageLink";
import { ApproveConcept, MarkSent, PublishConcept, SendConcept } from "@/features/versions/ConceptButtons";
import styles from "@/features/versions/versions.module.css";
import { displayHost, formatDate, formatRelative } from "@/lib/format";
import { compareBranches, hasGithubToken, type Comparison } from "@/lib/github";
import type { TabProps } from "./registry";
import tabStyles from "./tabs.module.css";

const reasons = {
  "no-branch": (branch: string) => `De branch “${branch}” bestaat nog niet op GitHub. Maak hem aan en push je wijzigingen daarheen.`,
  "no-access": () => "De Studio kan deze repo niet lezen. Voor privé-repo's is een GitHub-sleutel nodig (GITHUB_TOKEN).",
  error: () => "GitHub gaf geen antwoord. Probeer het zo nog eens.",
} as const;

/** The live site next to the version being worked on, with the link to send and the button to publish. */
export async function VersionsTab({ site }: TabProps) {
  const editHref = `/sites/${site.id}/bewerken`;

  if (!site.repo && !site.conceptUrl) {
    return (
      <section className={tabStyles.panel}>
        <h2 className={tabStyles.h2}>Nog niet ingesteld</h2>
        <p className={tabStyles.muted}>Zo werkt het: de live site blijft staan, je werkt op een aparte concept-versie en die stuur je naar de klant.</p>
        <ol className={styles.steps}>
          <li>Maak in de repo van deze site een branch met de naam “concept” en push je wijzigingen daarheen.</li>
          <li>Je hosting bouwt daar vanzelf een voorbeeldadres voor.</li>
          <li>Vul de repo en dat adres in onder Bewerken → Versies.</li>
        </ol>
        <div className={styles.tools}>
          <Link href={editHref} className="btn btn-primary">
            <Pencil aria-hidden="true" />
            Instellen
          </Link>
        </div>
      </section>
    );
  }

  const diff: Comparison | null = site.repo ? await compareBranches(site.repo, "main", site.conceptBranch) : null;
  const ahead = diff?.ok ? diff.ahead : null;
  const hasChanges = ahead == null ? Boolean(site.conceptUrl) : ahead > 0;
  const firstName = site.client.contactPerson?.trim().split(/\s+/)[0];
  const message = site.conceptUrl
    ? `Hoi${firstName ? ` ${firstName}` : ""}, de aanpassingen voor ${site.name} staan klaar om te bekijken: ${site.conceptUrl}\nLaat je weten of het zo goed is? Dan zet ik het live. Groet, FlitzWeb`
    : "";
  const send = site.conceptUrl ? messageLink(site.client, message, `${site.name}: nieuwe versie om te bekijken`) : null;

  const status = !hasChanges
    ? { text: "Geen wijzigingen", tone: "plain" }
    : site.conceptApprovedAt
      ? { text: `Akkoord op ${formatDate(site.conceptApprovedAt)}`, tone: "ok" }
      : site.conceptSentAt
        ? { text: `Wacht op akkoord · verstuurd ${formatRelative(site.conceptSentAt)}`, tone: "warn" }
        : { text: ahead ? `${ahead} ${ahead === 1 ? "wijziging" : "wijzigingen"} nog niet live` : "Nog niet verstuurd", tone: undefined };

  return (
    <div className={tabStyles.stack}>
      <div className={styles.grid}>
        <Version title="Live" badge={{ text: "Wat bezoekers nu zien", tone: "ok" }} url={site.url} />
        <Version
          title="Concept"
          badge={status}
          url={site.conceptUrl}
          empty="Nog geen concept-adres ingevuld. Zet het onder Bewerken → Versies."
          hint="Blijft dit vak leeg? Dan zit er een login voor het voorbeeldadres. Bij Vercel zet je die uit onder Settings → Deployment Protection; anders ziet je klant ook alleen een inlogscherm."
        />
      </div>

      <section className={tabStyles.panel}>
        <div className={styles.head}>
          <h2>Wat is er veranderd?</h2>
          <Link href={editHref} className="btn btn-sm btn-ghost">
            <Pencil aria-hidden="true" />
            Instellingen
          </Link>
        </div>

        {!site.repo ? (
          <p className={styles.note}>Vul de GitHub-repo in om hier de wijzigingen te zien en met één knop live te zetten.</p>
        ) : diff && !diff.ok ? (
          <p className={styles.note} data-tone="warn">
            {reasons[diff.reason](site.conceptBranch)}
          </p>
        ) : diff?.ok && diff.ahead === 0 ? (
          <p className={styles.note}>Het concept is gelijk aan de live site. Push nieuwe wijzigingen naar “{site.conceptBranch}” en ze verschijnen hier.</p>
        ) : diff?.ok ? (
          <>
            <ul className={styles.changes}>
              {diff.commits.slice(0, 12).map((c) => (
                <li key={c.sha}>
                  <span>{c.message}</span>
                  {c.date && <time dateTime={c.date}>{formatDate(c.date)}</time>}
                </li>
              ))}
            </ul>
            <p className={styles.note}>
              {diff.files.length} {diff.files.length === 1 ? "bestand" : "bestanden"} aangepast
              {diff.commits.length > 12 && ` · en nog ${diff.commits.length - 12} eerdere wijzigingen`}
            </p>
            {diff.behind > 0 && (
              <p className={styles.note} data-tone="warn">
                De live site heeft {diff.behind} {diff.behind === 1 ? "wijziging" : "wijzigingen"} die nog niet in het concept zit. Bij live
                zetten worden ze samengevoegd.
              </p>
            )}
          </>
        ) : null}

        {hasChanges && (
          <div className={styles.tools}>
            {site.conceptUrl && <CopyButton text={site.conceptUrl} label="Kopieer link" />}
            {send && <SendConcept siteId={site.id} href={send.href} channel={send.channel} />}
            {site.conceptUrl && !site.conceptSentAt && <MarkSent siteId={site.id} />}
            {(site.conceptSentAt || site.conceptApprovedAt) && <ApproveConcept siteId={site.id} approved={Boolean(site.conceptApprovedAt)} />}
            {site.repo && diff?.ok && diff.ahead > 0 && hasGithubToken() && (
              <PublishConcept siteId={site.id} siteName={site.name} count={diff.ahead} />
            )}
          </div>
        )}
        {site.repo && diff?.ok && diff.ahead > 0 && !hasGithubToken() && (
          <p className={styles.note}>“Zet live” verschijnt hier zodra de Studio een GitHub-sleutel heeft (GITHUB_TOKEN). Tot die tijd merge je zelf naar main.</p>
        )}
      </section>
    </div>
  );
}

function Version({
  title,
  badge,
  url,
  empty,
  hint,
}: {
  title: string;
  badge: { text: string; tone?: string };
  url: string | null;
  empty?: string;
  hint?: string;
}) {
  return (
    <section className={tabStyles.panel}>
      <div className={styles.head}>
        <div>
          <h2>{title}</h2>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className={styles.address}>
              {displayHost(url)}
            </a>
          )}
        </div>
        <span className="badge" data-tone={badge.tone}>
          {badge.text}
        </span>
      </div>
      <div className={styles.frame}>
        {url ? (
          // No scripts' access to the Studio: the page is another site and only shown for a look.
          <iframe src={url} title={`${title} versie`} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />
        ) : (
          <div className={styles.frameEmpty}>{empty}</div>
        )}
      </div>
      {url && (
        <div className={styles.tools}>
          <a href={url} target="_blank" rel="noreferrer" className="btn btn-sm">
            <ExternalLink aria-hidden="true" />
            Open in nieuw tabblad
          </a>
        </div>
      )}
      {url && hint && <p className={styles.note}>{hint}</p>}
    </section>
  );
}
