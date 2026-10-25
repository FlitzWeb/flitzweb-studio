import { createHash } from "node:crypto";
import { isbot } from "isbot";
import { collect, type CollectPayload } from "@/lib/analytics/collect";
import { findSite, originAllowed } from "@/lib/events/record";
import { rateLimited } from "@/lib/events/rateLimit";

// Public endpoint for t.js. Accepts events only from the site's own domain
// (checked via the Origin header), rate-limited per visitor, ignores bots.
// The body is JSON sent as text/plain, which browsers send without a CORS
// preflight:
//   { type?: "event" | "identify", website: siteKey, payload: { url, referrer,
//     title, hostname, screen, language, name?, value?, data?, tag?, id? }, cache?: token }
// The response { cache } lets the tracker keep one visit across events.

const cors = (origin: string) => ({ "Access-Control-Allow-Origin": origin, Vary: "Origin" });
const empty = (status: number, headers?: HeadersInit) => new Response(null, { status, headers });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const text = await request.text();
  if (text.length > 8000) return empty(413);

  let body: { type?: unknown; website?: unknown; payload?: CollectPayload; cache?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return empty(400);
  }
  if (typeof body.website !== "string" || typeof body.payload !== "object" || !body.payload) {
    return empty(400);
  }

  const site = await findSite({ publicKey: body.website });
  if (!site) return empty(404);
  if (!originAllowed(origin, site.url)) return empty(403);
  const headers = cors(origin!);

  if (isbot(request.headers.get("user-agent"))) return Response.json({}, { headers });

  // The IP is hashed and only used in memory for this one-minute window.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const visitor = createHash("sha256").update(`${site.id}:${ip}`).digest("hex");
  if (rateLimited(visitor, 60)) return empty(429, headers);

  const type = body.type === "identify" ? "identify" : "event";
  const { cache } = await collect(site, request, type, body.payload, body.cache);
  return Response.json({ cache }, { headers });
}
