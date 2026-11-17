import Link from "next/link";
import { formatMonth } from "@/lib/dates";
import { formatDate, formatEuro } from "@/lib/format";
import type { getSubscriptions } from "./queries";
import styles from "./money.module.css";

type Sub = Awaited<ReturnType<typeof getSubscriptions>>[number];

const stateLabels = { upcoming: "Gepland", free: "Gratis", running: "Loopt" } as const;

/** "elke 1e van de maand · start 1 jan 2027 · eerste maand gratis · Site" */
function meta(s: Sub) {
  const parts: string[] = [];
  if (s.state === "stopped") parts.push("gestopt");
  else parts.push(`elke ${s.billingDay}e van de maand`);
  parts.push(s.state === "upcoming" ? `start ${formatDate(s.startDate)}` : `sinds ${formatDate(s.startDate)}`);
  if (s.freeMonths > 0 && s.state !== "running" && s.state !== "stopped") {
    parts.push(
      s.freeMonths === 1 ? "eerste maand gratis" : `eerste ${s.freeMonths} maanden gratis`,
      `eerste betaling ${formatMonth(s.payingFrom)}`,
    );
  }
  if (s.endDate) parts.push(`tot ${formatDate(s.endDate)}`);
  if (s.siteName) parts.push(s.siteName);
  return parts;
}

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
        <li key={s.id} className={styles.item} data-status={s.state === "stopped" ? "stopped" : undefined}>
          <div className={styles.itemMain}>
            <Link href={`/geld/abonnementen/${s.id}?terug=${encodeURIComponent(returnTo)}`} className={styles.itemTitle}>
              {showClient && <strong>{s.clientName} · </strong>}
              {s.description}
            </Link>
            <span className={styles.itemMeta}>
              {s.state !== "stopped" && <span className={styles.pill} data-status={s.state}>{stateLabels[s.state]}</span>}
              {meta(s).join(" · ")}
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
