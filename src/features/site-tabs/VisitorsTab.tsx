import Link from "next/link";
import { StatTile, StatTiles } from "@/components/StatTile";
import { PeriodPicker } from "@/features/stats/PeriodPicker";
import styles from "@/features/stats/stats.module.css";
import { browserLabel, countryLabel, deviceLabel, languageLabel, regionLabel } from "@/lib/analytics/labels";
import { FilterBar } from "@/features/stats/FilterBar";
import { parseFilters } from "@/lib/analytics/filters";
import { getPeriod, isPeriodKey } from "@/lib/analytics/periods";
import { getSessionDetail, getSessions, type SessionRow } from "@/lib/analytics/sessions";
import { formatDateTime, formatDuration, formatRelative, formatTime } from "@/lib/format";
import type { TabProps } from "./registry";

/** Umami's Sessions page: recent anonymous visitors, and one visitor's timeline. */
export async function VisitorsTab({ site, searchParams }: TabProps) {
  const base = `/sites/${site.id}/bezoekers`;
  const sessionId = typeof searchParams.bezoeker === "string" ? searchParams.bezoeker : null;
  if (sessionId) return <VisitorDetail siteId={site.id} sessionId={sessionId} back={base} />;

  const filters = parseFilters(searchParams);
  const period = getPeriod(isPeriodKey(searchParams.periode) ? searchParams.periode : "7d", filters);
  const sessions = await getSessions(site.id, period);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <PeriodPicker active={period.key} basePath={base} filters={filters} />
        <span className={styles.muted}>Laatste {sessions.length} bezoekers</span>
      </div>
      <FilterBar filters={filters} />
      <section className={styles.panel}>
        {sessions.length === 0 ? (
          <p className={styles.muted}>Geen bezoekers in deze periode.</p>
        ) : (
          <ul className={styles.visitorList}>
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`${base}?bezoeker=${s.id}`} className={styles.visitorRow}>
                  <span className={styles.visitorWho}>
                    <strong>{who(s)}</strong>
                    <small>{device(s)}</small>
                  </span>
                  <span className={styles.visitorNums}>
                    <span>{s.visits} bezoek{s.visits === 1 ? "" : "en"}</span>
                    <span>{s.views} pagina{s.views === 1 ? "" : "'s"}</span>
                    {s.events > 0 && <span className={styles.visitorEvents}>{s.events} event{s.events === 1 ? "" : "s"}</span>}
                  </span>
                  <time className={styles.visitorWhen}>{formatRelative(s.lastAt)}</time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function VisitorDetail({ siteId, sessionId, back }: { siteId: number; sessionId: string; back: string }) {
  const detail = await getSessionDetail(siteId, sessionId);
  if (!detail) {
    return (
      <p className={styles.muted}>
        Deze bezoeker bestaat niet (meer). <Link href={back}>Terug naar bezoekers</Link>
      </p>
    );
  }
  const s = detail.summary;

  return (
    <div className={styles.stack}>
      <Link href={back} className="back-link">
        ← Alle bezoekers
      </Link>
      <section className={styles.panel}>
        <div>
          <h2 className={styles.h2}>{who(s)}</h2>
          <p className={styles.muted}>
            {device(s)}
            {s.screen && ` · ${s.screen}`}
            {s.language && ` · ${languageLabel(s.language)}`}
            {s.region && ` · ${regionLabel(s.region)}`}
          </p>
        </div>
        <StatTiles min={110}>
          <StatTile label="Bezoeken" value={s.visits} />
          <StatTile label="Pagina's" value={s.views} />
          <StatTile label="Events" value={s.events} />
          <StatTile label="Eerst gezien" value={formatDateTime(s.firstAt)} />
          <StatTile label="Laatst gezien" value={formatDateTime(s.lastAt)} />
        </StatTiles>
        {s.data && Object.keys(s.data).length > 0 && (
          <dl className={styles.dataList}>
            {Object.entries(s.data).map(([k, v]) => (
              <div key={k}>
                <dt>
                  <code>{k}</code>
                </dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {detail.visits.map((visit) => {
        const first = visit.events.at(-1)!;
        const last = visit.events[0];
        const ms = new Date(last.at).getTime() - new Date(first.at).getTime();
        return (
          <section key={visit.visitId} className={styles.panel}>
            <div className={styles.panelHead}>
              <h3 className={styles.h3}>Bezoek op {formatDateTime(first.at)}</h3>
              <span className={styles.muted}>
                {ms > 0 ? formatDuration(ms) : "< 1 min"}
                {first.referrer && ` · via ${first.referrer}`}
              </span>
            </div>
            <ol className={styles.feed}>
              {[...visit.events].reverse().map((e, i) => (
                <li key={`${e.at}-${i}`} data-type={e.eventKey === "pageview" ? "pageview" : "event"}>
                  <time>{formatTime(e.at)}</time>
                  <span>
                    {e.eventKey === "pageview" ? `Bekeek ${e.path ?? "?"}` : `Event “${e.eventKey}”`}
                    {e.metadata && (
                      <small className={styles.eventData}>
                        {Object.entries(e.metadata)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </small>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function who(s: Pick<SessionRow, "distinctId" | "city" | "country">) {
  const place = s.city ?? (s.country ? countryLabel(s.country) : null);
  if (s.distinctId) return `${s.distinctId}${place ? ` · ${place}` : ""}`;
  return place ? `Bezoeker uit ${place}` : "Anonieme bezoeker";
}

function device(s: Pick<SessionRow, "browser" | "os" | "device">) {
  return [s.device && deviceLabel(s.device), s.browser && browserLabel(s.browser), s.os].filter(Boolean).join(" · ");
}
