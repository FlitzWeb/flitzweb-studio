"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, reportNotes, sites, trackers } from "@/db";
import { requireSession } from "@/lib/auth";
import { cleanDone, FIXED_HIGHLIGHTS, goalKey } from "./message";
import { REPORT_PARTS } from "./parts";

/** Saves (or, when emptied, removes) the "what I did this month" line for one site and month. */
export async function saveReportNote(siteId: number, month: string, formData: FormData) {
  await requireSession();
  if (!/^\d{4}-\d{2}-01$/.test(month)) return;
  const done = cleanDone(formData.get("gedaan"));
  if (!done) {
    await db.delete(reportNotes).where(and(eq(reportNotes.siteId, siteId), eq(reportNotes.month, month)));
  } else {
    await db
      .insert(reportNotes)
      .values({ siteId, month, done })
      .onConflictDoUpdate({ target: [reportNotes.siteId, reportNotes.month], set: { done, updatedAt: new Date() } });
  }
  revalidatePath(`/sites/${siteId}/maandrapport`);
}

/** Saves which parts show on this site's report (every unticked checkbox is hidden), what the chart counts and which number leads. */
export async function saveReportParts(siteId: number, formData: FormData) {
  await requireSession();
  const shown = new Set(formData.getAll("part").map(String));
  const reportHidden = REPORT_PARTS.map((p) => p.key).filter((k) => !shown.has(k));
  // The chart may follow one of this site's own trackers; anything else means visitors.
  const own = await db.select({ key: trackers.eventKey }).from(trackers).where(eq(trackers.siteId, siteId));
  const wanted = String(formData.get("chart") ?? "");
  const reportChartEvent = own.find((t) => t.key === wanted)?.key ?? null;
  // The lead number is one of this site's trackers or a fixed number; anything else means the default order.
  const lead = String(formData.get("lead") ?? "");
  const reportLead = [...own.map((t) => goalKey(t.key)), ...FIXED_HIGHLIGHTS.map((h) => h.key)].find((k) => k === lead) ?? null;
  await db.update(sites).set({ reportHidden, reportChartEvent, reportLead }).where(eq(sites.id, siteId));
  revalidatePath(`/sites/${siteId}/maandrapport`);
}
