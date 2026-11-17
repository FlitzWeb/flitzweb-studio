import { addMonths, monthStart } from "@/lib/dates";

type SubDates = {
  active: boolean;
  startDate: string;
  endDate: string | null;
  freeMonths: number;
};

/**
 * - upcoming: start date is still in the future
 * - free:     started, but still inside its free months
 * - running:  started and being charged
 * - stopped:  switched off, or past its end date
 */
export type SubscriptionState = "upcoming" | "free" | "running" | "stopped";

/** First month (YYYY-MM-01) that gets a charge, after the free months. */
export const payingFrom = (s: Pick<SubDates, "startDate" | "freeMonths">) =>
  addMonths(monthStart(s.startDate), s.freeMonths);

export function subscriptionState(s: SubDates, today: string): SubscriptionState {
  if (!s.active || (s.endDate && s.endDate < today)) return "stopped";
  if (s.startDate > today) return "upcoming";
  if (monthStart(today) < payingFrom(s)) return "free";
  return "running";
}
