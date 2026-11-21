import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SiteLogo } from "@/components/SiteLogo";
import { SiteTabBar } from "@/features/site-tabs/SiteTabBar";
import { tabsFor } from "@/features/site-tabs/registry";
import { siteStatusLabels } from "@/features/sites/schema";
import { statusLabel, statusOf } from "@/features/uptime/StatusDot";
import { requireSession } from "@/lib/auth";
import { displayHost } from "@/lib/format";
import { getSite } from "@/lib/sites";
import styles from "./site.module.css";

/**
 * The site header and tab bar. A layout, so they stay on screen while you switch tabs:
 * only the tab below is rendered again, and loading.tsx shows a skeleton the moment you click.
 */
export default async function SiteLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  await requireSession();
  const { id } = await params;
  const site = Number.isInteger(Number(id)) ? await getSite(Number(id)) : undefined;
  if (!site) notFound();
  const status = statusOf({ monitored: site.status === "live", isUp: site.isUp });
  const tabs = tabsFor(site).map((t) => ({ slug: t.slug, label: t.label, hidden: Boolean(t.hidden) }));

  return (
    <>
      <AutoRefresh seconds={60} />
      <Link href="/" className="back-link">
        ← Overzicht
      </Link>
      <header className={styles.head}>
        <SiteLogo siteId={site.id} name={site.name} size={52} className={styles.logo} />
        <div className={styles.headText}>
          <div className={styles.titleRow}>
            <h1 className="page-title">{site.name}</h1>
            <span className="badge" data-tone={status === "up" ? "ok" : status === "down" ? "danger" : undefined}>
              {status === "off" ? siteStatusLabels[site.status] : statusLabel(status)}
            </span>
          </div>
          <p className={styles.meta}>
            <a href={site.url} target="_blank" rel="noreferrer">
              {displayHost(site.url)}
              <ExternalLink aria-hidden="true" />
            </a>
            <span aria-hidden="true">·</span>
            <Link href={`/klanten/${site.client.id}`}>{site.client.name}</Link>
          </p>
        </div>
        <div className="page-actions">
          <Link href={`/sites/${site.id}/bewerken`} className="btn">
            <Pencil aria-hidden="true" />
            Bewerken
          </Link>
        </div>
      </header>

      <SiteTabBar siteId={site.id} tabs={tabs} />

      {children}
    </>
  );
}
