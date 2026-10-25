import Link from "next/link";
import { formatDate, formatEuro } from "@/lib/format";
import { MarkPaidButton } from "./MarkPaidButton";
import type { MoneyItem } from "./queries";
import { moneyStatusLabels } from "./status";
import styles from "./money.module.css";

/**
 * Invoices and monthly charges as rows. `showClient` adds the client name
 * (for the global Geld page). `returnTo` is where edit pages go back to.
 */
export function MoneyList({
  items,
  showClient,
  returnTo,
  empty,
}: {
  items: MoneyItem[];
  showClient?: boolean;
  returnTo: string;
  empty: string;
}) {
  if (items.length === 0) return <p className={styles.muted}>{empty}</p>;

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className={styles.item} data-status={item.status}>
          <div className={styles.itemMain}>
            <Link href={`${item.editHref}?terug=${encodeURIComponent(returnTo)}`} className={styles.itemTitle}>
              {showClient && <strong>{item.clientName} · </strong>}
              {item.description}
            </Link>
            <span className={styles.itemMeta}>
              <span className={styles.pill} data-status={item.status}>
                {moneyStatusLabels[item.status]}
              </span>
              {item.paidDate ? `betaald ${formatDate(item.paidDate)}` : `vervalt ${formatDate(item.dueDate)}`}
              {item.siteName && ` · ${item.siteName}`}
              {item.kind === "charge" && " · abonnement"}
              {item.paymentUrl && item.status !== "paid" && (
                <a href={item.paymentUrl} target="_blank" rel="noreferrer">
                  betaallink ↗
                </a>
              )}
            </span>
          </div>
          <span className={`num ${styles.amount}`}>{formatEuro(item.amountCents)}</span>
          <MarkPaidButton kind={item.kind} id={item.id} paid={item.status === "paid"} />
        </li>
      ))}
    </ul>
  );
}
