import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, sessions } from "@/db";
import { flattenData, PAGEVIEW, recordEvent, type findSite } from "@/lib/events/record";
import { getClientInfo } from "./client";
import { readCache, resolveVisit, sessionIdFor, writeCache } from "./identity";

type Site = NonNullable<Awaited<ReturnType<typeof findSite>>>;

/** What t.js sends in `payload`. */
export type CollectPayload = {
  url?: unknown;
  referrer?: unknown;
  title?: unknown;
  hostname?: unknown;
  screen?: unknown;
  language?: unknown;
  name?: unknown; // custom event name; absent = pageview
  value?: unknown;
  data?: unknown;
  tag?: unknown;
  id?: unknown; // distinct id from flitz.identify()
};

const UTM = ["source", "medium", "campaign", "content", "term"] as const;
const AD_CLICK_IDS = ["gclid", "fbclid", "msclkid", "ttclid", "li_fat_id", "twclid"];

/**
 * Stores one browser event (or identify call): works out the anonymous
 * session and visit, creates the session row the first time, and returns
 * a new cache token.
 */
export async function collect(
  site: Site,
  request: Request,
  type: "event" | "identify",
  payload: CollectPayload,
  cacheToken: unknown,
) {
  const at = new Date();
  const screen = str(payload.screen, 20);
  const client = getClientInfo(request, screen ?? undefined);
  // Like Umami, an identified visitor gets its own session, separate from
  // anonymous visitors who happen to share the same IP and browser.
  const distinctId = str(payload.id, 50);
  const sessionId = sessionIdFor(site.id, client.ip, client.userAgent, at, distinctId ?? "");

  const cache = await readCache(cacheToken);
  if (cache?.sid !== sessionId) {
    // New (or changed) visitor: make sure the session exists. Its details
    // are taken from the first event we see that month.
    await db
      .insert(sessions)
      .values({
        id: sessionId,
        siteId: site.id,
        browser: client.browser,
        os: client.os,
        device: client.device,
        screen,
        language: str(payload.language, 35),
        country: client.country,
        region: client.region,
        city: client.city,
        distinctId,
      })
      .onConflictDoNothing();
  }
  const { visitId, iat } = resolveVisit(sessionId, cache, at);
  const newCache = () => writeCache({ sid: sessionId, vid: visitId, iat });

  if (type === "identify") {
    // Merge the new properties into the session's existing data.
    const data = flattenData(payload.data);
    await db
      .update(sessions)
      .set({
        distinctId,
        ...(data && { data: sql`coalesce(${sessions.data}, '{}'::jsonb) || ${JSON.stringify(data)}::jsonb` }),
      })
      .where(eq(sessions.id, sessionId));
    return { stored: true, cache: await newCache() };
  }

  const url = parseUrl(payload.url);
  const hostname = str(payload.hostname, 200) ?? url?.hostname ?? null;

  const result = await recordEvent(site, {
    eventKey: typeof payload.name === "string" ? payload.name : PAGEVIEW,
    value: payload.value,
    metadata: payload.data,
    path: url?.pathname,
    referrer: referrerHost(payload.referrer, hostname),
    title: payload.title,
    hostname,
    tag: payload.tag,
    sessionId,
    visitId,
    utm: Object.fromEntries(UTM.map((k) => [k, url?.searchParams.get(`utm_${k}`) ?? null])),
    adClick: AD_CLICK_IDS.find((k) => url?.searchParams.has(k)) ?? null,
    occurredAt: at,
  });

  return { stored: result.stored, cache: await newCache() };
}

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

function parseUrl(raw: unknown) {
  if (typeof raw !== "string") return null;
  try {
    return new URL(raw, "https://localhost");
  } catch {
    return null;
  }
}

/** Host of the referrer, or null for direct visits and self-referrals. */
function referrerHost(raw: unknown, hostname: string | null) {
  if (typeof raw !== "string" || !raw || raw.startsWith("/")) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    return host && host !== hostname?.replace(/^www\./, "") ? host : null;
  } catch {
    return null;
  }
}
