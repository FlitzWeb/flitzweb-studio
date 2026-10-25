import type { Metadata } from "next";
import Link from "next/link";
import { StatTile, StatTiles } from "@/components/StatTile";
import { MoneyList } from "@/features/money/MoneyList";
import { getMoneySummary, getSubscriptions } from "@/features/money/queries";
import { SubscriptionList } from "@/features/money/SubscriptionList";
import styles from "@/features/money/money.module.css";
import { formatMonth, todayISO } from "@/lib/dates";
import { formatEuro } from "@/lib/format";
import overview from "../overview.module.css";

export const metadata: Metadata = { title: "Geld" };

export default async function MoneyPage() {
  const [summary, subscriptions] = await Promise.all([
    getMoneySummary(),
    getSubscriptions({ activeOnly: true }),
  ]);

  return (
    <>
      <section className={overview.head}>
        <div>
          <p className="eyebrow">Geld · {formatMonth(todayISO())}</p>
          <h1 className={overview.title}>Geld</h1>
        </div>
        <div className={overview.actions}>
          <Link href="/geld/abonnementen/nieuw" className="btn">
            + Abonnement
          </Link>
          <Link href="/geld/facturen/nieuw" className="btn btn-primary">
            + Factuur
          </Link>
        </div>
      </section>

      <StatTiles>
        <StatTile size="lg" label="Open" value={formatEuro(summary.awaitingCents)} />
        <StatTile
          size="lg"
          label="Te laat"
          value={formatEuro(summary.overdueCents)}
          tone={summary.overdueCents > 0 ? "danger" : undefined}
          hint={summary.overdueCount > 0 ? `${summary.overdueCount} ${summary.overdueCount === 1 ? "post" : "posten"}` : undefined}
        />
        <StatTile size="lg" label="MRR" value={formatEuro(summary.mrrCents)} hint="per maand, actieve abonnementen" />
        <StatTile size="lg" label="Betaald deze maand" value={formatEuro(summary.paidThisMonthCents)} />
      </StatTiles>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Openstaand</h2>
        </div>
        <MoneyList items={summary.outstanding} showClient returnTo="/geld" empty="Niets openstaand. Alles is betaald." />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Lopende abonnementen</h2>
        </div>
        <SubscriptionList subscriptions={subscriptions} showClient returnTo="/geld" empty="Nog geen abonnementen." />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Recent betaald</h2>
        </div>
        <MoneyList items={summary.recentPaid} showClient returnTo="/geld" empty="Nog niets betaald in de laatste 90 dagen." />
      </section>
    </>
  );
}
