"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Site } from "@/db";
import { Field } from "@/components/form/Field";
import styles from "@/components/form/form.module.css";
import { saveSite } from "./actions";

export function SiteForm({
  site,
  clients,
  defaultClientId,
}: {
  site?: Site;
  clients: { id: number; name: string }[];
  defaultClientId?: number;
}) {
  const [state, action, pending] = useActionState(saveSite.bind(null, site?.id), {});
  const f = { state };
  const cancelHref = site ? `/sites/${site.id}` : defaultClientId ? `/klanten/${defaultClientId}` : "/";

  return (
    <form key={state.at} action={action} className={styles.form} noValidate>
      <section className={styles.section}>
        <h2>Site</h2>
        <Field
          {...f}
          as="select"
          name="clientId"
          label="Klant"
          initial={site?.clientId ?? defaultClientId ?? ""}
          options={[{ value: "", label: "Kies een klant…" }, ...clients.map((c) => ({ value: String(c.id), label: c.name }))]}
        />
        <div className={styles.row}>
          <Field {...f} name="name" label="Naam" initial={site?.name} required />
          <Field {...f} name="url" label="URL" type="url" inputMode="url" initial={site?.url} placeholder="https://voorbeeld.nl" required />
        </div>
        <div className={styles.row}>
          <Field
            {...f}
            as="select"
            name="status"
            label="Status"
            initial={site?.status ?? "live"}
            hint="Alleen Live wordt gemonitord"
            options={[
              { value: "live", label: "Live" },
              { value: "in_progress", label: "In aanbouw" },
              { value: "paused", label: "Gepauzeerd" },
            ]}
          />
          <Field {...f} name="goLiveDate" label="Live sinds" type="date" initial={site?.goLiveDate} />
        </div>
      </section>

      <section className={styles.section}>
        <h2>Hosting & domein</h2>
        <div className={styles.row}>
          <Field
            {...f}
            as="select"
            name="hosting"
            label="Hosting"
            initial={site?.hosting ?? "vercel"}
            options={[
              { value: "vercel", label: "Vercel" },
              { value: "other", label: "Anders" },
            ]}
          />
          <Field {...f} name="registrar" label="Domein geregistreerd bij" initial={site?.registrar} placeholder="TransIP" />
        </div>
        <Field
          {...f}
          name="hostingDashboardUrl"
          label="Link naar hosting-dashboard"
          type="url"
          inputMode="url"
          initial={site?.hostingDashboardUrl}
          placeholder="https://vercel.com/flitzweb/…"
        />
      </section>

      <div className={styles.footer}>
        <div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Opslaan…" : site ? "Opslaan" : "Site toevoegen"}
          </button>
          <Link href={cancelHref} className="btn">
            Annuleren
          </Link>
        </div>
      </div>
    </form>
  );
}
