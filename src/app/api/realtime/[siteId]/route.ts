import { cookies } from "next/headers";
import { getRealtimeData } from "@/lib/analytics/realtime";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Live data for the "Live" tab, polled every few seconds. Login required.
export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const email = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!email || email !== process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const siteId = Number((await params).siteId);
  if (!Number.isInteger(siteId)) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json(await getRealtimeData(siteId), { headers: { "Cache-Control": "no-store" } });
}
