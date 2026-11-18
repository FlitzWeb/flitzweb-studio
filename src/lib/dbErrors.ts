/** Postgres "relation does not exist": a table from a migration that has not run yet. */
export const isMissingTable = (error: unknown) => {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "42P01" || e?.cause?.code === "42P01";
};
