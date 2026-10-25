import Link from "next/link";
import { formatDate, formatEuro } from "@/lib/format";
import type { getSubscriptions } from "./queries";
import styles from "./money.module.css";

type Sub = Awaited<ReturnType<typeof getSubscriptions>>[number];

export function SubscriptionList({
  subscriptions,
  showClient,
  returnTo,
  empty,
}: {
  subscriptions: Sub[];
  showClient?: boolean;
  returnTo: string;
  empty: string;
}) {
  if (subscriptions.length === 0) return <p className={styles.muted}>{empty}</p>;

  return (
    <ul className={styles.list}>
      {subscriptions.map((s) => (
        <li key={s.id} className={styles.item} data-status={s.running ? undefined : "stopped"}>
          <div className={styles.itemMain}>
            <Link href={`/geld/abonnementen/${s.id}?terug=${encodeURIComponent(returnTo)}`} className={styles.itemTitle}>
              {showClient && <strong>{s.clientName} · </strong>}
              {s.description}
            </Link>
            <span className={styles.itemMeta}>
              {s.running ? `elke ${s.billingDay}e van de maand` : "gestopt"}
              {` · sinds ${formatDate(s.startDate)}`}
              {s.endDate && ` · tot ${formatDate(s.endDate)}`}
              {s.siteName && ` · ${s.siteName}`}
            </span>
          </div>
          <span className={`num ${styles.amount}`}>
            {formatEuro(s.amountCents)}
            <small> /mnd</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
