import { addDays, todayISO } from "@/lib/dates";
import type { Filter } from "./filters";

// Date ranges for the stats pages, in Amsterdam time. Each period also
// knows the previous period of the same length, for comparisons.

export type Unit = "hour" | "day" | "month";
/** A date range plus the active filters: everything a stats query needs. */
export type Period = {
  key: PeriodKey;
  label: string;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  unit: Unit;
  filters: Filter[];
};

export const PERIODS = {
  vandaag: "Vandaag",
  "24u": "24 uur",
  "7d": "7 dagen",
  "30d": "30 dagen",
  "90d": "90 dagen",
  "12m": "12 maanden",
} as const;
export type PeriodKey = keyof typeof PERIODS;

export const isPeriodKey = (k: unknown): k is PeriodKey => typeof k === "string" && k in PERIODS;

/** Midnight at the start of an Amsterdam calendar day, as a real instant. */
export function amsterdamMidnight(iso: string) {
  const guess = new Date(`${iso}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

export function getPeriod(key: PeriodKey = "7d", filters: Filter[] = [], now = new Date()): Period {
  const today = todayISO(now);
  let from: Date;
  let unit: Unit = "day";

  switch (key) {
    case "vandaag":
      from = amsterdamMidnight(today);
      unit = "hour";
      break;
    case "24u":
      from = new Date(now.getTime() - 24 * 3600_000);
      unit = "hour";
      break;
    case "7d":
      from = amsterdamMidnight(addDays(today, -6));
      break;
    case "30d":
      from = amsterdamMidnight(addDays(today, -29));
      break;
    case "90d":
      from = amsterdamMidnight(addDays(today, -89));
      break;
    case "12m": {
      const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - 11);
      from = amsterdamMidnight(d.toISOString().slice(0, 10));
      unit = "month";
      break;
    }
  }

  const length = now.getTime() - from.getTime();
  return {
    key,
    label: PERIODS[key],
    from,
    to: now,
    prevFrom: new Date(from.getTime() - length),
    prevTo: from,
    unit,
    filters,
  };
}
