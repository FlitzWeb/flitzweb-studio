"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/app/(dashboard)/sites/[id]/(tabs)/site.module.css";
import { KeepActiveTabVisible } from "./KeepActiveTabVisible";

type Tab = { slug: string; label: string; hidden: boolean };

/** The pill tabs. The active one follows the URL right away, before the new tab has loaded. */
export function SiteTabBar({ siteId, tabs }: { siteId: number; tabs: Tab[] }) {
  // /sites/12/stats → "stats"; /sites/12 → ""
  const active = usePathname().split("/")[3] ?? "";

  return (
    <nav className={styles.tabs} aria-label="Onderdelen">
      <KeepActiveTabVisible />
      {tabs
        // A hidden tab opened by URL still gets its place in the bar while you are on it.
        .filter((t) => !t.hidden || t.slug === active)
        .map((t) => (
          <Link
            key={t.slug}
            href={`/sites/${siteId}${t.slug ? `/${t.slug}` : ""}`}
            className={styles.tab}
            aria-current={t.slug === active ? "page" : undefined}
            scroll={false}
          >
            {t.label}
          </Link>
        ))}
    </nav>
  );
}
