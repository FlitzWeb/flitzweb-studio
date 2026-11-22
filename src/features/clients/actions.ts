"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clients, contactLog, db } from "@/db";
import { requireSession } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/dates";
import { phoneDigits } from "@/lib/phone";
import { parseForm, type FormState } from "@/lib/forms";
import { parseLeadSheet } from "./importLeads";
import { parseResearchFile, type ResearchLead } from "./importResearch";
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

const defaultBody = { whatsapp: "WhatsApp gestuurd", phone: "Gebeld", email: "E-mail gestuurd", meeting: "Afspraak gehad", visit: "Langs geweest", note: "" };

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

/** A door visit from the Looproute: one tap, and a fresh lead moves to "Benaderd". */
export async function logVisit(clientId: number) {
  await requireSession();
  const client = await db.query.clients.findFirst({ where: eq(clients.id, clientId), columns: { stage: true } });
  if (!client) return;
  await db.insert(contactLog).values({ clientId, kind: "visit", body: defaultBody.visit, occurredOn: todayISO() });
  if (client.stage === "lead") await db.update(clients).set({ stage: "contacted" }).where(eq(clients.id, clientId));
  revalidatePath("/", "layout");
}

export type ResearchImportState = { added?: number; updated?: number; skipped?: number; error?: string };

/**
 * Imports a run of the leads skill. A business that is already here (same Maps
 * place, else same name, else same phone number) only gets the research filled
 * in: its stage, follow-up date, notes and contact log are left alone. Real
 * clients are skipped.
 */
export async function importResearch(_prev: ResearchImportState, formData: FormData): Promise<ResearchImportState> {
  await requireSession();
  const { file, error } = parseResearchFile(String(formData.get("research") ?? ""));
  if (!file) return { error };

  const existing = await db
    .select({
      id: clients.id,
      name: clients.name,
      stage: clients.stage,
      placeId: clients.placeId,
      phone: clients.phone,
      industry: clients.industry,
      address: clients.address,
      email: clients.email,
      instagram: clients.instagram,
      facebook: clients.facebook,
      tiktok: clients.tiktok,
    })
    .from(clients);
  type Known = (typeof existing)[number];
  const key = (name: string) => name.trim().toLowerCase();
  const byPlace = new Map<string, Known>();
  const byName = new Map<string, Known>();
  const byPhone = new Map<string, Known>();
  for (const c of existing) {
    if (c.placeId) byPlace.set(c.placeId, c);
    byName.set(key(c.name), c);
    const digits = phoneDigits(c.phone);
    if (digits) byPhone.set(digits, c);
  }
  // Two branches can share a name or a number: a match on those only counts
  // when it does not point at a different Maps place.
  const samePlace = (c: Known | undefined, lead: ResearchLead) =>
    c && (!c.placeId || !lead.placeId || c.placeId === lead.placeId) ? c : undefined;
  const find = (lead: ResearchLead) => {
    const digits = phoneDigits(lead.phone);
    return (
      (lead.placeId ? byPlace.get(lead.placeId) : undefined) ??
      samePlace(byName.get(key(lead.name)), lead) ??
      samePlace(digits ? byPhone.get(digits) : undefined, lead)
    );
  };

  const research = (lead: ResearchLead) => ({
    websiteStatus: lead.websiteStatus,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    leadScore: lead.score,
    leadTier: lead.tier,
    leadHook: lead.hook,
    leadEvidence: lead.evidence,
    openerDoor: lead.openerDoor,
    openerDm: lead.openerDm,
    openerMail: lead.openerMail,
    websiteUrl: lead.websiteUrl,
    mapsUrl: lead.mapsUrl,
    placeId: lead.placeId,
    leadSource: file.label,
    researchedOn: file.date,
    routeName: lead.routeOrder ? file.routeName : null,
    routeOrder: lead.routeOrder,
  });

  let added = 0;
  let updated = 0;
  let skipped = 0;
  await db.transaction(async (tx) => {
    for (const lead of file.leads) {
      const match = find(lead);
      if (match?.stage === "client") {
        skipped++;
        continue;
      }
      if (match) {
        await tx
          .update(clients)
          .set({
            ...research(lead),
            // Contact details: only where nothing was filled in yet.
            industry: match.industry ?? lead.industry,
            address: match.address ?? lead.address,
            phone: match.phone ?? lead.phone,
            email: match.email ?? lead.email,
            instagram: match.instagram ?? lead.instagram,
            facebook: match.facebook ?? lead.facebook,
            tiktok: match.tiktok ?? lead.tiktok,
          })
          .where(eq(clients.id, match.id));
        match.placeId = lead.placeId ?? match.placeId;
        if (match.placeId) byPlace.set(match.placeId, match);
        updated++;
        continue;
      }
      const [row] = await tx
        .insert(clients)
        .values({
          ...research(lead),
          name: lead.name,
          businessName: lead.name,
          stage: "lead",
          billingType: "paying",
          industry: lead.industry,
          address: lead.address,
          phone: lead.phone,
          email: lead.email,
          instagram: lead.instagram,
          facebook: lead.facebook,
          tiktok: lead.tiktok,
          notes: lead.note,
        })
        .returning({ id: clients.id });
      // Known from here on, so the same business twice in one file is not added twice.
      const fresh: Known = { id: row.id, name: lead.name, stage: "lead", placeId: lead.placeId, phone: lead.phone, industry: lead.industry, address: lead.address, email: lead.email, instagram: lead.instagram, facebook: lead.facebook, tiktok: lead.tiktok };
      if (lead.placeId) byPlace.set(lead.placeId, fresh);
      else byName.set(key(lead.name), fresh);
      added++;
    }
  });
  revalidatePath("/", "layout");
  return { added, updated, skipped };
}
