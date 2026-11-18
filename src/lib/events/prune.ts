import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { db, events, sessions, siteUsage, sites } from "@/db";
import { alertEmail, appUrl, sendAlert } from "@/lib/email";

const KEEP_DAYS = 400; // a bit over a year, enough for year-on-year comparisons
const DAY_MS = 86400_000;

/**
 * Removes analytics nobody needs any more: events older than KEEP_DAYS, sessions whose
 * events are all gone (or that never got one, e.g. an identify call only, older than a
 * day), and the daily usage counts after 60 days. Events go before sessions: deleting a
 * session deletes its events (cascade), so only sessions without events are touched.
 */
export async function pruneEvents() {
  await db.delete(events).where(lt(events.occurredAt, new Date(Date.now() - KEEP_DAYS * DAY_MS)));
  await db
    .delete(sessions)
    .where(
      and(
        lt(sessions.createdAt, new Date(Date.now() - DAY_MS)),
        sql`not exists (select 1 from ${events} where ${events.sessionId} = ${sessions.id})`,
      ),
    );
  await db.delete(siteUsage).where(lt(siteUsage.day, new Date(Date.now() - 60 * DAY_MS).toISOString().slice(0, 10)));
}

const SPIKE_FACTOR = 10;
const SPIKE_MIN = 1000;

/**
 * One email per site per day when today's events are far above normal (more than
 * SPIKE_FACTOR times the daily average of the 14 days before, and at least SPIKE_MIN):
 * either real news, or someone sending fake events with the public key.
 */
export async function sendSpikeAlerts() {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 14 * DAY_MS).toISOString().slice(0, 10);
  const rows = await db
    .select({
      siteId: siteUsage.siteId,
      name: sites.name,
      today: siteUsage.events,
      sent: siteUsage.spikeAlertSent,
      average: sql<number>`coalesce((
        select sum(u.events) / 14.0 from ${siteUsage} u
        where u.site_id = ${siteUsage.siteId} and u.day >= ${from} and u.day < ${today}
      ), 0)`.mapWith(Number),
    })
    .from(siteUsage)
    .innerJoin(sites, eq(sites.id, siteUsage.siteId))
    .where(eq(siteUsage.day, today));

  let sent = 0;
  for (const row of rows) {
    if (row.sent || row.today < SPIKE_MIN || row.today < SPIKE_FACTOR * Math.max(row.average, 1)) continue;
    await sendAlert({
      to: alertEmail(),
      subject: `📈 Ongewoon veel events op ${row.name}`,
      text: `${row.name} kreeg vandaag al ${row.today} events, tegen gemiddeld ${Math.round(row.average)} per dag.\n\nEcht nieuws, of iemand die nep-events stuurt met de publieke key? Kijk bij de site; bij misbruik: nieuwe keys maken (Bewerken → Keys vernieuwen).\n\n${appUrl()}/sites/${row.siteId}`,
    });
    await db
      .update(siteUsage)
      .set({ spikeAlertSent: true })
      .where(and(eq(siteUsage.siteId, row.siteId), eq(siteUsage.day, today)));
    sent++;
  }
  return sent;
}
