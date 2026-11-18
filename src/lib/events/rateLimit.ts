import "server-only";

// A simple fixed-window rate limiter kept in memory. On Vercel each server
// instance has its own memory, so this is a guard against floods from one
// visitor or a buggy script, not an exact global limit (the per-site daily
// quota in quota.ts is the hard limit). Keys are only held in memory for a
// minute and never stored.

const MAX_KEYS = 10_000;
const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || w.resetAt < now) {
    windows.delete(key);
    windows.set(key, { count: 1, resetAt: now + windowMs });
    // Oldest windows first (Map keeps insertion order): drop expired ones from the front,
    // and the oldest beyond MAX_KEYS, without scanning everything on every request.
    for (const [k, old] of windows) {
      if (windows.size <= MAX_KEYS && old.resetAt >= now) break;
      windows.delete(k);
    }
    return false;
  }
  w.count++;
  return w.count > limit;
}

/**
 * The visitor's IP as Vercel saw it. x-real-ip and x-vercel-forwarded-for are set by
 * Vercel's edge (a visitor cannot choose them); the leftmost X-Forwarded-For entry can be
 * anything the visitor sent, so it is only the last resort (local development).
 */
export function clientIp(request: Request) {
  const h = request.headers;
  const ip =
    h.get("x-real-ip") ??
    h.get("x-vercel-forwarded-for")?.split(",")[0] ??
    h.get("x-forwarded-for")?.split(",").at(-1) ??
    "unknown";
  return ip.trim();
}

/** The key one visitor is limited by: the address for IPv4, its /64 network for IPv6. */
export function ipKey(ip: string) {
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left;
  return `${groups.slice(0, 4).map((g) => g.padStart(4, "0")).join(":")}::/64`;
}
