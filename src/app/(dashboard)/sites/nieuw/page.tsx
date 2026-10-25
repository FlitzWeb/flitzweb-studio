import type { Metadata } from "next";
import Link from "next/link";
import { getClientOptions } from "@/features/clients/queries";
import { SiteForm } from "@/features/sites/SiteForm";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Nieuwe site" };

export default async function NewSitePage({
  searchParams,
}: {
  searchParams: Promise<{ klant?: string }>;
}) {
  const clientId = Number((await searchParams).klant) || undefined;
  const clients = await getClientOptions();

  return (
    <>
      <Link href={clientId ? `/klanten/${clientId}` : "/"} className="back-link">
        ← Terug
      </Link>
      <h1 className={styles.title}>Nieuwe site</h1>
      {clients.length === 0 ? (
        <p>
          Voeg eerst een <Link href="/klanten/nieuw">klant</Link> toe.
        </p>
      ) : (
        <SiteForm clients={clients} defaultClientId={clientId} />
      )}
    </>
  );
}
