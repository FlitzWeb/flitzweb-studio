"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clients, db } from "@/db";
import { requireSession } from "@/lib/auth";
import { parseForm, type FormState } from "@/lib/forms";
import { clientSchema } from "./schema";

/** Creates a client (id undefined) or updates one. Bind the id in the form. */
export async function saveClient(
  id: number | undefined,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();
  const { data, state } = parseForm(clientSchema, formData);
  if (state) return state;

  let clientId = id;
  if (clientId) {
    await db.update(clients).set(data).where(eq(clients.id, clientId));
  } else {
    [{ id: clientId }] = await db
      .insert(clients)
      .values(data)
      .returning({ id: clients.id });
  }
  revalidatePath("/", "layout");
  redirect(`/klanten/${clientId}`);
}

/** Deletes a client and (via cascade) all their sites and checks. */
export async function deleteClient(id: number) {
  await requireSession();
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/", "layout");
  redirect("/klanten");
}
