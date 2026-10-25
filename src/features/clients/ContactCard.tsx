import Link from "next/link";
import type { Client } from "@/db";
import { ContactActions } from "./ContactActions";
import { channelLabels } from "./schema";
import styles from "./clients.module.css";
import tabStyles from "@/features/site-tabs/tabs.module.css";

/** Contact buttons + all contact details. Used on the client page and the site Contact tab. */
export function ContactCard({ client, showClientLink }: { client: Client; showClientLink?: boolean }) {
  const mapsLink = client.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`
    : null;

  return (
    <section className={tabStyles.panel}>
      <div className={tabStyles.panelHead}>
        <h2 className={tabStyles.h2}>Contact</h2>
        {showClientLink && (
          <Link href={`/klanten/${client.id}`} className="btn btn-sm">
            Naar klant
          </Link>
        )}
      </div>
      <div className={styles.cardActions}>
        <ContactActions client={client} />
      </div>
      <dl className={`${tabStyles.facts} ${styles.cardFacts}`}>
        <Fact label="Contactpersoon">{client.contactPerson}</Fact>
        <Fact label="Telefoon">{client.phone}</Fact>
        <Fact label="WhatsApp">{client.whatsapp ?? (client.phone && "zelfde als telefoon")}</Fact>
        <Fact label="E-mail">{client.email}</Fact>
        <Fact label="Voorkeur">{client.preferredChannel && channelLabels[client.preferredChannel]}</Fact>
        <Fact label="Adres">
          {mapsLink && (
            <a href={mapsLink} target="_blank" rel="noreferrer">
              {client.address} ↗
            </a>
          )}
        </Fact>
        {client.notes && (
          <Fact label="Notities">
            <span className={styles.notes}>{client.notes}</span>
          </Fact>
        )}
      </dl>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || <span className={tabStyles.muted}>–</span>}</dd>
    </div>
  );
}
