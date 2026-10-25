import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import type { Step } from "@/features/reports/schema";
import { PAGEVIEW } from "@/lib/events/record";
import { filterSql } from "./filters";
import type { Period } from "./periods";

// Report queries, ported from Umami (src/queries/sql/funnels, journeys,
// retention, goals). Every report respects the period and active filters.

const inRange = (siteId: number, p: Period, alias = "") => {
  const a = alias ? `${alias}.` : "";
  return sql`${sql.raw(`${a}site_id`)} = ${siteId}
    and ${sql.raw(`${a}occurred_at`)} between ${p.from.toISOString()} and ${p.to.toISOString()}
    ${filterSql(p.filters, alias || undefined)}`;
};

/** `col = value`, or `col like …` when the value starts/ends with *. */
function stepMatch(s: Step, alias: string): SQL {
  const col = sql.raw(`${alias}.${s.type === "path" ? "path" : "event_key"}`);
  if (s.value.startsWith("*") || s.value.endsWith("*")) {
    return sql`${col} like ${s.value.replace(/^\*|\*$/g, "%")}`;
  }
  return sql`${col} = ${s.value}`;
}

export type FunnelResult = { step: Step; visitors: number; dropoff: number; pctOfFirst: number }[];

/**
 * Visitors who did step 1, then step 2 within `window` minutes after it,
 * and so on (Umami's getFunnel).
 */
export async function getFunnel(siteId: number, p: Period, steps: Step[], window: number): Promise<FunnelResult> {
  const levels = steps.map((s, i) =>
    i === 0
      ? sql`level1 as (
          select distinct e.session_id, e.occurred_at from events e
          where ${inRange(siteId, p, "e")} and e.session_id is not null and ${stepMatch(s, "e")})`
      : sql`${sql.raw(`level${i + 1}`)} as (
          select distinct we.session_id, we.occurred_at
          from ${sql.raw(`level${i}`)} l
          join events we on we.session_id = l.session_id
          where we.site_id = ${siteId}
            and we.occurred_at between l.occurred_at and l.occurred_at + make_interval(mins => ${window})
            and we.occurred_at <= ${p.to.toISOString()}
            and ${stepMatch(s, "we")})`,
  );
  const counts = steps.map(
    (_, i) => sql`select ${i + 1} as level, count(distinct session_id)::int as count from ${sql.raw(`level${i + 1}`)}`,
  );
  const rows = await db.execute<{ level: number; count: number }>(
    sql`with ${sql.join(levels, sql`, `)} ${sql.join(counts, sql` union all `)} order by level`,
  );

  const first = rows[0]?.count ?? 0;
  return steps.map((step, i) => {
    const visitors = rows[i]?.count ?? 0;
    const prev = i === 0 ? visitors : (rows[i - 1]?.count ?? 0);
    return { step, visitors, dropoff: prev - visitors, pctOfFirst: first ? (visitors / first) * 100 : 0 };
  });
}

export type JourneyRow = { path: string[]; count: number };

/**
 * The most common sequences of pages/events within a visit (Umami's
 * getJourney). Each step is an event name, or the path for pageviews.
 */
export async function getJourney(
  siteId: number,
  p: Period,
  steps: number,
  startStep?: string,
  endStep?: string,
): Promise<JourneyRow[]> {
  const cols = Array.from({ length: steps }, (_, i) => i + 1);
  const pivot = sql.join(
    cols.map((n) => sql.raw(`max(case when event_number = ${n} then "event" end) as e${n}`)),
    sql`, `,
  );
  const groupCols = sql.raw(cols.map((n) => `s.e${n}`).join(", "));
  const startQuery = startStep ? sql`and e1 = ${startStep}` : sql``;
  const endQuery = endStep
    ? sql`and (${sql.join(
        [
          ...cols.slice(0, -1).map((n) => sql`(${sql.raw(`e${n}`)} = ${endStep} and ${sql.raw(`e${n + 1}`)} is null)`),
          sql`${sql.raw(`e${steps}`)} = ${endStep}`,
        ],
        sql` or `,
      )})`
    : sql``;

  const rows = await db.execute<Record<string, string | number | null>>(sql`
    with ev as (
      select visit_id,
        coalesce(nullif(event_key, ${PAGEVIEW}), path) as "event",
        row_number() over (partition by visit_id order by occurred_at, id) as event_number
      from events
      where ${inRange(siteId, p)} and visit_id is not null
    ),
    sequences as (
      select ${groupCols}, count(*)::int as count
      from (select visit_id, ${pivot} from ev group by visit_id) s
      group by ${groupCols}
    )
    select * from sequences where 1 = 1 ${startQuery} ${endQuery}
    order by count desc limit 25
  `);
  return rows.map((r) => ({
    path: cols.map((n) => r[`e${n}`]).filter((v): v is string => typeof v === "string"),
    count: Number(r.count),
  }));
}

export type RetentionRow = { date: string; visitors: number; days: { day: number; returning: number; pct: number }[] };

/**
 * Per day of first visit: how many of those visitors came back on day
 * 1, 2, … (Umami's getRetention, days 0–31). Note: like Umami's default,
 * visitor ids reset every month, so returns across a month boundary are
 * not linked.
 */
export async function getRetention(siteId: number, p: Period): Promise<RetentionRow[]> {
  const day = sql.raw(`(occurred_at at time zone 'Europe/Amsterdam')::date`);
  const rows = await db.execute<{ date: string; day: number; visitors: number; returning: number }>(sql`
    with cohort_items as (
      select min(${day}) as cohort_date, session_id
      from events
      where ${inRange(siteId, p)} and session_id is not null
      group by session_id
    ),
    activities as (
      select distinct e.session_id, (${sql.raw(`(e.occurred_at at time zone 'Europe/Amsterdam')::date`)} - c.cohort_date) as day_number
      from events e join cohort_items c on c.session_id = e.session_id
      where ${inRange(siteId, p, "e")}
    ),
    cohort_size as (select cohort_date, count(*)::int as visitors from cohort_items group by 1),
    cohort_days as (
      select c.cohort_date, a.day_number, count(*)::int as returning
      from activities a join cohort_items c on c.session_id = a.session_id
      group by 1, 2
    )
    select to_char(d.cohort_date, 'YYYY-MM-DD') as date, d.day_number as day, s.visitors, d.returning
    from cohort_days d join cohort_size s on s.cohort_date = d.cohort_date
    where d.day_number <= 31
    order by 1, 2
  `);

  const byDate = new Map<string, RetentionRow>();
  for (const r of rows) {
    let row = byDate.get(r.date);
    if (!row) byDate.set(r.date, (row = { date: r.date, visitors: r.visitors, days: [] }));
    row.days.push({ day: r.day, returning: r.returning, pct: (r.returning / r.visitors) * 100 });
  }
  return [...byDate.values()];
}

/** Visitors who reached the goal (a page or event) out of all visitors (Umami's getGoal). */
export async function getGoal(siteId: number, p: Period, goal: Step) {
  const [row] = await db.execute<{ num: number; total: number }>(sql`
    select
      (select count(distinct e.session_id)::int from events e
        where ${inRange(siteId, p, "e")} and ${stepMatch(goal, "e")}
          ${goal.type === "path" ? sql`and e.event_key = ${PAGEVIEW}` : sql`and e.event_key <> ${PAGEVIEW}`}) as num,
      (select count(distinct e.session_id)::int from events e
        where ${inRange(siteId, p, "e")} and e.session_id is not null) as total
  `);
  return { num: row?.num ?? 0, total: row?.total ?? 0 };
}

/** Paths and event names seen in the last 90 days, for the report editor's suggestions. */
export async function getStepSuggestions(siteId: number) {
  const rows = await db.execute<{ kind: string; v: string }>(sql`
    (select 'path' as kind, path as v from events
      where site_id = ${siteId} and event_key = ${PAGEVIEW} and path is not null
        and occurred_at > now() - interval '90 days'
      group by path order by count(*) desc limit 50)
    union all
    (select 'event' as kind, event_key as v from events
      where site_id = ${siteId} and event_key <> ${PAGEVIEW}
        and occurred_at > now() - interval '90 days'
      group by event_key order by count(*) desc limit 50)
  `);
  return {
    paths: rows.filter((r) => r.kind === "path").map((r) => r.v),
    events: rows.filter((r) => r.kind === "event").map((r) => r.v),
  };
}
