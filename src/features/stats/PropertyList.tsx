import type { PropertyValues } from "@/lib/analytics/events";
import styles from "./stats.module.css";

/** Each property with its most common values as bars. */
export function PropertyList({ properties }: { properties: PropertyValues[] }) {
  return (
    <div className={styles.props}>
      {properties.map((p) => (
        <div key={p.key}>
          <p className={styles.propKey}>
            <code>{p.key}</code>
          </p>
          <ul className={styles.topList}>
            {p.values.map((v) => (
              <li key={v.label}>
                <span className={styles.topBar} style={{ width: `${(v.count / p.total) * 100}%` }} />
                <span className={styles.topLabel}>{v.label}</span>
                <span className={styles.topValue}>
                  <span className="num">{v.count.toLocaleString("nl-NL")}</span>
                  <small>{Math.round((v.count / p.total) * 100)}%</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
