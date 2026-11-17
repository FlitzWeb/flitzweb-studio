import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { StatTile, StatTiles } from "@/components/StatTile";
import { messageLink } from "@/features/clients/messageLink";
import { changeText, goalValue, summaryMessage } from "@/features/summary/message";
import { getMonthSummary, summaryMonth } from "@/features/summary/queries";
import { formatMonth } from "@/lib/dates";
import { formatPct } from "@/lib/format";
import type { TabProps } from "./registry";
import styles from "./tabs.module.css";

/** One month in plain numbers, plus a ready-to-send update for the client. */
export async function SummaryTab({ site, searchParams }: TabProps) {
  const { month, prev, next, isCurrent } = summaryMonth(searchParams.maand);
  const summary = await getMonthSummary(site.id, site.trackers, month);
  const { current, previous } = summary.stats;
  const message = summaryMessage({ siteName: site.name, contactPerson: site.client.contactPerson, month, summary });
  const link = messageLink(site.client, message, `${site.name}: overzicht ${formatMonth(month)}`);
  const base = `/sites/${site.id}/maandrapport`;
  const empty = current.views === 0 && summary.uptimePct == null;

  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2 className={`${styles.h2} ${styles.monthTitle}`}>{formatMonth(month)}</h2>
            <p className={styles.muted}>
              {isCurrent ? "Deze maand loopt nog: de cijfers zijn tot nu toe." : "Hele maand, vergeleken met de maand ervoor."}
            </p>
          </div>
          <div className={styles.monthNav}>
            <Link href={`${base}?maand=${prev.slice(0, 7)}`} className="btn btn-sm" scroll={false}>
              <ChevronLeft aria-hidden="true" />
              {formatMonth(prev)}
            </Link>
            {next && (
              <Link href={`${base}?maand=${next.slice(0, 7)}`} className="btn btn-sm" scroll={false}>
                {formatMonth(next)}
                <ChevronRight aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>

        <div className={styles.tilesWrap}>
          <StatTiles>
            <StatTile label="Bezoekers" value={current.visitors.toLocaleString("nl-NL")} hint={changeText(current.visitors, previous.visitors)} />
            <StatTile label="Pagina's bekeken" value={current.views.toLocaleString("nl-NL")} hint={changeText(current.views, previous.views)} />
            {summary.goals.map((g) => (
              <StatTile key={g.name} label={g.name} value={goalValue(g)} />
            ))}
            <StatTile label="Bereikbaar" value={summary.uptimePct != null ? formatPct(summary.uptimePct) : null} unit="%" />
          </StatTiles>
        </div>
      </section>

      {empty ? (
        <p className={styles.muted}>Geen metingen in deze maand, dus er is nog niets om te sturen.</p>
      ) : (
        <>
          <div className={styles.columns}>
            <TopList title="Meest bekeken pagina's" rows={summary.pages} />
            <TopList title="Waar bezoekers vandaan kwamen" rows={summary.referrers} />
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.h2}>Bericht voor {site.client.contactPerson ?? site.client.name}</h2>
                <p className={styles.muted}>Kopieer het, of open het in WhatsApp of mail. Je kunt het daar nog aanpassen.</p>
              </div>
              <div className={styles.monthNav}>
                <CopyButton text={message} />
                {link && (
                  <a
                    href={link.href}
                    className="btn btn-sm btn-primary"
                    target={link.channel === "whatsapp" ? "_blank" : undefined}
                    rel={link.channel === "whatsapp" ? "noreferrer" : undefined}
                  >
                    <Send aria-hidden="true" />
                    {link.channel === "whatsapp" ? "Open in WhatsApp" : "Open in mail"}
                  </a>
                )}
              </div>
            </div>
            <pre className={styles.message}>{message}</pre>
          </section>
        </>
      )}
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.h2}>{title}</h2>
      {rows.length === 0 ? (
        <p className={styles.muted}>Niets gemeten.</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((r) => (
            <li key={r.label}>
              <span>{r.label}</span>
              <span className="num">{r.count.toLocaleString("nl-NL")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
