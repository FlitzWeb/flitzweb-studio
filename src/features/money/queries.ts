import "server-only";
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { clients, db, payments, sites, subscriptionCharges, subscriptions } from "@/db";
import { addDays, formatMonth, monthStart, todayISO } from "@/lib/dates";
import { ensureCharges } from "./charges";
import { moneyStatus, type MoneyStatus } from "./status";

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
};

type Filter = { clientId?: number; unpaid?: boolean; paidFrom?: string };

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
      filter.paidFrom ? gte(paidDate, filter.paidFrom) : undefined,
    );

  const [invoices, charges] = await Promise.all([
    db
      .select({ p: payments, clientName: clients.name, siteName: sites.name })
      .from(payments)
      .innerJoin(clients, eq(clients.id, payments.clientId))
      .leftJoin(sites, eq(sites.id, payments.siteId))
      .where(conditions(payments.paidDate, payments.clientId)),
    db
      .select({ c: subscriptionCharges, s: subscriptions, clientName: clients.name, siteName: sites.name })
      .from(subscriptionCharges)
      .innerJoin(subscriptions, eq(subscriptions.id, subscriptionCharges.subscriptionId))
      .innerJoin(clients, eq(clients.id, subscriptions.clientId))
      .leftJoin(sites, eq(sites.id, subscriptions.siteId))
      .where(conditions(subscriptionCharges.paidDate, subscriptions.clientId)),
  ]);

  const items: MoneyItem[] = [
    ...invoices.map(({ p, clientName, siteName }) => ({
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
    })),
    ...charges.map(({ c, s, clientName, siteName }) => ({
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
    })),
  ];
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Subscriptions with client + site names. Active ones first. */
export async function getSubscriptions(filter: { clientId?: number; activeOnly?: boolean } = {}) {
  const rows = await db
    .select({ s: subscriptions, clientName: clients.name, siteName: sites.name })
    .from(subscriptions)
    .innerJoin(clients, eq(clients.id, subscriptions.clientId))
    .leftJoin(sites, eq(sites.id, subscriptions.siteId))
    .where(
      and(
        paying,
        filter.clientId ? eq(subscriptions.clientId, filter.clientId) : undefined,
        filter.activeOnly ? isRunning() : undefined,
      ),
    );
  return rows
    .map(({ s, clientName, siteName }) => ({ ...s, clientName, siteName, running: isRunningNow(s) }))
    .sort((a, b) => Number(b.running) - Number(a.running) || a.clientName.localeCompare(b.clientName, "nl"));
}

// A subscription counts towards MRR when it's active and today is within its dates.
const isRunning = () => {
  const today = todayISO();
  return and(
    eq(subscriptions.active, true),
    lte(subscriptions.startDate, today),
    or(isNull(subscriptions.endDate), gte(subscriptions.endDate, today)),
  );
};
const isRunningNow = (s: { active: boolean; startDate: string; endDate: string | null }) => {
  const today = todayISO();
  return s.active && s.startDate <= today && (!s.endDate || s.endDate >= today);
};

/** Monthly recurring revenue: running subscriptions of paying clients. */
export async function getMrrCents() {
  const [mrr] = await db
    .select({ cents: sql<number>`coalesce(sum(${subscriptions.amountCents}), 0)`.mapWith(Number) })
    .from(subscriptions)
    .innerJoin(clients, eq(clients.id, subscriptions.clientId))
    .where(and(paying, isRunning()));
  return mrr.cents;
}

/** Totals for the Geld page. */
export async function getMoneySummary() {
  const today = todayISO();
  const [outstanding, paidThisMonth, mrrCents, recentPaid] = await Promise.all([
    getMoneyItems({ unpaid: true }),
    getMoneyItems({ paidFrom: monthStart(today) }),
    getMrrCents(),
    getMoneyItems({ paidFrom: addDays(today, -90) }),
  ]);

  const sum = (items: MoneyItem[]) => items.reduce((t, i) => t + i.amountCents, 0);
  return {
    outstanding,
    awaitingCents: sum(outstanding.filter((i) => i.status === "awaiting")),
    overdueCents: sum(outstanding.filter((i) => i.status === "overdue")),
    overdueCount: outstanding.filter((i) => i.status === "overdue").length,
    mrrCents,
    paidThisMonthCents: sum(paidThisMonth),
    recentPaid: recentPaid
      .filter((i) => i.paidDate)
      .sort((a, b) => b.paidDate!.localeCompare(a.paidDate!))
      .slice(0, 10),
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
    .where(paying)
    .orderBy(clients.name);
}
