import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Reuse one connection pool across hot reloads in dev.
const globalForDb = globalThis as unknown as { pg?: postgres.Sql };

const client =
  globalForDb.pg ??
  postgres(process.env.DATABASE_URL!, {
    // Neon's pooled connection string runs through PgBouncer,
    // which does not support prepared statements.
    prepare: false,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export * from "./schema";
