import { getRealtimeData } from "@/lib/analytics/realtime";
import { sessionEmail } from "@/lib/auth";

// Live data for the "Live" tab, polled every few seconds. Login required.
export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  if (!(await sessionEmail())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const siteId = Number((await params).siteId);
  if (!Number.isInteger(siteId)) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json(await getRealtimeData(siteId), { headers: { "Cache-Control": "no-store" } });
}
