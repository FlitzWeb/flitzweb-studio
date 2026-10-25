"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, trackers } from "@/db";
import { requireSession } from "@/lib/auth";
import { parseForm, type FormState } from "@/lib/forms";
import { trackerSchema } from "./trackerSchema";

/** Creates or updates a tracker on a site. Bind siteId and trackerId in the form. */
export async function saveTracker(
  siteId: number,
  trackerId: number | undefined,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();
  const { data, state } = parseForm(trackerSchema, formData);
  if (state) return state;

  const clash = await db.query.trackers.findFirst({
    where: and(
      eq(trackers.siteId, siteId),
      eq(trackers.eventKey, data.eventKey),
      trackerId ? ne(trackers.id, trackerId) : undefined,
    ),
  });
  if (clash) {
    return {
      errors: { eventKey: `"${clash.name}" gebruikt deze key al` },
      values: Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)])),
      at: Date.now(),
    };
  }

  if (trackerId) {
    await db.update(trackers).set(data).where(and(eq(trackers.id, trackerId), eq(trackers.siteId, siteId)));
  } else {
    await db.insert(trackers).values({ ...data, siteId });
  }
  revalidatePath("/", "layout");
  redirect(`/sites/${siteId}/tracking`);
}

/** Removes a tracker. Its past events stay in the database (hidden). */
export async function deleteTracker(siteId: number, trackerId: number) {
  await requireSession();
  await db.delete(trackers).where(and(eq(trackers.id, trackerId), eq(trackers.siteId, siteId)));
  revalidatePath("/", "layout");
  redirect(`/sites/${siteId}/tracking`);
}
