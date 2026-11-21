import Link from "next/link";
import { TrackerChart } from "@/components/charts/TrackerChart";
import type { Period } from "@/lib/analytics/periods";
import type { TrackerStats } from "./queries";
import styles from "./stats.module.css";

const num = (v: number) => v.toLocaleString("nl-NL", { maximumFractionDigits: 2 });

/** One tracker over the chosen period: total, change vs the period before, goal, chart. */
export function TrackerCard({ tracker, siteId, period }: { tracker: TrackerStats; siteId: number; period: Period }) {
  const goal = tracker.monthlyGoal;
  const pct = goal ? Math.min(100, Math.round((tracker.thisMonth / goal) * 100)) : 0;
  const when = period.key === "vandaag" ? "vandaag" : `afgelopen ${period.label}`;

  const diff = tracker.total - tracker.previous;
  const change = tracker.previous
    ? `${Math.abs(Math.round((diff / tracker.previous) * 100))}%`
    : tracker.total
      ? "nieuw"
      : null;

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div>
          <h3 className={styles.h2}>{tracker.name}</h3>
          <code className={styles.key}>
            {tracker.key}
            {tracker.aggregation === "sum" && " · som van value"}
          </code>
        </div>
        <Link href={`/sites/${siteId}/trackers/${tracker.id}`} className="btn btn-sm">
          Bewerken
        </Link>
      </div>

      <p className={styles.trackerTotal}>
        <strong className="num" data-count>
          {num(tracker.total)}
        </strong>
        {change && diff !== 0 && change !== "0%" && (
          <span
            className={styles.change}
            data-good={diff > 0 || undefined}
            data-bad={diff < 0 || undefined}
            title="Vergeleken met de periode ervoor"
          >
            {diff > 0 ? "↑" : "↓"} {change}
          </span>
        )}
        <small>{when}</small>
      </p>

      {goal ? (
        <div className={styles.goal}>
          <div className={styles.goalText}>
            <span>Doel deze maand</span>
            <span className="num">
              {num(tracker.thisMonth)} / {num(goal)} · {pct}%
            </span>
          </div>
          <div
            className={styles.goalBar}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${tracker.name}: ${pct}% van het maanddoel`}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      <TrackerChart
        points={tracker.series}
        unit={period.unit}
        unitLabel={tracker.aggregation === "sum" ? "totaal" : "keer"}
      />
    </section>
  );
}
