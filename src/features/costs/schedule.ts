// When a cost is paid, derived from its start date and interval.
// Works on "YYYY-MM-DD" strings, like lib/dates.ts.
import type { Cost } from "@/db";

type Schedule = Pick<Cost, "amountCents" | "interval" | "startDate" | "endDate">;

const MONTHS = { monthly: 1, yearly: 12, once: 0 } as const;

/** `start` moved `months` ahead, keeping its day (31 jan + 1 → 28 feb). */
function shift(start: string, months: number) {
  const [y, m, d] = start.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Payment dates from `from` to `to` (both inclusive). */
export function paymentDates(cost: Schedule, from: string, to: string) {
  const step = MONTHS[cost.interval];
  const last = cost.endDate && cost.endDate < to ? cost.endDate : to;
  const dates: string[] = [];
  for (let k = 0; ; k++) {
    const date = shift(cost.startDate, k * step);
    if (date > last) break;
    if (date >= from) dates.push(date);
    if (step === 0) break;
  }
  return dates;
}

/** Total paid from `from` to `to`. */
export const paidBetween = (cost: Schedule, from: string, to: string) =>
  paymentDates(cost, from, to).length * cost.amountCents;

/** The first payment on or after `today`, or null when there is none. */
export function nextPayment(cost: Schedule, today: string) {
  if (cost.interval === "once") return cost.startDate >= today ? cost.startDate : null;
  // Within a year there is always a payment, unless it starts later or was cancelled.
  const to = cost.startDate > today ? cost.startDate : shift(today, 12);
  return paymentDates(cost, today, to)[0] ?? null;
}

/** Recurring and not cancelled (yet). */
export const isRunning = (cost: Schedule, today: string) =>
  cost.interval !== "once" && (!cost.endDate || cost.endDate >= today);

/** What a recurring cost comes down to per month (yearly / 12). */
export const perMonthCents = (cost: Schedule) =>
  cost.interval === "monthly" ? cost.amountCents : cost.interval === "yearly" ? Math.round(cost.amountCents / 12) : 0;
