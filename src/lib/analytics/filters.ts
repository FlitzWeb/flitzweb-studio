import { sql, type SQL } from "drizzle-orm";
import { FILTER_FIELDS, type Filter } from "./filterFields";

export * from "./filterFields";

function condition(column: SQL, f: Filter) {
  switch (f.op) {
    case "eq":
      return sql`${column} = ${f.value}`;
    case "neq":
      return sql`${column} is distinct from ${f.value}`;
    case "c":
      return sql`${column} ilike ${`%${f.value}%`}`;
    case "dnc":
      return sql`coalesce(${column}, '') not ilike ${`%${f.value}%`}`;
  }
}

/**
 * SQL to append to a WHERE clause on the events table (` and …`).
 * `alias` is the events table alias in that query, if any.
 */
export function filterSql(filters: Filter[], alias?: string): SQL {
  if (!filters.length) return sql``;
  const prefix = alias ? `${alias}.` : "";
  const parts = filters.map((f) => {
    const def = FILTER_FIELDS[f.field];
    if (def.on === "event") return condition(sql.raw(`${prefix}${def.column}`), f);
    return sql`exists (select 1 from sessions fs where fs.id = ${sql.raw(`${prefix}session_id`)} and ${condition(sql.raw(`fs.${def.column}`), f)})`;
  });
  return sql` and ${sql.join(parts, sql` and `)}`;
}
