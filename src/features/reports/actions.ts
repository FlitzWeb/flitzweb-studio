"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, reports } from "@/db";
import { requireSession } from "@/lib/auth";
import type { FormState } from "@/lib/forms";
import { reportSchema } from "./schema";

/**
 * Creates or updates a saved report. The form sends everything as one JSON
 * field ("payload") because funnel steps are a dynamic list.
 */
export async function saveReport(
  siteId: number,
  reportId: number | undefined,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();
  const raw = String(formData.get("payload") ?? "");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { errors: { form: "Ongeldige invoer" }, at: Date.now() };
  }
  const parsed = reportSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { errors: { form: issue.message }, values: { payload: raw }, at: Date.now() };
  }
  const { type, name, params } = parsed.data;

  if (reportId) {
    await db
      .update(reports)
      .set({ type, name, params })
      .where(and(eq(reports.id, reportId), eq(reports.siteId, siteId)));
  } else {
    await db.insert(reports).values({ siteId, type, name, params });
  }
  revalidatePath("/", "layout");
  redirect(`/sites/${siteId}/rapporten`);
}

export async function deleteReport(siteId: number, reportId: number) {
  await requireSession();
  await db.delete(reports).where(and(eq(reports.id, reportId), eq(reports.siteId, siteId)));
  revalidatePath("/", "layout");
  redirect(`/sites/${siteId}/rapporten`);
}
