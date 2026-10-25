import { BucketBarChart } from "@/components/charts/BucketBarChart";
import { StatTile, StatTiles } from "@/components/StatTile";
import { PeriodPicker } from "@/features/stats/PeriodPicker";
import { PropertyList } from "@/features/stats/PropertyList";
import styles from "@/features/stats/stats.module.css";
import { getEventNames, getEventProperties, getEventSeries, getSessionProperties } from "@/lib/analytics/events";
import { FilterBar } from "@/features/stats/FilterBar";
import { parseFilters } from "@/lib/analytics/filters";
import { getPeriod, isPeriodKey } from "@/lib/analytics/periods";
import { getWebsiteStats } from "@/lib/analytics/queries";
import { formatRelative } from "@/lib/format";
import type { TabProps } from "./registry";

/** Umami's Events page: every custom event, with its properties and values. */
export async function EventsTab({ site, searchParams }: TabProps) {
  const filters = parseFilters(searchParams);
  const period = getPeriod(isPeriodKey(searchParams.periode) ? searchParams.periode : "30d", filters);
  const [names, series, properties, sessionProps, stats] = await Promise.all([
    getEventNames(site.id, period),
    getEventSeries(site.id, period),
    getEventProperties(site.id, period),
    getSessionProperties(site.id, period),
    getWebsiteStats(site.id, period),
  ]);
  const total = names.reduce((t, n) => t + n.count, 0);
  const visitors = stats.current.visitors;
  const pct = (n: number) => {
    if (!visitors) return "–";
    const p = (n / visitors) * 100;
    return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <PeriodPicker active={period.key} basePath={`/sites/${site.id}/events`} filters={filters} />
      </div>
      <FilterBar filters={filters} />

      <section className={styles.panel}>
        <StatTiles min={120}>
          <StatTile label="Events" value={total.toLocaleString("nl-NL")} />
          <StatTile label="Soorten" value={names.length} />
          <StatTile label="Bezoekers" value={visitors.toLocaleString("nl-NL")} hint="in deze periode" />
        </StatTiles>
        <BucketBarChart points={series} unit={period.unit} unitLabel="events" />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.h2}>Events</h2>
        {names.length === 0 ? (
          <p className={styles.muted}>
            Nog geen events in deze periode. Zie de Tracking-tab voor hoe je klikken en acties meet.
          </p>
        ) : (
          <div className={styles.eventTable}>
            <div className={styles.eventHead} aria-hidden="true">
              <span>Event</span>
              <span>Aantal</span>
              <span>Bezoekers</span>
              <span>Conversie</span>
            </div>
            {names.map((n) => {
              const props = properties[n.name] ?? [];
              return (
                <details key={n.name} className={styles.eventRow}>
                  <summary>
                    <span>
                      <code>{n.name}</code>
                      <small>laatst {formatRelative(n.lastAt)}</small>
                    </span>
                    <span className="num">{n.count.toLocaleString("nl-NL")}</span>
                    <span className="num">{n.visitors.toLocaleString("nl-NL")}</span>
                    <span className="num" title="Bezoekers met dit event ÷ alle bezoekers">
                      {pct(n.visitors)}
                    </span>
                  </summary>
                  {props.length ? (
                    <PropertyList properties={props} />
                  ) : (
                    <p className={styles.muted}>Geen eigenschappen meegestuurd.</p>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </section>

      {sessionProps.length > 0 && (
        <section className={styles.panel}>
          <h2 className={styles.h2}>Bezoekerseigenschappen</h2>
          <p className={styles.muted}>Meegegeven met flitz.identify(), per bezoeker in deze periode.</p>
          <PropertyList properties={sessionProps} />
        </section>
      )}
    </div>
  );
}
