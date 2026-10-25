import "server-only";
import { lt } from "drizzle-orm";
import { db, events } from "@/db";

const KEEP_DAYS = 400; // a bit over a year, enough for year-on-year comparisons

export async function pruneEvents() {
  await db.delete(events).where(lt(events.occurredAt, new Date(Date.now() - KEEP_DAYS * 86400000)));
}
