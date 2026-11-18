import { formatMonth } from "@/lib/dates";
import { formatEuro, formatPct } from "@/lib/format";
import type { ReportPart } from "./parts";
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

export type Highlight = { key: string; label: string; value: string; note?: string | null };

/** The numbers that are not trackers, by the key they are stored under as a site's lead number. */
export const FIXED_HIGHLIGHTS = [
  { key: "visitors", label: "Bezoekers" },
  { key: "views", label: "Pagina's bekeken" },
  { key: "uptime", label: "Bereikbaar" },
] as const;

/** A tracker's highlight key. Prefixed, so an event called "views" cannot be mistaken for the fixed number. */
export const goalKey = (eventKey: string) => `goal:${eventKey}`;

/**
 * The (at most four) numbers the report leads with. Results first: what the
 * site brought in (tracker goals), then visitors, then the supporting figures.
 * `lead` (a highlight key) moves one of them to the front, where the picture
 * gives it the blue tile; without it, or when that number is hidden or zero,
 * the order stays as it is.
 */
export function highlights(s: MonthSummary, hidden: ReadonlySet<ReportPart> = new Set(), lead: string | null = null): Highlight[] {
  const list: Highlight[] = [];
  const change = (current: number, previous: number) => (s.comparable ? changeText(current, previous) : null);
  if (!hidden.has("goals")) {
    list.push(
      ...s.goals
        .filter((g) => g.value > 0)
        // Only two trackers fit: the chosen one is always one of them.
        .sort((a, b) => Number(b.key === lead) - Number(a.key === lead))
        .slice(0, 2)
        .map((g) => ({ key: g.key, label: g.name, value: goalValue(g), note: change(g.value, g.previous) ?? "via de website" })),
    );
  }
  if (!hidden.has("visitors")) {
    list.push({
      key: "visitors",
      label: "Bezoekers",
      value: nl(s.stats.current.visitors),
      note: change(s.stats.current.visitors, s.stats.previous.visitors),
    });
  }
  if (!hidden.has("views")) {
    list.push({ key: "views", label: "Pagina's bekeken", value: nl(s.stats.current.views), note: change(s.stats.current.views, s.stats.previous.views) });
  }
  if (!hidden.has("uptime") && s.uptimePct != null) {
    list.push({ key: "uptime", label: "Bereikbaar", value: `${formatPct(s.uptimePct)}%`, note: "van de tijd online" });
  }
  const at = list.findIndex((h) => h.key === lead);
  if (at > 0) list.unshift(...list.splice(at, 1));
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
