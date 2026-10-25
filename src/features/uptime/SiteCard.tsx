import Link from "next/link";
import { daysUntil, displayHost, formatDuration, formatPct, formatRelative } from "@/lib/format";
import type { SiteOverview } from "@/lib/uptime/queries";
import { siteStatusLabels } from "@/features/sites/schema";
import { SSL_WARN_DAYS } from "@/lib/uptime/run";
import { statusLabel, statusOf } from "./StatusDot";
import styles from "./uptime.module.css";

export function SiteCard({ site }: { site: SiteOverview }) {
  const status = statusOf(site);
  const check = site.lastCheck;
  const sslDays = check?.sslExpiresAt ? daysUntil(check.sslExpiresAt) : null;

  return (
    <Link href={`/sites/${site.id}`} className={styles.card} data-status={status}>
      <div className={styles.cardTop}>
        <span className={styles.favicon} aria-hidden="true">
          {site.name.charAt(0)}
        </span>
        <div className={styles.cardTitle}>
          <h2>{site.name}</h2>
          <span className={styles.host}>{displayHost(site.url)}</span>
        </div>
        <span className="badge" data-tone={status === "up" ? "ok" : status === "down" ? "danger" : undefined}>
          {status === "off" ? siteStatusLabels[site.status] : statusLabel(status)}
        </span>
      </div>

      {status === "down" && (
        <p className={styles.downNote}>
          {site.downForMs != null ? <>Al {formatDuration(site.downForMs)} offline</> : "Offline"}
          {check?.error && <> · {check.error}</>}
        </p>
      )}

      {site.monitored && (
        <dl className={styles.stats}>
          <div>
            <dt>Reactie</dt>
            <dd className="num">
              {check?.responseMs != null ? <>{check.responseMs}<small> ms</small></> : "–"}
            </dd>
          </div>
          <div>
            <dt>Uptime 30d</dt>
            <dd className="num">
              {site.uptime30 != null ? <>{formatPct(site.uptime30)}<small>%</small></> : "–"}
            </dd>
          </div>
          <div>
            <dt>SSL</dt>
            <dd className="num" data-warn={sslDays != null && sslDays < SSL_WARN_DAYS || undefined}>
              {sslDays == null ? "–" : sslDays < 0 ? "verlopen" : <>{sslDays}<small> d</small></>}
            </dd>
          </div>
        </dl>
      )}

      <p className={styles.checked}>
        {check ? `Gecheckt ${formatRelative(check.checkedAt)}` : site.monitored ? "Nog geen checks" : site.clientName}
      </p>
    </Link>
  );
}

