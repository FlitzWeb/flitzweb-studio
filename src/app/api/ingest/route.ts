import { takeQuota } from "@/lib/events/quota";
import { findSite, recordEvent } from "@/lib/events/record";
import { clientIp, ipKey, rateLimited } from "@/lib/events/rateLimit";

// Server-to-server events, e.g. from a booking API:
//   POST /api/ingest
//   Authorization: Bearer <site ingest secret>
//   { "event": "order_placed", "value": 24.5, "meta": { "type": "afhalen" }, "at": "2026-10-25T18:00:00Z" }
// "at" is optional (default: now) and may be up to 7 days in the past.

export async function POST(request: Request) {
  // Per caller first, before the secret is looked up (no guessing at secrets at full speed).
  if (rateLimited(`ingest-ip:${ipKey(clientIp(request))}`, 600)) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const site = secret ? await findSite({ ingestSecret: secret }) : null;
  if (!site) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (rateLimited(`ingest:${site.id}`, 600)) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }

  let body: { event?: unknown; value?: unknown; meta?: unknown; at?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "send a JSON object" }, { status: 400 });
  }
  if (!(await takeQuota(site.id))) {
    return Response.json({ error: "daily event limit reached" }, { status: 429 });
  }

  let occurredAt: Date | undefined;
  if (body.at !== undefined) {
    occurredAt = new Date(String(body.at));
    const age = Date.now() - occurredAt.getTime();
    if (Number.isNaN(age) || age < -60_000 || age > 7 * 86400_000) {
      return Response.json({ error: "'at' must be an ISO date within the last 7 days" }, { status: 400 });
    }
  }

  const result = await recordEvent(site, {
    eventKey: body.event,
    value: body.value,
    metadata: body.meta,
    occurredAt,
  }, "server");
  return result.stored
    ? Response.json({ ok: true }, { status: 202 })
    : Response.json({ ok: false, error: result.reason }, { status: 400 });
}
