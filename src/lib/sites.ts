import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db, sites } from "@/db";

/** One site with its client and trackers, or undefined. Once per request (layout, page and metadata share it). */
export const getSite = cache((id: number) =>
  db.query.sites.findFirst({
    where: eq(sites.id, id),
    with: { client: true, trackers: true },
  }),
);

export type SiteWithClient = NonNullable<Awaited<ReturnType<typeof getSite>>>;
