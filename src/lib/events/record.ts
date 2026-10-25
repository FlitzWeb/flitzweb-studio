import "server-only";
import { eq } from "drizzle-orm";
import { db, events, sites } from "@/db";

export const PAGEVIEW = "pageview";

export type IncomingEvent = {
  eventKey: unknown;
  value?: unknown;
  metadata?: unknown;
  path?: unknown;
  referrer?: unknown;
  occurredAt?: Date;
  // Browser-only context (see lib/analytics/collect.ts)
  sessionId?: string;
  visitId?: string;
  title?: unknown;
  hostname?: unknown;
  tag?: unknown;
  utm?: Partial<Record<"source" | "medium" | "campaign" | "content" | "term", string | null>>;
  adClick?: string | null;
};

export async function findSite(by: { publicKey: string } | { ingestSecret: string }) {
  const where =
    "publicKey" in by ? eq(sites.publicKey, by.publicKey) : eq(sites.ingestSecret, by.ingestSecret);
  return (await db.query.sites.findFirst({ where, columns: { id: true, url: true } })) ?? null;
}

type Site = NonNullable<Awaited<ReturnType<typeof findSite>>>;

/** Event names: like Umami, any name is accepted, up to 50 characters. */
export const cleanEventName = (n: unknown) =>
  typeof n === "string" && n.trim() ? n.trim().slice(0, 50) : null;

/** Validates and stores one event. */
export async function recordEvent(site: Site, e: IncomingEvent) {
  const eventKey = cleanEventName(e.eventKey);
  if (!eventKey) return { stored: false, reason: "missing event name" } as const;
  const value = typeof e.value === "number" && Number.isFinite(e.value) && Math.abs(e.value) < 1e9 ? e.value : null;

  await db.insert(events).values({
    siteId: site.id,
    eventKey,
    value,
    path: cleanPath(e.path),
    referrer: cleanHost(e.referrer),
    metadata: flattenData(e.metadata),
    occurredAt: e.occurredAt ?? new Date(),
    sessionId: e.sessionId,
    visitId: e.visitId,
    title: cleanText(e.title, 200),
    hostname: cleanHost(e.hostname),
    tag: cleanText(e.tag, 50),
    utmSource: cleanText(e.utm?.source, 100),
    utmMedium: cleanText(e.utm?.medium, 100),
    utmCampaign: cleanText(e.utm?.campaign, 100),
    utmContent: cleanText(e.utm?.content, 100),
    utmTerm: cleanText(e.utm?.term, 100),
    adClick: e.adClick ?? null,
  });
  return { stored: true } as const;
}

// Pathname only: drop query strings and fragments, which can hold personal data.
function cleanPath(p: unknown) {
  if (typeof p !== "string" || !p.startsWith("/")) return null;
  return p.split(/[?#]/)[0].slice(0, 300);
}

function cleanText(t: unknown, max: number) {
  return typeof t === "string" && t.trim() ? t.trim().slice(0, max) : null;
}

function cleanHost(h: unknown) {
  if (typeof h !== "string" || !/^[a-z0-9.-]{1,200}(:\d+)?$/i.test(h)) return null;
  return h.toLowerCase().replace(/^www\./, "");
}

/**
 * Event/session data, with Umami's rules: nested objects are flattened to
 * dotted keys ({ adres: { stad } } → "adres.stad"), max 50 properties,
 * strings max 500 characters, numbers rounded to 4 decimals, arrays stored
 * as a JSON string.
 */
export function flattenData(data: unknown): Record<string, string | number | boolean> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const out: Record<string, string | number | boolean> = {};
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      if (Object.keys(out).length >= 50) return;
      const key = (prefix ? `${prefix}.${k}` : k).slice(0, 50);
      if (v && typeof v === "object" && !Array.isArray(v)) walk(v as Record<string, unknown>, key);
      else if (typeof v === "number" && Number.isFinite(v)) out[key] = Math.round(v * 1e4) / 1e4;
      else if (typeof v === "boolean") out[key] = v;
      else if (typeof v === "string") out[key] = v.slice(0, 500);
      else if (Array.isArray(v)) {
        const json = JSON.stringify(v);
        if (json.length <= 500) out[key] = json;
      }
    }
  };
  walk(data as Record<string, unknown>, "");
  return Object.keys(out).length ? out : null;
}

/** Hosts that may send browser events for a site: its own domain, with or without www. */
export function originAllowed(origin: string | null, siteUrl: string) {
  if (!origin) return false;
  try {
    const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");
    return bare(new URL(origin).host) === bare(new URL(siteUrl).host);
  } catch {
    return false;
  }
}
