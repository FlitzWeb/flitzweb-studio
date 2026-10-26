import "server-only";

// Finds and downloads a site's own logo/favicon, so the dashboard can show it
// next to the site name. Best candidate first: an SVG icon, then the
// apple-touch-icon (large and square), then the biggest PNG, then any icon,
// then /favicon.ico.

export type SiteIcon = { body: ArrayBuffer; type: string };

const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;
const TTL_MS = 24 * 3600_000;
const UA = "Mozilla/5.0 (compatible; FlitzWebStudio/1.0; +https://www.flitzweb.nl)";

// Per server instance: a site is fetched at most once a day.
const cache = new Map<string, { icon: SiteIcon | null; at: number }>();

export async function getSiteIcon(siteUrl: string): Promise<SiteIcon | null> {
  const hit = cache.get(siteUrl);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.icon;
  const icon = await findIcon(siteUrl).catch(() => null);
  cache.set(siteUrl, { icon, at: Date.now() });
  return icon;
}

async function findIcon(siteUrl: string): Promise<SiteIcon | null> {
  const page = new URL(siteUrl);
  if (page.protocol !== "http:" && page.protocol !== "https:") return null;

  const res = await get(page.href, "text/html");
  const candidates: string[] = [];
  if (res?.ok && res.headers.get("content-type")?.includes("html")) {
    const html = (await res.text()).slice(0, 200_000);
    // Relative icon paths resolve against the final URL (after redirects).
    candidates.push(...iconLinks(html, res.url || page.href));
  }
  candidates.push(new URL("/favicon.ico", page).href);

  for (const href of candidates) {
    const icon = await download(href);
    if (icon) return icon;
  }
  return null;
}

/** All <link rel="…icon…"> hrefs in the page, best first. */
function iconLinks(html: string, base: string) {
  const links: { href: string; score: number }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, "rel")?.toLowerCase() ?? "";
    const href = attr(tag, "href");
    if (!href || !/\bicon\b|apple-touch-icon/.test(rel) || rel.includes("mask-icon")) continue;

    const type = attr(tag, "type") ?? "";
    const size = Math.max(0, ...(attr(tag, "sizes") ?? "").split(/\s+/).map((s) => parseInt(s, 10) || 0));
    let score = size;
    if (type.includes("svg") || /\.svg(\?|$)/i.test(href)) score = 10_000;
    else if (rel.includes("apple-touch-icon")) score = 5_000 + size;
    else if (/\.ico(\?|$)/i.test(href)) score = 1;

    try {
      links.push({ href: new URL(decode(href), base).href, score });
    } catch {}
  }
  return links.sort((a, b) => b.score - a.score).map((l) => l.href);
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

const decode = (s: string) => s.replace(/&amp;/g, "&");

async function download(href: string): Promise<SiteIcon | null> {
  if (href.startsWith("data:")) return null;
  const res = await get(href, "image/*");
  const type = res?.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!res?.ok || !type.startsWith("image/")) return null;
  const body = await res.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return null;
  return { body, type };
}

async function get(url: string, accept: string) {
  try {
    return await fetch(url, {
      headers: { "user-agent": UA, accept },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return null;
  }
}
