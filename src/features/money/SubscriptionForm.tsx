"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Subscription } from "@/db";
import { Field } from "@/components/form/Field";
import styles from "@/components/form/form.module.css";
import { saveSubscription } from "./actions";
import { centsToInput } from "./status";

export type MoneyFormOptions = {
  clients: { id: number; name: string }[];
  sites: { id: number; name: string; clientName: string }[];
};

export function SubscriptionForm({
  subscription,
  options,
  defaults,
  returnTo,
}: {
  subscription?: Subscription;
  options: MoneyFormOptions;
  defaults: { clientId?: number; startDate: string };
  returnTo: string;
}) {
  const [state, action, pending] = useActionState(saveSubscription.bind(null, subscription?.id), {});
  const f = { state };
  const s = subscription;

  return (
    <form key={state.at} action={action} className={styles.form} noValidate>
      <input type="hidden" name="returnTo" value={returnTo} />
      <section className={styles.section}>
        <h2>Abonnement</h2>
        <div className={styles.row}>
          <Field
            {...f}
            as="select"
            name="clientId"
            label="Klant"
            initial={s?.clientId ?? defaults.clientId ?? ""}
            options={[{ value: "", label: "Kies een klant…" }, ...options.clients.map((c) => ({ value: String(c.id), label: c.name }))]}
          />
          <Field
            {...f}
            as="select"
            name="siteId"
            label="Site (optioneel)"
            initial={s?.siteId ?? ""}
            options={[{ value: "", label: "Geen specifieke site" }, ...options.sites.map((x) => ({ value: String(x.id), label: `${x.clientName} · ${x.name}` }))]}
          />
        </div>
        <Field {...f} name="description" label="Omschrijving" initial={s?.description ?? "Hosting & onderhoud"} />
        <div className={styles.row}>
          <Field {...f} name="amountCents" label="Bedrag per maand (€)" initial={s && centsToInput(s.amountCents)} placeholder="25,00" />
          <Field
            {...f}
            name="billingDay"
            label="Betaaldag in de maand"
            type="number"
            initial={s?.billingDay ?? 1}
            hint="1 t/m 28"
          />
        </div>
        <div className={styles.row}>
          <Field {...f} name="startDate" label="Startdatum" type="date" initial={s?.startDate ?? defaults.startDate} />
          <Field {...f} name="endDate" label="Einddatum" type="date" initial={s?.endDate} hint="Leeg = loopt door" />
        </div>
        <Field
          {...f}
          as="select"
          name="active"
          label="Status"
          initial={String(s?.active ?? true)}
          options={[
            { value: "true", label: "Actief" },
            { value: "false", label: "Gestopt (geen nieuwe termijnen)" },
          ]}
        />
      </section>

      <div className={styles.footer}>
        <div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Opslaan…" : s ? "Opslaan" : "Abonnement toevoegen"}
          </button>
          <Link href={returnTo} className="btn">
            Annuleren
          </Link>
        </div>
      </div>
    </form>
  );
}
