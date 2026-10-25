import Link from "next/link";
import { TrafficChart } from "@/components/charts/TrafficChart";
import { BreakdownCard, type BreakdownTab } from "@/features/stats/BreakdownCard";
import { MetricCard } from "@/features/stats/MetricCard";
import { MetricsBar } from "@/features/stats/MetricsBar";
import { PeriodPicker } from "@/features/stats/PeriodPicker";
import { getSiteStats } from "@/features/stats/queries";
import styles from "@/features/stats/stats.module.css";
import { browserLabel, countryLabel, deviceLabel, languageLabel, regionLabel } from "@/lib/analytics/labels";
import { FilterBar } from "@/features/stats/FilterBar";
import { parseFilters } from "@/lib/analytics/filters";
import { getPeriod, isPeriodKey } from "@/lib/analytics/periods";
import { getActiveVisitors, getBreakdowns, getPageviewSeries, getWebsiteStats } from "@/lib/analytics/queries";
import { CHANNEL_LABELS, getChannels, getEntryExit, getUtm } from "@/lib/analytics/sources";
import type { TabProps } from "./registry";

export async function StatsTab({ site, searchParams }: TabProps) {
  const filters = parseFilters(searchParams);
  const period = getPeriod(isPeriodKey(searchParams.periode) ? searchParams.periode : "7d", filters);
  const [stats, series, breakdowns, active, trackers, channels, entry, exit, utm] = await Promise.all([
    getWebsiteStats(site.id, period),
    getPageviewSeries(site.id, period),
    getBreakdowns(site.id, period),
    getActiveVisitors(site.id),
    getSiteStats(site.id, site.trackers),
    getChannels(site.id, period),
    getEntryExit(site.id, period, "entry"),
    getEntryExit(site.id, period, "exit"),
    getUtm(site.id, period),
  ]);
  const b = breakdowns;
  const map = (rows: { label: string; count: number }[], fn: (s: string) => string) =>
    rows.map((r) => ({ ...r, value: r.label, label: fn(r.label) }));
  const visitors = "Bezoekers";
  const v = { measure: visitors, total: stats.current.visitors };

  const views = { measure: "Weergaven", total: stats.current.views };

  const cards: BreakdownTab[][] = [
    [
      { label: "Pagina's", ...v, filter: "pad", rows: b.pages },
      { label: "Instap", ...v, filter: "pad", rows: entry },
      { label: "Uitstap", ...v, filter: "pad", rows: exit },
    ],
    [
      { label: "Verwijzers", ...v, filter: "verwijzer", rows: b.referrers },
      { label: "Kanalen", ...v, rows: map(channels, (c) => CHANNEL_LABELS[c] ?? c) },
    ],
    [
      { label: "Browsers", ...v, filter: "browser", rows: map(b.browsers, browserLabel) },
      { label: "Systemen", ...v, filter: "systeem", rows: b.os },
      { label: "Apparaten", ...v, filter: "apparaat", rows: map(b.devices, deviceLabel) },
      { label: "Schermen", ...v, filter: "scherm", rows: b.screens },
    ],
    [
      { label: "Landen", ...v, filter: "land", rows: map(b.countries, countryLabel) },
      { label: "Regio's", ...v, filter: "regio", rows: map(b.regions, regionLabel) },
      { label: "Steden", ...v, filter: "stad", rows: b.cities },
      { label: "Talen", ...v, filter: "taal", rows: map(b.languages, languageLabel) },
    ],
    [
      { label: "UTM-bron", ...views, filter: "bron", rows: utm.source },
      { label: "Medium", ...views, filter: "medium", rows: utm.medium },
      { label: "Campagne", ...views, filter: "campagne", rows: utm.campaign },
      { label: "Inhoud", ...views, rows: utm.content },
      { label: "Term", ...views, rows: utm.term },
    ],
  ];

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <PeriodPicker active={period.key} basePath={`/sites/${site.id}/stats`} filters={filters} />
        <span className={styles.live}>
          <i aria-hidden="true" /> {active} nu online
        </span>
      </div>
      <FilterBar filters={filters} />

      <section className={styles.panel}>
        <MetricsBar current={stats.current} previous={stats.previous} />
        <TrafficChart points={series} unit={period.unit} />
      </section>

      <div className={styles.columns}>
        {cards.map((tabs) => (
          <BreakdownCard key={tabs[0].label} tabs={tabs} />
        ))}
      </div>

      <div className={styles.sectionHead}>
        <h2 className={styles.h2}>Trackers</h2>
        <Link href={`/sites/${site.id}/tracking`} className="btn btn-sm">
          Trackers beheren
        </Link>
      </div>
      {trackers
        .filter((m) => m.trackerId)
        .map((m) => (
          <MetricCard key={m.key} metric={m} siteId={site.id} />
        ))}
    </div>
  );
}
