import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { PAGEVIEW } from "@/lib/events/record";
import { filterSql } from "./filters";
import type { Period } from "./periods";

// Individual (anonymous) visitors and what they did, like Umami's Sessions page.

export type SessionRow = {
  id: string;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  city: string | null;
  distinctId: string | null;
  data: Record<string, unknown> | null;
  visits: number;
  views: number;
  events: number;
  firstAt: string;
  lastAt: string;
};

const iso = (col: string) =>
  sql.raw(`to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`);

/** Visitors active in the period, most recent first. */
export function getSessions(siteId: number, p: Period, limit = 50) {
  return db.execute<SessionRow>(sql`
    select s.id, s.browser, s.os, s.device, s.country, s.city,
      s.distinct_id as "distinctId", s.data,
      count(distinct e.visit_id)::int as visits,
      count(*) filter (where e.event_key = ${PAGEVIEW})::int as views,
      count(*) filter (where e.event_key <> ${PAGEVIEW})::int as events,
      ${iso("min(e.occurred_at)")} as "firstAt",
      ${iso("max(e.occurred_at)")} as "lastAt"
    from sessions s
    join events e on e.session_id = s.id
    where s.site_id = ${siteId}
      and e.occurred_at between ${p.from.toISOString()} and ${p.to.toISOString()}
      ${filterSql(p.filters, "e")}
    group by s.id
    order by max(e.occurred_at) desc
    limit ${limit}
  `);
}

export type SessionEvent = {
  visitId: string;
  eventKey: string;
  path: string | null;
  title: string | null;
  referrer: string | null;
  metadata: Record<string, unknown> | null;
  at: string;
};

/** One visitor with all their events (newest first, max 500). */
export async function getSessionDetail(siteId: number, sessionId: string) {
  if (!/^[0-9a-f-]{36}$/.test(sessionId)) return null;
  const [summary] = await db.execute<SessionRow & { screen: string | null; language: string | null; region: string | null }>(sql`
    select s.id, s.browser, s.os, s.device, s.screen, s.language, s.country, s.region, s.city,
      s.distinct_id as "distinctId", s.data,
      count(distinct e.visit_id)::int as visits,
      count(*) filter (where e.event_key = ${PAGEVIEW})::int as views,
      count(*) filter (where e.event_key <> ${PAGEVIEW})::int as events,
      ${iso("min(e.occurred_at)")} as "firstAt",
      ${iso("max(e.occurred_at)")} as "lastAt"
    from sessions s
    join events e on e.session_id = s.id
    where s.site_id = ${siteId} and s.id = ${sessionId}
    group by s.id
  `);
  if (!summary) return null;

  const events = await db.execute<SessionEvent>(sql`
    select visit_id as "visitId", event_key as "eventKey", path, title, referrer, metadata,
      ${iso("occurred_at")} as at
    from events
    where site_id = ${siteId} and session_id = ${sessionId}
    order by occurred_at desc
    limit 500
  `);

  // Group into visits, newest first.
  const visits: { visitId: string; events: SessionEvent[] }[] = [];
  for (const e of events) {
    const last = visits.at(-1);
    if (last?.visitId === e.visitId) last.events.push(e);
    else visits.push({ visitId: e.visitId, events: [e] });
  }
  return { summary, visits };
}
