// Calendar-date helpers working on "YYYY-MM-DD" strings (Postgres `date`),
// with "today" taken in Amsterdam time.

const isoFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Amsterdam, e.g. "2026-10-25". */
export const todayISO = (now = new Date()) => isoFmt.format(now);

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toISO = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (iso: string, days: number) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
};

/** "2026-10-25" → "2026-10-01" */
export const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;

export const addMonths = (iso: string, months: number) => {
  const d = toDate(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() + months);
  return toISO(d);
};

/** The given day (1–28) in the month of `iso`. */
export const dayInMonth = (iso: string, day: number) =>
  `${iso.slice(0, 7)}-${String(day).padStart(2, "0")}`;

const monthFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** "2026-10-01" → "oktober 2026" */
export const formatMonth = (iso: string) => monthFmt.format(toDate(iso));
