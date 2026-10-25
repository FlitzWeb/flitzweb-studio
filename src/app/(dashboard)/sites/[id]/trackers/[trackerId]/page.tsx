import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/form/DeleteButton";
import { deleteTracker } from "@/features/stats/actions";
import { TrackerForm } from "@/features/stats/TrackerForm";
import { getSite } from "@/lib/sites";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Tracker bewerken" };

export default async function EditTrackerPage({
  params,
}: {
  params: Promise<{ id: string; trackerId: string }>;
}) {
  const { id, trackerId } = await params;
  const site = Number.isInteger(Number(id)) ? await getSite(Number(id)) : undefined;
  const tracker = site?.trackers.find((t) => t.id === Number(trackerId));
  if (!site || !tracker) notFound();

  return (
    <>
      <Link href={`/sites/${site.id}/tracking`} className="back-link">
        ← {site.name}
      </Link>
      <h1 className={styles.title}>Tracker bewerken</h1>
      <TrackerForm siteId={site.id} tracker={tracker} />
      <div className={styles.danger}>
        <DeleteButton
          action={deleteTracker.bind(null, site.id, tracker.id)}
          label="Tracker verwijderen"
          confirmText={`Tracker "${tracker.name}" verwijderen? Nieuwe "${tracker.eventKey}" events worden dan genegeerd.`}
        />
      </div>
    </>
  );
}
