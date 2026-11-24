import "server-only";
import { and, eq, gte, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, searchStats, sites } from "@/db";
import { addDays } from "@/lib/dates";
import { querySearchAnalytics, readServiceAccount, SearchConsoleError } from "./google";

// Copies a site's Search Console data into search_stats. The first sync takes
// everything Google still has (16 months); after that only the last few days,
// because Google keeps adjusting a day for about three days before it is final.

const BACKFILL_DAYS = 486; // 16 months, all Google keeps
const REFRESH_DAYS = 5;
/** The cron runs every 30 minutes; one sync per site every 12 hours is plenty. */
const SYNC_EVERY_MS = 12 * 3600_000;

const DIMENSIONS = {
  total: [],
  query: ["query"],
  page: ["page"],
  country: ["country"],
  device: ["device"],
} as const;

type Dimension = keyof typeof DIMENSIONS;

const pacificFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Search Console counts days in Pacific time, so "today" is Google's today. */
const googleToday = (now = new Date()) => pacificFmt.format(now);

/** The last day this site has data for, or null before the first sync. */
export async function lastSearchDate(siteId: number) {
  const [row] = await db
    .select({ last: sql<string | null>`max(${searchStats.date})` })
    .from(searchStats)
    .where(and(eq(searchStats.siteId, siteId), eq(searchStats.dimension, "total")));
  return row?.last ?? null;
}

/**
 * Fetches and stores one site's data. Errors are kept on the site (gsc_error) so
 * the Google tab can show them, and thrown again for the caller.
 */
export async function syncSearchConsole(site: { id: number; gscProperty: string | null }) {
  const property = site.gscProperty;
  if (!property) return null;
  const last = await lastSearchDate(site.id);
  const endDate = googleToday();
  const startDate = last ? addDays(last, -REFRESH_DAYS) : addDays(endDate, -BACKFILL_DAYS);

  try {
    const parts = await Promise.all(
      (Object.entries(DIMENSIONS) as [Dimension, readonly string[]][]).map(async ([dimension, extra]) => {
        const rows = await querySearchAnalytics(property, { startDate, endDate, dimensions: ["date", ...extra] });
        return rows.map((r) => ({
          siteId: site.id,
          date: r.keys?.[0] ?? startDate,
          dimension,
          value: r.keys?.[1] ?? "",
          clicks: Math.round(r.clicks),
          impressions: Math.round(r.impressions),
          position: r.position,
        }));
      }),
    );
    const rows = parts.flat();

    await db.transaction(async (tx) => {
      await tx.delete(searchStats).where(and(eq(searchStats.siteId, site.id), gte(searchStats.date, startDate)));
      for (let i = 0; i < rows.length; i += 2000) {
        await tx.insert(searchStats).values(rows.slice(i, i + 2000));
      }
      await tx.update(sites).set({ gscSyncedAt: new Date(), gscError: null }).where(eq(sites.id, site.id));
    });
    return { startDate, endDate, rows: rows.length };
  } catch (error) {
    const message =
      error instanceof SearchConsoleError ? error.message : "Ophalen bij Google mislukte. Het wordt later opnieuw geprobeerd.";
    console.error(`search console sync for site ${site.id} failed`, error);
    // The attempt counts as a sync, so a broken link is retried in 12 hours, not every 30 minutes.
    await db.update(sites).set({ gscSyncedAt: new Date(), gscError: message }).where(eq(sites.id, site.id));
    throw error;
  }
}

/** For the cron: syncs every linked site whose last sync is more than 12 hours old. */
export async function syncDueSearchConsole(now = new Date()) {
  if (!readServiceAccount().account) return [];
  const due = await db
    .select({ id: sites.id, name: sites.name, gscProperty: sites.gscProperty })
    .from(sites)
    .where(
      and(
        isNotNull(sites.gscProperty),
        or(isNull(sites.gscSyncedAt), lt(sites.gscSyncedAt, new Date(now.getTime() - SYNC_EVERY_MS))),
      ),
    );
  const results: { site: string; rows?: number; failed?: string }[] = [];
  for (const site of due) {
    try {
      const r = await syncSearchConsole(site);
      results.push({ site: site.name, rows: r?.rows ?? 0 });
    } catch (error) {
      results.push({ site: site.name, failed: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}
