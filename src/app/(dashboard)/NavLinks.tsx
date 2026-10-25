"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav";
import styles from "./shell.module.css";

export function NavLinks() {
  const pathname = usePathname();
  // Hidden until there is more than one section to switch between.
  if (navItems.length < 2) return <span className={styles.nav} />;

  return (
    <nav className={styles.nav} aria-label="Hoofdmenu">
      {navItems.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/" || pathname.startsWith("/sites")
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={styles.navLink}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
