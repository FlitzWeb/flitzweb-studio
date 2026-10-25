import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackerForm } from "@/features/stats/TrackerForm";
import { getSite } from "@/lib/sites";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Nieuwe tracker" };

export default async function NewTrackerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const site = Number.isInteger(id) ? await getSite(id) : undefined;
  if (!site) notFound();

  return (
    <>
      <Link href={`/sites/${site.id}/tracking`} className="back-link">
        ← {site.name}
      </Link>
      <h1 className={styles.title}>Nieuwe tracker</h1>
      <TrackerForm siteId={site.id} />
    </>
  );
}
