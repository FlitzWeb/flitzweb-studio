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
  plain,
  className,
}: {
  siteId?: number | null;
  name: string;
  size?: number;
  /** Adds a small status dot in the corner. */
  status?: "up" | "down" | "unknown" | "off";
  /** No white tile behind the logo: it sits straight on the surface (the dock). */
  plain?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const showImg = siteId != null && !failed;

  // No icon = the route's 1×1 placeholder (or a broken image): show the letter.
  const check = (el: HTMLImageElement) => {
    if (el.naturalWidth <= 1) setFailed(true);
  };

  // The image can finish before React is listening (server-rendered page):
  // check once on mount so the letter still takes over.
  useEffect(() => {
    if (img.current?.complete) check(img.current);
  }, []);

  return (
    <span
      className={`${styles.logo} ${className ?? ""}`}
      data-img={showImg || undefined}
      data-plain={plain || undefined}
      style={{ "--logo-size": `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      {showImg ? (
        <img ref={img} src={`/api/site-icon/${siteId}`} alt="" loading="lazy" decoding="async" onLoad={(e) => check(e.currentTarget)} onError={() => setFailed(true)} />
      ) : (
        name.charAt(0)
      )}
      {status && <i className={styles.status} data-status={status} />}
    </span>
  );
}
