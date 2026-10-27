import Link from "next/link";
import { formatDate, formatEuro } from "@/lib/format";
import styles from "../money/money.module.css";
import { categoryLabels, intervalSuffix } from "./labels";
import type { CostRow } from "./queries";

/** Costs as rows. `show` picks the date that matters for the list. */
export function CostList({ costs, show, empty }: { costs: CostRow[]; show: "next" | "bought" | "stopped"; empty: string }) {
  if (costs.length === 0) return <p className={styles.muted}>{empty}</p>;

  return (
    <ul className={styles.list}>
      {costs.map((c) => (
        <li key={c.id} className={styles.item} data-status={show === "stopped" ? "stopped" : undefined}>
          <div className={styles.itemMain}>
            <Link href={`/kosten/${c.id}`} className={styles.itemTitle}>
              {c.name}
            </Link>
            <span className={styles.itemMeta}>
              <span className={styles.pill}>{categoryLabels[c.category]}</span>
              {show === "next" && (c.next ? `volgende ${formatDate(c.next)}` : "geen betaling meer")}
              {show === "next" && c.endDate && ` · opgezegd per ${formatDate(c.endDate)}`}
              {show === "next" && c.interval === "yearly" && ` · ≈ ${formatEuro(c.perMonthCents)} /mnd`}
              {show === "bought" && formatDate(c.startDate)}
              {show === "stopped" && `${formatDate(c.startDate)} – ${formatDate(c.endDate!)} · ${formatEuro(c.paidTotalCents)} totaal`}
            </span>
          </div>
          <span className={`num ${styles.amount}`}>
            {formatEuro(c.amountCents)}
            <small>{intervalSuffix[c.interval]}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
