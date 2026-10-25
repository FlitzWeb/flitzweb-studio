import "server-only";

// A simple fixed-window rate limiter kept in memory. On Vercel each server
// instance has its own memory, so this is a guard against floods from one
// visitor or a buggy script, not an exact global limit. Keys are only held
// in memory for a minute and never stored.

const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  if (windows.size > 10_000) {
    for (const [k, w] of windows) if (w.resetAt < now) windows.delete(k);
  }
  const w = windows.get(key);
  if (!w || w.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  w.count++;
  return w.count > limit;
}
