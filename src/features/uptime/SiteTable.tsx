import Link from "next/link";
import { siteStatusLabels } from "@/features/sites/schema";
import { daysUntil, displayHost, formatDuration, formatPct, formatRelative } from "@/lib/format";
import type { SiteOverview } from "@/lib/uptime/queries";
import { SSL_WARN_DAYS } from "@/lib/uptime/run";
import { statusLabel, statusOf } from "./StatusDot";
import styles from "./uptime.module.css";
import { SiteLogo } from "@/components/SiteLogo";

const tone = { up: "ok", down: "danger", unknown: undefined, off: undefined } as const;

/** Every site in one table: status, speed, uptime, certificate. */
export function SiteTable({ sites }: { sites: SiteOverview[] }) {
  const slowest = Math.max(...sites.map((s) => s.lastCheck?.responseMs ?? 0), 1);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Site</th>
            <th scope="col">Status</th>
            <th scope="col">Reactie</th>
            <th scope="col" data-num>
              Uptime 30d
            </th>
            <th scope="col" data-num>
              SSL
            </th>
            <th scope="col" data-num>
              Gecheckt
            </th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => {
            const status = statusOf(site);
            const check = site.lastCheck;
            const ms = status === "up" ? check?.responseMs : null;
            const sslDays = check?.sslExpiresAt ? daysUntil(check.sslExpiresAt) : null;
            return (
              <tr key={site.id} data-status={status}>
                <td>
                  <Link href={`/sites/${site.id}`} className={styles.siteCell}>
                    <SiteLogo siteId={site.id} name={site.name} size={36} />
                    <span className={styles.siteName}>
                      <strong>{site.name}</strong>
                      <small>{displayHost(site.url)}</small>
                    </span>
                  </Link>
                </td>
                <td data-label="Status">
                  <span className="badge" data-tone={tone[status]}>
                    {status === "off" ? siteStatusLabels[site.status] : statusLabel(status)}
                  </span>
                  {status === "down" && site.downForMs != null && (
                    <small className={styles.downFor}>al {formatDuration(site.downForMs)}</small>
                  )}
                </td>
                <td data-label="Reactie">
                  {ms != null ? (
                    <span className={styles.meter}>
                      <span className={styles.meterTrack} aria-hidden="true">
                        <span style={{ width: `${Math.max((ms / slowest) * 100, 4)}%` }} />
                      </span>
                      <span className="num">{ms} ms</span>
                    </span>
                  ) : (
                    <span className={styles.na}>–</span>
                  )}
                </td>
                <td data-label="Uptime 30d" data-num className="num">
                  {site.monitored && site.uptime30 != null ? `${formatPct(site.uptime30)}%` : <span className={styles.na}>–</span>}
                </td>
                <td
                  data-label="SSL"
                  data-num
                  className="num"
                  data-warn={(sslDays != null && sslDays < SSL_WARN_DAYS) || undefined}
                >
                  {sslDays == null ? <span className={styles.na}>–</span> : sslDays < 0 ? "verlopen" : `${sslDays} d`}
                </td>
                <td data-label="Gecheckt" data-num className={styles.when}>
                  {check ? formatRelative(check.checkedAt) : site.monitored ? "nog niet" : site.clientName}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
