import styles from "./StatTile.module.css";

/** A labelled headline number. `tone="danger"` paints the value red. */
export function StatTile({
  label,
  value,
  unit,
  hint,
  tone,
  size = "md",
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  tone?: "danger";
  size?: "md" | "lg";
}) {
  return (
    <div className={styles.tile} data-tone={tone} data-size={size}>
      <dt>{label}</dt>
      <dd className="num">
        {value ?? "–"}
        {value != null && unit && <small> {unit}</small>}
      </dd>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

/** Grid wrapper for StatTiles. `min` is the narrowest a tile may get (px). */
export function StatTiles({ children, min = 150 }: { children: React.ReactNode; min?: number }) {
  return (
    <dl className={styles.tiles} style={{ "--tile-min": `${min}px` } as React.CSSProperties}>
      {children}
    </dl>
  );
}
