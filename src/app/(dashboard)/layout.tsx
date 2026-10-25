import { asc, eq } from "drizzle-orm";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { clients, db, sites } from "@/db";
import { statusOf } from "@/features/uptime/StatusDot";
import { requireSession } from "@/lib/auth";
import { displayHost } from "@/lib/format";
import { signOut } from "../login/actions";
import { CommandPalette, SearchField } from "./CommandPalette";
import { SidebarNav, TabBar } from "./NavLinks";
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
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand} aria-label="FlitzWeb Studio, overzicht">
          <Logo studio />
        </Link>
        <div className={styles.sidebarScroll}>
          <SidebarNav sites={navSites} />
        </div>
        <div className={styles.account}>
          <span className={styles.avatar} aria-hidden="true">
            {email.charAt(0).toUpperCase()}
          </span>
          <span className={styles.accountText}>
            <small>Ingelogd als</small>
            <span>{email}</span>
          </span>
          <form action={signOut}>
            <button className={styles.iconBtn} type="submit" aria-label="Uitloggen" title="Uitloggen">
              <LogOut aria-hidden="true" />
            </button>
          </form>
        </div>
      </aside>

      <div className={styles.frame}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.mobileBrand} aria-label="FlitzWeb Studio, overzicht">
            <Logo />
          </Link>
          <SearchField />
          <div className={styles.tools}>
            {monitored.length > 0 && (
              <Link href="/" className="badge" data-tone={down > 0 ? "danger" : "ok"}>
                {down === 0 ? "Alles online" : down === 1 ? "1 site offline" : `${down} sites offline`}
              </Link>
            )}
            <ThemeToggle className={styles.iconBtn} />
            <form action={signOut} className={styles.mobileOnly}>
              <button className={styles.iconBtn} type="submit" aria-label="Uitloggen" title="Uitloggen">
                <LogOut aria-hidden="true" />
              </button>
            </form>
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>

      <TabBar />
      <CommandPalette
        sites={siteRows.map((s) => ({ id: s.id, name: s.name, host: displayHost(s.url) }))}
        clients={clientRows}
      />
    </div>
  );
}
