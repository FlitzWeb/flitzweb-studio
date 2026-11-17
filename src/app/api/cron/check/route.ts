import { timingSafeEqual } from "node:crypto";
import { ensureCharges } from "@/features/money/charges";
import { sendOverdueAlerts } from "@/features/money/overdueAlerts";
import { pruneEvents } from "@/lib/events/prune";
import { runChecks } from "@/lib/uptime/run";

// Checks every live site. Called by Vercel Cron (daily) and cron-job.org
// (every 5 minutes), both with the header `Authorization: Bearer <CRON_SECRET>`.
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await runChecks();
  await ensureCharges(); // new month → new subscription charges
  const overdueAlerts = await sendOverdueAlerts(); // one email when something goes past its due date
  await pruneEvents();
  return Response.json({ checked: results.length, overdueAlerts, results });
}

export const GET = handle;
export const POST = handle;
