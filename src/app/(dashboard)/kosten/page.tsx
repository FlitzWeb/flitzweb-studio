import { CalendarClock, Plus, Receipt, Scale, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { KpiCard } from "@/components/KpiCard";
import { CostList } from "@/features/costs/CostList";
import { getCostsOverview } from "@/features/costs/queries";
import styles from "@/features/money/money.module.css";
import { todayISO } from "@/lib/dates";
import { formatDate, formatEuro } from "@/lib/format";
import overview from "../overview.module.css";

export const metadata: Metadata = { title: "Kosten" };

export default async function CostsPage() {
  const o = await getCostsOverview();
  const year = todayISO().slice(0, 4);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Kosten</h1>
          <p className="page-sub">Wat FlitzWeb zelf betaalt: abonnementen, domeinen en software</p>
        </div>
        <div className="page-actions">
          <Link href="/kosten/nieuw" className="btn btn-primary">
            <Plus aria-hidden="true" />
            Nieuwe kosten
          </Link>
        </div>
      </header>

      <section className={overview.kpis} aria-label="Totalen">
        <KpiCard
          icon={<Receipt />}
          label="Per maand"
          value={formatEuro(o.perMonthCents)}
          hint={`≈ ${formatEuro(o.perMonthCents * 12)} per jaar`}
        />
        <KpiCard
          icon={<CalendarClock />}
          label="Volgende betaling"
          value={o.upcoming ? formatEuro(o.upcoming.amountCents) : null}
          hint={o.upcoming ? `${o.upcoming.name} · ${formatDate(o.upcoming.next!)}` : "Niets gepland"}
        />
        <KpiCard icon={<Wallet />} label={`Betaald in ${year}`} value={formatEuro(o.paidThisYearCents)} hint="Alle kosten samen" />
        <KpiCard
          icon={<Scale />}
          label="Netto per maand"
          value={formatEuro(o.netPerMonthCents)}
          tone={o.netPerMonthCents < 0 ? "danger" : undefined}
          hint={`${formatEuro(o.mrrCents)} MRR min kosten`}
          href="/geld"
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Lopende kosten</h2>
        </div>
        <CostList costs={o.running} show="next" empty="Nog geen vaste kosten. Voeg bijvoorbeeld je Claude-abonnement of een domein toe." />
      </section>

      {o.oneOff.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Eenmalige aankopen</h2>
          </div>
          <CostList costs={o.oneOff} show="bought" empty="" />
        </section>
      )}

      {o.stopped.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Opgezegd</h2>
          </div>
          <CostList costs={o.stopped} show="stopped" empty="" />
        </section>
      )}
    </>
  );
}
