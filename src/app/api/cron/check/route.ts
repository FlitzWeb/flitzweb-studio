import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { ensureCharges } from "@/features/money/charges";
import { sendOverdueAlerts } from "@/features/money/overdueAlerts";
import { pruneLoginTokens } from "@/lib/auth";
import { pruneEvents, sendSpikeAlerts } from "@/lib/events/prune";
import { syncDueSearchConsole } from "@/lib/searchConsole/sync";
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

/** Runs one step; a failure is logged and reported, and the next steps still run. */
async function step<T>(name: string, run: () => Promise<T>): Promise<T | { failed: string }> {
  try {
    return await run();
  } catch (error) {
    console.error(`cron: ${name} failed`, error);
    return { failed: error instanceof Error ? error.message : String(error) };
  }
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await step("checks", runChecks);
  const charges = await step("charges", ensureCharges); // new month → new subscription charges
  const overdueAlerts = await step("overdue alerts", sendOverdueAlerts); // one email when something goes past its due date
  const spikeAlerts = await step("spike alerts", sendSpikeAlerts);
  const pruned = await step("prune", async () => {
    await pruneEvents();
    await pruneLoginTokens();
    return true;
  });
  // Google Search Console, at most twice a day per site. After the response, so a
  // slow first sync (16 months of data) never makes the cron call time out.
  after(() => step("search console", syncDueSearchConsole));
  return Response.json({
    checked: Array.isArray(results) ? results.length : results,
    charges: charges && typeof charges === "object" && "failed" in charges ? charges : undefined,
    overdueAlerts,
    spikeAlerts,
    pruned,
    results,
  });
}

export const GET = handle;
export const POST = handle;
