import type { Metadata } from "next";
import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactCard } from "@/features/clients/ContactCard";
import { ContactLog } from "@/features/clients/ContactLog";
import { LeadResearchCard } from "@/features/clients/LeadResearchCard";
import { PipelineCard } from "@/features/clients/PipelineCard";
import { getClient } from "@/features/clients/queries";
import { stageLabels, stageTone } from "@/features/clients/stages";
import { todayISO } from "@/lib/dates";
import { ClientMoney } from "@/features/money/ClientMoney";
import moneyStyles from "@/features/money/money.module.css";
import { billingLabels } from "@/features/clients/schema";
import { SiteCard } from "@/features/uptime/SiteCard";
import { getSiteOverviews } from "@/lib/uptime/queries";
import styles from "@/features/clients/clients.module.css";
import overview from "../../overview.module.css";
import { requireSession } from "@/lib/auth";

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
  await requireSession(); // the real check (the proxy only redirects early)
  const client = await load(params);
  const sites = (await getSiteOverviews()).filter(
    (s) => s.clientId === client.id,
  );
  const isClient = client.stage === "client";

  return (
    <>
      <Link href={isClient ? "/klanten" : "/leads"} className="back-link">
        ← {isClient ? "Klanten" : "Leads"}
      </Link>
      <header className="page-head">
        <div>
          <h1 className="page-title">{client.name}</h1>
          <p className={styles.sub}>
            {client.businessName && client.businessName !== client.name && (
              <span>{client.businessName}</span>
            )}
            <span className="badge" data-tone={stageTone[client.stage]}>
              {stageLabels[client.stage]}
            </span>
            {isClient && (
              <span
                className="badge"
                data-tone={
                  client.billingType === "paying" ? "plain" : undefined
                }
              >
                {billingLabels[client.billingType]}
              </span>
            )}
          </p>
        </div>
        <Link href={`/klanten/${client.id}/bewerken`} className="btn">
          <Pencil aria-hidden="true" />
          Bewerken
        </Link>
      </header>

      <div className={styles.stack}>
        <PipelineCard client={client} today={todayISO()} />
        {(client.leadTier || client.leadHook) && <LeadResearchCard client={client} />}
        <ContactCard client={client} />
        <ContactLog client={client} today={todayISO()} />
      </div>

      {(isClient || sites.length > 0) && (
        <>
          <div className={styles.sectionHead}>
            <h2>Sites</h2>
            <Link
              href={`/sites/nieuw?klant=${client.id}`}
              className="btn btn-sm"
            >
              <Plus aria-hidden="true" />
              Site toevoegen
            </Link>
          </div>
          {sites.length === 0 ? (
            <p className={styles.muted}>Nog geen sites voor deze klant.</p>
          ) : (
            <div className={overview.siteGrid}>
              {sites.map((site) => (
                <SiteCard key={site.id} site={site} />
              ))}
            </div>
          )}

          <div className={moneyStyles.section}>
            <ClientMoney client={client} returnTo={`/klanten/${client.id}`} />
          </div>
        </>
      )}
    </>
  );
}
