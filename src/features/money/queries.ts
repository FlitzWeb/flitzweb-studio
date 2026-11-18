import "server-only";
import { and, eq, gte, isNull, or } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { clients, db, payments, sites, subscriptionCharges, subscriptions } from "@/db";
import { addDays, addMonths, diffDays, formatMonth, monthStart, todayISO } from "@/lib/dates";
import { formatEuro } from "@/lib/format";
import { ensureCharges } from "./charges";
import { moneyStatus, type MoneyStatus } from "./status";
import { payingFrom, subscriptionState, type SubscriptionState } from "./subscriptionState";

/** An invoice or a monthly subscription charge, in one shape for lists and totals. */
export type MoneyItem = {
  kind: "invoice" | "charge";
  id: number;
  clientId: number;
  clientName: string;
  siteName: string | null;
  description: string;
  amountCents: number;
  dueDate: string;
  paidDate: string | null;
  status: MoneyStatus;
  editHref: string;
  paymentUrl: string | null;
  /** Days past the due date (0 when not late or already paid). */
  daysLate: number;
  /** The "this is overdue" email to yourself already went out. */
  alertSent: boolean;
  /** How to reach the client, for payment reminders. */
  contact: {
    contactPerson: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    preferredChannel: "phone" | "whatsapp" | "email" | null;
  };
};

type Filter = { clientId?: number; unpaid?: boolean };

// `no_billing` clients (family, pro bono) are left out of everything here.
const paying = eq(clients.billingType, "paying");

/** All invoices and charges matching the filter. Generates due charges first. */
export async function getMoneyItems(filter: Filter = {}): Promise<MoneyItem[]> {
  await ensureCharges();
  const today = todayISO();

  const conditions = (paidDate: PgColumn, clientId: PgColumn) =>
    and(
      paying,
      filter.clientId ? eq(clientId, filter.clientId) : undefined,
      filter.unpaid ? isNull(paidDate) : undefined,
    );

  const contact = {
    contactPerson: clients.contactPerson,
    phone: clients.phone,
    whatsapp: clients.whatsapp,
    email: clients.email,
    preferredChannel: clients.preferredChannel,
  };
  const daysLate = (i: { paidDate: string | null; dueDate: string }) =>
    i.paidDate ? 0 : Math.max(0, diffDays(i.dueDate, today));

  const [invoices, charges] = await Promise.all([
    db
      .select({ p: payments, clientName: clients.name, siteName: sites.name, contact })
      .from(payments)
      .innerJoin(clients, eq(clients.id, payments.clientId))
      .leftJoin(sites, eq(sites.id, payments.siteId))
      .where(conditions(payments.paidDate, payments.clientId)),
    db
      .select({ c: subscriptionCharges, s: subscriptions, clientName: clients.name, siteName: sites.name, contact })
      .from(subscriptionCharges)
      .innerJoin(subscriptions, eq(subscriptions.id, subscriptionCharges.subscriptionId))
      .innerJoin(clients, eq(clients.id, subscriptions.clientId))
      .leftJoin(sites, eq(sites.id, subscriptions.siteId))
      .where(conditions(subscriptionCharges.paidDate, subscriptions.clientId)),
  ]);

  const items: MoneyItem[] = [
    ...invoices.map(({ p, clientName, siteName, contact }) => ({
      kind: "invoice" as const,
      id: p.id,
      clientId: p.clientId,
      clientName,
      siteName,
      description: p.description,
      amountCents: p.amountCents,
      dueDate: p.dueDate,
      paidDate: p.paidDate,
      status: moneyStatus(p, today),
      editHref: `/geld/facturen/${p.id}`,
      paymentUrl: p.paymentUrl,
      daysLate: daysLate(p),
      alertSent: p.overdueAlertSent,
      contact,
    })),
    ...charges.map(({ c, s, clientName, siteName, contact }) => ({
      kind: "charge" as const,
      id: c.id,
      clientId: s.clientId,
      clientName,
      siteName,
      description: `${s.description} · ${formatMonth(c.period)}`,
      amountCents: c.amountCents,
      dueDate: c.dueDate,
      paidDate: c.paidDate,
      status: moneyStatus(c, today),
      editHref: `/geld/abonnementen/${s.id}`,
      paymentUrl: null,
      daysLate: daysLate(c),
      alertSent: c.overdueAlertSent,
      contact,
    })),
  ];
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

const stateOrder: Record<SubscriptionState, number> = { running: 0, free: 1, upcoming: 2, stopped: 3 };

/**
 * Subscriptions with client + site names and their current state.
 * `current` leaves out stopped/ended ones but keeps upcoming and free ones.
 */
export async function getSubscriptions(filter: { clientId?: number; current?: boolean } = {}) {
  const today = todayISO();
  const rows = await db
    .select({ s: subscriptions, clientName: clients.name, siteName: sites.name })
    .from(subscriptions)
    .innerJoin(clients, eq(clients.id, subscriptions.clientId))
    .leftJoin(sites, eq(sites.id, subscriptions.siteId))
    .where(
      and(
        paying,
        filter.clientId ? eq(subscriptions.clientId, filter.clientId) : undefined,
        filter.current
          ? and(eq(subscriptions.active, true), or(isNull(subscriptions.endDate), gte(subscriptions.endDate, today)))
          : undefined,
      ),
    );
  return rows
    .map(({ s, clientName, siteName }) => ({
      ...s,
      clientName,
      siteName,
      state: subscriptionState(s, today),
      payingFrom: payingFrom(s),
    }))
    .sort(
      (a, b) =>
        stateOrder[a.state] - stateOrder[b.state] ||
        a.startDate.localeCompare(b.startDate) ||
        a.clientName.localeCompare(b.clientName, "nl"),
    );
}

type Sub = Awaited<ReturnType<typeof getSubscriptions>>[number];

/**
 * Monthly recurring revenue: the subscriptions that are being charged right
 * now (not upcoming, not in a free month, not stopped).
 */
export const mrrOf = (subs: Sub[]) =>
  subs.filter((s) => s.state === "running").reduce((t, s) => t + s.amountCents, 0);

/**
 * What is not in the MRR yet but will be: subscriptions still in a free month
 * or with a start date ahead. `from` is the first month one of them is charged.
 */
export function startingLater(subs: Sub[]) {
  const later = subs.filter((s) => s.state === "free" || s.state === "upcoming");
  return {
    cents: later.reduce((t, s) => t + s.amountCents, 0),
    from: later.map((s) => s.payingFrom).sort()[0] ?? null,
  };
}
export type StartingLater = ReturnType<typeof startingLater>;

/** "€ 30,00 erbij vanaf december 2026", or null when nothing is waiting to start. */
export const startingLaterText = (later: StartingLater) =>
  later.cents > 0 && later.from ? `${formatEuro(later.cents)} erbij vanaf ${formatMonth(later.from)}` : null;

/** Totals for the Geld page. */
export async function getMoneySummary() {
  const today = todayISO();
  // One read of everything; the lists below are slices of it. (This used to be
  // three separate reads, each of which also re-ran the charge generation.)
  const [items, subs] = await Promise.all([getMoneyItems(), getSubscriptions({ current: true })]);
  const outstanding = items.filter((i) => !i.paidDate);
  const paidSince = (from: string) => items.filter((i) => i.paidDate && i.paidDate >= from);
  const paidThisMonth = paidSince(monthStart(today));
  const recentPaid = paidSince(addDays(today, -90));
  // Everything that should come in this month: already paid, plus what is
  // still open and due before the month ends (older late items included).
  const nextMonth = addMonths(today, 1);

  const sum = (items: MoneyItem[]) => items.reduce((t, i) => t + i.amountCents, 0);
  return {
    outstanding,
    awaitingCents: sum(outstanding.filter((i) => i.status === "awaiting")),
    overdueCents: sum(outstanding.filter((i) => i.status === "overdue")),
    overdueCount: outstanding.filter((i) => i.status === "overdue").length,
    mrrCents: mrrOf(subs),
    startingLater: startingLater(subs),
    paidThisMonthCents: sum(paidThisMonth),
    expectedThisMonthCents: sum(paidThisMonth) + sum(outstanding.filter((i) => i.dueDate < nextMonth)),
    recentPaid: recentPaid.sort((a, b) => b.paidDate!.localeCompare(a.paidDate!)).slice(0, 10),
  };
}

/** Sites for the optional "site" select in money forms. */
export function getSiteOptions() {
  return db
    .select({ id: sites.id, name: sites.name, clientId: sites.clientId, clientName: clients.name })
    .from(sites)
    .innerJoin(clients, eq(clients.id, sites.clientId))
    .where(paying)
    .orderBy(clients.name, sites.name);
}

/** Paying clients only, for the "client" select in money forms. */
export function getPayingClientOptions() {
  return db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(paying, eq(clients.stage, "client")))
    .orderBy(clients.name);
}
