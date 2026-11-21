import { AlarmClock, ArrowRight, CircleAlert, GitBranch, Globe, ListChecks, MessageCircle, Plus, Target, Wallet, WifiOff } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Gauge } from "@/components/charts/Gauge";
import { KpiCard } from "@/components/KpiCard";
import { ContactActions } from "@/features/clients/ContactActions";
import { getDueFollowUps, getStageCounts } from "@/features/clients/queries";
import { OPEN_STAGES, stageLabels } from "@/features/clients/stages";
import { MarkPaidButton } from "@/features/money/MarkPaidButton";
import { getMoneySummary, startingLaterText } from "@/features/money/queries";
import { ReminderButton } from "@/features/money/ReminderButton";
import { CheckNowButton } from "@/features/uptime/CheckNowButton";
import { SiteTable } from "@/features/uptime/SiteTable";
import { addDays, formatDue, todayISO } from "@/lib/dates";
import { formatDuration, formatEuro, formatRelative } from "@/lib/format";
import { getSiteOverviews } from "@/lib/uptime/queries";
import styles from "../overview.module.css";
import { requireSession } from "@/lib/auth";

const dayFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", weekday: "long", day: "numeric", month: "long" });

export default async function OverviewPage() {
  await requireSession(); // the real check (the proxy only redirects early)
  const today = todayISO();
  const [sites, money, followUps, stages] = await Promise.all([
    getSiteOverviews(),
    getMoneySummary(),
    getDueFollowUps(today),
    getStageCounts(),
  ]);
  const live = sites.filter((s) => s.monitored);
  const down = live.filter((s) => s.isUp === false);

  const overdue = money.outstanding.filter((i) => i.status === "overdue");
  const dueSoon = money.outstanding.filter((i) => i.status === "awaiting" && i.dueDate <= addDays(today, 7));
  const openLeads = OPEN_STAGES.reduce((t, s) => t + stages[s], 0);
  const toPublish = sites.filter((s) => s.conceptApprovedAt);
  const awaitingClient = sites.filter((s) => s.conceptSentAt && !s.conceptApprovedAt);
  const todoCount = down.length + overdue.length + followUps.length + toPublish.length;
  const maxStage = Math.max(...OPEN_STAGES.map((s) => stages[s]), 1);

  const expected = money.expectedThisMonthCents;
  const received = money.paidThisMonthCents;
  const startingLater = startingLaterText(money.startingLater);

  return (
    <>
      <AutoRefresh seconds={60} />
      <header className="page-head">
        <div>
          <h1 className="page-title">Overzicht</h1>
          <p className="page-sub">
            <span className={styles.today}>{dayFmt.format(new Date())}</span> ·{" "}
            {todoCount === 0 ? "niets dat op je wacht" : todoCount === 1 ? "1 ding te doen" : `${todoCount} dingen te doen`}
          </p>
        </div>
        <div className="page-actions">
          <CheckNowButton />
          <Link href="/klanten/nieuw?fase=lead" className="btn btn-primary">
            <Plus aria-hidden="true" />
            Nieuwe lead
          </Link>
        </div>
      </header>

      <section className={styles.kpis} aria-label="Kerncijfers">
        <KpiCard
          icon={<AlarmClock />}
          label="Opvolgen"
          value={followUps.length}
          tone={followUps.length > 0 ? "danger" : undefined}
          hint={followUps.length ? "Vandaag of eerder gepland" : "Niemand wacht op je"}
          href="/leads"
        />
        <KpiCard
          icon={<Target />}
          label="In de pijplijn"
          value={openLeads}
          tone="brand"
          hint={`${stages.replied + stages.meeting} met reactie of afspraak`}
          href="/leads"
        />
        <KpiCard
          icon={<CircleAlert />}
          label="Te laat betaald"
          value={formatEuro(money.overdueCents)}
          tone={money.overdueCents > 0 ? "danger" : undefined}
          hint={money.overdueCount ? `${money.overdueCount} ${money.overdueCount === 1 ? "post" : "posten"} over de vervaldatum` : "Niets te laat"}
          href="/geld"
        />
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
      </section>

      <div className={styles.grid}>
        <section className={`card ${styles.panel} ${styles.wide}`} aria-labelledby="h-today">
          <div className="card-head">
            <span className="icon-chip" aria-hidden="true">
              <ListChecks />
            </span>
            <h2 id="h-today" className="card-title">
              Vandaag
            </h2>
            <span className={styles.meta}>{todoCount === 0 ? "Alles gedaan" : `${todoCount} te doen`}</span>
          </div>

          {todoCount + dueSoon.length + awaitingClient.length === 0 ? (
            <Empty text="Niets dat op je wacht. Goed moment om nieuwe leads te benaderen.">
              <Link href="/leads" className="btn btn-sm">
                Naar leads
              </Link>
            </Empty>
          ) : (
            <ul className={styles.todo}>
              {down.map((s) => (
                <li key={`site-${s.id}`} data-tone="danger">
                  <span className={styles.todoIcon} aria-hidden="true">
                    <WifiOff />
                  </span>
                  <Link href={`/sites/${s.id}`} className={styles.todoMain}>
                    <strong>{s.name} ligt eruit</strong>
                    <small>
                      {s.downForMs != null ? `Al ${formatDuration(s.downForMs)} offline` : "Offline"} · {s.clientName}
                    </small>
                  </Link>
                </li>
              ))}
              {overdue.map((i) => (
                <li key={`${i.kind}-${i.id}`} data-tone="danger">
                  <span className={styles.todoIcon} aria-hidden="true">
                    <Wallet />
                  </span>
                  <Link href={`/klanten/${i.clientId}`} className={styles.todoMain}>
                    <strong>
                      {i.clientName} · {formatEuro(i.amountCents)}
                    </strong>
                    <small>
                      {i.description} · {formatDue(i.dueDate, today)}
                    </small>
                  </Link>
                  <div className={styles.todoTools}>
                    <ReminderButton item={i} />
                    <MarkPaidButton kind={i.kind} id={i.id} paid={false} />
                  </div>
                </li>
              ))}
              {toPublish.map((s) => (
                <li key={`publish-${s.id}`}>
                  <span className={styles.todoIcon} aria-hidden="true">
                    <GitBranch />
                  </span>
                  <Link href={`/sites/${s.id}/versies`} className={styles.todoMain}>
                    <strong>{s.name}: klant is akkoord</strong>
                    <small>Het concept kan live · {s.clientName}</small>
                  </Link>
                </li>
              ))}
              {followUps.map((c) => (
                <li key={`follow-${c.id}`}>
                  <span className={styles.todoIcon} aria-hidden="true">
                    <MessageCircle />
                  </span>
                  <Link href={`/klanten/${c.id}`} className={styles.todoMain}>
                    <strong>{c.name}</strong>
                    <small>
                      {stageLabels[c.stage]} · opvolgen {formatDue(c.nextFollowUp!, today)}
                    </small>
                  </Link>
                  <div className={styles.todoTools}>
                    <ContactActions client={c} compact />
                  </div>
                </li>
              ))}
              {awaitingClient.map((s) => (
                <li key={`await-${s.id}`} data-tone="quiet">
                  <span className={styles.todoIcon} aria-hidden="true">
                    <GitBranch />
                  </span>
                  <Link href={`/sites/${s.id}/versies`} className={styles.todoMain}>
                    <strong>{s.name}: wacht op akkoord</strong>
                    <small>
                      Concept verstuurd {formatRelative(s.conceptSentAt!)} · {s.clientName}
                    </small>
                  </Link>
                </li>
              ))}
              {dueSoon.map((i) => (
                <li key={`soon-${i.kind}-${i.id}`} data-tone="quiet">
                  <span className={styles.todoIcon} aria-hidden="true">
                    <Wallet />
                  </span>
                  <Link href={`/klanten/${i.clientId}`} className={styles.todoMain}>
                    <strong>
                      {i.clientName} · {formatEuro(i.amountCents)}
                    </strong>
                    <small>
                      {i.description} · verwacht {formatDue(i.dueDate, today)}
                    </small>
                  </Link>
                  <div className={styles.todoTools}>
                    <MarkPaidButton kind={i.kind} id={i.id} paid={false} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`card ${styles.panel}`} aria-labelledby="h-pipeline">
          <div className="card-head">
            <span className="icon-chip" aria-hidden="true">
              <Target />
            </span>
            <h2 id="h-pipeline" className="card-title">
              Pijplijn
            </h2>
            <div className="card-tools">
              <Link href="/leads" className={styles.more}>
                Leads
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
          <ul className={styles.stages}>
            {OPEN_STAGES.map((s) => (
              <li key={s}>
                <Link href={`/leads?fase=${s}`}>
                  <span>{stageLabels[s]}</span>
                  <span className={styles.stageBar} aria-hidden="true">
                    <i style={{ width: `${(stages[s] / maxStage) * 100}%` }} />
                  </span>
                  <span className="num">{stages[s]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className={styles.meta}>
            {stages.client} {stages.client === 1 ? "klant" : "klanten"} · {stages.lost} afgevallen
          </p>
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
              caption={received >= expected ? "alles is binnen" : `van ${formatEuro(expected)} verwacht deze maand`}
              ariaLabel={`${formatEuro(received)} van ${formatEuro(expected)} binnen deze maand`}
            />
          ) : (
            <Empty text={startingLater ? `Deze maand wordt niets verwacht. ${startingLater}.` : "Deze maand wordt nog niets verwacht."} />
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
            <div title={startingLater ?? undefined}>
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
