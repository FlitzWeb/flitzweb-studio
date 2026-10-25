/* eslint-disable @next/next/no-img-element -- tiny SVG, no optimisation needed */

/**
 * The FlitzWeb mark + wordmark. Sized by font-size: the mark is 1.15em,
 * so set `font-size` on the wrapper (or a parent) to scale it.
 */
export function Logo({ className, studio }: { className?: string; studio?: boolean }) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.4em", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}
    >
      <img src="/brand/mark.svg" alt="" style={{ height: "1.15em", width: "auto" }} />
      <span>FlitzWeb</span>
      {studio && (
        <span
          style={{
            marginLeft: "0.1em",
            padding: "0.2em 0.45em",
            borderRadius: 6,
            background: "var(--brand-soft)",
            color: "var(--brand-ink)",
            fontSize: "0.58em",
            fontWeight: 650,
            letterSpacing: 0,
          }}
        >
          Studio
        </span>
      )}
    </span>
  );
}
