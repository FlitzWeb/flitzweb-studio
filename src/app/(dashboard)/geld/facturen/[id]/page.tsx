import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/form/DeleteButton";
import { db, payments } from "@/db";
import { deletePayment } from "@/features/money/actions";
import { formParams, getMoneyFormOptions } from "@/features/money/formOptions";
import { PaymentForm } from "@/features/money/PaymentForm";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Factuur bewerken" };

export default async function EditPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ terug?: string }>;
}) {
  const id = Number((await params).id);
  const { returnTo } = formParams(await searchParams);
  const [payment, options] = await Promise.all([
    Number.isInteger(id) ? db.query.payments.findFirst({ where: eq(payments.id, id) }) : undefined,
    getMoneyFormOptions(),
  ]);
  if (!payment) notFound();

  return (
    <>
      <Link href={returnTo} className="back-link">
        ← Terug
      </Link>
      <h1 className={styles.title}>Factuur bewerken</h1>
      <PaymentForm payment={payment} options={options} defaults={{ issueDate: payment.issueDate, dueDate: payment.dueDate }} returnTo={returnTo} />
      <div className={styles.danger}>
        <DeleteButton
          action={deletePayment.bind(null, payment.id)}
          label="Factuur verwijderen"
          confirmText={`Factuur "${payment.description}" verwijderen?`}
        />
      </div>
    </>
  );
}
