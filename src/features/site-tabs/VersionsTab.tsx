import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CopyButton } from "@/components/CopyButton";
import { PanelSkeleton } from "@/components/Skeleton";
import { messageLink } from "@/features/clients/messageLink";
import { ApproveConcept, MarkSent, MoveToConcept, PublishConcept, SendConcept } from "@/features/versions/ConceptButtons";
import styles from "@/features/versions/versions.module.css";
import { displayHost, formatDate, formatRelative } from "@/lib/format";
import { compareBranches, hasGithubToken, listBranches, type Comparison } from "@/lib/github";
import type { SiteWithClient } from "@/lib/sites";
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

  // GitHub takes a moment (a second or more with several branches), so the two previews show
  // at once and what depends on GitHub streams in behind them.
  const diff = site.repo ? compareBranches(site.repo, "main", site.conceptBranch) : Promise.resolve(null);

  return (
    <div className={tabStyles.stack}>
      <div className={styles.grid}>
        <Version
          title="Live"
          badge={
            <span className="badge" data-tone="ok">
              Wat bezoekers nu zien
            </span>
          }
          url={site.url}
        />
        <Version
          title="Concept"
          badge={
            <Suspense fallback={<span className="badge">GitHub lezen…</span>}>
              <ConceptBadge site={site} diff={diff} />
            </Suspense>
          }
          url={site.conceptUrl}
          empty="Nog geen concept-adres ingevuld. Zet het onder Bewerken → Versies."
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
        <Suspense fallback={<PanelSkeleton />}>
          <Changes site={site} diff={diff} />
        </Suspense>
      </section>

      {site.repo && (
        <Suspense fallback={null}>
          <LooseBranches site={site} repo={site.repo} />
        </Suspense>
      )}
    </div>
  );
}

type DiffPromise = Promise<Comparison | null>;

/** How many changes a client would count (merge commits are left out of the list), or null without GitHub. */
function changeCount(diff: Comparison | null) {
  return diff?.ok ? (diff.ahead > 0 ? Math.max(diff.commits.length, 1) : 0) : null;
}
const hasChanges = (site: SiteWithClient, diff: Comparison | null) => {
  const ahead = changeCount(diff);
  return ahead == null ? Boolean(site.conceptUrl) : ahead > 0;
};

async function ConceptBadge({ site, diff: diffPromise }: { site: SiteWithClient; diff: DiffPromise }) {
  const diff = await diffPromise;
  const ahead = changeCount(diff);
  const status = !hasChanges(site, diff)
    ? { text: "Geen wijzigingen", tone: "plain" }
    : site.conceptApprovedAt
      ? { text: `Akkoord op ${formatDate(site.conceptApprovedAt)}`, tone: "ok" }
      : site.conceptSentAt
        ? { text: `Wacht op akkoord · verstuurd ${formatRelative(site.conceptSentAt)}`, tone: "warn" }
        : { text: ahead ? `${ahead} ${ahead === 1 ? "wijziging" : "wijzigingen"} nog niet live` : "Nog niet verstuurd", tone: undefined };
  return (
    <span className="badge" data-tone={status.tone}>
      {status.text}
    </span>
  );
}

/** The commits on the concept branch, and the buttons to send, approve and publish. */
async function Changes({ site, diff: diffPromise }: { site: SiteWithClient; diff: DiffPromise }) {
  const diff = await diffPromise;
  const ahead = changeCount(diff);
  const firstName = site.client.contactPerson?.trim().split(/\s+/)[0];
  const message = site.conceptUrl
    ? `Hoi${firstName ? ` ${firstName}` : ""}, de aanpassingen voor ${site.name} staan klaar om te bekijken: ${site.conceptUrl}\nLaat je weten of het zo goed is? Dan zet ik het live. Groet, FlitzWeb`
    : "";
  const send = site.conceptUrl ? messageLink(site.client, message, `${site.name}: nieuwe versie om te bekijken`) : null;

  return (
    <>
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

      {hasChanges(site, diff) && (
        <div className={styles.tools}>
          {site.conceptUrl && <CopyButton text={site.conceptUrl} label="Kopieer link" />}
          {send && <SendConcept siteId={site.id} href={send.href} channel={send.channel} />}
          {site.conceptUrl && !site.conceptSentAt && <MarkSent siteId={site.id} />}
          {(site.conceptSentAt || site.conceptApprovedAt) && <ApproveConcept siteId={site.id} approved={Boolean(site.conceptApprovedAt)} />}
          {site.repo && diff?.ok && diff.ahead > 0 && hasGithubToken() && (
            <PublishConcept siteId={site.id} siteName={site.name} count={ahead ?? diff.ahead} />
          )}
        </div>
      )}
      {site.repo && diff?.ok && diff.ahead > 0 && !hasGithubToken() && (
        <p className={styles.note}>“Zet live” verschijnt hier zodra de Studio een GitHub-sleutel heeft (GITHUB_TOKEN). Tot die tijd merge je zelf naar main.</p>
      )}
    </>
  );
}

/** Work on other branches that is neither live nor on the concept yet. Hidden when there is none. */
async function LooseBranches({ site, repo }: { site: SiteWithClient; repo: string }) {
  const loose = await looseBranches(repo, site.conceptBranch);
  if (!loose.length) return null;
  return (
    <section className={tabStyles.panel}>
      <div className={styles.head}>
        <h2>Wijzigingen op een andere branch</h2>
      </div>
      <p className={styles.note}>
        De Studio toont alleen wat op “{site.conceptBranch}” staat, want daar hoort het vaste adres voor de klant bij. Dit werk staat op een
        eigen branch en is dus nog niet te zien in het concept.
      </p>
      <ul className={styles.changes}>
        {loose.map((b) => (
          <li key={b.name}>
            <span>
              <strong>{b.name}</strong> · {b.ahead} {b.ahead === 1 ? "wijziging" : "wijzigingen"}
              {b.last && `: ${b.last}`}
            </span>
            {hasGithubToken() && <MoveToConcept siteId={site.id} branch={b.name} />}
          </li>
        ))}
      </ul>
      {!hasGithubToken() && (
        <p className={styles.note}>
          Zet het op het concept door de branch in “{site.conceptBranch}” te mergen en te pushen (of push je werk direct naar “
          {site.conceptBranch}”). Met een GitHub-sleutel verschijnt hier een knop die dat voor je doet.
        </p>
      )}
    </section>
  );
}

/** Other branches with work that is neither live nor on the concept branch yet. */
async function looseBranches(repo: string, conceptBranch: string) {
  const names = (await listBranches(repo)) ?? [];
  const others = names.filter((n) => n !== "main" && n !== conceptBranch).slice(0, 8);
  const compared = await Promise.all(
    others.map(async (name) => {
      // Two questions per branch: does it have anything the concept lacks, and what is new compared with live?
      const [vsConcept, vsLive] = await Promise.all([compareBranches(repo, conceptBranch, name), compareBranches(repo, "main", name)]);
      return { name, vsConcept, vsLive };
    }),
  );
  return compared.flatMap(({ name, vsConcept, vsLive }) =>
    // Stale branches (nothing new for the concept, or already live) stay out of sight.
    vsConcept.ok && vsConcept.ahead > 0 && vsLive.ok && vsLive.commits.length > 0
      ? [{ name, ahead: vsLive.commits.length, last: vsLive.commits[0]?.message ?? null }]
      : [],
  );
}

function Version({
  title,
  badge,
  url,
  empty,
}: {
  title: string;
  badge: React.ReactNode;
  url: string | null;
  empty?: string;
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
        {badge}
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
    </section>
  );
}
