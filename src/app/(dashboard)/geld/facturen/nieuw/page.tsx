import type { Metadata } from "next";
import Link from "next/link";
import { formParams, getMoneyFormOptions } from "@/features/money/formOptions";
import { PaymentForm } from "@/features/money/PaymentForm";
import { addDays, todayISO } from "@/lib/dates";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Nieuwe factuur" };

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ klant?: string; terug?: string }>;
}) {
  const { clientId, returnTo } = formParams(await searchParams);
  const options = await getMoneyFormOptions();
  const today = todayISO();

  return (
    <>
      <Link href={returnTo} className="back-link">
        ← Terug
      </Link>
      <h1 className={styles.title}>Nieuwe factuur</h1>
      {options.clients.length === 0 ? (
        <p>Er zijn nog geen betalende klanten.</p>
      ) : (
        <PaymentForm
          options={options}
          defaults={{ clientId, issueDate: today, dueDate: addDays(today, 14) }}
          returnTo={returnTo}
        />
      )}
    </>
  );
}
