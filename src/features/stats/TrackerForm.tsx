"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Tracker } from "@/db";
import { Field } from "@/components/form/Field";
import styles from "@/components/form/form.module.css";
import { saveTracker } from "./actions";

export function TrackerForm({ siteId, tracker }: { siteId: number; tracker?: Tracker }) {
  const [state, action, pending] = useActionState(saveTracker.bind(null, siteId, tracker?.id), {});
  const f = { state };

  return (
    <form key={state.at} action={action} className={styles.form} noValidate>
      <section className={styles.section}>
        <h2>Tracker</h2>
        <Field {...f} name="name" label="Naam" initial={tracker?.name} placeholder="Bestellingen" required />
        <Field
          {...f}
          name="eventKey"
          label="Event key"
          initial={tracker?.eventKey}
          placeholder="order_placed"
          hint={
            tracker
              ? "Let op: events met de oude key tellen dan niet meer mee"
              : "Dit zet je in de code van de site: flitz(\"order_placed\")"
          }
        />
        <div className={styles.row}>
          <Field
            {...f}
            as="select"
            name="aggregation"
            label="Meten als"
            initial={tracker?.aggregation ?? "count"}
            options={[
              { value: "count", label: "Aantal keer" },
              { value: "sum", label: "Som van value (bijv. omzet)" },
            ]}
          />
          <Field
            {...f}
            name="monthlyGoal"
            label="Maanddoel (optioneel)"
            type="number"
            initial={tracker?.monthlyGoal}
            placeholder="100"
          />
        </div>
      </section>

      <div className={styles.footer}>
        <div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Opslaan…" : tracker ? "Opslaan" : "Tracker toevoegen"}
          </button>
          <Link href={`/sites/${siteId}/tracking`} className="btn">
            Annuleren
          </Link>
        </div>
      </div>
    </form>
  );
}
