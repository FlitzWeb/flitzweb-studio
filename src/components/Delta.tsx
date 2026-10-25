import { TrendingDown, TrendingUp } from "lucide-react";

const pctFmt = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 });

/**
 * Change pill (▲ 12,4%). `better` says which direction is good news:
 * more visitors is good, a slower response time is not.
 */
export function Delta({
  current,
  previous,
  better = "up",
}: {
  current: number | null | undefined;
  previous: number | null | undefined;
  better?: "up" | "down";
}) {
  if (current == null || !previous) return null;
  const change = ((current - previous) / previous) * 100;
  if (!Number.isFinite(change)) return null;
  const rounded = Math.round(change * 10) / 10;
  const tone = rounded === 0 ? undefined : (rounded > 0) === (better === "up") ? "good" : "bad";
  const Icon = rounded < 0 ? TrendingDown : TrendingUp;

  return (
    <span className="delta" data-tone={tone}>
      {rounded !== 0 && <Icon aria-hidden="true" />}
      <span className="sr-only">{rounded > 0 ? "gestegen met" : rounded < 0 ? "gedaald met" : "gelijk:"}</span>
      {pctFmt.format(Math.abs(rounded))}%
    </span>
  );
}
