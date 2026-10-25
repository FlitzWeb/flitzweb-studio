// Filter definitions, shared by the browser (filter bar) and the server.
// Filters live in the URL as ?f=<field>:<op>:<value>, e.g.
// ?f=land:eq:NL&f=pad:c:/prijzen.
//   eq = is, neq = is not, c = contains, dnc = does not contain
// Event fields filter the events themselves; session fields keep only
// events from visitors with that property. The SQL is in ./filters.ts.

export const FILTER_FIELDS = {
  pad: { label: "Pagina", column: "path", on: "event" },
  titel: { label: "Paginatitel", column: "title", on: "event" },
  verwijzer: { label: "Verwijzer", column: "referrer", on: "event" },
  event: { label: "Event", column: "event_key", on: "event" },
  bron: { label: "UTM-bron", column: "utm_source", on: "event" },
  medium: { label: "UTM-medium", column: "utm_medium", on: "event" },
  campagne: { label: "UTM-campagne", column: "utm_campaign", on: "event" },
  tag: { label: "Tag", column: "tag", on: "event" },
  browser: { label: "Browser", column: "browser", on: "session" },
  systeem: { label: "Systeem", column: "os", on: "session" },
  apparaat: { label: "Apparaat", column: "device", on: "session" },
  scherm: { label: "Scherm", column: "screen", on: "session" },
  taal: { label: "Taal", column: "language", on: "session" },
  land: { label: "Land", column: "country", on: "session" },
  regio: { label: "Regio", column: "region", on: "session" },
  stad: { label: "Stad", column: "city", on: "session" },
  id: { label: "Bezoeker-id", column: "distinct_id", on: "session" },
} as const;

export type FilterField = keyof typeof FILTER_FIELDS;
export const OPERATORS = { eq: "is", neq: "is niet", c: "bevat", dnc: "bevat niet" } as const;
export type Operator = keyof typeof OPERATORS;
export type Filter = { field: FilterField; op: Operator; value: string };

/** Reads ?f=… params. Invalid entries are ignored. */
export function parseFilters(searchParams: Record<string, string | string[] | undefined>): Filter[] {
  const raw = searchParams.f;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.flatMap((entry) => {
    const [field, op, ...rest] = entry.split(":");
    const value = rest.join(":");
    if (!(field in FILTER_FIELDS) || !(op in OPERATORS) || !value) return [];
    return [{ field: field as FilterField, op: op as Operator, value }];
  });
}

export const filterParam = (f: Filter) => `${f.field}:${f.op}:${f.value}`;
