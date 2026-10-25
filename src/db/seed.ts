// Seeds the starting clients and sites. Safe to run more than once:
// existing clients (matched by name) are left alone.
// Run with `npm run db:seed`.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { newIngestSecret, newPublicKey } from "../lib/keys";
import * as schema from "./schema";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(sql, { schema, casing: "snake_case" });

type SeedClient = typeof schema.clients.$inferInsert & {
  sites: (Omit<typeof schema.sites.$inferInsert, "clientId" | "publicKey" | "ingestSecret"> & {
    trackers?: Omit<typeof schema.trackers.$inferInsert, "siteId">[];
  })[];
};

const seed: SeedClient[] = [
  {
    name: "FlitzWeb",
    businessName: "FlitzWeb",
    email: "info@flitzweb.nl",
    preferredChannel: "email",
    billingType: "no_billing",
    notes: "Eigen site.",
    sites: [
      {
        name: "FlitzWeb",
        url: "https://flitzweb.nl",
        hosting: "vercel",
        status: "live",
      },
    ],
  },
  {
    name: "Hakiki Döner",
    businessName: "Hakiki Döner",
    billingType: "no_billing",
    notes: "Restaurant van papa. Gratis gebouwd als case study.",
    sites: [
      {
        name: "Hakiki Döner",
        url: "https://hakiki.nl",
        hosting: "vercel",
        status: "live",
        trackers: [
          { name: "Bestellingen", eventKey: "order_placed", aggregation: "count" },
        ],
      },
    ],
  },
];

async function main() {
  for (const { sites, ...client } of seed) {
    const existing = await db.query.clients.findFirst({
      where: eq(schema.clients.name, client.name),
    });
    if (existing) {
      console.log(`- ${client.name} bestaat al, overgeslagen`);
      continue;
    }

    const [{ id: clientId }] = await db
      .insert(schema.clients)
      .values(client)
      .returning({ id: schema.clients.id });

    for (const { trackers = [], ...site } of sites) {
      const [{ id: siteId }] = await db
        .insert(schema.sites)
        .values({ ...site, clientId, publicKey: newPublicKey(), ingestSecret: newIngestSecret() })
        .returning({ id: schema.sites.id });

      if (trackers.length) {
        await db
          .insert(schema.trackers)
          .values(trackers.map((t) => ({ ...t, siteId })));
      }
    }
    console.log(`+ ${client.name}`);
  }
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
