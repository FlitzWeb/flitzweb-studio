import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/form/DeleteButton";
import { getClientOptions } from "@/features/clients/queries";
import { deleteSite } from "@/features/sites/actions";
import { SiteForm } from "@/features/sites/SiteForm";
import { getSite } from "@/lib/sites";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Site bewerken" };

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [site, clients] = await Promise.all([
    Number.isInteger(id) ? getSite(id) : undefined,
    getClientOptions(),
  ]);
  if (!site) notFound();

  return (
    <>
      <Link href={`/sites/${site.id}`} className="back-link">
        ← {site.name}
      </Link>
      <h1 className={styles.title}>Site bewerken</h1>
      <SiteForm site={site} clients={clients} />
      <div className={styles.danger}>
        <DeleteButton
          action={deleteSite.bind(null, site.id)}
          label="Site verwijderen"
          confirmText={`${site.name} verwijderen? De uptime-geschiedenis en trackers gaan ook weg.`}
        />
      </div>
    </>
  );
}
