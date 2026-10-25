import styles from "./charts.module.css";

type Day = { key: string; label: string; full: string; value: number };

const num = (v: number) => v.toLocaleString("nl-NL");

/**
 * One bar per day; the busiest day is highlighted and labelled, the rest
 * stay quiet. Every bar shows its value on hover or focus.
 */
export function DayBars({ days, unitLabel }: { days: Day[]; unitLabel: string }) {
  const max = Math.max(...days.map((d) => d.value), 0);
  const peak = max > 0 ? days.findIndex((d) => d.value === max) : -1;

  return (
    <div className={styles.dayBars}>
      <ol className={styles.dayList}>
        {days.map((d, i) => {
          const h = max > 0 ? Math.max(d.value / max, 0.04) : 0.04;
          return (
            <li key={d.key} className={styles.day} data-peak={i === peak || undefined}>
              <span className={styles.dayTrack}>
                <span
                  className={styles.dayBar}
                  style={{ height: `${h * 100}%` }}
                  tabIndex={0}
                  aria-label={`${d.full}: ${num(d.value)} ${unitLabel}`}
                >
                  <span className={styles.dayValue}>{num(d.value)}</span>
                </span>
              </span>
              <span className={styles.dayLabel} aria-hidden="true">
                {d.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
