// The parts of the monthly report picture you can switch on and off per site.
export const REPORT_PARTS = [
  { key: "goals", label: "Resultaten", hint: "Je trackers, zoals afspraken of WhatsApp-klikken" },
  { key: "visitors", label: "Bezoekers", hint: "Aantal bezoekers, met het verschil t.o.v. de maand ervoor" },
  { key: "views", label: "Pagina's bekeken", hint: "Totaal aantal bekeken pagina's" },
  { key: "uptime", label: "Bereikbaar", hint: "Hoeveel procent van de tijd de site online was" },
  { key: "chart", label: "Bezoekers per dag", hint: "Het staafdiagram" },
  { key: "pages", label: "Meest bekeken pagina's", hint: "Valt vanzelf weg als de site maar één pagina heeft" },
  { key: "sources", label: "Waar bezoekers vandaan kwamen", hint: "Google, Instagram, …" },
] as const;

export type ReportPart = (typeof REPORT_PARTS)[number]["key"];

const KEYS = new Set<string>(REPORT_PARTS.map((p) => p.key));

/** The stored list (anything unknown ignored) as a set of hidden parts. */
export const hiddenParts = (stored: unknown) =>
  new Set((Array.isArray(stored) ? stored : []).filter((k): k is ReportPart => typeof k === "string" && KEYS.has(k)));
