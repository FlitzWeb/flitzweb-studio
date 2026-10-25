import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { tabsFor } from "@/features/site-tabs/registry";
import { StatusDot, statusOf } from "@/features/uptime/StatusDot";
import { displayHost } from "@/lib/format";
import { getSite } from "@/lib/sites";
import styles from "./site.module.css";

type Props = {
  params: Promise<{ id: string; tab?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function load(params: Props["params"]) {
  const { id, tab = [] } = await params;
  const site = Number.isInteger(Number(id)) ? await getSite(Number(id)) : undefined;
  if (!site || tab.length > 1) notFound();
  const tabs = tabsFor(site);
  const active = tabs.find((t) => t.slug === (tab[0] ?? ""));
  if (!active) notFound();
  return { site, tabs, active };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site } = await load(params);
  return { title: site.name };
}

export default async function SitePage({ params, searchParams }: Props) {
  const { site, tabs, active } = await load(params);
  const Tab = active.component;
  const status = statusOf({ monitored: site.status === "live", isUp: site.isUp });

  return (
    <>
      <AutoRefresh seconds={60} />
      <Link href="/" className="back-link">
        ← Overzicht
      </Link>
      <header className={styles.head}>
        <StatusDot status={status} size={20} />
        <div className={styles.headText}>
          <h1 className={styles.title}>{site.name}</h1>
          <p className={styles.meta}>
            <a href={site.url} target="_blank" rel="noreferrer">
              {displayHost(site.url)} ↗
            </a>
            <Link href={`/klanten/${site.client.id}`}>{site.client.name}</Link>
          </p>
        </div>
        <Link href={`/sites/${site.id}/bewerken`} className="btn btn-sm">
          Bewerken
        </Link>
      </header>

      <nav className={styles.tabs} aria-label="Onderdelen">
        {tabs.map((t) => (
          <Link
            key={t.slug}
            href={`/sites/${site.id}${t.slug ? `/${t.slug}` : ""}`}
            className={styles.tab}
            aria-current={t === active ? "page" : undefined}
            scroll={false}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <Tab site={site} searchParams={await searchParams} />
    </>
  );
}
