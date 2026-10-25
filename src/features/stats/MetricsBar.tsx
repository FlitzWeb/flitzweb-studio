import type { WebsiteStats } from "@/lib/analytics/queries";
import styles from "./stats.module.css";

/**
 * Umami's five headline numbers with the change vs the previous period:
 * visitors, visits, views, bounce rate, average visit duration.
 */
export function MetricsBar({ current, previous }: { current: WebsiteStats; previous: WebsiteStats }) {
  const bounce = (s: WebsiteStats) => (s.visits ? (Math.min(s.visits, s.bounces) / s.visits) * 100 : 0);
  const duration = (s: WebsiteStats) => (s.visits ? s.totaltime / s.visits : 0);

  const metrics = [
    { label: "Bezoekers", value: current.visitors, prev: previous.visitors, format: num },
    { label: "Bezoeken", value: current.visits, prev: previous.visits, format: num },
    { label: "Weergaven", value: current.views, prev: previous.views, format: num },
    {
      label: "Bouncepercentage",
      value: bounce(current),
      prev: bounce(previous),
      format: (n: number) => `${Math.round(n)}%`,
      lowerIsBetter: true,
      absolute: true,
    },
    { label: "Bezoekduur", value: duration(current), prev: duration(previous), format: time, absolute: true },
  ];

  return (
    <dl className={styles.metricsBar}>
      {metrics.map((m) => {
        const diff = m.value - m.prev;
        const good = m.lowerIsBetter ? diff < 0 : diff > 0;
        const pct = m.prev ? Math.round((diff / m.prev) * 100) : null;
        // The arrow shows the direction, so the numbers themselves are unsigned.
        // Rates and durations can't be compared with a period that had no visits.
        const change = m.absolute
          ? previous.visits
            ? m.format(Math.abs(diff))
            : null
          : pct === null
            ? m.value
              ? "nieuw"
              : null
            : `${Math.abs(pct)}%`;
        return (
          <div key={m.label} className={styles.metric}>
            <dt>{m.label}</dt>
            <dd className="num">{m.format(m.value)}</dd>
            {change && diff !== 0 && change !== "0%" && (
              <span className={styles.change} data-good={good || undefined} data-bad={!good || undefined}>
                {diff > 0 ? "↑" : "↓"} {change}
              </span>
            )}
          </div>
        );
      })}
    </dl>
  );
}

const num = (n: number) => n.toLocaleString("nl-NL");

/** 135 → "2m 15s" */
function time(seconds: number) {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}
