import { StatTile, StatTiles } from "@/components/StatTile";
import { CheckNowButton } from "@/features/uptime/CheckNowButton";
import { ResponseChart } from "@/features/uptime/ResponseChart";
import {
  daysUntil,
  formatDate,
  formatDateTime,
  formatDuration,
  formatPct,
  formatRelative,
} from "@/lib/format";
import type { SiteWithClient } from "@/lib/sites";
import { getIncidents, recentChecks, uptimeBySite } from "@/lib/uptime/queries";
import { SSL_WARN_DAYS } from "@/lib/uptime/run";
import styles from "./tabs.module.css";

export async function OverviewTab({ site }: { site: SiteWithClient }) {
  const [last24h, up7, up30, incidents] = await Promise.all([
    recentChecks(site.id, 24),
    uptimeBySite(7, site.id),
    uptimeBySite(30, site.id),
    getIncidents(site.id, 30),
  ]);
  const last = last24h.at(-1);
  const timed = last24h.filter((c) => c.responseMs != null);
  const avgMs = timed.length
    ? Math.round(timed.reduce((sum, c) => sum + c.responseMs!, 0) / timed.length)
    : null;
  const sslDays = last?.sslExpiresAt ? daysUntil(last.sslExpiresAt) : null;
  const monitored = site.status === "live";

  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2 className={styles.h2}>Bereikbaarheid</h2>
            <p className={styles.muted}>
              {!monitored
                ? "Deze site wordt niet gemonitord (alleen sites met status Live)."
                : last
                  ? `Laatst gecheckt ${formatRelative(last.checkedAt)}${last.httpStatus ? ` · HTTP ${last.httpStatus}` : ""}`
                  : "Nog geen checks."}
            </p>
          </div>
          {monitored && <CheckNowButton siteId={site.id} small />}
        </div>

        <div className={styles.tilesWrap}>
          <StatTiles>
            <StatTile label="Nu" value={last?.responseMs} unit="ms" />
            <StatTile label="Gem. 24 u" value={avgMs} unit="ms" />
            <StatTile label="Uptime 7 d" value={pct(up7.get(site.id))} unit="%" />
            <StatTile label="Uptime 30 d" value={pct(up30.get(site.id))} unit="%" />
            <StatTile
              label="SSL geldig"
              value={sslDays != null && sslDays < 0 ? "verlopen" : sslDays}
              unit={sslDays != null && sslDays < 0 ? "" : "dagen"}
              tone={sslDays != null && sslDays < SSL_WARN_DAYS ? "danger" : undefined}
              hint={last?.sslExpiresAt ? `tot ${formatDate(last.sslExpiresAt)}` : undefined}
            />
          </StatTiles>
        </div>

        {timed.length > 1 && (
          <figure className={styles.figure}>
            <figcaption className={styles.figcaption}>Reactietijd, afgelopen 24 uur</figcaption>
            <ResponseChart
              points={last24h.map((c) => ({ t: c.checkedAt.getTime(), ms: c.isUp ? c.responseMs : null }))}
            />
          </figure>
        )}
      </section>

      <div className={styles.columns}>
        <section className={styles.panel}>
          <h2 className={styles.h2}>Storingen, 30 dagen</h2>
          {incidents.length === 0 ? (
            <p className={styles.muted}>Geen storingen. Mooi zo.</p>
          ) : (
            <ul className={styles.list}>
              {incidents.slice(0, 10).map((i) => (
                <li key={i.start.toISOString()}>
                  <span>{formatDateTime(i.start)}</span>
                  <span className={styles.listMeta}>
                    {i.end
                      ? `${formatDuration(i.end.getTime() - i.start.getTime())}`
                      : "nog bezig"}
                    {i.error && ` · ${i.error}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.h2}>Gegevens</h2>
          <dl className={styles.facts}>
            <Fact label="Klant">{site.client.name}</Fact>
            <Fact label="Hosting">
              {site.hosting === "vercel" ? "Vercel" : "Anders"}
              {site.hostingDashboardUrl && (
                <>
                  {" · "}
                  <a href={site.hostingDashboardUrl} target="_blank" rel="noreferrer">
                    dashboard ↗
                  </a>
                </>
              )}
            </Fact>
            <Fact label="Domein via">{site.registrar}</Fact>
            <Fact label="Live sinds">{site.goLiveDate && formatDate(site.goLiveDate)}</Fact>
            <Fact label="Site key">
              <code>{site.publicKey}</code>
            </Fact>
          </dl>
        </section>
      </div>
    </div>
  );
}

const pct = (v: number | undefined) => (v == null ? null : formatPct(v));

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || <span className={styles.muted}>–</span>}</dd>
    </div>
  );
}
