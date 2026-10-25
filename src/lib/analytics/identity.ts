import "server-only";
import { createHash } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

// Anonymous visitor ("session") and visit ids, as in Umami's /api/send:
//   sessionId = hash(site, ip, userAgent, monthly salt, distinct id, secret)
//   visitId   = hash(sessionId, start of the hour)   (without a cache token)
// The tracker keeps a signed cache token in page memory (not in storage),
// so events from one page view stay in the same visit for up to 30 minutes.

const VISIT_MAX_SECONDS = 30 * 60;

const secret = () => sha512(process.env.AUTH_SECRET ?? "", "analytics");

function sha512(...parts: string[]) {
  return createHash("sha512").update(parts.join("")).digest("hex");
}

/** Deterministic UUID-shaped id from the given parts (plus the app secret). */
export function hashId(...parts: string[]) {
  const h = sha512(...parts, secret());
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Changes on the 1st of every month (UTC), like Umami's default SALT_ROTATION. */
const monthlySalt = (d: Date) => sha512(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);

const startOfHour = (d: Date) => {
  const h = new Date(d);
  h.setUTCMinutes(0, 0, 0);
  return h.toISOString();
};

export const sessionIdFor = (siteId: number, ip: string, userAgent: string, at: Date, distinctId = "") =>
  hashId(String(siteId), ip, userAgent, monthlySalt(at), distinctId);

export type VisitCache = { sid: string; vid: string; iat: number };

const key = () => new TextEncoder().encode(secret().slice(0, 64));

export async function readCache(token: unknown): Promise<VisitCache | null> {
  if (typeof token !== "string" || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const { sid, vid, iat } = payload as Partial<VisitCache>;
    return sid && vid && iat ? { sid, vid, iat } : null;
  } catch {
    return null;
  }
}

export const writeCache = (c: VisitCache) =>
  new SignJWT({ ...c }).setProtectedHeader({ alg: "HS256" }).sign(key());

/** Picks the visit id: reuse the cached one unless it's stale or for another session. */
export function resolveVisit(sessionId: string, cache: VisitCache | null, at: Date) {
  const now = Math.floor(at.getTime() / 1000);
  if (cache && cache.sid === sessionId && now - cache.iat <= VISIT_MAX_SECONDS) {
    return { visitId: cache.vid, iat: cache.iat };
  }
  return { visitId: hashId(sessionId, startOfHour(at)), iat: now };
}
