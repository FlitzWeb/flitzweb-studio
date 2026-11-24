import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { linkSearchProperty } from "@/features/search/actions";
import { formatCtr, formatPosition, pagePath, searchCountryLabel, searchDeviceLabel } from "@/features/search/labels";
import {
  isSearchPeriodKey,
  nearlyPageOne,
  newQueries,
  SEARCH_PERIODS,
  searchItems,
  searchPeriod,
  searchRange,
  searchSeries,
  searchTotals,
  type SearchItem,
  type SearchPeriodKey,
  type SearchTotals,
} from "@/features/search/queries";
import { LinkSubmit, SyncNowButton } from "@/features/search/SearchButtons";
import { SearchChart } from "@/features/search/SearchChart";
import styles from "@/features/search/search.module.css";
import { SearchTable } from "@/features/search/SearchTable";
import stats from "@/features/stats/stats.module.css";
import { formatRelative } from "@/lib/format";
import { listProperties, matchProperty, propertyLabel, readServiceAccount, type Property } from "@/lib/searchConsole/google";
import type { TabProps } from "./registry";

const dayFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", day: "numeric", month: "short" });
const day = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00Z`));
const nl = (n: number) => n.toLocaleString("nl-NL");

/** What Google Search Console knows: search terms, impressions, clicks and positions. */
export async function GoogleTab({ site, searchParams }: TabProps) {
  const { account, problem } = readServiceAccount();
  if (!account) return <SetupSteps problem={problem} />;
  if (!site.gscProperty || searchParams.koppeling === "wijzigen") {
    return <LinkPanel siteId={site.id} siteUrl={site.url} current={site.gscProperty} email={account.email} />;
  }

  const range = await searchRange(site.id);
  const status = (
    <p className={styles.status}>
      {range.last && <>Gegevens t/m {day(range.last)} · </>}
      {site.gscSyncedAt ? `opgehaald ${formatRelative(site.gscSyncedAt)}` : "nog niet opgehaald"} · {propertyLabel(site.gscProperty)} ·{" "}
      <Link href={`/sites/${site.id}/google?koppeling=wijzigen`}>wijzigen</Link>
    </p>
  );
  const error = site.gscError && <p className={styles.error}>{site.gscError}</p>;

  if (!range.last) {
    return (
      <div className={stats.stack}>
        {error}
        <section className={stats.panel}>
          <h2 className={stats.h2}>Nog geen gegevens van Google</h2>
          <p className={stats.muted}>
            {site.gscError
              ? "Het ophalen ging mis (zie hierboven). Los dat op en haal het opnieuw op."
              : "Google heeft voor deze site nog geen zoekresultaten gemeld. Bij een nieuwe site duurt dat een paar dagen."}
          </p>
          <div>
            <SyncNowButton siteId={site.id} />
          </div>
        </section>
        {status}
      </div>
    );
  }

  const key: SearchPeriodKey = isSearchPeriodKey(searchParams.periode) ? searchParams.periode : "28d";
  const p = searchPeriod(key, range.last);
  // Only compare with a previous period that Google fully had data for.
  const comparable = range.first != null && range.first <= p.prevFrom;
  const [current, previous, series, queries, pages, countries, devices, fresh] = await Promise.all([
    searchTotals(site.id, p.from, p.to),
    comparable ? searchTotals(site.id, p.prevFrom, p.prevTo) : null,
    searchSeries(site.id, p),
    searchItems(site.id, "query", p.from, p.to),
    searchItems(site.id, "page", p.from, p.to),
    searchItems(site.id, "country", p.from, p.to),
    searchItems(site.id, "device", p.from, p.to),
    comparable ? newQueries(site.id, p) : [],
  ]);
  const nearly = nearlyPageOne(queries);
  const queryClicks = queries.reduce((s, q) => s + q.clicks, 0);
  const hiddenClicks = current.clicks - queryClicks;

  return (
    <div className={stats.stack}>
      <div className={stats.toolbar}>
        <nav className={stats.periods} aria-label="Periode">
          {(Object.keys(SEARCH_PERIODS) as SearchPeriodKey[]).map((k) => (
            <Link
              key={k}
              href={`/sites/${site.id}/google?periode=${k}`}
              className={stats.period}
              aria-current={k === key ? "true" : undefined}
              scroll={false}
            >
              {SEARCH_PERIODS[k].label}
            </Link>
          ))}
        </nav>
        <SyncNowButton siteId={site.id} />
      </div>
      {error}

      <section className={stats.panel}>
        <SearchMetrics current={current} previous={previous} />
        <SearchChart points={series} unit={p.unit} />
        <p className={styles.caption}>
          {day(p.from)} – {day(p.to)}
          {previous ? `, vergeleken met ${day(p.prevFrom)} – ${day(p.prevTo)}` : ", zonder vergelijking (Google heeft de periode ervoor niet volledig)"}
        </p>
      </section>

      <div className={stats.columns}>
        <OpportunityList
          title="Bijna op pagina 1"
          hint="Zoekwoorden waarop de site gemiddeld net onder de top staat (plek 8 tot 20). Een betere paginatitel of een eigen stukje tekst erover kan hem omhoog duwen."
          empty="Geen zoekwoorden net onder de top in deze periode."
          rows={nearly}
        />
        <OpportunityList
          title="Nieuw in deze periode"
          hint="Zoekwoorden waarop de site nu gevonden wordt en in de periode ervoor nog niet."
          empty={comparable ? "Geen nieuwe zoekwoorden in deze periode." : "Kan nog niet: de periode ervoor is niet volledig bekend."}
          rows={fresh}
        />
      </div>

      <SearchTable
        tabs={[
          {
            label: "Zoekwoorden",
            searchable: true,
            rows: queries.map(item),
            note:
              hiddenClicks > 0
                ? `Google laat zeldzame zoekwoorden weg om privacyredenen: ${nl(hiddenClicks)} van de ${nl(current.clicks)} klikken staan niet bij een zoekwoord.`
                : null,
          },
          {
            label: "Pagina's",
            searchable: true,
            rows: pages.map((r) => ({ ...item(r), label: pagePath(r.value), href: r.value })),
          },
          { label: "Landen", rows: countries.map((r) => ({ ...item(r), label: searchCountryLabel(r.value) })) },
          { label: "Apparaten", rows: devices.map((r) => ({ ...item(r), label: searchDeviceLabel(r.value) })) },
        ]}
      />
      {status}
    </div>
  );
}

const item = (r: SearchItem) => ({ label: r.value, clicks: r.clicks, impressions: r.impressions, position: r.position });

/** The four Search Console numbers, with the change against the period before. */
function SearchMetrics({ current, previous }: { current: SearchTotals; previous: SearchTotals | null }) {
  const ctr = (t: SearchTotals) => (t.impressions ? (t.clicks / t.impressions) * 100 : 0);
  const pct = (a: number, b: number) => (b ? `${Math.abs(Math.round(((a - b) / b) * 100))}%` : null);
  const metrics = [
    {
      label: "Klikken",
      value: nl(current.clicks),
      diff: previous ? current.clicks - previous.clicks : 0,
      change: previous && pct(current.clicks, previous.clicks),
    },
    {
      label: "Vertoningen",
      value: nl(current.impressions),
      diff: previous ? current.impressions - previous.impressions : 0,
      change: previous && pct(current.impressions, previous.impressions),
    },
    {
      label: "Gem. CTR",
      value: formatCtr(current.clicks, current.impressions),
      diff: previous?.impressions ? ctr(current) - ctr(previous) : 0,
      change: previous?.impressions ? `${formatPosition(Math.abs(ctr(current) - ctr(previous)))} %-punt` : null,
    },
    {
      label: "Gem. positie",
      value: formatPosition(current.position),
      // A lower position is better, so the sign flips.
      diff: previous?.position != null && current.position != null ? previous.position - current.position : 0,
      change:
        previous?.position != null && current.position != null ? formatPosition(Math.abs(current.position - previous.position)) : null,
      arrowFlip: true,
    },
  ];
  return (
    <dl className={stats.metricsBar}>
      {metrics.map((m) => {
        const show = m.change && Math.abs(m.diff) >= 0.05 && m.change !== "0%";
        const up = m.arrowFlip ? m.diff < 0 : m.diff > 0;
        return (
          <div key={m.label} className={stats.metric}>
            <dt>{m.label}</dt>
            <dd className="num" data-count>
              {m.value}
            </dd>
            {show && (
              <span className={stats.change} data-good={m.diff > 0 || undefined} data-bad={m.diff < 0 || undefined}>
                {up ? "↑" : "↓"} {m.change}
              </span>
            )}
          </div>
        );
      })}
    </dl>
  );
}

function OpportunityList({ title, hint, empty, rows }: { title: string; hint: string; empty: string; rows: SearchItem[] }) {
  return (
    <section className={stats.panel}>
      <div>
        <h2 className={stats.h2}>{title}</h2>
        <p className={styles.hint}>{hint}</p>
      </div>
      {rows.length === 0 ? (
        <p className={stats.muted}>{empty}</p>
      ) : (
        <ol className={styles.opportunities}>
          {rows.map((r) => (
            <li key={r.value}>
              <span className={styles.term}>{r.value}</span>
              <span className={styles.facts}>
                <span className="num">plek {formatPosition(r.position)}</span>
                <span className="num">{nl(r.impressions)}× getoond</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Before GSC_SERVICE_ACCOUNT is set: what to do on Google's side. */
function SetupSteps({ problem }: { problem: string | null }) {
  return (
    <div className={stats.stack}>
      {problem && <p className={styles.error}>{problem}</p>}
      <section className={stats.panel}>
        <div>
          <h2 className={stats.h2}>Google Search Console koppelen</h2>
          <p className={styles.hint}>
            Eenmalig, voor alle sites samen. Daarna staan hier de zoekwoorden, vertoningen, klikken en posities uit Google,
            twee keer per dag bijgewerkt.
          </p>
        </div>
        <ol className={styles.steps}>
          <li>
            Maak in <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud</a> een project
            en zet daarin de <strong>Google Search Console API</strong> aan.
          </li>
          <li>
            Maak onder <em>IAM en beheer → Serviceaccounts</em> een service-account (geen rollen nodig) en download bij{" "}
            <em>Sleutels</em> een JSON-sleutel.
          </li>
          <li>
            Zet de inhoud van dat bestand in Vercel als gevoelige variabele <code>GSC_SERVICE_ACCOUNT</code> en deploy opnieuw.
          </li>
          <li>
            Voeg in <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Search Console</a> bij elke
            property het e-mailadres van het service-account toe als gebruiker met <strong>beperkte</strong> rechten.
          </li>
        </ol>
      </section>
    </div>
  );
}

/** Choose (or change) the Search Console property for one site. */
async function LinkPanel({ siteId, siteUrl, current, email }: { siteId: number; siteUrl: string; current: string | null; email: string }) {
  let properties: Property[] = [];
  let failed: string | null = null;
  try {
    properties = await listProperties();
  } catch (error) {
    failed = error instanceof Error ? error.message : "Google gaf geen lijst met properties.";
  }
  const suggested = current ?? matchProperty(siteUrl, properties);

  return (
    <div className={stats.stack}>
      {failed && <p className={styles.error}>{failed}</p>}
      <section className={stats.panel}>
        <div>
          <h2 className={stats.h2}>{current ? "Andere property kiezen" : "Koppel deze site aan Search Console"}</h2>
          <p className={styles.hint}>
            {properties.length
              ? "Kies de property van deze site. De eerste keer worden 16 maanden opgehaald; dat duurt even."
              : "Het service-account ziet nog geen enkele property. Voeg het in Search Console toe als gebruiker (beperkte rechten) en laad deze pagina opnieuw."}
          </p>
        </div>
        <div className={styles.account}>
          <span>
            Service-account: <code>{email}</code>
          </span>
          <CopyButton text={email} label="Kopieer adres" />
        </div>
        {properties.length > 0 && (
          <form action={linkSearchProperty.bind(null, siteId)} className={styles.linkForm}>
            <select name="property" className="input" defaultValue={suggested ?? ""} aria-label="Property">
              {current ? <option value="">Niet gekoppeld</option> : !suggested && <option value="">Kies een property…</option>}
              {properties.map((p) => (
                <option key={p.siteUrl} value={p.siteUrl}>
                  {propertyLabel(p.siteUrl)}
                </option>
              ))}
            </select>
            <LinkSubmit label={current ? "Opslaan" : "Koppelen"} />
          </form>
        )}
        {current && (
          <div>
            <Link href={`/sites/${siteId}/google`} className="btn btn-sm btn-ghost">
              Terug naar de cijfers
            </Link>
          </div>
        )}
        {properties.length > 0 && !suggested && (
          <p className={stats.muted}>Geen property gevonden voor dit adres. Staat de site wel in Search Console, en is het service-account daar toegevoegd?</p>
        )}
      </section>
    </div>
  );
}
