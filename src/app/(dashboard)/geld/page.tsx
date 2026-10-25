import { AlertTriangle, CircleCheck, Clock, Plus, Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { KpiCard } from "@/components/KpiCard";
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
      <header className="page-head">
        <div>
          <h1 className="page-title">Geld</h1>
          <p className="page-sub">{capitalize(formatMonth(todayISO()))} · facturen en abonnementen</p>
        </div>
        <div className="page-actions">
          <Link href="/geld/abonnementen/nieuw" className="btn">
            <Repeat aria-hidden="true" />
            Abonnement
          </Link>
          <Link href="/geld/facturen/nieuw" className="btn btn-primary">
            <Plus aria-hidden="true" />
            Nieuwe factuur
          </Link>
        </div>
      </header>

      <section className={overview.kpis} aria-label="Totalen">
        <KpiCard icon={<Clock />} label="Open" value={formatEuro(summary.awaitingCents)} hint="Verstuurd, nog niet betaald" />
        <KpiCard
          icon={<AlertTriangle />}
          label="Te laat"
          value={formatEuro(summary.overdueCents)}
          tone={summary.overdueCents > 0 ? "danger" : undefined}
          hint={
            summary.overdueCount > 0
              ? `${summary.overdueCount} ${summary.overdueCount === 1 ? "post" : "posten"} over de vervaldatum`
              : "Niets te laat"
          }
        />
        <KpiCard icon={<Repeat />} label="MRR" value={formatEuro(summary.mrrCents)} hint="Per maand, lopende abonnementen" />
        <KpiCard icon={<CircleCheck />} label="Betaald deze maand" value={formatEuro(summary.paidThisMonthCents)} />
      </section>

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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
