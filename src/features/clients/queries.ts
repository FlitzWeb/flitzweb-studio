import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import { clients, contactLog, db } from "@/db";
import { todayISO } from "@/lib/dates";
import { OPEN_STAGES, type Stage } from "./stages";

/** Real clients (stage "client") with their sites, alphabetical. */
export function getClients() {
  return db.query.clients.findMany({
    where: eq(clients.stage, "client"),
    orderBy: asc(clients.name),
    with: {
      sites: { columns: { id: true, name: true, status: true, isUp: true } },
      contactLog: { orderBy: [desc(contactLog.occurredOn), desc(contactLog.id)], limit: 1 },
    },
  });
}

export function getClient(id: number) {
  return db.query.clients.findFirst({ where: eq(clients.id, id) });
}

/** For <select> menus: clients first, then leads. */
export function getClientOptions() {
  return db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(ne(clients.stage, "lost"))
    .orderBy(sql`${clients.stage} <> 'client'`, asc(clients.name));
}

/**
 * Everyone in the pipeline who is not a client yet, with their latest contact
 * moment. Due follow-ups first, then by date, then leads without a date.
 */
export async function getLeads(stages: Stage[] = OPEN_STAGES) {
  const rows = await db.query.clients.findMany({
    where: inArray(clients.stage, stages),
    with: { contactLog: { orderBy: [desc(contactLog.occurredOn), desc(contactLog.id)], limit: 1 } },
  });
  return rows
    .map(({ contactLog: log, ...c }) => ({ ...c, lastContact: log[0] ?? null }))
    .sort(
      (a, b) =>
        (a.nextFollowUp ?? "9999").localeCompare(b.nextFollowUp ?? "9999") || a.name.localeCompare(b.name, "nl"),
    );
}
export type Lead = Awaited<ReturnType<typeof getLeads>>[number];

/** How many businesses sit in each stage. */
export async function getStageCounts() {
  const rows = await db
    .select({ stage: clients.stage, n: sql<number>`count(*)::int` })
    .from(clients)
    .groupBy(clients.stage);
  const counts = { lead: 0, contacted: 0, replied: 0, meeting: 0, client: 0, lost: 0 } as Record<Stage, number>;
  for (const r of rows) counts[r.stage] = r.n;
  return counts;
}

/** Leads and clients whose follow-up date is today or earlier. */
export function getDueFollowUps(today = todayISO()) {
  return db
    .select()
    .from(clients)
    .where(and(isNotNull(clients.nextFollowUp), lte(clients.nextFollowUp, today), ne(clients.stage, "lost")))
    .orderBy(asc(clients.nextFollowUp), asc(clients.name));
}

/** Every contact moment for one client, newest first. */
export function getContactLog(clientId: number) {
  return db
    .select()
    .from(contactLog)
    .where(eq(contactLog.clientId, clientId))
    .orderBy(desc(contactLog.occurredOn), desc(contactLog.id));
}
