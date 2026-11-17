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

/** The plain-text update you send the client. Meant to be edited before sending. */
export function summaryMessage(opts: { siteName: string; contactPerson: string | null; month: string; summary: MonthSummary }) {
  const { summary: s } = opts;
  const firstName = opts.contactPerson?.trim().split(/\s+/)[0];
  const change = changeText(s.stats.current.visitors, s.stats.previous.visitors);
  const lines = [
    `Hoi${firstName ? ` ${firstName}` : ""}, hier is het overzicht van ${opts.siteName} over ${formatMonth(opts.month)}:`,
    "",
    `• ${nl(s.stats.current.visitors)} bezoekers${change ? ` (${change})` : ""}`,
    `• ${nl(s.stats.current.views)} pagina's bekeken`,
    ...s.goals.filter((g) => g.value > 0).map((g) => `• ${g.name}: ${goalValue(g)}`),
    s.pages.length ? `• Meest bekeken: ${s.pages.slice(0, 3).map((p) => p.label).join(", ")}` : null,
    s.referrers.length ? `• Bezoekers kwamen vooral via: ${s.referrers.slice(0, 3).map((r) => r.label).join(", ")}` : null,
    s.uptimePct != null ? `• De site was ${formatPct(s.uptimePct)}% van de tijd bereikbaar` : null,
    "",
    "Vragen, of wil je iets aanpassen? Laat het gerust weten.",
    "Groet, FlitzWeb",
  ];
  return lines.filter((l) => l !== null).join("\n");
}
