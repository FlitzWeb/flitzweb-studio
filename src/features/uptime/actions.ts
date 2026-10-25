"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { runChecks } from "@/lib/uptime/run";

/** "Check nu": checks all live sites, or one site when an id is given. */
export async function checkNow(siteId?: number) {
  await requireSession();
  await runChecks(siteId ? [siteId] : undefined);
  revalidatePath("/", "layout");
}
