import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { PAGEVIEW } from "@/lib/events/record";
import { filterSql } from "./filters";
import type { Period } from "./periods";
import { bucketsBetween } from "./queries";

// Custom events and their properties (Umami's Events page and event data).

const inPeriod = (siteId: number, p: Period) =>
  sql`site_id = ${siteId} and occurred_at between ${p.from.toISOString()} and ${p.to.toISOString()} ${filterSql(p.filters)}`;

export type EventRow = { name: string; count: number; visitors: number; lastAt: string };

/** Every custom event name with how often it happened and by how many visitors. */
export function getEventNames(siteId: number, p: Period) {
  return db.execute<EventRow>(sql`
    select event_key as name, count(*)::int as count, count(distinct session_id)::int as visitors,
      to_char(max(occurred_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "lastAt"
    from events
    where ${inPeriod(siteId, p)} and event_key <> ${PAGEVIEW}
    group by 1 order by 2 desc
  `);
}

/** Custom events per hour/day/month bucket (same buckets as the traffic chart). */
export async function getEventSeries(siteId: number, p: Period) {
  const fmt = { hour: "YYYY-MM-DD HH24:00", day: "YYYY-MM-DD", month: "YYYY-MM" }[p.unit];
  const bucket = sql.raw(
    `to_char(date_trunc('${p.unit}', occurred_at at time zone 'Europe/Amsterdam'), '${fmt}')`,
  );
  const rows = await db.execute<{ bucket: string; count: number }>(sql`
    select ${bucket} as bucket, count(*)::int as count
    from events where ${inPeriod(siteId, p)} and event_key <> ${PAGEVIEW}
    group by 1
  `);
  const byBucket = new Map(rows.map((r) => [r.bucket, r.count]));
  return bucketsBetween(p).map((b) => ({ bucket: b, count: byBucket.get(b) ?? 0 }));
}

export type PropertyValues = { key: string; total: number; values: { label: string; count: number }[] };

/** For each event name: its properties and the most common values of each. */
export async function getEventProperties(siteId: number, p: Period) {
  const rows = await db.execute<{ name: string; key: string; value: string; count: number }>(sql`
    select e.event_key as name, kv.key, kv.value, count(*)::int as count
    from events e, jsonb_each_text(e.metadata) kv
    where e.site_id = ${siteId}
      and e.occurred_at between ${p.from.toISOString()} and ${p.to.toISOString()}
      and e.event_key <> ${PAGEVIEW} and e.metadata is not null
      ${filterSql(p.filters, "e")}
    group by 1, 2, 3 order by 4 desc
  `);
  return groupProperties(rows.map((r) => ({ group: r.name, ...r })));
}

/** Properties set with flitz.identify(), across visitors seen in the period. */
export async function getSessionProperties(siteId: number, p: Period) {
  const rows = await db.execute<{ key: string; value: string; count: number }>(sql`
    select kv.key, kv.value, count(*)::int as count
    from sessions s, jsonb_each_text(s.data) kv
    where s.site_id = ${siteId} and s.data is not null
      and exists (select 1 from events e where e.session_id = s.id
        and e.occurred_at between ${p.from.toISOString()} and ${p.to.toISOString()} ${filterSql(p.filters, "e")})
    group by 1, 2 order by 3 desc
  `);
  return groupProperties(rows.map((r) => ({ group: "", ...r })))[""] ?? [];
}

function groupProperties(rows: { group: string; key: string; value: string; count: number }[]) {
  const out: Record<string, PropertyValues[]> = {};
  for (const r of rows) {
    const props = (out[r.group] ??= []);
    let prop = props.find((x) => x.key === r.key);
    if (!prop) props.push((prop = { key: r.key, total: 0, values: [] }));
    prop.total += r.count;
    if (prop.values.length < 10) prop.values.push({ label: r.value, count: r.count });
  }
  return out;
}
