import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { PAGEVIEW } from "@/lib/events/record";

// The last 30 minutes, like Umami's realtime page (getRealtimeData).

const WINDOW_MINUTES = 30;

export type RealtimeEvent = {
  type: "session" | "pageview" | "event";
  sessionId: string;
  eventKey: string;
  path: string | null;
  referrer: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  city: string | null;
  at: string; // ISO
};

export type RealtimeData = Awaited<ReturnType<typeof getRealtimeData>>;

export async function getRealtimeData(siteId: number) {
  const since = sql`now() - make_interval(mins => ${WINDOW_MINUTES})`;

  const [activity, series] = await Promise.all([
    db.execute<Omit<RealtimeEvent, "type">>(sql`
      select e.session_id as "sessionId", e.event_key as "eventKey", e.path, e.referrer,
        s.browser, s.os, s.device, s.country, s.city,
        to_char(e.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at
      from events e
      join sessions s on s.id = e.session_id
      where e.site_id = ${siteId} and e.occurred_at >= ${since}
      order by e.occurred_at desc
      limit 100
    `),
    db.execute<{ minute: string; views: number; visitors: number }>(sql`
      select to_char(date_trunc('minute', occurred_at at time zone 'Europe/Amsterdam'), 'HH24:MI') as minute,
        count(*) filter (where event_key = ${PAGEVIEW})::int as views,
        count(distinct session_id)::int as visitors
      from events
      where site_id = ${siteId} and occurred_at >= ${since} and session_id is not null
      group by 1
    `),
  ]);

  // Walk oldest → newest: the first event of a session also announces the visitor.
  const seen = new Set<string>();
  const countries: Record<string, number> = {};
  const pages: Record<string, number> = {};
  const referrers: Record<string, number> = {};
  const events: RealtimeEvent[] = [];
  for (const e of [...activity].reverse()) {
    if (!seen.has(e.sessionId)) {
      seen.add(e.sessionId);
      if (e.country) countries[e.country] = (countries[e.country] ?? 0) + 1;
      events.push({ ...e, type: "session" });
    }
    if (e.eventKey === PAGEVIEW) {
      if (e.path) pages[e.path] = (pages[e.path] ?? 0) + 1;
      if (e.referrer) referrers[e.referrer] = (referrers[e.referrer] ?? 0) + 1;
    }
    events.push({ ...e, type: e.eventKey === PAGEVIEW ? "pageview" : "event" });
  }

  // One bucket per minute, oldest first, so the chart has no gaps.
  const byMinute = new Map(series.map((r) => [r.minute, r]));
  const minuteFmt = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const minutes = Array.from({ length: WINDOW_MINUTES }, (_, i) => {
    const label = minuteFmt.format(new Date(Date.now() - (WINDOW_MINUTES - 1 - i) * 60_000));
    return byMinute.get(label) ?? { minute: label, views: 0, visitors: 0 };
  });

  const sorted = (r: Record<string, number>) =>
    Object.entries(r)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

  return {
    events: events.reverse(),
    minutes,
    countries: sorted(countries),
    pages: sorted(pages),
    referrers: sorted(referrers),
    totals: {
      visitors: seen.size,
      views: activity.filter((e) => e.eventKey === PAGEVIEW).length,
      events: activity.filter((e) => e.eventKey !== PAGEVIEW).length,
      countries: Object.keys(countries).length,
    },
    at: new Date().toISOString(),
  };
}
