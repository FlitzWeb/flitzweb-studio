import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db, events, type Tracker } from "@/db";
import { PAGEVIEW } from "@/lib/events/record";
import { addDays, monthStart, todayISO } from "@/lib/dates";

const DAY = sql<string>`to_char(${events.occurredAt} at time zone 'Europe/Amsterdam', 'YYYY-MM-DD')`;

export type Metric = {
  key: string;
  name: string;
  aggregation: "count" | "sum";
  monthlyGoal: number | null;
  trackerId: number | null;
};

export type Period = { current: number; previous: number };

export type MetricStats = Metric & {
  today: Period;
  week: Period;
  month30: Period;
  thisMonth: number;
  series: { day: string; value: number }[];
};

/** Pageviews plus each tracker, with today / 7d / 30d vs the previous period, and a 30-day series. */
export async function getSiteStats(siteId: number, trackers: Tracker[]) {
  const today = todayISO();
  const from = addDays(today, -59);

  const rows = await db
    .select({
      key: events.eventKey,
      day: DAY,
      count: count(),
      sum: sql<number>`coalesce(sum(${events.value}), 0)`.mapWith(Number),
    })
    .from(events)
    .where(
      and(
        eq(events.siteId, siteId),
        // A day of slack; exact Amsterdam days are filtered by `day` below.
        gte(events.occurredAt, new Date(`${addDays(from, -1)}T00:00:00Z`)),
      ),
    )
    .groupBy(events.eventKey, DAY);

  const metrics: Metric[] = [
    { key: PAGEVIEW, name: "Paginaweergaven", aggregation: "count", monthlyGoal: null, trackerId: null },
    ...trackers.map((t) => ({
      key: t.eventKey,
      name: t.name,
      aggregation: t.aggregation,
      monthlyGoal: t.monthlyGoal,
      trackerId: t.id,
    })),
  ];

  return metrics.map((m): MetricStats => {
    const byDay = new Map<string, number>();
    for (const r of rows) {
      if (r.key === m.key && r.day >= from) byDay.set(r.day, m.aggregation === "count" ? r.count : r.sum);
    }
    // Sum of `days` days ending `endOffset` days before today.
    const total = (days: number, endOffset = 0) => {
      let t = 0;
      for (let i = endOffset; i < endOffset + days; i++) t += byDay.get(addDays(today, -i)) ?? 0;
      return t;
    };
    let thisMonth = 0;
    for (let d = monthStart(today); d <= today; d = addDays(d, 1)) thisMonth += byDay.get(d) ?? 0;

    return {
      ...m,
      today: { current: total(1), previous: total(1, 1) },
      week: { current: total(7), previous: total(7, 7) },
      month30: { current: total(30), previous: total(30, 30) },
      thisMonth,
      series: Array.from({ length: 30 }, (_, i) => {
        const day = addDays(today, i - 29);
        return { day, value: byDay.get(day) ?? 0 };
      }),
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
