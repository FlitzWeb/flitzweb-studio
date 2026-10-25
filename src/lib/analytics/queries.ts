import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { PAGEVIEW } from "@/lib/events/record";
import { filterSql, type Filter } from "./filters";
import type { Period, Unit } from "./periods";

// Analytics queries. The definitions follow Umami's getWebsiteStats
// (src/queries/sql/getWebsiteStats.ts) so the numbers mean the same thing:
//   views     = pageviews
//   visitors  = distinct sessions (anonymous visitors)
//   visits    = distinct visits
//   bounces   = visits with exactly one pageview and no custom event
//   totaltime = per visit, last pageview − first pageview (seconds), summed
// Average visit duration = totaltime / visits; bounce rate = bounces / visits.

export type WebsiteStats = {
  views: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
};

async function statsBetween(siteId: number, from: Date, to: Date, filters: Filter[]): Promise<WebsiteStats> {
  const rows = await db.execute<WebsiteStats>(sql`
    select
      coalesce(sum(t.c), 0)::int as views,
      count(distinct t.session_id)::int as visitors,
      count(distinct t.visit_id)::int as visits,
      coalesce(sum(case when t.c = 1 and t.has_custom = 0 then 1 else 0 end), 0)::int as bounces,
      coalesce(sum(extract(epoch from (t.max_time - t.min_time))), 0)::int as totaltime
    from (
      select
        session_id,
        visit_id,
        sum(case when event_key = ${PAGEVIEW} then 1 else 0 end) as c,
        min(case when event_key = ${PAGEVIEW} then occurred_at end) as min_time,
        max(case when event_key = ${PAGEVIEW} then occurred_at end) as max_time,
        -- Like Umami, custom events count against bounces even when filters hide them.
        max(case when exists (
          select 1 from events c
          where c.visit_id = events.visit_id and c.site_id = ${siteId} and c.event_key <> ${PAGEVIEW}
            and c.occurred_at between ${from.toISOString()} and ${to.toISOString()}
        ) then 1 else 0 end) as has_custom
      from events
      where site_id = ${siteId}
        and session_id is not null
        and occurred_at between ${from.toISOString()} and ${to.toISOString()}
        ${filterSql(filters)}
      group by 1, 2
      having sum(case when event_key = ${PAGEVIEW} then 1 else 0 end) > 0
    ) as t
  `);
  return rows[0];
}

/** Stats for the period and the previous period of the same length. */
export async function getWebsiteStats(siteId: number, p: Period) {
  const [current, previous] = await Promise.all([
    statsBetween(siteId, p.from, p.to, p.filters),
    statsBetween(siteId, p.prevFrom, p.prevTo, p.filters),
  ]);
  return { current, previous };
}

/** Visitors on the site in the last 5 minutes (Umami's "active visitors"). */
export async function getActiveVisitors(siteId: number) {
  const rows = await db.execute<{ n: number }>(sql`
    select count(distinct session_id)::int as n from events
    where site_id = ${siteId} and occurred_at >= now() - interval '5 minutes'
  `);
  return rows[0]?.n ?? 0;
}

export type SeriesPoint = { bucket: string; views: number; visitors: number };

const BUCKET: Record<Unit, string> = {
  hour: "YYYY-MM-DD HH24:00",
  day: "YYYY-MM-DD",
  month: "YYYY-MM",
};

/** Views and visitors per hour/day/month, with empty buckets filled in. */
export async function getPageviewSeries(siteId: number, p: Period): Promise<SeriesPoint[]> {
  const bucket = sql.raw(
    `to_char(date_trunc('${p.unit}', occurred_at at time zone 'Europe/Amsterdam'), '${BUCKET[p.unit]}')`,
  );
  const rows = await db.execute<SeriesPoint>(sql`
    select ${bucket} as bucket,
      count(*)::int as views,
      count(distinct session_id)::int as visitors
    from events
    where site_id = ${siteId} and event_key = ${PAGEVIEW}
      and occurred_at between ${p.from.toISOString()} and ${p.to.toISOString()}
      ${filterSql(p.filters)}
    group by 1
  `);
  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  return bucketsBetween(p).map((b) => byBucket.get(b) ?? { bucket: b, views: 0, visitors: 0 });
}

/** Every bucket label between from and to, in Amsterdam time. */
export function bucketsBetween(p: Period) {
  const fmt = (d: Date) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Amsterdam",
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
      })
        .formatToParts(d)
        .map((x) => [x.type, x.value]),
    );
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    return p.unit === "hour" ? `${day} ${parts.hour}:00` : p.unit === "day" ? day : day.slice(0, 7);
  };
  const step = p.unit === "hour" ? 3600_000 : 86400_000;
  const out: string[] = [];
  for (let t = p.from.getTime(); t <= p.to.getTime(); t += step) {
    const label = fmt(new Date(t));
    if (out.at(-1) !== label) out.push(label);
  }
  const last = fmt(p.to);
  if (out.at(-1) !== last) out.push(last);
  return out;
}

export type Breakdown = { label: string; count: number }[];

/** Visitors per value of a session column (browser, country, ...). */
async function sessionBreakdown(siteId: number, p: Period, column: SQL, limit = 10): Promise<Breakdown> {
  return db.execute<{ label: string; count: number }>(sql`
    select ${column} as label, count(distinct s.id)::int as count
    from sessions s
    join events e on e.session_id = s.id
    where e.site_id = ${siteId}
      and e.occurred_at between ${p.from.toISOString()} and ${p.to.toISOString()}
      and ${column} is not null
      ${filterSql(p.filters, "e")}
    group by 1 order by 2 desc limit ${limit}
  `);
}

/** Visitors per path or referrer host (Umami counts both in visitors). */
async function eventBreakdown(siteId: number, p: Period, kind: "pages" | "referrers"): Promise<Breakdown> {
  const column = kind === "pages" ? sql.raw("path") : sql.raw("referrer");
  return db.execute<{ label: string; count: number }>(sql`
    select ${column} as label, count(distinct session_id)::int as count
    from events
    where site_id = ${siteId} and event_key = ${PAGEVIEW}
      and occurred_at between ${p.from.toISOString()} and ${p.to.toISOString()}
      and ${column} is not null
      ${filterSql(p.filters)}
    group by 1 order by 2 desc limit 10
  `);
}

/** All breakdown lists for the Stats tab in one go. */
export async function getBreakdowns(siteId: number, p: Period) {
  const s = (c: string) => sessionBreakdown(siteId, p, sql.raw(`s.${c}`));
  const [pages, referrers, browsers, os, devices, screens, countries, regions, cities, languages] =
    await Promise.all([
      eventBreakdown(siteId, p, "pages"),
      eventBreakdown(siteId, p, "referrers"),
      s("browser"),
      s("os"),
      s("device"),
      s("screen"),
      s("country"),
      s("region"),
      s("city"),
      s("language"),
    ]);
  return { pages, referrers, browsers, os, devices, screens, countries, regions, cities, languages };
}
