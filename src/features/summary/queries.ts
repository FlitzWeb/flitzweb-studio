import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { checks, db, events, type Tracker } from "@/db";
import { addMonths, monthStart, todayISO } from "@/lib/dates";
import { amsterdamMidnight, type Period } from "@/lib/analytics/periods";
import { getBreakdowns, getWebsiteStats } from "@/lib/analytics/queries";

const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** "2026-10" (or anything else → last month) as first-of-month dates around it. */
export function summaryMonth(param: unknown, today = todayISO()) {
  const thisMonth = monthStart(today);
  let month = isMonth(param) ? `${param}-01` : addMonths(thisMonth, -1);
  if (month > thisMonth) month = thisMonth;
  return { month, prev: addMonths(month, -1), next: month < thisMonth ? addMonths(month, 1) : null, isCurrent: month === thisMonth };
}

/** Everything for one site's monthly summary: traffic vs the month before, goals, top pages, uptime. */
export async function getMonthSummary(siteId: number, trackers: Tracker[], month: string) {
  const from = amsterdamMidnight(month);
  const end = amsterdamMidnight(addMonths(month, 1));
  const to = new Date(Math.min(end.getTime() - 1, Date.now()));
  const prevFrom = amsterdamMidnight(addMonths(month, -1));
  const period: Period = { key: "30d", label: "Maand", from, to, prevFrom, prevTo: new Date(from.getTime() - 1), unit: "day", filters: [] };

  const [stats, breakdowns, goals, uptime] = await Promise.all([
    getWebsiteStats(siteId, period),
    getBreakdowns(siteId, period),
    db
      .select({
        key: events.eventKey,
        count: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(${events.value}), 0)`.mapWith(Number),
      })
      .from(events)
      .where(and(eq(events.siteId, siteId), gte(events.occurredAt, from), lt(events.occurredAt, end)))
      .groupBy(events.eventKey),
    db
      .select({
        total: sql<number>`count(*)::int`,
        up: sql<number>`(count(*) filter (where ${checks.isUp}))::int`,
      })
      .from(checks)
      .where(and(eq(checks.siteId, siteId), gte(checks.checkedAt, from), lt(checks.checkedAt, end))),
  ]);

  const byKey = new Map(goals.map((g) => [g.key, g]));
  return {
    stats,
    pages: breakdowns.pages.slice(0, 5),
    referrers: breakdowns.referrers.slice(0, 5),
    goals: trackers.map((t) => {
      const g = byKey.get(t.eventKey);
      return { name: t.name, aggregation: t.aggregation, value: t.aggregation === "sum" ? (g?.sum ?? 0) : (g?.count ?? 0) };
    }),
    uptimePct: uptime[0]?.total ? (100 * uptime[0].up) / uptime[0].total : null,
  };
}
export type MonthSummary = Awaited<ReturnType<typeof getMonthSummary>>;
