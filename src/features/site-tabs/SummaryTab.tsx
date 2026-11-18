/* eslint-disable @next/next/no-img-element -- generated on the fly by /api/report-image */
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { StatTile, StatTiles } from "@/components/StatTile";
import { messageLink } from "@/features/clients/messageLink";
import { saveReportNote, saveReportParts } from "@/features/summary/actions";
import { hiddenParts, REPORT_PARTS } from "@/features/summary/parts";
import { DONE_MAX, FIXED_HIGHLIGHTS, goalKey, highlights, summaryMessage } from "@/features/summary/message";
import { getMonthSummary, getReportNote, summaryMonth } from "@/features/summary/queries";
import { formatDate } from "@/lib/format";
import { ShareReport } from "@/features/summary/ShareReport";
import { formatMonth } from "@/lib/dates";
import type { TabProps } from "./registry";
import styles from "./tabs.module.css";

/** One month as a picture to send the client, with the numbers it is built from. */
export async function SummaryTab({ site, searchParams }: TabProps) {
  const { month, prev, next, isCurrent } = summaryMonth(searchParams.maand);
  const [summary, note] = await Promise.all([getMonthSummary(site.id, site.trackers, month, site.reportChartEvent), getReportNote(site.id, month)]);
  const message = summaryMessage({ siteName: site.name, contactPerson: site.client.contactPerson, month });
  const link = messageLink(site.client, message, `${site.name}: overzicht ${formatMonth(month)}`);
  const base = `/sites/${site.id}/maandrapport`;
  const ym = month.slice(0, 7);
  const hidden = hiddenParts(site.reportHidden);
  // Changes when the saved line or the report's settings change, so the browser fetches the new picture and the form shows what was saved.
  const settings = `${[...hidden].join(".")}-${site.reportChartEvent ?? ""}-${site.reportLead ?? ""}`;
  const imageUrl = `/api/report-image/${site.id}?maand=${ym}&v=${encodeURIComponent(`${note ? note.updatedAt.getTime() : 0}-${settings}`)}`;
  const slug = site.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site";
  const empty = summary.stats.current.views === 0 && summary.uptimePct == null;

  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2 className={`${styles.h2} ${styles.monthTitle}`}>{formatMonth(month)}</h2>
            <p className={styles.muted}>
              {isCurrent
                ? "Deze maand loopt nog: de cijfers zijn tot nu toe, zonder vergelijking."
                : summary.comparable
                  ? "Hele maand, vergeleken met de maand ervoor."
                  : "Hele maand. Geen vergelijking: de maand ervoor is niet volledig gemeten."}
            </p>
          </div>
          <div className={styles.monthNav}>
            <Link href={`${base}?maand=${prev.slice(0, 7)}`} className="btn btn-sm" scroll={false}>
              <ChevronLeft aria-hidden="true" />
              {formatMonth(prev)}
            </Link>
            {next && (
              <Link href={`${base}?maand=${next.slice(0, 7)}`} className="btn btn-sm" scroll={false}>
                {formatMonth(next)}
                <ChevronRight aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
        <div className={styles.tilesWrap}>
          <StatTiles>
            {highlights(summary, new Set(), site.reportLead).map((h) => (
              <StatTile key={h.key} label={h.label} value={h.value} hint={h.note} />
            ))}
          </StatTiles>
        </div>
      </section>

      {empty ? (
        <p className={styles.muted}>Geen metingen in deze maand, dus er is nog niets om te sturen.</p>
      ) : (
        <div className={styles.report}>
          <section className={styles.panel}>
            <h2 className={styles.h2}>Rapport voor {site.client.contactPerson ?? site.client.name}</h2>
            <p className={styles.muted}>Dit is de afbeelding die je stuurt. De belangrijkste cijfers staan bovenaan.</p>
            <a href={imageUrl} target="_blank" rel="noreferrer" className={styles.reportImage}>
              <img src={imageUrl} alt={`Maandoverzicht ${site.name}, ${formatMonth(month)}`} width={1080} height={1350} />
            </a>
          </section>

          <div className={styles.stack}>
            <section className={styles.panel}>
              <h2 className={styles.h2}>Wat heb je deze maand gedaan?</h2>
              <p className={styles.muted}>
                Eén zin, komt onderaan op het rapport. {note ? `Opgeslagen op ${formatDate(note.updatedAt)}.` : "Mag leeg blijven."}
              </p>
              <form action={saveReportNote.bind(null, site.id, month)} className={styles.doneForm}>
                <textarea
                  name="gedaan"
                  className="input"
                  aria-label="Deze maand gedaan"
                  key={note?.updatedAt.getTime() ?? 0}
                  defaultValue={note?.done ?? ""}
                  maxLength={DONE_MAX}
                  placeholder="Prijzenpagina bijgewerkt en de openingstijden voor de feestdagen aangepast."
                />
                <div>
                  <button type="submit" className="btn btn-sm">
                    Opslaan
                  </button>
                </div>
              </form>
            </section>

            <section className={styles.panel}>
              <h2 className={styles.h2}>Wat staat erop?</h2>
              <p className={styles.muted}>Geldt voor elk maandrapport van {site.name}. Er passen maximaal vier grote cijfers op.</p>
              <form action={saveReportParts.bind(null, site.id)} className={styles.doneForm} key={settings}>
                <div className={styles.parts}>
                  {REPORT_PARTS.map((p) => (
                    <label key={p.key} className={styles.part}>
                      <input type="checkbox" name="part" value={p.key} defaultChecked={!hidden.has(p.key)} />
                      <span>
                        <strong>{p.label}</strong>
                        <small>{p.hint}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="field">
                  <label className="label" htmlFor="report-lead">
                    Belangrijkste cijfer
                  </label>
                  <select id="report-lead" name="lead" className="input" defaultValue={site.reportLead ?? ""}>
                    <option value="">Automatisch (het eerste cijfer)</option>
                    {site.trackers.map((t) => (
                      <option key={t.id} value={goalKey(t.eventKey)}>
                        {t.name}
                      </option>
                    ))}
                    {FIXED_HIGHLIGHTS.map((h) => (
                      <option key={h.key} value={h.key}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                  <span className="label">Dit cijfer staat vooraan en krijgt het blauwe vak.</span>
                </div>
                {site.trackers.length > 0 && (
                  <div className="field">
                    <label className="label" htmlFor="report-chart">
                      De grafiek per dag toont
                    </label>
                    <select id="report-chart" name="chart" className="input" defaultValue={site.reportChartEvent ?? ""}>
                      <option value="">Bezoekers</option>
                      {site.trackers.map((t) => (
                        <option key={t.id} value={t.eventKey}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <span className="label">Kies een resultaat (zoals bellen) om te zien op welke dagen een actie werkte.</span>
                  </div>
                )}
                <div>
                  <button type="submit" className="btn btn-sm">
                    Opslaan
                  </button>
                </div>
              </form>
            </section>

            <section className={styles.panel}>
              <h2 className={styles.h2}>Versturen</h2>
              <p className={styles.muted}>
                Op je telefoon stuurt “Deel afbeelding” het rapport direct door naar WhatsApp. Op de computer download je het en
                voeg je het zelf toe.
              </p>
              <div className={styles.sendTools}>
                <ShareReport imageUrl={imageUrl} fileName={`maandoverzicht-${slug}-${ym}.png`} message={message} />
              </div>
              <pre className={styles.message}>{message}</pre>
              <div className={styles.sendTools}>
                <CopyButton text={message} label="Kopieer bericht" />
                {link && (
                  <a
                    href={link.href}
                    className="btn btn-sm"
                    target={link.channel === "whatsapp" ? "_blank" : undefined}
                    rel={link.channel === "whatsapp" ? "noreferrer" : undefined}
                  >
                    {link.channel === "whatsapp" ? "Open chat in WhatsApp" : "Open in mail"}
                  </a>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
