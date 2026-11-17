import "server-only";
import { costs, db } from "@/db";
import { todayISO } from "@/lib/dates";
import { getMrrCents } from "../money/queries";
import { isPlanned, isRunning, nextPayment, paidBetween, perMonthCents } from "./schedule";

/** Every cost with its next payment, grouped for the Kosten page, plus totals. */
export async function getCostsOverview() {
  const today = todayISO();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const [rows, mrrCents] = await Promise.all([db.select().from(costs), getMrrCents()]);

  const all = rows.map((c) => ({
    ...c,
    next: nextPayment(c, today),
    running: isRunning(c, today),
    planned: isPlanned(c, today),
    perMonthCents: perMonthCents(c),
    paidTotalCents: paidBetween(c, c.startDate, today),
  }));
  const byNext = (a: (typeof all)[number], b: (typeof all)[number]) => (a.next ?? "9999").localeCompare(b.next ?? "9999");
  // What you pay for now. Monthly costs that start later are "planned" and
  // don't count yet; yearly costs are spread over the year, so they always count.
  const running = all.filter((c) => c.running && !c.planned).sort(byNext);
  const planned = all.filter((c) => c.planned).sort(byNext);
  const perMonth = running.reduce((t, c) => t + c.perMonthCents, 0);
  const upcoming = [...running, ...planned].sort(byNext).find((c) => c.next);

  return {
    running,
    planned,
    plannedPerMonthCents: planned.reduce((t, c) => t + c.perMonthCents, 0),
    oneOff: all.filter((c) => c.interval === "once").sort((a, b) => b.startDate.localeCompare(a.startDate)),
    stopped: all
      .filter((c) => c.interval !== "once" && !c.running)
      .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? "")),
    perMonthCents: perMonth,
    paidThisYearCents: all.reduce((t, c) => t + paidBetween(c, yearStart, today), 0),
    upcoming,
    mrrCents,
    netPerMonthCents: mrrCents - perMonth,
  };
}

export type CostRow = Awaited<ReturnType<typeof getCostsOverview>>["running"][number];
