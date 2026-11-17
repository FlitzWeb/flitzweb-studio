import { formatMonth } from "@/lib/dates";
import { formatEuro, formatPct } from "@/lib/format";
import type { MonthSummary } from "./queries";

const nl = (n: number) => n.toLocaleString("nl-NL");

/** "+12% t.o.v. de maand ervoor", or nothing when there is nothing to compare with. */
export function changeText(current: number, previous: number) {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "gelijk aan de maand ervoor";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% t.o.v. de maand ervoor`;
}

export const goalValue = (g: MonthSummary["goals"][number]) =>
  g.aggregation === "sum" ? formatEuro(Math.round(g.value * 100)) : nl(g.value);

export type Highlight = { label: string; value: string; note?: string | null };

/**
 * The (at most four) numbers the report leads with. Results first: what the
 * site brought in (tracker goals), then visitors, then the supporting figures.
 */
export function highlights(s: MonthSummary): Highlight[] {
  const list: Highlight[] = [
    ...s.goals
      .filter((g) => g.value > 0)
      .slice(0, 2)
      .map((g) => ({ label: g.name, value: goalValue(g), note: "via de website" })),
    {
      label: "Bezoekers",
      value: nl(s.stats.current.visitors),
      note: changeText(s.stats.current.visitors, s.stats.previous.visitors),
    },
    { label: "Pagina's bekeken", value: nl(s.stats.current.views), note: changeText(s.stats.current.views, s.stats.previous.views) },
  ];
  if (s.uptimePct != null) list.push({ label: "Bereikbaar", value: `${formatPct(s.uptimePct)}%`, note: "van de tijd online" });
  return list.slice(0, 4);
}

/** Max length of the "what I did this month" line on the report. */
export const DONE_MAX = 220;
export const cleanDone = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, DONE_MAX) : "");

/** The short personal line that goes with the report image. Meant to be edited before sending. */
export function summaryMessage(opts: { siteName: string; contactPerson: string | null; month: string }) {
  const firstName = opts.contactPerson?.trim().split(/\s+/)[0];
  return `Hoi${firstName ? ` ${firstName}` : ""}, hier is het overzicht van ${opts.siteName} over ${formatMonth(opts.month)}. Laat het gerust weten als je vragen hebt of iets wilt aanpassen. Groet, FlitzWeb`;
}
