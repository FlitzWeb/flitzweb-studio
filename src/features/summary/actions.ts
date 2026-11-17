"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, reportNotes, sites, trackers } from "@/db";
import { requireSession } from "@/lib/auth";
import { cleanDone } from "./message";
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

/** Saves which parts show on this site's report: every unticked checkbox is hidden. */
export async function saveReportParts(siteId: number, formData: FormData) {
  await requireSession();
  const shown = new Set(formData.getAll("part").map(String));
  const reportHidden = REPORT_PARTS.map((p) => p.key).filter((k) => !shown.has(k));
  // The chart may follow one of this site's own trackers; anything else means visitors.
  const wanted = String(formData.get("chart") ?? "");
  const [tracker] = wanted
    ? await db.select({ key: trackers.eventKey }).from(trackers).where(and(eq(trackers.siteId, siteId), eq(trackers.eventKey, wanted)))
    : [];
  await db.update(sites).set({ reportHidden, reportChartEvent: tracker?.key ?? null }).where(eq(sites.id, siteId));
  revalidatePath(`/sites/${siteId}/maandrapport`);
}
