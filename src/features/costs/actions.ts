"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { costs, db } from "@/db";
import { requireSession } from "@/lib/auth";
import { parseForm, type FormState } from "@/lib/forms";
import { costSchema } from "./schema";

export async function saveCost(id: number | undefined, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const { data, state } = parseForm(costSchema, formData);
  if (state) return state;

  if (id) await db.update(costs).set(data).where(eq(costs.id, id));
  else await db.insert(costs).values(data);
  revalidatePath("/", "layout");
  redirect("/kosten");
}

export async function deleteCost(id: number) {
  await requireSession();
  await db.delete(costs).where(eq(costs.id, id));
  revalidatePath("/", "layout");
  redirect("/kosten");
}
