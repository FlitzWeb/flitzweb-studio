import { createHash } from "node:crypto";
import { isbot } from "isbot";
import { collect, type CollectPayload } from "@/lib/analytics/collect";
import { takeQuota } from "@/lib/events/quota";
import { findSite, originAllowed } from "@/lib/events/record";
import { clientIp, ipKey, rateLimited } from "@/lib/events/rateLimit";

// Public endpoint for t.js. Accepts events only from the site's own domain
// (checked via the Origin header), rate-limited per visitor, ignores bots, and
// stops at the site's daily quota (lib/events/quota.ts). The body is JSON sent
// as text/plain, which browsers send without a CORS preflight:
//   { type?: "event" | "identify", website: siteKey, payload: { url, referrer,
//     title, hostname, screen, language, name?, value?, data?, tag?, id? }, cache?: token }
// The response { cache } lets the tracker keep one visit across events.
// Origin is only a browser's word: anyone can send these with the public key, so numbers
// that matter come from /api/ingest (trackers marked "server only").

const MAX_BYTES = 8000;
const cors = (origin: string) => ({ "Access-Control-Allow-Origin": origin, Vary: "Origin" });
const empty = (status: number, headers?: HeadersInit) => new Response(null, { status, headers });

export async function POST(request: Request) {
  // Limited per visitor before anything else (also before the site lookup in the database).
  const ip = clientIp(request);
  if (rateLimited(`collect:${ipKey(ip)}`, 120)) return empty(429);

  const origin = request.headers.get("origin");
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BYTES) return empty(413);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return empty(413);

  let body: { type?: unknown; website?: unknown; payload?: CollectPayload; cache?: unknown } | null;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return empty(400);
  }
  if (!body || typeof body !== "object" || typeof body.website !== "string" || typeof body.payload !== "object" || !body.payload) {
    return empty(400);
  }

  const site = await findSite({ publicKey: body.website });
  if (!site) return empty(404);
  if (!originAllowed(origin, site.url)) return empty(403);
  const headers = cors(origin!);

  if (isbot(request.headers.get("user-agent"))) return Response.json({}, { headers });

  // The IP is hashed and only used in memory for this one-minute window.
  const visitor = createHash("sha256").update(`${site.id}:${ipKey(ip)}`).digest("hex");
  if (rateLimited(visitor, 60)) return empty(429, headers);
  if (!(await takeQuota(site.id))) return empty(429, headers);

  const type = body.type === "identify" ? "identify" : "event";
  const { cache } = await collect(site, request, type, body.payload, body.cache);
  return Response.json({ cache }, { headers });
}
