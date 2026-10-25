"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, payments, sites, subscriptionCharges, subscriptions } from "@/db";
import { requireSession } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { parseForm, type FormState } from "@/lib/forms";
import { paymentSchema, subscriptionSchema } from "./schema";

/** Where to go after saving: a hidden "returnTo" field, or /geld. */
const returnTo = (formData: FormData) => {
  const to = String(formData.get("returnTo") ?? "");
  return to.startsWith("/") && !to.startsWith("//") ? to : "/geld";
};

/** The chosen site must belong to the chosen client. */
async function siteMismatch(clientId: number, siteId: number | null, values: Record<string, string>) {
  if (!siteId) return null;
  const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId) });
  if (site?.clientId === clientId) return null;
  return { errors: { siteId: "Deze site hoort niet bij deze klant" }, values, at: Date.now() };
}

const formValues = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));

export async function savePayment(id: number | undefined, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const { data, state } = parseForm(paymentSchema, formData);
  if (state) return state;
  const mismatch = await siteMismatch(data.clientId, data.siteId, formValues(formData));
  if (mismatch) return mismatch;

  if (id) await db.update(payments).set(data).where(eq(payments.id, id));
  else await db.insert(payments).values(data);
  revalidatePath("/", "layout");
  redirect(returnTo(formData));
}

export async function deletePayment(id: number) {
  await requireSession();
  await db.delete(payments).where(eq(payments.id, id));
  revalidatePath("/", "layout");
  redirect("/geld");
}

export async function saveSubscription(
  id: number | undefined,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();
  const { data, state } = parseForm(subscriptionSchema, formData);
  if (state) return state;
  const mismatch = await siteMismatch(data.clientId, data.siteId, formValues(formData));
  if (mismatch) return mismatch;

  if (id) await db.update(subscriptions).set(data).where(eq(subscriptions.id, id));
  else await db.insert(subscriptions).values(data);
  revalidatePath("/", "layout");
  redirect(returnTo(formData));
}

export async function deleteSubscription(id: number) {
  await requireSession();
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  revalidatePath("/", "layout");
  redirect("/geld");
}

/**
 * Marks an invoice or monthly charge as paid today (or un-paid again).
 * A Mollie webhook would do the same with provider "mollie".
 */
export async function setPaid(kind: "invoice" | "charge", id: number, paid: boolean) {
  await requireSession();
  const paidDate = paid ? todayISO() : null;
  const table = kind === "invoice" ? payments : subscriptionCharges;
  await db.update(table).set({ paidDate }).where(eq(table.id, id));
  revalidatePath("/", "layout");
}
