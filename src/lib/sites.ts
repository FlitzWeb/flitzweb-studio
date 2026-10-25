import "server-only";
import { eq } from "drizzle-orm";
import { db, sites } from "@/db";

/** One site with its client and trackers, or undefined. */
export function getSite(id: number) {
  return db.query.sites.findFirst({
    where: eq(sites.id, id),
    with: { client: true, trackers: true },
  });
}

export type SiteWithClient = NonNullable<Awaited<ReturnType<typeof getSite>>>;
