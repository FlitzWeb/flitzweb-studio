"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Client } from "@/db";
import { Field } from "@/components/form/Field";
import styles from "@/components/form/form.module.css";
import { saveClient } from "./actions";

export function ClientForm({ client }: { client?: Client }) {
  const [state, action, pending] = useActionState(saveClient.bind(null, client?.id), {});
  const f = { state };

  return (
    // `key` remounts the form after a failed submit so it shows the sent values.
    <form key={state.at} action={action} className={styles.form} noValidate>
      <section className={styles.section}>
        <h2>Klant</h2>
        <Field {...f} name="name" label="Naam" initial={client?.name} required placeholder="Hakiki Döner" />
        <div className={styles.row}>
          <Field {...f} name="businessName" label="Bedrijfsnaam" initial={client?.businessName} hint="Als die anders is dan de naam" />
          <Field
            {...f}
            as="select"
            name="billingType"
            label="Facturatie"
            initial={client?.billingType ?? "paying"}
            options={[
              { value: "paying", label: "Betalend" },
              { value: "no_billing", label: "Geen facturatie (familie, pro bono)" },
            ]}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2>Contact</h2>
        <Field {...f} name="contactPerson" label="Contactpersoon" initial={client?.contactPerson} />
        <div className={styles.row}>
          <Field {...f} name="phone" label="Telefoon" type="tel" inputMode="tel" initial={client?.phone} placeholder="06 12345678" />
          <Field {...f} name="whatsapp" label="WhatsApp" type="tel" inputMode="tel" initial={client?.whatsapp} hint="Leeg = zelfde als telefoon" />
        </div>
        <div className={styles.row}>
          <Field {...f} name="email" label="E-mail" type="email" inputMode="email" initial={client?.email} />
          <Field
            {...f}
            as="select"
            name="preferredChannel"
            label="Voorkeur contact"
            initial={client?.preferredChannel ?? ""}
            options={[
              { value: "", label: "Geen voorkeur" },
              { value: "phone", label: "Bellen" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "email", label: "E-mail" },
            ]}
          />
        </div>
        <Field {...f} name="address" label="Adres" initial={client?.address} placeholder="Straat 1, 5600 AA Eindhoven" />
        <Field {...f} as="textarea" name="notes" label="Notities" initial={client?.notes} />
      </section>

      <div className={styles.footer}>
        <div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Opslaan…" : client ? "Opslaan" : "Klant toevoegen"}
          </button>
          <Link href={client ? `/klanten/${client.id}` : "/klanten"} className="btn">
            Annuleren
          </Link>
        </div>
      </div>
    </form>
  );
}
