import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/form/DeleteButton";
import { db, subscriptions } from "@/db";
import { deleteSubscription } from "@/features/money/actions";
import { formParams, getMoneyFormOptions } from "@/features/money/formOptions";
import { SubscriptionForm } from "@/features/money/SubscriptionForm";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Abonnement bewerken" };

export default async function EditSubscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ terug?: string }>;
}) {
  const id = Number((await params).id);
  const { returnTo } = formParams(await searchParams);
  const [subscription, options] = await Promise.all([
    Number.isInteger(id) ? db.query.subscriptions.findFirst({ where: eq(subscriptions.id, id) }) : undefined,
    getMoneyFormOptions(),
  ]);
  if (!subscription) notFound();

  return (
    <>
      <Link href={returnTo} className="back-link">
        ← Terug
      </Link>
      <h1 className={styles.title}>Abonnement bewerken</h1>
      <SubscriptionForm subscription={subscription} options={options} defaults={{ startDate: subscription.startDate }} returnTo={returnTo} />
      <p className={styles.note}>
        Bedrag aangepast? Nieuwe termijnen krijgen het nieuwe bedrag; bestaande termijnen blijven zoals ze waren.
      </p>
      <div className={styles.danger}>
        <DeleteButton
          action={deleteSubscription.bind(null, subscription.id)}
          label="Abonnement verwijderen"
          confirmText="Abonnement verwijderen? Alle termijnen (ook betaalde) verdwijnen uit de geschiedenis. Wil je alleen stoppen, zet de status dan op Gestopt."
        />
      </div>
    </>
  );
}
