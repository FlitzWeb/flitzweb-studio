import styles from "./charts.module.css";

const TICKS = 40;

/**
 * Half-circle tick gauge. `value` is 0–1; ticks up to it are filled.
 * The number and caption sit inside the arc.
 */
export function Gauge({
  value,
  label,
  caption,
  ariaLabel,
}: {
  value: number;
  label: React.ReactNode;
  caption?: React.ReactNode;
  ariaLabel: string;
}) {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * TICKS);
  const cx = 120;
  const cy = 118;
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    // From 180° (left) to 0° (right).
    const a = Math.PI - (i / (TICKS - 1)) * Math.PI;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return {
      x1: cx + cos * 86,
      y1: cy - sin * 86,
      x2: cx + cos * 110,
      y2: cy - sin * 110,
      on: i < filled,
      // Filled ticks fade in along the arc, like a fill sweeping round.
      opacity: 0.45 + 0.55 * (i / Math.max(filled - 1, 1)),
    };
  });

  return (
    <figure className={styles.gauge} role="img" aria-label={ariaLabel}>
      <svg viewBox="0 0 240 128" aria-hidden="true">
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            strokeWidth="4.5"
            strokeLinecap="round"
            stroke={t.on ? "var(--chart-1)" : "var(--chart-track)"}
            strokeOpacity={t.on ? t.opacity : 1}
          />
        ))}
      </svg>
      <figcaption className={styles.gaugeText}>
        <strong className="num">{label}</strong>
        {caption && <span>{caption}</span>}
      </figcaption>
    </figure>
  );
}
