import Link from "next/link";
import { Fragment } from "react";
import type { Report } from "@/db";
import type { Period } from "@/lib/analytics/periods";
import { getFunnel, getGoal, getJourney, getRetention } from "@/lib/analytics/reports";
import { formatDate } from "@/lib/format";
import { REPORT_TYPES, reportSchema, type Step } from "./schema";
import styles from "./reports.module.css";

const num = (n: number) => n.toLocaleString("nl-NL");
const pct = (n: number) => `${n >= 10 || n === 0 ? Math.round(n) : n.toFixed(1).replace(".", ",")}%`;
const stepLabel = (s: Step) => (s.type === "event" ? `Event “${s.value}”` : s.value);

/** One saved report, calculated for the given period and filters. */
export async function ReportView({ report, period }: { report: Report; period: Period }) {
  const parsed = reportSchema.safeParse({ type: report.type, name: report.name, params: report.params });

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div>
          <span className={styles.kind}>{REPORT_TYPES[report.type].label}</span>
          <h2 className={styles.h2}>{report.name}</h2>
        </div>
        <Link href={`/sites/${report.siteId}/rapporten/${report.id}`} className="btn btn-sm">
          Bewerken
        </Link>
      </div>
      {!parsed.success ? (
        <p className={styles.muted}>Dit rapport heeft ongeldige instellingen. Bewerk het om het te herstellen.</p>
      ) : parsed.data.type === "funnel" ? (
        <Funnel siteId={report.siteId} period={period} steps={parsed.data.params.steps} window={parsed.data.params.window} />
      ) : parsed.data.type === "journey" ? (
        <Journey siteId={report.siteId} period={period} {...parsed.data.params} />
      ) : parsed.data.type === "retention" ? (
        <Retention siteId={report.siteId} period={period} />
      ) : (
        <Goal siteId={report.siteId} period={period} goal={parsed.data.params} />
      )}
    </section>
  );
}

async function Funnel({ siteId, period, steps, window }: { siteId: number; period: Period; steps: Step[]; window: number }) {
  const result = await getFunnel(siteId, period, steps, window);
  const last = result.at(-1);
  return (
    <>
      <p className={styles.summary}>
        <strong className="num">{pct(last?.pctOfFirst ?? 0)}</strong> haalt de laatste stap ·{" "}
        {num(last?.visitors ?? 0)} van {num(result[0]?.visitors ?? 0)} bezoekers · max. {window} min per stap
      </p>
      <ol className={styles.funnel}>
        {result.map((r, i) => (
          <li key={i}>
            <div className={styles.funnelLabel}>
              <span className={styles.stepNo}>{i + 1}</span>
              <span>{stepLabel(r.step)}</span>
            </div>
            <div className={styles.funnelBar}>
              <span style={{ width: `${Math.max(r.pctOfFirst, 0.5)}%` }} />
            </div>
            <div className={styles.funnelNums}>
              <strong className="num">{num(r.visitors)}</strong>
              <span>{pct(r.pctOfFirst)}</span>
              {i > 0 && r.dropoff > 0 && <span className={styles.drop}>−{num(r.dropoff)} afgehaakt</span>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

async function Journey(props: { siteId: number; period: Period; steps: number; startStep?: string; endStep?: string }) {
  const rows = await getJourney(props.siteId, props.period, props.steps, props.startStep, props.endStep);
  const total = rows.reduce((t, r) => t + r.count, 0);
  if (!rows.length) return <p className={styles.muted}>Geen routes gevonden in deze periode.</p>;
  return (
    <ol className={styles.journeys}>
      {rows.slice(0, 15).map((r, i) => (
        <li key={i}>
          <span className={styles.path}>
            {r.path.map((s, j) => (
              <Fragment key={j}>
                {j > 0 && <span className={styles.arrow}>→</span>}
                <span className={styles.pathStep} data-event={!s.startsWith("/") || undefined}>
                  {s}
                </span>
              </Fragment>
            ))}
          </span>
          <span className={styles.journeyCount}>
            <strong className="num">{num(r.count)}</strong>
            <small>{pct((r.count / total) * 100)}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

async function Retention({ siteId, period }: { siteId: number; period: Period }) {
  const rows = await getRetention(siteId, period);
  if (!rows.length) return <p className={styles.muted}>Nog geen bezoekers in deze periode.</p>;
  const maxDay = Math.min(14, Math.max(...rows.flatMap((r) => r.days.map((d) => d.day))));
  const days = Array.from({ length: maxDay + 1 }, (_, i) => i);
  return (
    <div className={styles.retentionWrap}>
      <table className={styles.retention}>
        <thead>
          <tr>
            <th>Eerste bezoek</th>
            <th>Bezoekers</th>
            {days.map((d) => (
              <th key={d}>Dag {d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date}>
              <th>{formatDate(r.date)}</th>
              <td className="num">{num(r.visitors)}</td>
              {days.map((d) => {
                const cell = r.days.find((x) => x.day === d);
                return (
                  <td
                    key={d}
                    style={cell ? { background: `color-mix(in srgb, var(--chart-line) ${Math.round(8 + cell.pct * 0.8)}%, transparent)` } : undefined}
                    title={cell ? `${cell.returning} van ${r.visitors}` : undefined}
                  >
                    {cell ? pct(cell.pct) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Goal({ siteId, period, goal }: { siteId: number; period: Period; goal: Step }) {
  const { num: reached, total } = await getGoal(siteId, period, goal);
  const p = total ? (reached / total) * 100 : 0;
  return (
    <div className={styles.goal}>
      <p className={styles.summary}>
        <strong className="num">{pct(p)}</strong> van de bezoekers bereikte {stepLabel(goal)} · {num(reached)} van{" "}
        {num(total)}
      </p>
      <div className={styles.goalBar} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
