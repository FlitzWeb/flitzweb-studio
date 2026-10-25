/* eslint-disable @next/next/no-img-element -- tiny SVGs, no optimisation needed */

/** The FlitzWeb lockup; swaps to the light-on-dark version in dark mode. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={className} style={{ display: "inline-block" }}>
      <img
        src="/brand/lockup.svg"
        alt="FlitzWeb"
        className="logo-light"
        style={{ height: "100%", width: "auto" }}
      />
      <img
        src="/brand/lockup-dark.svg"
        alt="FlitzWeb"
        className="logo-dark"
        style={{ height: "100%", width: "auto" }}
      />
    </span>
  );
}
