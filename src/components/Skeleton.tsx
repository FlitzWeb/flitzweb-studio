import styles from "./Skeleton.module.css";

/**
 * Placeholder panels shown the moment you click, while the server renders the page.
 * `data-skeleton` tells PageMotion to wait for the real content before animating.
 */
export function PageSkeleton({ head = true }: { head?: boolean }) {
  return (
    <div className={styles.page} data-skeleton aria-busy="true" aria-label="Laden">
      {head && <div className={styles.title} />}
      <div className={styles.panel} data-size="lg" />
      <div className={styles.columns}>
        <div className={styles.panel} />
        <div className={styles.panel} />
      </div>
    </div>
  );
}

/** A smaller placeholder for one section that loads on its own (a Suspense fallback). */
export function PanelSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.inline} aria-busy="true" aria-label="Laden">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={styles.line} />
      ))}
    </div>
  );
}
