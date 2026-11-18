/**
 * A path on this dashboard to go back to (?terug=, a hidden returnTo field), or the fallback.
 * Only a plain local path counts: no "//host", no backslash ("/\host" is read as "//host"
 * by browsers), no tabs, newlines or other control characters (dropped by URL parsing, which
 * turns "/\t/host" into "//host"), and it must stay on this origin once resolved.
 */
export function safeReturnPath(to: unknown, fallback: string) {
  if (typeof to !== "string" || !to.startsWith("/") || to.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(to)) return fallback;
  try {
    const base = "http://studio.invalid";
    const url = new URL(to, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
