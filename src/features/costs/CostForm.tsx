"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Cost } from "@/db";
import { Field } from "@/components/form/Field";
import styles from "@/components/form/form.module.css";
import { centsToInput } from "../money/status";
import { saveCost } from "./actions";
import { categoryLabels, intervalLabels } from "./labels";

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export function CostForm({ cost, today }: { cost?: Cost; today: string }) {
  const [state, action, pending] = useActionState(saveCost.bind(null, cost?.id), {});
  const f = { state };
  const c = cost;

  return (
    <form key={state.at} action={action} className={styles.form} noValidate>
      <section className={styles.section}>
        <h2>Kosten</h2>
        <div className={styles.row}>
          <Field {...f} name="name" label="Naam" initial={c?.name} placeholder="Claude Pro, flitzweb.nl, Figma…" />
          <Field {...f} as="select" name="category" label="Soort" initial={c?.category ?? "software"} options={toOptions(categoryLabels)} />
        </div>
        <div className={styles.row}>
          <Field {...f} name="amountCents" label="Bedrag (€)" initial={c && centsToInput(c.amountCents)} placeholder="20,00" />
          <Field {...f} as="select" name="interval" label="Hoe vaak" initial={c?.interval ?? "monthly"} options={toOptions(intervalLabels)} />
        </div>
        <div className={styles.row}>
          <Field
            {...f}
            name="startDate"
            label="Eerste betaling"
            type="date"
            initial={c?.startDate ?? today}
            hint="Bepaalt de betaaldag. Eenmalig: de aankoopdatum"
          />
          <Field {...f} name="endDate" label="Opgezegd per" type="date" initial={c?.endDate} hint="Leeg = loopt door" />
        </div>
        <Field {...f} name="url" label="Link naar account (optioneel)" initial={c?.url} inputMode="url" placeholder="claude.ai/settings/billing" />
        <Field {...f} as="textarea" name="notes" label="Notities (optioneel)" initial={c?.notes} />
      </section>

      <div className={styles.footer}>
        <div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Opslaan…" : c ? "Opslaan" : "Kosten toevoegen"}
          </button>
          <Link href="/kosten" className="btn">
            Annuleren
          </Link>
        </div>
      </div>
    </form>
  );
}
