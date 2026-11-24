import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, searchStats } from "@/db";
import { addDays, addMonths, monthStart } from "@/lib/dates";

// Reads from search_stats (copied from Search Console by lib/searchConsole/sync.ts).
// Periods end on the last day Google has data for, which is a day or two ago,
// just like the Search Console reports.

export const SEARCH_PERIODS = {
  "7d": { label: "7 dagen", days: 7 },
  "28d": { label: "28 dagen", days: 28 },
  "3m": { label: "3 maanden", days: 91 },
  "12m": { label: "12 maanden", days: 365 },
  "16m": { label: "16 maanden", days: 486 },
} as const;
export type SearchPeriodKey = keyof typeof SEARCH_PERIODS;

export const isSearchPeriodKey = (k: unknown): k is SearchPeriodKey =>
  typeof k === "string" && Object.hasOwn(SEARCH_PERIODS, k);

export type SearchPeriod = {
  key: SearchPeriodKey;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  unit: "day" | "month";
};

export function searchPeriod(key: SearchPeriodKey, lastDate: string): SearchPeriod {
  const { days } = SEARCH_PERIODS[key];
  const from = addDays(lastDate, -(days - 1));
  const prevTo = addDays(from, -1);
  return { key, from, to: lastDate, prevFrom: addDays(prevTo, -(days - 1)), prevTo, unit: days > 100 ? "month" : "day" };
}

export type SearchTotals = { clicks: number; impressions: number; position: number | null };
export type SearchItem = SearchTotals & { value: string };

type Dimension = "query" | "page" | "country" | "device";

const sumClicks = sql<number>`coalesce(sum(${searchStats.clicks}), 0)::int`;
const sumImpressions = sql<number>`coalesce(sum(${searchStats.impressions}), 0)::int`;
// Google's average position, averaged again over days weighted by impressions (as Search Console does).
const avgPosition = sql<number | null>`sum(${searchStats.position} * ${searchStats.impressions}) / nullif(sum(${searchStats.impressions}), 0)`.mapWith(
  (v) => (v == null ? null : Number(v)),
);

const between = (siteId: number, dimension: "total" | Dimension, from: string, to: string) =>
  and(
    eq(searchStats.siteId, siteId),
    eq(searchStats.dimension, dimension),
    sql`${searchStats.date} between ${from} and ${to}`,
  );

/** First and last day with data, or nulls before the first sync. */
export async function searchRange(siteId: number) {
  const [row] = await db
    .select({ first: sql<string | null>`min(${searchStats.date})`, last: sql<string | null>`max(${searchStats.date})` })
    .from(searchStats)
    .where(and(eq(searchStats.siteId, siteId), eq(searchStats.dimension, "total")));
  return { first: row?.first ?? null, last: row?.last ?? null };
}

export async function searchTotals(siteId: number, from: string, to: string): Promise<SearchTotals> {
  const [row] = await db
    .select({ clicks: sumClicks, impressions: sumImpressions, position: avgPosition })
    .from(searchStats)
    .where(between(siteId, "total", from, to));
  return row ?? { clicks: 0, impressions: 0, position: null };
}

/** Clicks and impressions per day (or per month), with every bucket present. */
export async function searchSeries(siteId: number, p: SearchPeriod) {
  const bucket = p.unit === "month" ? sql<string>`to_char(${searchStats.date}, 'YYYY-MM')` : sql<string>`to_char(${searchStats.date}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ bucket, clicks: sumClicks, impressions: sumImpressions, position: avgPosition })
    .from(searchStats)
    .where(between(siteId, "total", p.from, p.to))
    .groupBy(bucket);
  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  const points: { bucket: string; clicks: number; impressions: number; position: number | null }[] = [];
  if (p.unit === "month") {
    for (let m = monthStart(p.from); m <= p.to; m = addMonths(m, 1)) {
      const b = m.slice(0, 7);
      points.push(byBucket.get(b) ?? { bucket: b, clicks: 0, impressions: 0, position: null });
    }
  } else {
    for (let d = p.from; d <= p.to; d = addDays(d, 1)) {
      points.push(byBucket.get(d) ?? { bucket: d, clicks: 0, impressions: 0, position: null });
    }
  }
  return points;
}

/** The values of one dimension in a period, most clicks first (or most impressions first). */
export async function searchItems(
  siteId: number,
  dimension: Dimension,
  from: string,
  to: string,
  limit = 500,
  by: "clicks" | "impressions" = "clicks",
): Promise<SearchItem[]> {
  return db
    .select({ value: searchStats.value, clicks: sumClicks, impressions: sumImpressions, position: avgPosition })
    .from(searchStats)
    .where(between(siteId, dimension, from, to))
    .groupBy(searchStats.value)
    .orderBy(...(by === "clicks" ? [sql`2 desc`, sql`3 desc`] : [sql`3 desc`, sql`2 desc`]))
    .limit(limit);
}

/** Search terms with impressions in the period that had none in the period before. */
export async function newQueries(siteId: number, p: SearchPeriod, limit = 8): Promise<SearchItem[]> {
  return db
    .select({ value: searchStats.value, clicks: sumClicks, impressions: sumImpressions, position: avgPosition })
    .from(searchStats)
    .where(
      and(
        between(siteId, "query", p.from, p.to),
        sql`not exists (
          select 1 from ${searchStats} prev
          where prev.site_id = ${siteId} and prev.dimension = 'query' and prev.value = ${searchStats.value}
            and prev.date between ${p.prevFrom} and ${p.prevTo}
        )`,
      ),
    )
    .groupBy(searchStats.value)
    .orderBy(sql`3 desc`, sql`2 desc`)
    .limit(limit);
}

/**
 * "Bijna op pagina 1": terms the site shows up for, on average just below the top
 * results (position 8 to 20), with enough impressions to be worth working on.
 */
export function nearlyPageOne(queries: SearchItem[], limit = 8) {
  const minImpressions = Math.max(3, Math.round(Math.max(0, ...queries.map((q) => q.impressions)) * 0.02));
  return queries
    .filter((q) => q.position != null && q.position >= 8 && q.position <= 20 && q.impressions >= minImpressions)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}

/** One month's Google numbers for the monthly report, with the month before; null when there is no data. */
export async function monthSearch(siteId: number, month: string) {
  const to = addDays(addMonths(month, 1), -1);
  const prevFrom = addMonths(month, -1);
  const [current, previous, queries] = await Promise.all([
    searchTotals(siteId, month, to),
    searchTotals(siteId, prevFrom, addDays(month, -1)),
    // The report lists what the site was shown for most, which says more to a client than clicks on its own name.
    searchItems(siteId, "query", month, to, 3, "impressions"),
  ]);
  if (!current.impressions) return null;
  return { current, previous, queries };
}
export type MonthSearch = Awaited<ReturnType<typeof monthSearch>>;
