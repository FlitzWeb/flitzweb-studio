import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { checks, db, events, reportNotes, type Tracker } from "@/db";
import { addDays, addMonths, monthStart, todayISO } from "@/lib/dates";
import { amsterdamMidnight, type Period } from "@/lib/analytics/periods";
import { getBreakdowns, getPageviewSeries, getWebsiteStats } from "@/lib/analytics/queries";
import { sinceFirstUp } from "@/lib/uptime/queries";
import { monthSearch } from "@/features/search/queries";
import { countedEvents } from "@/features/stats/source";
import { goalKey } from "./message";
import { friendlySources } from "./sources";

const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** "2026-10" (or anything else → last month) as first-of-month dates around it. */
export function summaryMonth(param: unknown, today = todayISO()) {
  const thisMonth = monthStart(today);
  let month = isMonth(param) ? `${param}-01` : addMonths(thisMonth, -1);
  if (month > thisMonth) month = thisMonth;
  return { month, prev: addMonths(month, -1), next: month < thisMonth ? addMonths(month, 1) : null, isCurrent: month === thisMonth };
}

const LEGAL_PAGE = /^\/(privacy[a-z-]*|cookies?[a-z-]*|algemene-voorwaarden|voorwaarden|disclaimer|terms[a-z-]*)\/?$/i;

/** The saved "what I did this month" line, or null. */
export async function getReportNote(siteId: number, month: string) {
  const [row] = await db
    .select()
    .from(reportNotes)
    .where(and(eq(reportNotes.siteId, siteId), eq(reportNotes.month, month)));
  return row ?? null;
}

/** Everything for one site's monthly summary: traffic vs the month before, goals, top pages, uptime. */
export async function getMonthSummary(siteId: number, trackers: Tracker[], month: string, chartEvent: string | null = null) {
  const from = amsterdamMidnight(month);
  const end = amsterdamMidnight(addMonths(month, 1));
  const to = new Date(Math.min(end.getTime() - 1, Date.now()));
  const prevFrom = amsterdamMidnight(addMonths(month, -1));
  const period: Period = { key: "30d", label: "Maand", from, to, prevFrom, prevTo: new Date(from.getTime() - 1), unit: "day", filters: [] };

  // The chart follows one result (e.g. calls) when the site picked a tracker, otherwise visitors.
  const chartTracker = trackers.find((t) => t.eventKey === chartEvent) ?? null;
  const counted = countedEvents(trackers);
  const day = sql<string>`to_char(${events.occurredAt} at time zone 'Europe/Amsterdam', 'YYYY-MM-DD')`;

  const [stats, breakdowns, series, goals, prevGoals, perDay, uptime, [firstEvent], search] = await Promise.all([
    getWebsiteStats(siteId, period),
    getBreakdowns(siteId, period),
    getPageviewSeries(siteId, period),
    db
      .select({
        key: events.eventKey,
        count: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(${events.value}), 0)`.mapWith(Number),
      })
      .from(events)
      .where(and(eq(events.siteId, siteId), gte(events.occurredAt, from), lt(events.occurredAt, end), counted))
      .groupBy(events.eventKey),
    // The same totals for the month before, to say whether a result went up or down.
    db
      .select({
        key: events.eventKey,
        count: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(${events.value}), 0)`.mapWith(Number),
      })
      .from(events)
      .where(and(eq(events.siteId, siteId), gte(events.occurredAt, prevFrom), lt(events.occurredAt, from), counted))
      .groupBy(events.eventKey),
    chartTracker
      ? db
          .select({
            day,
            count: sql<number>`count(*)::int`,
            sum: sql<number>`coalesce(sum(${events.value}), 0)`.mapWith(Number),
          })
          .from(events)
          .where(
            and(
              eq(events.siteId, siteId),
              eq(events.eventKey, chartTracker.eventKey),
              gte(events.occurredAt, from),
              lt(events.occurredAt, end),
              counted,
            ),
          )
          .groupBy(day)
      : [],
    db
      .select({
        total: sql<number>`count(*)::int`,
        up: sql<number>`(count(*) filter (where ${checks.isUp}))::int`,
      })
      .from(checks)
      .where(and(eq(checks.siteId, siteId), gte(checks.checkedAt, from), lt(checks.checkedAt, end), sinceFirstUp)),
    db.select({ at: sql<string | null>`min(${events.occurredAt})` }).from(events).where(eq(events.siteId, siteId)),
    // Google Search Console, when the site is linked (null otherwise).
    monthSearch(siteId, month),
  ]);

  // "+228% t.o.v. de maand ervoor" is only true when both months were measured
  // in full: not while this month is still running, and not when tracking
  // started somewhere in the month before.
  const trackedSince = firstEvent?.at ? new Date(firstEvent.at) : null;
  const comparable = end.getTime() <= Date.now() && trackedSince != null && trackedSince.getTime() < prevFrom.getTime() + 86400000;

  const byKey = new Map(goals.map((g) => [g.key, g]));
  const prevByKey = new Map(prevGoals.map((g) => [g.key, g]));
  const total = (t: Tracker, g: { count: number; sum: number } | undefined) =>
    t.aggregation === "sum" ? (g?.sum ?? 0) : (g?.count ?? 0);

  // One entry per calendar day of the month (up to today), also for days with nothing.
  const lastDay = [addDays(addMonths(month, 1), -1), todayISO()].sort()[0];
  const valueByDay = chartTracker
    ? new Map(perDay.map((r) => [r.day, chartTracker.aggregation === "sum" ? r.sum : r.count]))
    : new Map(series.map((p) => [p.bucket, p.visitors]));
  const days: { day: string; value: number }[] = [];
  for (let d = month; d <= lastDay; d = addDays(d, 1)) days.push({ day: d, value: valueByDay.get(d) ?? 0 });

  return {
    stats,
    /** Whether the month before is a fair comparison (see above). */
    comparable,
    /** The per-day chart: what it counts and the value for every day of the month. */
    chart: { label: chartTracker?.name ?? "Bezoekers", isMoney: chartTracker?.aggregation === "sum", days },
    // Legal pages say nothing about the business, and a "top pages" list of one is no list.
    pages: breakdowns.pages.filter((p) => !LEGAL_PAGE.test(p.label)).slice(0, 5),
    referrers: friendlySources(breakdowns.referrers).slice(0, 5),
    goals: trackers.map((t) => ({
      key: goalKey(t.eventKey),
      name: t.name,
      aggregation: t.aggregation,
      value: total(t, byKey.get(t.eventKey)),
      previous: total(t, prevByKey.get(t.eventKey)),
    })),
    uptimePct: uptime[0]?.total ? (100 * uptime[0].up) / uptime[0].total : null,
    search,
  };
}
export type MonthSummary = Awaited<ReturnType<typeof getMonthSummary>>;
