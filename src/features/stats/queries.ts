import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, events, type Tracker } from "@/db";
import { filterSql, type Filter } from "@/lib/analytics/filters";
import { amsterdamMidnight, type Period } from "@/lib/analytics/periods";
import { bucketSql, bucketsBetween } from "@/lib/analytics/queries";
import { monthStart, todayISO } from "@/lib/dates";
import { countedEvents } from "./source";

export type TrackerStats = {
  id: number;
  key: string;
  name: string;
  aggregation: "count" | "sum";
  monthlyGoal: number | null;
  /** Total in the chosen period, and in the period of the same length before it. */
  total: number;
  previous: number;
  /** This calendar month so far, for the monthly goal (filters don't apply). */
  thisMonth: number;
  series: { bucket: string; value: number }[];
};

type Row = { key: string; count: number; sum: number };

/**
 * Each tracker over the chosen period: total, the previous period, and a series per
 * hour/day/month. Follows the period and filters like the visitor numbers do.
 */
export async function getTrackerStats(siteId: number, trackers: Tracker[], p: Period): Promise<TrackerStats[]> {
  if (!trackers.length) return [];

  const counted = countedEvents(trackers);
  const where = (from: Date, to: Date, filters: Filter[]) => sql`
    site_id = ${siteId}
    and ${inArray(
      events.eventKey,
      trackers.map((t) => t.eventKey),
    )}
    and occurred_at between ${from.toISOString()} and ${to.toISOString()}
    ${counted ? sql`and ${counted}` : sql``}
    ${filterSql(filters)}`;
  const totals = (from: Date, to: Date, filters: Filter[]) =>
    db.execute<Row>(sql`
      select event_key as key, count(*)::int as count, coalesce(sum(value), 0)::float8 as sum
      from events where ${where(from, to, filters)}
      group by 1
    `);

  const hasGoal = trackers.some((t) => t.monthlyGoal);
  const [series, previous, month] = await Promise.all([
    db.execute<Row & { bucket: string }>(sql`
      select event_key as key, ${bucketSql(p.unit)} as bucket,
        count(*)::int as count, coalesce(sum(value), 0)::float8 as sum
      from events where ${where(p.from, p.to, p.filters)}
      group by 1, 2
    `),
    totals(p.prevFrom, p.prevTo, p.filters),
    hasGoal ? totals(amsterdamMidnight(monthStart(todayISO(p.to))), p.to, []) : [],
  ]);

  const buckets = bucketsBetween(p);

  return trackers.map((t): TrackerStats => {
    const value = (r: Row) => (t.aggregation === "count" ? r.count : r.sum);
    const of = (rows: Iterable<Row>) => {
      for (const r of rows) if (r.key === t.eventKey) return value(r);
      return 0;
    };
    const byBucket = new Map<string, number>();
    for (const r of series) if (r.key === t.eventKey) byBucket.set(r.bucket, value(r));

    return {
      id: t.id,
      key: t.eventKey,
      name: t.name,
      aggregation: t.aggregation,
      monthlyGoal: t.monthlyGoal,
      total: [...byBucket.values()].reduce((a, b) => a + b, 0),
      previous: of(previous),
      thisMonth: of(month),
      series: buckets.map((bucket) => ({ bucket, value: byBucket.get(bucket) ?? 0 })),
    };
  });
}

/** When the site last sent anything (to tell if the script is installed). */
export async function lastEventAt(siteId: number) {
  const [row] = await db
    .select({ at: events.occurredAt })
    .from(events)
    .where(eq(events.siteId, siteId))
    .orderBy(desc(events.occurredAt))
    .limit(1);
  return row?.at ?? null;
}
