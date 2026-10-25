import "server-only";
import { asc, eq } from "drizzle-orm";
import { clients, db } from "@/db";

/** All clients with their sites, alphabetical. */
export function getClients() {
  return db.query.clients.findMany({
    orderBy: asc(clients.name),
    with: { sites: { columns: { id: true, name: true, status: true, isUp: true } } },
  });
}

export function getClient(id: number) {
  return db.query.clients.findFirst({ where: eq(clients.id, id) });
}

/** For <select> menus. */
export function getClientOptions() {
  return db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .orderBy(asc(clients.name));
}
