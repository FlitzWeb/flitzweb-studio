import { asc, eq } from "drizzle-orm";
import { LogOut, ShieldX } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { clients, db, sites } from "@/db";
import { statusOf } from "@/features/uptime/StatusDot";
import { requireSession } from "@/lib/auth";
import { displayHost } from "@/lib/format";
import { signOut, signOutEverywhere } from "../login/actions";
import { CommandPalette, SearchField } from "./CommandPalette";
import { BottomDock, SideDock } from "./NavLinks";
import { PageMotion } from "./PageMotion";
import styles from "./shell.module.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email } = await requireSession();
  const [siteRows, clientRows] = await Promise.all([
    db
      .select({ id: sites.id, name: sites.name, url: sites.url, status: sites.status, isUp: sites.isUp })
      .from(sites)
      .innerJoin(clients, eq(clients.id, sites.clientId))
      .orderBy(asc(sites.name)),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
  ]);

  const navSites = siteRows.map((s) => ({
    id: s.id,
    name: s.name,
    status: statusOf({ monitored: s.status === "live", isUp: s.isUp }),
  }));
  const monitored = navSites.filter((s) => s.status !== "off");
  const down = monitored.filter((s) => s.status === "down").length;

  return (
    <div className={styles.shell}>
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.horizon}>
          <span className={`${styles.arc} ${styles.arcRim}`} />
          <span className={`${styles.arc} ${styles.arcA}`} />
          <span className={`${styles.arc} ${styles.arcB}`} />
          <span className={`${styles.arc} ${styles.arcCore}`} />
        </div>
      </div>

      <div className={styles.topWrap}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.brand} aria-label="FlitzWeb Studio, overzicht">
            <Logo studio />
          </Link>
          <SearchField />
          <div className={styles.tools}>
            {monitored.length > 0 && (
              <Link href="/" className={styles.statusPill} data-tone={down > 0 ? "danger" : "ok"}>
                <i aria-hidden="true" />
                <span>{down === 0 ? "Alles online" : down === 1 ? "1 site offline" : `${down} sites offline`}</span>
              </Link>
            )}
            <ThemeToggle className={styles.iconBtn} />
            <button
              type="button"
              className={styles.avatar}
              popoverTarget="account-menu"
              aria-label={`Account: ${email}`}
              title={email}
            >
              {email.charAt(0).toUpperCase()}
            </button>
          </div>
        </header>
      </div>

      <div id="account-menu" popover="auto" className={styles.accountMenu}>
        <p className={styles.accountText}>
          <small>Ingelogd als</small>
          <span>{email}</span>
        </p>
        <form action={signOut}>
          <button className={styles.menuItem} type="submit">
            <LogOut aria-hidden="true" />
            Uitloggen
          </button>
        </form>
        <form action={signOutEverywhere}>
          <button className={styles.menuItem} type="submit">
            <ShieldX aria-hidden="true" />
            Overal uitloggen
            <small>alle apparaten</small>
          </button>
        </form>
      </div>

      <div className={styles.stageWrap}>
        <SideDock sites={navSites} />
        <main className={styles.stage}>
          <PageMotion>{children}</PageMotion>
        </main>
      </div>

      <BottomDock />
      <CommandPalette
        sites={siteRows.map((s) => ({ id: s.id, name: s.name, host: displayHost(s.url) }))}
        clients={clientRows}
      />
    </div>
  );
}
