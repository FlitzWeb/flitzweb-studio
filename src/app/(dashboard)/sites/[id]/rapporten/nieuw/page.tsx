import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportForm } from "@/features/reports/ReportForm";
import { getStepSuggestions } from "@/lib/analytics/reports";
import { getSite } from "@/lib/sites";
import styles from "@/components/form/form.module.css";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Nieuw rapport" };

export default async function NewReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession(); // the real check (the proxy only redirects early)
  const id = Number((await params).id);
  const site = Number.isInteger(id) ? await getSite(id) : undefined;
  if (!site) notFound();
  const suggestions = await getStepSuggestions(site.id);

  return (
    <>
      <Link href={`/sites/${site.id}/rapporten`} className="back-link">
        ← {site.name}
      </Link>
      <h1 className={styles.title}>Nieuw rapport</h1>
      <ReportForm siteId={site.id} suggestions={suggestions} />
    </>
  );
}
