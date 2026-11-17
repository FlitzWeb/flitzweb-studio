"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import formStyles from "@/components/form/form.module.css";
import { importLeads, type ImportState } from "./actions";
import { parseLeadSheet } from "./importLeads";
import { STAGES, stageLabels } from "./stages";
import styles from "./clients.module.css";

/** Paste cells from the leads sheet, check the preview, import. */
export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importLeads, {});
  const [text, setText] = useState("");
  const { rows, hadHeader } = useMemo(() => parseLeadSheet(text), [text]);
  const perStage = STAGES.map((s) => ({ s, n: rows.filter((r) => r.stage === s).length })).filter((x) => x.n > 0);

  if (state.added != null) {
    return (
      <div className={formStyles.section}>
        <h2>Klaar</h2>
        <p className={styles.muted}>
          {state.added} {state.added === 1 ? "lead" : "leads"} toegevoegd
          {state.skipped ? `, ${state.skipped} overgeslagen omdat de naam al bestond` : ""}.
        </p>
        <div>
          <Link href="/leads" className="btn btn-primary">
            Naar leads
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className={formStyles.form}>
      <section className={formStyles.section}>
        <h2>Plak je sheet</h2>
        <p className={styles.muted}>
          Selecteer in Google Sheets de rijen (liefst met de kopregel), kopieer en plak ze hier. Kolommen: Bedrijfsnaam,
          Branche, Locatie, Contactpersoon, Telefoonnummer, Email, Website status, Gevonden door, Status, Laatste contact,
          Notities.
        </p>
        <textarea
          name="sheet"
          className={`input ${styles.importArea}`}
          aria-label="Rijen uit de sheet"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Bedrijfsnaam\tBranche\tLocatie\t…"}
          spellCheck={false}
        />
        {state.error && <span className="field-error">{state.error}</span>}
      </section>

      {rows.length > 0 && (
        <section className={formStyles.section}>
          <h2>
            Voorbeeld: {rows.length} {rows.length === 1 ? "rij" : "rijen"}
          </h2>
          <p className={styles.muted}>
            {hadHeader ? "Kopregel herkend." : "Geen kopregel gevonden: de vaste kolomvolgorde van de sheet is gebruikt."}{" "}
            {perStage.map((x) => `${x.n}× ${stageLabels[x.s]}`).join(" · ")}. Namen die al bestaan worden overgeslagen.
          </p>
          <div className={styles.previewWrap}>
            <table className={styles.preview}>
              <thead>
                <tr>
                  <th>Bedrijf</th>
                  <th>Branche</th>
                  <th>Telefoon</th>
                  <th>Website nu</th>
                  <th>Fase</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>{r.industry}</td>
                    <td>{r.phone}</td>
                    <td>{r.websiteStatus}</td>
                    <td>{stageLabels[r.stage]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 8 && <p className={styles.muted}>… en nog {rows.length - 8}.</p>}
        </section>
      )}

      <div className={formStyles.footer}>
        <div>
          <button className="btn btn-primary" type="submit" disabled={pending || rows.length === 0}>
            {pending ? "Importeren…" : rows.length ? `${rows.length} importeren` : "Importeren"}
          </button>
          <Link href="/leads" className="btn">
            Annuleren
          </Link>
        </div>
      </div>
    </form>
  );
}
