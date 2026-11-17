import type { Client } from "@/db";
import { DeleteContactButton } from "./DeleteContactButton";
import { ContactLogForm } from "./ContactLogForm";
import { getContactLog } from "./queries";
import { contactKindLabels } from "./stages";
import { formatDate } from "@/lib/format";
import styles from "./clients.module.css";
import tabStyles from "@/features/site-tabs/tabs.module.css";

/** Contact history for one lead or client, with the form to add a line. */
export async function ContactLog({ client, today }: { client: Client; today: string }) {
  const entries = await getContactLog(client.id);
  const preferred = client.preferredChannel ?? (client.phone || client.whatsapp ? "whatsapp" : client.email ? "email" : "note");

  return (
    <section className={tabStyles.panel}>
      <div className={tabStyles.panelHead}>
        <div>
          <h2 className={tabStyles.h2}>Contactlog</h2>
          <p className={tabStyles.muted}>
            {entries.length ? `Laatste contact ${formatDate(entries[0].occurredOn)}` : "Nog niets vastgelegd."}
          </p>
        </div>
      </div>
      <ContactLogForm clientId={client.id} today={today} preferred={preferred} />
      {entries.length > 0 && (
        <ol className={styles.log}>
          {entries.map((e) => (
            <li key={e.id}>
              <div className={styles.logMeta}>
                <span className="badge" data-tone="plain">
                  {contactKindLabels[e.kind]}
                </span>
                <time dateTime={e.occurredOn}>{formatDate(e.occurredOn)}</time>
                <DeleteContactButton id={e.id} />
              </div>
              <p className={styles.notes}>{e.body}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
