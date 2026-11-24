"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, searchStats, sites } from "@/db";
import { requireSession } from "@/lib/auth";
import { listProperties } from "@/lib/searchConsole/google";
import { syncSearchConsole } from "@/lib/searchConsole/sync";

const path = (siteId: number) => `/sites/${siteId}/google`;

/**
 * Links a site to a Search Console property and fetches its data right away
 * (16 months the first time). Linking a different property clears the old data;
 * an empty choice unlinks and keeps what was fetched.
 */
export async function linkSearchProperty(siteId: number, formData: FormData) {
  await requireSession();
  const property = String(formData.get("property") ?? "");
  const [site] = await db.select({ gscProperty: sites.gscProperty }).from(sites).where(eq(sites.id, siteId));
  if (!site) return;

  if (!property) {
    await db.update(sites).set({ gscProperty: null, gscError: null }).where(eq(sites.id, siteId));
    revalidatePath(path(siteId));
    return;
  }
  // Only a property the service account can actually read.
  if (!(await listProperties()).some((p) => p.siteUrl === property)) return;
  if (property !== site.gscProperty) {
    await db.delete(searchStats).where(eq(searchStats.siteId, siteId));
    await db.update(sites).set({ gscProperty: property, gscSyncedAt: null, gscError: null }).where(eq(sites.id, siteId));
  }
  try {
    await syncSearchConsole({ id: siteId, gscProperty: property });
  } catch {
    // Kept on the site (gsc_error) and shown on the tab.
  }
  revalidatePath(path(siteId));
}

/** "Nu ophalen": fetches the latest days now instead of waiting for the cron. */
export async function syncSearchNow(siteId: number) {
  await requireSession();
  const [site] = await db.select({ id: sites.id, gscProperty: sites.gscProperty }).from(sites).where(eq(sites.id, siteId));
  if (!site?.gscProperty) return;
  try {
    await syncSearchConsole(site);
  } catch {
    // Kept on the site (gsc_error) and shown on the tab.
  }
  revalidatePath(path(siteId));
}
