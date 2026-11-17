import Link from "next/link";
import styles from "./money.module.css";

const TABS = [
  { href: "/geld", label: "Inkomsten" },
  { href: "/kosten", label: "Kosten" },
] as const;

/** Switches between what comes in (Geld) and what goes out (Kosten). */
export function MoneyTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav className={styles.tabs} aria-label="Geld">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={styles.tab} aria-current={t.href === active ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
