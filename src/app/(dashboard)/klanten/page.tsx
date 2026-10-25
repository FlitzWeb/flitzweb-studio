import type { Metadata } from "next";
import Link from "next/link";
import { ContactActions } from "@/features/clients/ContactActions";
import { getClients } from "@/features/clients/queries";
import { billingLabels } from "@/features/clients/schema";
import { StatusDot, statusOf } from "@/features/uptime/StatusDot";
import styles from "@/features/clients/clients.module.css";

export const metadata: Metadata = { title: "Klanten" };

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <>
      <section className={styles.head}>
        <div>
          <p className="eyebrow">Klanten · {clients.length}</p>
          <h1 className={styles.title}>Klanten</h1>
        </div>
        <Link href="/klanten/nieuw" className="btn btn-primary">
          + Nieuwe klant
        </Link>
      </section>

      {clients.length === 0 ? (
        <p className={styles.muted}>Nog geen klanten.</p>
      ) : (
        <ul className={styles.list}>
          {clients.map((client) => (
            <li key={client.id} className={styles.row}>
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
                    <span className={styles.badge}>{billingLabels.no_billing}</span>
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
