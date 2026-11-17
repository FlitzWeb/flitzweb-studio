"use client";

/* eslint-disable @next/next/no-img-element -- proxied favicons, no optimisation needed */
import { useEffect, useRef, useState } from "react";
import styles from "./SiteLogo.module.css";

/**
 * The site's own logo, fetched via /api/site-icon. Falls back to the first
 * letter of the name while there is no site, or when the site has no icon.
 */
export function SiteLogo({
  siteId,
  name,
  size = 32,
  status,
  className,
}: {
  siteId?: number | null;
  name: string;
  size?: number;
  /** Adds a small status dot in the corner. */
  status?: "up" | "down" | "unknown" | "off";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const showImg = siteId != null && !failed;

  // The image can fail before React is listening (server-rendered page):
  // check once on mount so the letter still takes over.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <span
      className={`${styles.logo} ${className ?? ""}`}
      data-img={showImg || undefined}
      style={{ "--logo-size": `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      {showImg ? (
        <img ref={img} src={`/api/site-icon/${siteId}`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        name.charAt(0)
      )}
      {status && <i className={styles.status} data-status={status} />}
    </span>
  );
}
