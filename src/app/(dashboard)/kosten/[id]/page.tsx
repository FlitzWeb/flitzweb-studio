import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/form/DeleteButton";
import { costs, db } from "@/db";
import { deleteCost } from "@/features/costs/actions";
import { CostForm } from "@/features/costs/CostForm";
import { todayISO } from "@/lib/dates";
import { displayHost } from "@/lib/format";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Kosten bewerken" };

export default async function EditCostPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const cost = Number.isInteger(id) ? await db.query.costs.findFirst({ where: eq(costs.id, id) }) : undefined;
  if (!cost) notFound();

  return (
    <>
      <Link href="/kosten" className="back-link">
        ← Terug
      </Link>
      <h1 className={styles.title}>{cost.name}</h1>
      {cost.url && (
        <p className={styles.note}>
          <a href={cost.url} target="_blank" rel="noreferrer">
            {displayHost(cost.url)} openen ↗
          </a>
        </p>
      )}
      <CostForm cost={cost} today={todayISO()} />
      <div className={styles.danger}>
        <DeleteButton
          action={deleteCost.bind(null, cost.id)}
          label="Kosten verwijderen"
          confirmText="Kosten verwijderen? Ze tellen dan ook niet meer mee in eerdere totalen. Opgezegd? Vul dan liever een opzegdatum in."
        />
      </div>
    </>
  );
}
