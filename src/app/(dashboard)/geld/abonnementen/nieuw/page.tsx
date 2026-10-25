import type { Metadata } from "next";
import Link from "next/link";
import { formParams, getMoneyFormOptions } from "@/features/money/formOptions";
import { SubscriptionForm } from "@/features/money/SubscriptionForm";
import { todayISO } from "@/lib/dates";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Nieuw abonnement" };

export default async function NewSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ klant?: string; terug?: string }>;
}) {
  const { clientId, returnTo } = formParams(await searchParams);
  const options = await getMoneyFormOptions();

  return (
    <>
      <Link href={returnTo} className="back-link">
        ← Terug
      </Link>
      <h1 className={styles.title}>Nieuw abonnement</h1>
      {options.clients.length === 0 ? (
        <p>Er zijn nog geen betalende klanten.</p>
      ) : (
        <SubscriptionForm options={options} defaults={{ clientId, startDate: todayISO() }} returnTo={returnTo} />
      )}
    </>
  );
}
