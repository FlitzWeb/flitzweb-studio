"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, sites } from "@/db";
import { requireSession } from "@/lib/auth";
import { parseForm, type FormState } from "@/lib/forms";
import { newIngestSecret, newPublicKey } from "@/lib/keys";
import { siteSchema } from "./schema";

/** Creates a site (id undefined) or updates one. Bind the id in the form. */
export async function saveSite(
  id: number | undefined,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();
  const { data, state } = parseForm(siteSchema, formData);
  if (state) return state;
  const values = { ...data, url: data.url! };

  let siteId = id;
  if (siteId) {
    const before = await db.query.sites.findFirst({ where: eq(sites.id, siteId) });
    // A new URL is a different site as far as monitoring goes: start fresh.
    const reset =
      before && before.url !== values.url
        ? { isUp: null, downSince: null, sslAlertSent: false }
        : {};
    await db.update(sites).set({ ...values, ...reset }).where(eq(sites.id, siteId));
  } else {
    [{ id: siteId }] = await db
      .insert(sites)
      .values({ ...values, publicKey: newPublicKey(), ingestSecret: newIngestSecret() })
      .returning({ id: sites.id });
  }
  revalidatePath("/", "layout");
  redirect(`/sites/${siteId}`);
}

export async function deleteSite(id: number) {
  await requireSession();
  const [deleted] = await db
    .delete(sites)
    .where(eq(sites.id, id))
    .returning({ clientId: sites.clientId });
  revalidatePath("/", "layout");
  redirect(deleted ? `/klanten/${deleted.clientId}` : "/");
}
