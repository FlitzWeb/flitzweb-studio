import { Plus } from "lucide-react";
import Link from "next/link";
import { StatTile, StatTiles } from "@/components/StatTile";
import type { Client } from "@/db";
import { formatEuro } from "@/lib/format";
import { MoneyList } from "./MoneyList";
import { getMoneyItems, getSubscriptions } from "./queries";
import { SubscriptionList } from "./SubscriptionList";
import styles from "./money.module.css";

/**
 * Everything money for one client: totals, open items, subscriptions, history.
 * Used on the client page and the site's Betalingen tab.
 * Renders nothing for `no_billing` clients.
 */
export async function ClientMoney({ client, returnTo }: { client: Client; returnTo: string }) {
  if (client.billingType !== "paying") return null;

  const [items, subscriptions] = await Promise.all([
    getMoneyItems({ clientId: client.id }),
    getSubscriptions({ clientId: client.id }),
  ]);
  const open = items.filter((i) => i.status !== "paid");
  const paid = items
    .filter((i) => i.status === "paid")
    .sort((a, b) => b.paidDate!.localeCompare(a.paidDate!));
  const sum = (list: typeof items) => list.reduce((t, i) => t + i.amountCents, 0);
  const overdue = open.filter((i) => i.status === "overdue");
  const mrr = subscriptions.filter((s) => s.running).reduce((t, s) => t + s.amountCents, 0);
  const q = `klant=${client.id}&terug=${encodeURIComponent(returnTo)}`;

  return (
    <>
      <div className={styles.sectionHead}>
        <h2>Geld</h2>
        <div>
          <Link href={`/geld/abonnementen/nieuw?${q}`} className="btn btn-sm">
            <Plus aria-hidden="true" />
            Abonnement
          </Link>
          <Link href={`/geld/facturen/nieuw?${q}`} className="btn btn-sm">
            <Plus aria-hidden="true" />
            Factuur
          </Link>
        </div>
      </div>

      <StatTiles>
        <StatTile label="Open" value={formatEuro(sum(open))} tone={overdue.length ? "danger" : undefined} hint={overdue.length ? `${formatEuro(sum(overdue))} te laat` : undefined} />
        <StatTile label="Abonnement" value={formatEuro(mrr)} unit="/mnd" />
        <StatTile label="Totaal betaald" value={formatEuro(sum(paid))} />
      </StatTiles>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Openstaand</h2>
        </div>
        <MoneyList items={open} returnTo={returnTo} empty="Niets openstaand." />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Abonnementen</h2>
        </div>
        <SubscriptionList subscriptions={subscriptions} returnTo={returnTo} empty="Geen abonnement." />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Geschiedenis</h2>
        </div>
        <MoneyList items={paid} returnTo={returnTo} empty="Nog niets betaald." />
      </section>
    </>
  );
}
