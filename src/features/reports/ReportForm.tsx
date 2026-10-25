"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { Report } from "@/db";
import formStyles from "@/components/form/form.module.css";
import { saveReport } from "./actions";
import { REPORT_TYPES, type ReportInput, type Step } from "./schema";
import styles from "./reports.module.css";

type Type = ReportInput["type"];

/** Create/edit a saved report. Suggestions come from the site's real paths and events. */
export function ReportForm({
  siteId,
  report,
  suggestions,
}: {
  siteId: number;
  report?: Report;
  suggestions: { paths: string[]; events: string[] };
}) {
  const [state, action, pending] = useActionState(saveReport.bind(null, siteId, report?.id), {});
  const p = (report?.params ?? {}) as Record<string, unknown>;
  const [type, setType] = useState<Type>((report?.type as Type) ?? "funnel");
  const [name, setName] = useState(report?.name ?? "");
  const [steps, setSteps] = useState<Step[]>(
    (p.steps as Step[] | undefined) ?? [
      { type: "path", value: "/" },
      { type: "path", value: "" },
    ],
  );
  const [window, setWindow] = useState(String(p.window ?? 60));
  const [journeySteps, setJourneySteps] = useState(String(typeof p.steps === "number" ? p.steps : 5));
  const [startStep, setStartStep] = useState(String(p.startStep ?? ""));
  const [endStep, setEndStep] = useState(String(p.endStep ?? ""));
  const [goal, setGoal] = useState<Step>(
    report?.type === "goal" ? { type: p.type as Step["type"], value: String(p.value) } : { type: "event", value: "" },
  );

  const params =
    type === "funnel"
      ? { steps, window: Number(window) }
      : type === "journey"
        ? { steps: Number(journeySteps), startStep, endStep }
        : type === "goal"
          ? goal
          : {};
  const payload = JSON.stringify({ type, name, params });
  const setStep = (i: number, s: Partial<Step>) => setSteps(steps.map((x, j) => (j === i ? { ...x, ...s } : x)));

  return (
    <form action={action} className={formStyles.form}>
      <input type="hidden" name="payload" value={payload} />
      <datalist id="paths">
        {suggestions.paths.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="events">
        {suggestions.events.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="both">
        {[...suggestions.paths, ...suggestions.events].map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <section className={formStyles.section}>
        <h2>Soort rapport</h2>
        <div className={styles.typePicker} role="radiogroup">
          {(Object.keys(REPORT_TYPES) as Type[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={t === type}
              className={styles.typeOption}
              onClick={() => setType(t)}
            >
              <strong>{REPORT_TYPES[t].label}</strong>
              <span>{REPORT_TYPES[t].help}</span>
            </button>
          ))}
        </div>
        <div className="field">
          <label className="label" htmlFor="r-name">
            Naam
          </label>
          <input id="r-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Van homepage naar afspraak" />
        </div>
      </section>

      {type === "funnel" && (
        <section className={formStyles.section}>
          <h2>Stappen</h2>
          <ol className={styles.steps}>
            {steps.map((s, i) => (
              <li key={i}>
                <span className={styles.stepNo}>{i + 1}</span>
                <select className="input" value={s.type} onChange={(e) => setStep(i, { type: e.target.value as Step["type"] })} aria-label="Soort stap">
                  <option value="path">Pagina</option>
                  <option value="event">Event</option>
                </select>
                <input
                  className="input"
                  value={s.value}
                  list={s.type === "path" ? "paths" : "events"}
                  onChange={(e) => setStep(i, { value: e.target.value })}
                  placeholder={s.type === "path" ? "/prijzen of /blog/*" : "bel_klik"}
                  aria-label={`Stap ${i + 1}`}
                />
                {steps.length > 2 && (
                  <button type="button" className="btn btn-sm" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label="Stap verwijderen">
                    ×
                  </button>
                )}
              </li>
            ))}
          </ol>
          {steps.length < 8 && (
            <button type="button" className="btn btn-sm" onClick={() => setSteps([...steps, { type: "path", value: "" }])}>
              + Stap
            </button>
          )}
          <div className="field">
            <label className="label" htmlFor="r-window">
              Max. minuten tussen stappen
            </label>
            <input id="r-window" className="input" type="number" min={1} value={window} onChange={(e) => setWindow(e.target.value)} />
          </div>
        </section>
      )}

      {type === "journey" && (
        <section className={formStyles.section}>
          <h2>Route</h2>
          <div className={formStyles.row}>
            <div className="field">
              <label className="label" htmlFor="r-jsteps">
                Aantal stappen
              </label>
              <select id="r-jsteps" className="input" value={journeySteps} onChange={(e) => setJourneySteps(e.target.value)}>
                {[3, 4, 5, 6, 7].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={formStyles.row}>
            <div className="field">
              <label className="label" htmlFor="r-start">
                Begint bij (optioneel)
              </label>
              <input id="r-start" className="input" list="both" value={startStep} onChange={(e) => setStartStep(e.target.value)} placeholder="/" />
            </div>
            <div className="field">
              <label className="label" htmlFor="r-end">
                Eindigt bij (optioneel)
              </label>
              <input id="r-end" className="input" list="both" value={endStep} onChange={(e) => setEndStep(e.target.value)} placeholder="appointment_booked" />
            </div>
          </div>
        </section>
      )}

      {type === "goal" && (
        <section className={formStyles.section}>
          <h2>Doel</h2>
          <div className={formStyles.row}>
            <select className="input" value={goal.type} onChange={(e) => setGoal({ ...goal, type: e.target.value as Step["type"] })} aria-label="Soort doel">
              <option value="event">Event</option>
              <option value="path">Pagina</option>
            </select>
            <input
              className="input"
              list={goal.type === "path" ? "paths" : "events"}
              value={goal.value}
              onChange={(e) => setGoal({ ...goal, value: e.target.value })}
              placeholder={goal.type === "path" ? "/bedankt" : "appointment_booked"}
              aria-label="Doel"
            />
          </div>
        </section>
      )}

      {type === "retention" && (
        <section className={formStyles.section}>
          <h2>Retentie</h2>
          <p className={styles.muted}>Geen instellingen nodig. Kies een periode van minstens 30 dagen op de Rapporten-tab.</p>
        </section>
      )}

      {state.errors?.form && <p className="field-error">{state.errors.form}</p>}
      <div className={formStyles.footer}>
        <div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Opslaan…" : report ? "Opslaan" : "Rapport maken"}
          </button>
          <Link href={`/sites/${siteId}/rapporten`} className="btn">
            Annuleren
          </Link>
        </div>
      </div>
    </form>
  );
}
