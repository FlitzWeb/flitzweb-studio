import "server-only";
import { isNull, notInArray, or, type SQL } from "drizzle-orm";
import { events, type Tracker } from "@/db";

/**
 * The events that count for these trackers: for a "server only" tracker, only events sent
 * with the site's secret (POST /api/ingest, which have no browser session). Browser events
 * with that name are left out, since anyone with the public key can send them.
 */
export function countedEvents(trackers: Pick<Tracker, "eventKey" | "serverOnly">[]): SQL | undefined {
  const serverOnly = trackers.filter((t) => t.serverOnly).map((t) => t.eventKey);
  return serverOnly.length ? or(isNull(events.sessionId), notInArray(events.eventKey, serverOnly)) : undefined;
}
