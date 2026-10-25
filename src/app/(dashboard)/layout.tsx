import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireSession } from "@/lib/auth";
import { signOut } from "../login/actions";
import { NavLinks } from "./NavLinks";
import styles from "./shell.module.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="FlitzWeb Studio, overzicht">
          <Logo className={styles.logo} />
          <span className={styles.studio}>Studio</span>
        </Link>
        <NavLinks />
        <div className={styles.tools}>
          <ThemeToggle className={styles.iconBtn} />
          <form action={signOut}>
            <button className={styles.iconBtn} type="submit" aria-label="Uitloggen" title="Uitloggen">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
              </svg>
            </button>
          </form>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
