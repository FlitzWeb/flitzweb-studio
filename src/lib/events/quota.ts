import "server-only";
import { sql } from "drizzle-orm";
import { db, siteUsage } from "@/db";
import { isMissingTable } from "@/lib/dbErrors";

/**
 * Events a site may store per day (UTC). Far above what a small business site sends, low
 * enough that its public key cannot be used to fill the database (Neon free tier). Set
 * SITE_DAILY_EVENT_LIMIT to change it.
 */
export const dailyEventLimit = () => Number(process.env.SITE_DAILY_EVENT_LIMIT) || 20_000;

/** Counts one more event for the site today; false when the site is over its daily limit. */
export async function takeQuota(siteId: number) {
  const day = new Date().toISOString().slice(0, 10);
  try {
    return await countEvent(siteId, day);
  } catch (error) {
    // Deployed before migration 0016 ran: keep taking events rather than losing them.
    if (isMissingTable(error)) return true;
    throw error;
  }
}

async function countEvent(siteId: number, day: string) {
  const [row] = await db
    .insert(siteUsage)
    .values({ siteId, day, events: 1 })
    .onConflictDoUpdate({
      target: [siteUsage.siteId, siteUsage.day],
      set: { events: sql`${siteUsage.events} + 1` },
    })
    .returning({ events: siteUsage.events });
  return row.events <= dailyEventLimit();
}
