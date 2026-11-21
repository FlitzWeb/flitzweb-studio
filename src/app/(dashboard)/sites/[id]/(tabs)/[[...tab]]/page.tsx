import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tabsFor } from "@/features/site-tabs/registry";
import { requireSession } from "@/lib/auth";
import { getSite } from "@/lib/sites";

type Props = {
  params: Promise<{ id: string; tab?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The header and tab bar live in ../layout.tsx; this renders only the open tab.
async function load(params: Props["params"]) {
  const { id, tab = [] } = await params;
  const site = Number.isInteger(Number(id)) ? await getSite(Number(id)) : undefined;
  if (!site || tab.length > 1) notFound();
  const active = tabsFor(site).find((t) => t.slug === (tab[0] ?? ""));
  if (!active) notFound();
  return { site, active };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site } = await load(params);
  return { title: site.name };
}

export default async function SiteTabPage({ params, searchParams }: Props) {
  await requireSession(); // the real check (the proxy only redirects early)
  const { site, active } = await load(params);
  const Tab = active.component;
  return <Tab site={site} searchParams={await searchParams} />;
}
