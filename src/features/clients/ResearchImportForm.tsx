"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import formStyles from "@/components/form/form.module.css";
import { formatRating } from "@/lib/format";
import { importResearch, type ResearchImportState } from "./actions";
import { parseResearchFile } from "./importResearch";
import { TIERS } from "./stages";
import { TierBadge } from "./TierBadge";
import styles from "./clients.module.css";

/** Pick the file a run of the leads skill wrote, check the preview, import. */
export function ResearchImportForm() {
  const [state, action, pending] = useActionState<ResearchImportState, FormData>(importResearch, {});
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const parsed = useMemo(() => (text ? parseResearchFile(text) : null), [text]);
  const file = parsed?.file;
  const leads = file?.leads ?? [];
  const onRoute = leads.filter((l) => l.routeOrder).length;

  if (state.added != null) {
    return (
      <div className={formStyles.section}>
        <h2>Klaar</h2>
        <p className={styles.muted}>
          {state.added} nieuw toegevoegd, {state.updated} bestaande {state.updated === 1 ? "lead" : "leads"} bijgewerkt
          {state.skipped ? `, ${state.skipped} overgeslagen omdat het al een klant is` : ""}.
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
        <h2>Bestand van de leads-skill</h2>
        <p className={styles.muted}>
          Kies het bestand <code>studio-import.json</code> uit de map van de run. Daar zit alles in: reviews, score,
          tier, de haak, het bewijs, de drie openers en de looproute. Leads die hier al staan krijgen alleen die
          gegevens erbij; fase, opvolgdatum, notities en contactlog blijven zoals ze zijn.
        </p>
        <input
          type="file"
          accept="application/json,.json"
          className="input"
          aria-label="Bestand van de leads-skill"
          onChange={async (e) => {
            const picked = e.target.files?.[0];
            setFileName(picked?.name ?? "");
            setText(picked ? await picked.text() : "");
          }}
        />
        {/* The file's text travels with the form; a file input alone would post the file itself. */}
        <textarea name="research" value={text} readOnly hidden />
        {parsed?.error && <span className="field-error">{parsed.error}</span>}
        {state.error && <span className="field-error">{state.error}</span>}
      </section>

      {file && (
        <section className={formStyles.section}>
          <h2>
            Voorbeeld: {leads.length} {leads.length === 1 ? "lead" : "leads"}
          </h2>
          <p className={styles.muted}>
            {fileName}
            {file.label && ` · ${file.label}`} ·{" "}
            {TIERS.map((t) => `${leads.filter((l) => l.tier === t).length}× ${t}`).join(" · ")}
            {onRoute > 0 && ` · ${onRoute} op de looproute`}
          </p>
          <div className={styles.previewWrap}>
            <table className={styles.preview}>
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Bedrijf</th>
                  <th>Reviews</th>
                  <th>Website nu</th>
                  <th>Haak</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 8).map((l, i) => (
                  <tr key={i}>
                    <td>
                      <TierBadge tier={l.tier} score={l.score} />
                    </td>
                    <td>{l.name}</td>
                    <td>{formatRating(l.rating, l.reviewCount)}</td>
                    <td>{l.websiteStatus}</td>
                    <td>{l.hook}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leads.length > 8 && <p className={styles.muted}>… en nog {leads.length - 8}.</p>}
        </section>
      )}

      <div className={formStyles.footer}>
        <div>
          <button className="btn btn-primary" type="submit" disabled={pending || !file}>
            {pending ? "Importeren…" : file ? `${leads.length} importeren` : "Importeren"}
          </button>
          <Link href="/leads" className="btn">
            Annuleren
          </Link>
        </div>
      </div>
    </form>
  );
}
