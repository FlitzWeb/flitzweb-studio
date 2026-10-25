import Link from "next/link";
import { DailyLineChart } from "@/components/charts/DailyLineChart";
import { StatTile, StatTiles } from "@/components/StatTile";
import type { MetricStats, Period } from "./queries";
import styles from "./stats.module.css";

const num = (v: number) => v.toLocaleString("nl-NL", { maximumFractionDigits: 2 });

/** One metric (pageviews or a tracker): today / 7d / 30d tiles, goal, daily chart. */
export function MetricCard({ metric, siteId }: { metric: MetricStats; siteId: number }) {
  const goal = metric.monthlyGoal;
  const pct = goal ? Math.min(100, Math.round((metric.thisMonth / goal) * 100)) : 0;

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div>
          <h2 className={styles.h2}>{metric.name}</h2>
          <code className={styles.key}>
            {metric.key}
            {metric.aggregation === "sum" && " · som van value"}
          </code>
        </div>
        {metric.trackerId && (
          <Link href={`/sites/${siteId}/trackers/${metric.trackerId}`} className="btn btn-sm">
            Bewerken
          </Link>
        )}
      </div>

      <div className={styles.tiles}>
        <StatTiles min={84}>
          <StatTile label="Vandaag" value={num(metric.today.current)} hint={<Delta p={metric.today} vs="gisteren" />} />
          <StatTile label="7 dagen" value={num(metric.week.current)} hint={<Delta p={metric.week} vs="vorige 7 d" />} />
          <StatTile label="30 dagen" value={num(metric.month30.current)} hint={<Delta p={metric.month30} vs="vorige 30 d" />} />
        </StatTiles>
      </div>

      {goal ? (
        <div className={styles.goal}>
          <div className={styles.goalText}>
            <span>Doel deze maand</span>
            <span className="num">
              {num(metric.thisMonth)} / {num(goal)} · {pct}%
            </span>
          </div>
          <div
            className={styles.goalBar}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${metric.name}: ${pct}% van het maanddoel`}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      <figure className={styles.figure}>
        <figcaption className={styles.figcaption}>Per dag, laatste 30 dagen</figcaption>
        <DailyLineChart points={metric.series} unitLabel={metric.aggregation === "sum" ? "totaal" : "keer"} />
      </figure>
    </section>
  );
}

function Delta({ p, vs }: { p: Period; vs: string }) {
  if (p.previous === 0) {
    return <span>{p.current > 0 ? `nieuw t.o.v. ${vs}` : `– t.o.v. ${vs}`}</span>;
  }
  const change = Math.round(((p.current - p.previous) / p.previous) * 100);
  return (
    <span className={styles.delta} data-dir={change > 0 ? "up" : change < 0 ? "down" : undefined}>
      {change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change)}% t.o.v. {vs}
    </span>
  );
}
