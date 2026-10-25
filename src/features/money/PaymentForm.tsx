"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Payment } from "@/db";
import { Field } from "@/components/form/Field";
import styles from "@/components/form/form.module.css";
import { savePayment } from "./actions";
import { centsToInput } from "./status";
import type { MoneyFormOptions } from "./SubscriptionForm";

export function PaymentForm({
  payment,
  options,
  defaults,
  returnTo,
}: {
  payment?: Payment;
  options: MoneyFormOptions;
  /** Prefilled values for a new invoice (client, dates). */
  defaults: { clientId?: number; issueDate: string; dueDate: string };
  returnTo: string;
}) {
  const [state, action, pending] = useActionState(savePayment.bind(null, payment?.id), {});
  const f = { state };

  return (
    <form key={state.at} action={action} className={styles.form} noValidate>
      <input type="hidden" name="returnTo" value={returnTo} />
      <section className={styles.section}>
        <h2>Factuur</h2>
        <div className={styles.row}>
          <Field
            {...f}
            as="select"
            name="clientId"
            label="Klant"
            initial={payment?.clientId ?? defaults.clientId ?? ""}
            options={[{ value: "", label: "Kies een klant…" }, ...options.clients.map((c) => ({ value: String(c.id), label: c.name }))]}
          />
          <Field
            {...f}
            as="select"
            name="siteId"
            label="Site (optioneel)"
            initial={payment?.siteId ?? ""}
            options={[{ value: "", label: "Geen specifieke site" }, ...options.sites.map((s) => ({ value: String(s.id), label: `${s.clientName} · ${s.name}` }))]}
          />
        </div>
        <Field {...f} name="description" label="Omschrijving" initial={payment?.description} placeholder="Website bouwen" />
        <Field
          {...f}
          name="amountCents"
          label="Bedrag (€)"
          inputMode="text"
          initial={payment && centsToInput(payment.amountCents)}
          placeholder="450,00"
        />
        <div className={styles.row}>
          <Field {...f} name="issueDate" label="Factuurdatum" type="date" initial={payment?.issueDate ?? defaults.issueDate} />
          <Field {...f} name="dueDate" label="Vervaldatum" type="date" initial={payment?.dueDate ?? defaults.dueDate} />
        </div>
        <Field {...f} name="paidDate" label="Betaald op" type="date" initial={payment?.paidDate} hint="Leeg = nog niet betaald" />
      </section>

      <div className={styles.footer}>
        <div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Opslaan…" : payment ? "Opslaan" : "Factuur toevoegen"}
          </button>
          <Link href={returnTo} className="btn">
            Annuleren
          </Link>
        </div>
      </div>
    </form>
  );
}
