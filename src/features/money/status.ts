import { todayISO } from "@/lib/dates";

export type MoneyStatus = "paid" | "awaiting" | "overdue";

/** Status is derived from dates: paid if there's a paid date, overdue once past due. */
export function moneyStatus(
  item: { paidDate: string | null; dueDate: string },
  today = todayISO(),
): MoneyStatus {
  if (item.paidDate) return "paid";
  return item.dueDate < today ? "overdue" : "awaiting";
}

export const moneyStatusLabels: Record<MoneyStatus, string> = {
  paid: "Betaald",
  awaiting: "Open",
  overdue: "Te laat",
};

/** "24,50" / "24.50" / "1.234,56" / "€ 25" → cents, or null if not a number. */
export function parseEuro(input: string) {
  let s = input.replace(/[€\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

/** 2450 → "24,50" (for form inputs) */
export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
