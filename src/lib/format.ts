// Display helpers. Everything is shown in Dutch, in Amsterdam time.

const TZ = "Europe/Amsterdam";

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});

const euroFmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const relFmt = new Intl.RelativeTimeFormat("nl", { numeric: "auto" });

export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));
export const formatDateTime = (d: Date | string) =>
  dateTimeFmt.format(new Date(d));
export const formatTime = (d: Date | string) => timeFmt.format(new Date(d));

/** Money is stored as integer cents. */
export const formatEuro = (cents: number) => euroFmt.format(cents / 100);

/** "3 minuten geleden", "gisteren", ... */
export function formatRelative(d: Date | string, now = new Date()) {
  const seconds = Math.round((new Date(d).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "zojuist";
  if (abs < 3600) return relFmt.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relFmt.format(Math.round(seconds / 3600), "hour");
  return relFmt.format(Math.round(seconds / 86400), "day");
}

/** "2 u 14 min", "35 min" */
export function formatDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} u ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} dagen`;
}

export const daysUntil = (d: Date | string, now = new Date()) =>
  Math.floor((new Date(d).getTime() - now.getTime()) / 86400000);

export const displayHost = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** 100 → "100", 99.93 → "99,93", 97.5 → "97,5" */
export const formatPct = (pct: number) =>
  pct >= 99.995 ? "100" : pct.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
