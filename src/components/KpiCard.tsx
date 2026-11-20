import Link from "next/link";
import styles from "./KpiCard.module.css";

/** Headline number with an icon, an optional change pill and one line of context. */
export function KpiCard({
  icon,
  label,
  value,
  unit,
  delta,
  hint,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  unit?: string;
  delta?: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  /** "brand" = the one highlighted card on a page (voltage blue glass). */
  tone?: "danger" | "brand";
}) {
  const body = (
    <>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={`icon-chip ${styles.icon}`} aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className={styles.valueRow}>
        <span className={`num ${styles.value}`} data-count>
          {value ?? "–"}
          {value != null && unit && <small>{unit}</small>}
        </span>
        {delta}
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
    </>
  );

  return href ? (
    <Link href={href} className={`card ${styles.kpi}`} data-tone={tone} data-link>
      {body}
    </Link>
  ) : (
    <div className={`card ${styles.kpi}`} data-tone={tone}>
      {body}
    </div>
  );
}
