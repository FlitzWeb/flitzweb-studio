import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactActions } from "@/features/clients/ContactActions";
import { getClients } from "@/features/clients/queries";
import { billingLabels } from "@/features/clients/schema";
import { StatusDot, statusOf } from "@/features/uptime/StatusDot";
import styles from "@/features/clients/clients.module.css";
import { SiteLogo } from "@/components/SiteLogo";

export const metadata: Metadata = { title: "Klanten" };

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Klanten</h1>
          <p className="page-sub">
            {clients.length} {clients.length === 1 ? "klant" : "klanten"} · {clients.reduce((t, c) => t + c.sites.length, 0)} sites
          </p>
        </div>
        <Link href="/klanten/nieuw" className="btn btn-primary">
          <Plus aria-hidden="true" />
          Nieuwe klant
        </Link>
      </header>

      {clients.length === 0 ? (
        <p className={styles.muted}>Nog geen klanten. Voeg je eerste klant toe om sites en facturen te koppelen.</p>
      ) : (
        <ul className={styles.list}>
          {clients.map((client) => (
            <li key={client.id} className={styles.row}>
              {/* The client's logo is their (live) site's logo. */}
              <SiteLogo
                siteId={(client.sites.find((s) => s.status === "live") ?? client.sites[0])?.id}
                name={client.name}
                size={36}
              />
              <Link href={`/klanten/${client.id}`} className={styles.rowMain}>
                <h2>{client.name}</h2>
                <div className={styles.rowMeta}>
                  {client.contactPerson && <span>{client.contactPerson}</span>}
                  <span className={styles.siteDots}>
                    {client.sites.map((s) => (
                      <StatusDot
                        key={s.id}
                        size={8}
                        status={statusOf({ monitored: s.status === "live", isUp: s.isUp })}
                      />
                    ))}
                  </span>
                  <span>
                    {client.sites.length} {client.sites.length === 1 ? "site" : "sites"}
                  </span>
                  {client.billingType === "no_billing" && (
                    <span className="badge" data-tone="plain">{billingLabels.no_billing}</span>
                  )}
                </div>
              </Link>
              <ContactActions client={client} compact />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
