import { Activity, ArrowRight, BarChart3, Globe, Plus, ShieldCheck, Timer, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DayBars } from "@/components/charts/DayBars";
import { Gauge } from "@/components/charts/Gauge";
import { Delta } from "@/components/Delta";
import { KpiCard } from "@/components/KpiCard";
import { getMoneySummary } from "@/features/money/queries";
import { CheckNowButton } from "@/features/uptime/CheckNowButton";
import { ResponseOverviewChart, type ResponseSeries } from "@/features/uptime/ResponseOverviewChart";
import { SiteTable } from "@/features/uptime/SiteTable";
import { getPageviewSeries, getWebsiteStats } from "@/lib/analytics/queries";
import { getPeriod } from "@/lib/analytics/periods";
import { formatEuro, formatPct } from "@/lib/format";
import { recentChecks, responseAverages, getSiteOverviews, type SiteOverview } from "@/lib/uptime/queries";
import styles from "./overview.module.css";

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
const BUCKET_MS = 15 * 60_000;
const UPTIME_TARGET = 99.9;

const dayFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", weekday: "long", day: "numeric", month: "long" });
const weekdayFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", weekday: "short" });
const fullDayFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" });

export default async function OverviewPage() {
  const sites = await getSiteOverviews();
  const live = sites.filter((s) => s.monitored);
  const down = live.filter((s) => s.isUp === false);
  const period = getPeriod("7d");

  const [response, money, chart, traffic] = await Promise.all([
    responseAverages(),
    getMoneySummary(),
    responseSeries(live),
    // Every site with a tracker counts, also ones still being built.
    Promise.all(
      sites.map(async (s) => {
        const [stats, series] = await Promise.all([getWebsiteStats(s.id, period), getPageviewSeries(s.id, period)]);
        return { stats, series };
      }),
    ),
  ]);

  const visitors = traffic.reduce((t, x) => t + x.stats.current.visitors, 0);
  const visitorsBefore = traffic.reduce((t, x) => t + x.stats.previous.visitors, 0);
  const days = (traffic[0]?.series ?? []).map((p, i) => {
    const date = new Date(`${p.bucket}T00:00:00Z`);
    return {
      key: p.bucket,
      label: weekdayFmt.format(date).replace(".", ""),
      full: fullDayFmt.format(date),
      value: traffic.reduce((t, x) => t + (x.series[i]?.visitors ?? 0), 0),
    };
  });

  const uptimes = live.map((s) => s.uptime30).filter((u): u is number => u != null);
  const uptimeAvg = uptimes.length ? uptimes.reduce((a, b) => a + b, 0) / uptimes.length : null;

  const expected = money.mrrCents;
  const received = money.paidThisMonthCents;

  return (
    <>
      <AutoRefresh seconds={60} />
      <header className="page-head">
        <div>
          <h1 className="page-title">Overzicht</h1>
          <p className="page-sub">
            <span className={styles.today}>{dayFmt.format(new Date())}</span> · {headline(live.length, down.length)}
          </p>
        </div>
        <div className="page-actions">
          <CheckNowButton />
          <Link href="/sites/nieuw" className="btn btn-primary">
            <Plus aria-hidden="true" />
            Nieuwe site
          </Link>
        </div>
      </header>

      <section className={styles.kpis} aria-label="Kerncijfers">
        <KpiCard
          icon={<Globe />}
          label="Sites online"
          value={live.length ? `${live.length - down.length}/${live.length}` : null}
          tone={down.length > 0 ? "danger" : undefined}
          delta={
            live.length > 0 && (
              <span className="badge" data-tone={down.length ? "danger" : "ok"}>
                {down.length ? `${down.length} offline` : "Alles draait"}
              </span>
            )
          }
          hint={sites.length > live.length ? `${sites.length - live.length} niet gemonitord` : "Elke 5 minuten gecheckt"}
        />
        <KpiCard
          icon={<Users />}
          label="Bezoekers"
          value={sites.length ? visitors.toLocaleString("nl-NL") : null}
          delta={<Delta current={visitors} previous={visitorsBefore} />}
          hint={`7 dagen · vorige week ${visitorsBefore.toLocaleString("nl-NL")}`}
        />
        <KpiCard
          icon={<Timer />}
          label="Reactietijd"
          value={response.current}
          unit="ms"
          delta={<Delta current={response.current} previous={response.previous} better="down" />}
          hint={response.previous != null ? `24 uur · daarvoor ${response.previous} ms` : "Gemiddelde, laatste 24 uur"}
        />
        <KpiCard
          icon={<ShieldCheck />}
          label="Uptime"
          value={uptimeAvg != null ? formatPct(uptimeAvg) : null}
          unit="%"
          tone={uptimeAvg != null && uptimeAvg < UPTIME_TARGET ? "danger" : undefined}
          delta={
            uptimeAvg != null && (
              <span className="badge" data-tone={uptimeAvg >= UPTIME_TARGET ? "ok" : "warn"}>
                {uptimeAvg >= UPTIME_TARGET ? "Op doel" : "Onder doel"}
              </span>
            )
          }
          hint={`30 dagen · doel ${formatPct(UPTIME_TARGET)}%`}
        />
      </section>

      <div className={styles.grid}>
        <section className={`card ${styles.panel} ${styles.wide}`} aria-labelledby="h-response">
          <div className="card-head">
            <span className="icon-chip" aria-hidden="true">
              <Activity />
            </span>
            <h2 id="h-response" className="card-title">
              Reactietijd
            </h2>
            <span className={styles.meta}>Laatste 24 uur</span>
          </div>
          {chart.series.length > 0 && chart.points.length > 1 ? (
            <ResponseOverviewChart points={chart.points} series={chart.series} />
          ) : (
            <Empty text="Nog te weinig checks voor een grafiek. Na een paar uur monitoren verschijnt hier de lijn." />
          )}
        </section>

        <section className={`card ${styles.panel}`} aria-labelledby="h-days">
          <div className="card-head">
            <span className="icon-chip" aria-hidden="true">
              <BarChart3 />
            </span>
            <h2 id="h-days" className="card-title">
              Drukste dag
            </h2>
            <span className={styles.meta}>Bezoekers, 7 dagen</span>
          </div>
          {days.length > 0 && visitors > 0 ? (
            <DayBars days={days} unitLabel="bezoekers" />
          ) : (
            <Empty text="Nog geen bezoekers gemeten. Zet de tracker op een site om dit te vullen." />
          )}
        </section>

        <section className={`card ${styles.panel} ${styles.wide}`} aria-labelledby="h-sites">
          <div className="card-head">
            <span className="icon-chip" aria-hidden="true">
              <Globe />
            </span>
            <h2 id="h-sites" className="card-title">
              Sites
            </h2>
            <span className={styles.meta}>{sites.length}</span>
            <div className="card-tools">
              <Link href="/sites/nieuw" className="btn btn-sm btn-ghost">
                <Plus aria-hidden="true" />
                Toevoegen
              </Link>
            </div>
          </div>
          {sites.length === 0 ? (
            <Empty text="Nog geen sites. Voeg eerst een klant toe, daarna hun site.">
              <Link href="/klanten/nieuw" className="btn btn-sm">
                Nieuwe klant
              </Link>
            </Empty>
          ) : (
            <SiteTable sites={sites} />
          )}
        </section>

        <section className={`card ${styles.panel}`} aria-labelledby="h-money">
          <div className="card-head">
            <span className="icon-chip" aria-hidden="true">
              <Wallet />
            </span>
            <h2 id="h-money" className="card-title">
              Deze maand
            </h2>
            <div className="card-tools">
              <Link href="/geld" className={styles.more}>
                Geld
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
          {expected > 0 ? (
            <Gauge
              value={received / expected}
              label={formatEuro(received)}
              caption={`van ${formatEuro(expected)} per maand binnen`}
              ariaLabel={`${formatEuro(received)} van ${formatEuro(expected)} binnen deze maand`}
            />
          ) : (
            <Empty text="Nog geen lopende abonnementen." />
          )}
          <dl className={styles.moneyFacts}>
            <div>
              <dt>Open</dt>
              <dd className="num">{formatEuro(money.awaitingCents)}</dd>
            </div>
            <div data-danger={money.overdueCents > 0 || undefined}>
              <dt>Te laat</dt>
              <dd className="num">{formatEuro(money.overdueCents)}</dd>
            </div>
            <div>
              <dt>MRR</dt>
              <dd className="num">{formatEuro(money.mrrCents)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}

function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className={styles.empty}>
      <p>{text}</p>
      {children}
    </div>
  );
}

function headline(total: number, down: number) {
  if (total === 0) return "nog niets te monitoren";
  if (down === 0) return total === 1 ? "je site draait" : `alle ${total} sites draaien`;
  if (down === total && total > 1) return "alle sites liggen eruit";
  return down === 1 ? "één site ligt eruit" : `${down} sites liggen eruit`;
}

/** Last 24h of checks per live site, averaged into 15-minute buckets. */
async function responseSeries(live: SiteOverview[]) {
  const shown = [...live].sort((a, b) => a.id - b.id).slice(0, SERIES_COLORS.length);
  const perSite = await Promise.all(shown.map((s) => recentChecks(s.id, 24)));

  const buckets = new Map<number, Record<string, number[]>>();
  const series: ResponseSeries[] = shown.map((s, i) => {
    const key = `s${s.id}`;
    const ok = perSite[i].filter((c) => c.isUp && c.responseMs != null);
    for (const c of ok) {
      const t = Math.floor(c.checkedAt.getTime() / BUCKET_MS) * BUCKET_MS;
      const row = buckets.get(t) ?? {};
      (row[key] ??= []).push(c.responseMs!);
      buckets.set(t, row);
    }
    const avg = ok.length ? Math.round(ok.reduce((t, c) => t + c.responseMs!, 0) / ok.length) : null;
    return { key, name: s.name, color: SERIES_COLORS[i], avg };
  });

  const points = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, row]) => {
      const point: { t: number } & Record<string, number | null> = { t };
      for (const s of series) {
        const v = row[s.key];
        point[s.key] = v ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
      }
      return point;
    });

  return { series: series.filter((s) => s.avg != null), points };
}
