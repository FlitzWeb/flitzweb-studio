import Link from "next/link";
import { filterParam, type Filter } from "@/lib/analytics/filterFields";
import { PERIODS, type PeriodKey } from "@/lib/analytics/periods";
import styles from "./stats.module.css";

/** Period links; active filters are kept when switching. */
export function PeriodPicker({
  active,
  basePath,
  filters = [],
}: {
  active: PeriodKey;
  basePath: string;
  filters?: Filter[];
}) {
  const href = (key: PeriodKey) => {
    const q = new URLSearchParams({ periode: key });
    for (const f of filters) q.append("f", filterParam(f));
    return `${basePath}?${q}`;
  };
  return (
    <nav className={styles.periods} aria-label="Periode">
      {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
        <Link
          key={key}
          href={href(key)}
          className={styles.period}
          aria-current={key === active ? "true" : undefined}
          scroll={false}
        >
          {PERIODS[key]}
        </Link>
      ))}
    </nav>
  );
}
