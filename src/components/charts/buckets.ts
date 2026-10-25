// Labels for chart buckets. Bucket strings are Amsterdam wall-clock time
// ("2026-10", "2026-10-25", "2026-10-25 14:00"); they're parsed as UTC and
// formatted in UTC so they show unchanged.

export type Unit = "hour" | "day" | "month";

const fmt: Record<Unit, Intl.DateTimeFormat> = {
  hour: new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" }),
  day: new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", day: "numeric", month: "short" }),
  month: new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", month: "short", year: "2-digit" }),
};

const toDate = (b: string) =>
  new Date(
    b.length === 7 ? `${b}-01T00:00:00Z` : b.length === 10 ? `${b}T00:00:00Z` : `${b.replace(" ", "T")}:00Z`,
  );

export const bucketLabel = (unit: Unit) => (b: string) => fmt[unit].format(toDate(b));
