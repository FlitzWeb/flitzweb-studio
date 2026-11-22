import { asc, eq, max } from "drizzle-orm";
import { checks, clients, db, sites } from "@/db";
import { sessionEmail } from "@/lib/auth";

// Which sites are offline right now, for the Mac app's Dock badge (mac/). Login required.
// The same rule as the status pill in the top bar ((dashboard)/layout.tsx): a site counts
// when it is live (monitored), and is down when its last check failed.
//
// `checkedAt` is the time of the newest check. The Mac app asks again just after the next
// check is due, while the database is still awake from it, so the badge costs no extra
// database time. Don't poll this on a short timer: every call wakes the database.
export async function GET() {
  if (!(await sessionEmail())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const [rows, [newest]] = await Promise.all([
    db
      .select({ name: sites.name, status: sites.status, isUp: sites.isUp })
      .from(sites)
      .innerJoin(clients, eq(clients.id, sites.clientId))
      .orderBy(asc(sites.name)),
    db.select({ at: max(checks.checkedAt) }).from(checks),
  ]);

  const monitored = rows.filter((site) => site.status === "live");
  return Response.json(
    {
      monitored: monitored.length,
      down: monitored.filter((site) => site.isUp === false).map((site) => site.name),
      checkedAt: newest?.at ? new Date(newest.at).toISOString() : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
