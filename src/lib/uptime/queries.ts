import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { checks, clients, db, sites, type Check } from "@/db";

const DAY = 86400000;

export type SiteOverview = Awaited<ReturnType<typeof getSiteOverviews>>[number];

/** Every site with its latest check and 30-day uptime, down sites first. */
export async function getSiteOverviews() {
  const [rows, latest, uptime] = await Promise.all([
    db
      .select({ site: sites, clientName: clients.name })
      .from(sites)
      .innerJoin(clients, eq(clients.id, sites.clientId)),
    db
      .selectDistinctOn([checks.siteId])
      .from(checks)
      .orderBy(checks.siteId, desc(checks.checkedAt)),
    uptimeBySite(30),
  ]);

  const latestBySite = new Map(latest.map((c) => [c.siteId, c]));
  const now = Date.now();

  return rows
    .map(({ site, clientName }) => ({
      ...site,
      clientName,
      monitored: site.status === "live",
      lastCheck: latestBySite.get(site.id) ?? null,
      uptime30: uptime.get(site.id) ?? null,
      downForMs: site.downSince ? now - site.downSince.getTime() : null,
    }))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "nl"));
}

// Down first, then up, then never-checked, then not monitored.
function rank(s: { monitored: boolean; isUp: boolean | null }) {
  if (!s.monitored) return 3;
  if (s.isUp === false) return 0;
  if (s.isUp === true) return 1;
  return 2;
}

/** Uptime percentage per site over the last `days` days. */
export async function uptimeBySite(days: number, siteId?: number) {
  const rows = await db
    .select({
      siteId: checks.siteId,
      pct: sql<number>`100.0 * count(*) filter (where ${checks.isUp}) / count(*)`.mapWith(Number),
    })
    .from(checks)
    .where(
      and(
        gte(checks.checkedAt, new Date(Date.now() - days * DAY)),
        siteId ? eq(checks.siteId, siteId) : undefined,
      ),
    )
    .groupBy(checks.siteId);
  return new Map(rows.map((r) => [r.siteId, r.pct]));
}

/** Checks for one site in the last `hours` hours, oldest first (for charts). */
export function recentChecks(siteId: number, hours: number): Promise<Check[]> {
  return db
    .select()
    .from(checks)
    .where(
      and(
        eq(checks.siteId, siteId),
        gte(checks.checkedAt, new Date(Date.now() - hours * 3600000)),
      ),
    )
    .orderBy(asc(checks.checkedAt));
}

export type Incident = { start: Date; end: Date | null; error: string | null };

/** Groups consecutive failed checks into incidents, newest first. */
export async function getIncidents(siteId: number, days = 30) {
  const rows = await recentChecks(siteId, days * 24);
  const incidents: Incident[] = [];
  let open: Incident | null = null;
  for (const c of rows) {
    if (!c.isUp && !open) {
      open = { start: c.checkedAt, end: null, error: c.error };
      incidents.push(open);
    } else if (c.isUp && open) {
      open.end = c.checkedAt;
      open = null;
    }
  }
  return incidents.reverse();
}

/** Average response time (successful checks, live sites) over the last 24h and the 24h before. */
export async function responseAverages() {
  const [row] = await db
    .select({
      current: sql<number | null>`avg(${checks.responseMs}) filter (where ${checks.checkedAt} >= now() - interval '24 hours')`.mapWith((v) => (v == null ? null : Math.round(Number(v)))),
      previous: sql<number | null>`avg(${checks.responseMs}) filter (where ${checks.checkedAt} < now() - interval '24 hours')`.mapWith((v) => (v == null ? null : Math.round(Number(v)))),
    })
    .from(checks)
    .innerJoin(sites, eq(sites.id, checks.siteId))
    .where(
      and(
        eq(checks.isUp, true),
        eq(sites.status, "live"),
        gte(checks.checkedAt, new Date(Date.now() - 2 * DAY)),
      ),
    );
  return row ?? { current: null, previous: null };
}
