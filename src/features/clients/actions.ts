"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clients, contactLog, db } from "@/db";
import { requireSession } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/dates";
import { parseForm, type FormState } from "@/lib/forms";
import { parseLeadSheet } from "./importLeads";
import { clientSchema, contactSchema } from "./schema";
import { isStage, type Stage } from "./stages";

/** Creates a client or lead (id undefined) or updates one. Bind the id in the form. */
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

/** Moves a lead or client to another pipeline stage. */
export async function setStage(id: number, stage: Stage) {
  await requireSession();
  if (!isStage(stage)) return;
  await db
    .update(clients)
    // Nothing to follow up once a lead has dropped out.
    .set(stage === "lost" ? { stage, nextFollowUp: null } : { stage })
    .where(eq(clients.id, id));
  revalidatePath("/", "layout");
}

/** Sets (or clears, with null) when to get in touch again. */
export async function setFollowUp(id: number, date: string | null) {
  await requireSession();
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await db.update(clients).set({ nextFollowUp: date }).where(eq(clients.id, id));
  revalidatePath("/", "layout");
}

const defaultBody = { whatsapp: "WhatsApp gestuurd", phone: "Gebeld", email: "E-mail gestuurd", meeting: "Afspraak gehad", note: "" };

/**
 * Logs a contact moment. Can also plan the next follow-up, and a fresh lead
 * that you just messaged moves to "Benaderd" by itself.
 */
export async function addContact(clientId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const { data, state } = parseForm(contactSchema, formData);
  if (state) return state;
  const body = data.body ?? defaultBody[data.kind];
  if (!body) return { errors: { body: "Schrijf wat er besproken is" }, values: { kind: data.kind }, at: Date.now() };

  const client = await db.query.clients.findFirst({ where: eq(clients.id, clientId) });
  if (!client) return { errors: { body: "Klant niet gevonden" }, at: Date.now() };

  await db.insert(contactLog).values({ clientId, kind: data.kind, body, occurredOn: data.occurredOn });

  const update: Partial<typeof clients.$inferInsert> = {};
  if (data.followUp === "none") update.nextFollowUp = null;
  else if (data.followUp) update.nextFollowUp = addDays(todayISO(), Number(data.followUp));
  if (client.stage === "lead" && data.kind !== "note") update.stage = "contacted";
  if (Object.keys(update).length) await db.update(clients).set(update).where(eq(clients.id, clientId));

  revalidatePath("/", "layout");
  return { at: Date.now() };
}

export async function deleteContact(id: number) {
  await requireSession();
  await db.delete(contactLog).where(eq(contactLog.id, id));
  revalidatePath("/", "layout");
}

export type ImportState = { added?: number; skipped?: number; error?: string };

/** Imports pasted sheet rows as leads. Businesses that already exist (by name) are skipped. */
export async function importLeads(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireSession();
  const { rows } = parseLeadSheet(String(formData.get("sheet") ?? ""));
  if (rows.length === 0) return { error: "Geen rijen gevonden. Plak de cellen uit je sheet, met de kolom Bedrijfsnaam." };
  if (rows.length > 2000) return { error: "Meer dan 2000 rijen in één keer. Plak ze in delen." };

  const existing = await db.select({ name: sql<string>`lower(trim(${clients.name}))` }).from(clients);
  const seen = new Set(existing.map((e) => e.name));
  const fresh = rows.filter((r) => {
    const key = r.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (fresh.length) {
    await db.insert(clients).values(fresh.map((r) => ({ ...r, businessName: r.name, billingType: "paying" as const })));
  }
  revalidatePath("/", "layout");
  return { added: fresh.length, skipped: rows.length - fresh.length };
}
