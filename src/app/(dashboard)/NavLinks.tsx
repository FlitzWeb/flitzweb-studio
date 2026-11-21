"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { openCommandPalette } from "./CommandPalette";
import { isActive, navItems } from "./nav";
import styles from "./shell.module.css";
import { SiteLogo } from "@/components/SiteLogo";

export type NavSite = { id: number; name: string; status: "up" | "down" | "unknown" | "off" };

/** Moves the highlight pill under whichever link is the current page. */
function useIndicator(pathname: string) {
  const nav = useRef<HTMLElement>(null);
  const marker = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = nav.current;
    const indicator = marker.current;
    if (!container || !indicator) return;
    const place = () => {
      const current = container.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current || current.offsetWidth === 0) {
        indicator.dataset.visible = "false";
        return;
      }
      indicator.style.width = `${current.offsetWidth}px`;
      indicator.style.height = `${current.offsetHeight}px`;
      indicator.style.transform = `translate(${current.offsetLeft}px, ${current.offsetTop}px)`;
      indicator.dataset.visible = "true";
      // Only animate after the first placement, so it doesn't fly in on load.
      requestAnimationFrame(() => (indicator.dataset.ready = "true"));
    };
    const observer = new ResizeObserver(place);
    observer.observe(container);
    place();
    return () => observer.disconnect();
  }, [pathname]);

  return { nav, marker };
}

/**
 * Desktop: a floating glass dock on the left edge of the stage. The sections
 * as icons, then every site's own logo with its live status dot.
 */
export function SideDock({ sites }: { sites: NavSite[] }) {
  const pathname = usePathname();
  const { nav, marker } = useIndicator(pathname);
  const down = sites.filter((s) => s.status === "down").length;

  return (
    <nav ref={nav} className={`${styles.dock} ${styles.dockSide}`} aria-label="Hoofdmenu">
      <span ref={marker} className={styles.dockIndicator} aria-hidden="true" />
      {navItems.map(({ href, label, icon: Icon }) => {
        // On a site page the site itself is highlighted below, not "Overzicht".
        const active = href === "/" ? pathname === "/" : isActive(href, pathname);
        return (
          <Link key={href} href={href} className={styles.dockLink} aria-current={active ? "page" : undefined} aria-label={label}>
            <Icon aria-hidden="true" />
            {href === "/" && down > 0 && <span className={styles.dockCount}>{down}</span>}
            <span className={styles.dockTip} aria-hidden="true">{label}</span>
          </Link>
        );
      })}

      {sites.length > 0 && <span className={styles.dockRule} aria-hidden="true" />}
      {sites.map((s) => {
        const href = `/sites/${s.id}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={s.id}
            href={href}
            className={styles.dockLink}
            aria-current={active ? "page" : undefined}
            aria-label={s.status === "down" ? `${s.name} (offline)` : s.name}
          >
            <SiteLogo siteId={s.id} name={s.name} size={30} status={s.status} plain />
            <span className={styles.dockTip} aria-hidden="true">{s.name}</span>
          </Link>
        );
      })}

      <span className={styles.dockRule} aria-hidden="true" />
      <button type="button" className={styles.dockLink} onClick={openCommandPalette} aria-label="Zoeken (⌘K)">
        <Search aria-hidden="true" />
        <span className={styles.dockTip} aria-hidden="true">Zoeken <kbd>⌘K</kbd></span>
      </button>
    </nav>
  );
}

/** Phones and tablets: the same dock as a floating bar in thumb reach. */
export function BottomDock() {
  const pathname = usePathname();
  const { nav, marker } = useIndicator(pathname);
  return (
    <nav ref={nav} className={`${styles.dock} ${styles.dockBottom}`} aria-label="Hoofdmenu">
      <span ref={marker} className={styles.dockIndicator} aria-hidden="true" />
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={styles.dockLink}
          aria-current={isActive(href, pathname) ? "page" : undefined}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
      <button type="button" className={styles.dockLink} onClick={openCommandPalette}>
        <Search aria-hidden="true" />
        <span>Zoeken</span>
      </button>
    </nav>
  );
}
