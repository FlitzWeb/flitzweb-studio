import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactCard } from "@/features/clients/ContactCard";
import { getClient } from "@/features/clients/queries";
import { ClientMoney } from "@/features/money/ClientMoney";
import moneyStyles from "@/features/money/money.module.css";
import { billingLabels } from "@/features/clients/schema";
import { SiteCard } from "@/features/uptime/SiteCard";
import { getSiteOverviews } from "@/lib/uptime/queries";
import styles from "@/features/clients/clients.module.css";
import overview from "../../overview.module.css";

type Props = { params: Promise<{ id: string }> };

async function load(params: Props["params"]) {
  const id = Number((await params).id);
  const client = Number.isInteger(id) ? await getClient(id) : undefined;
  if (!client) notFound();
  return client;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: (await load(params)).name };
}

export default async function ClientPage({ params }: Props) {
  const client = await load(params);
  const sites = (await getSiteOverviews()).filter((s) => s.clientId === client.id);

  return (
    <>
      <Link href="/klanten" className="back-link">
        ← Klanten
      </Link>
      <section className={styles.head}>
        <div>
          <h1 className={styles.title}>{client.name}</h1>
          <p className={styles.sub}>
            {client.businessName && client.businessName !== client.name && (
              <span>{client.businessName}</span>
            )}
            <span className={styles.badge}>{billingLabels[client.billingType]}</span>
          </p>
        </div>
        <Link href={`/klanten/${client.id}/bewerken`} className="btn btn-sm">
          Bewerken
        </Link>
      </section>

      <ContactCard client={client} />

      <div className={styles.sectionHead}>
        <h2>Sites</h2>
        <Link href={`/sites/nieuw?klant=${client.id}`} className="btn btn-sm">
          + Site toevoegen
        </Link>
      </div>
      {sites.length === 0 ? (
        <p className={styles.muted}>Nog geen sites voor deze klant.</p>
      ) : (
        <div className={overview.grid}>
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}

      <div className={moneyStyles.section}>
        <ClientMoney client={client} returnTo={`/klanten/${client.id}`} />
      </div>
    </>
  );
}
