import "server-only";
import { eq } from "drizzle-orm";
import { db, events, sites, trackers } from "@/db";

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

/** The event names a site has trackers for: the only custom events the browser may send. */
export async function trackerKeys(siteId: number) {
  const rows = await db.select({ key: trackers.eventKey }).from(trackers).where(eq(trackers.siteId, siteId));
  return new Set(rows.map((r) => r.key));
}

type Site = NonNullable<Awaited<ReturnType<typeof findSite>>>;

/** Event names: like Umami, any name is accepted, up to 50 characters. */
export const cleanEventName = (n: unknown) =>
  typeof n === "string" && n.trim() ? n.trim().slice(0, 50) : null;

/** Data limits per source: the browser (public key) gets less room than the server (secret). */
export const LIMITS = {
  browser: { maxProps: 20, maxString: 200, maxValue: 1e6 },
  server: { maxProps: 50, maxString: 500, maxValue: 1e9 },
} as const;
export type Source = keyof typeof LIMITS;

/**
 * A usable value: a finite number below the source's maximum. From the browser it must also
 * be 0 or more (only the server, with its secret, may send a negative one such as a refund).
 */
export const cleanValue = (v: unknown, source: Source) =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) < LIMITS[source].maxValue && (source === "server" || v >= 0)
    ? v
    : null;

/** Validates and stores one event. */
export async function recordEvent(site: Site, e: IncomingEvent, source: Source = "server") {
  const eventKey = cleanEventName(e.eventKey);
  if (!eventKey) return { stored: false, reason: "missing event name" } as const;
  const value = cleanValue(e.value, source);

  await db.insert(events).values({
    siteId: site.id,
    eventKey,
    value,
    path: cleanPath(e.path),
    referrer: cleanHost(e.referrer),
    metadata: flattenData(e.metadata, LIMITS[source]),
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
export function flattenData(
  data: unknown,
  { maxProps = 50, maxString = 500 }: { maxProps?: number; maxString?: number } = {},
): Record<string, string | number | boolean> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const out: Record<string, string | number | boolean> = Object.create(null);
  const walk = (obj: Record<string, unknown>, prefix: string, depth: number) => {
    for (const [k, v] of Object.entries(obj)) {
      if (Object.keys(out).length >= maxProps) return;
      const key = (prefix ? `${prefix}.${k}` : k).slice(0, 50);
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (depth < 5) walk(v as Record<string, unknown>, key, depth + 1);
      } else if (typeof v === "number" && Number.isFinite(v)) out[key] = Math.round(v * 1e4) / 1e4;
      else if (typeof v === "boolean") out[key] = v;
      else if (typeof v === "string") out[key] = v.slice(0, maxString);
      else if (Array.isArray(v)) {
        const json = JSON.stringify(v);
        if (json.length <= maxString) out[key] = json;
      }
    }
  };
  walk(data as Record<string, unknown>, "", 0);
  return Object.keys(out).length ? { ...out } : null;
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
