"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { openCommandPalette } from "./CommandPalette";
import { isActive, navItems } from "./nav";
import styles from "./shell.module.css";

export type NavSite = { id: number; name: string; status: "up" | "down" | "unknown" | "off" };

/** Sidebar: the sections, then every site with its live status. */
export function SidebarNav({ sites }: { sites: NavSite[] }) {
  const pathname = usePathname();
  const down = sites.filter((s) => s.status === "down").length;

  return (
    <>
      <nav className={styles.navGroup} aria-label="Hoofdmenu">
        <p className={styles.groupLabel}>Menu</p>
        {navItems.map(({ href, label, icon: Icon }) => {
          // On a site page the site itself is highlighted below, not "Overzicht".
          const active = href === "/" ? pathname === "/" : isActive(href, pathname);
          return (
            <Link key={href} href={href} className={styles.navLink} aria-current={active ? "page" : undefined}>
              <Icon aria-hidden="true" />
              {label}
              {href === "/" && down > 0 && <span className={styles.navCount} data-tone="danger">{down}</span>}
            </Link>
          );
        })}
      </nav>

      {sites.length > 0 && (
        <nav className={styles.navGroup} aria-label="Sites">
          <p className={styles.groupLabel}>
            Sites <span>{sites.length}</span>
          </p>
          {sites.map((s) => {
            const href = `/sites/${s.id}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={s.id} href={href} className={styles.navLink} aria-current={active ? "page" : undefined}>
                <span className={styles.siteDot} data-status={s.status} aria-hidden="true" />
                <span className={styles.navText}>{s.name}</span>
                {s.status === "down" && <span className="sr-only">(offline)</span>}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}

/** Phones: the sections as a tab bar in thumb reach, plus search. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className={styles.tabBar} aria-label="Hoofdmenu">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={styles.tabLink}
          aria-current={isActive(href, pathname) ? "page" : undefined}
        >
          <Icon aria-hidden="true" />
          {label}
        </Link>
      ))}
      <button type="button" className={styles.tabLink} onClick={openCommandPalette}>
        <Search aria-hidden="true" />
        Zoeken
      </button>
    </nav>
  );
}
