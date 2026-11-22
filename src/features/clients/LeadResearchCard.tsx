import Link from "next/link";
import type { Client } from "@/db";
import { CopyButton } from "@/components/CopyButton";
import { formatDate, formatRating } from "@/lib/format";
import { whatsappLink } from "@/lib/phone";
import { splitMail } from "./importResearch";
import { TierBadge } from "./TierBadge";
import styles from "./clients.module.css";
import tabStyles from "@/features/site-tabs/tabs.module.css";

/**
 * What the leads skill found out about this business: score, reviews, what is
 * wrong with their website now, and the three drafted openers. The buttons
 * open WhatsApp or the mail app with the draft filled in; the Studio sends nothing.
 */
export function LeadResearchCard({ client }: { client: Client }) {
  const reviews = formatRating(client.rating, client.reviewCount);
  const evidence = client.leadEvidence?.split(/;\s+/).filter(Boolean) ?? [];
  const wa = whatsappLink(client.whatsapp ?? client.phone);
  // WhatsApp only works on a mobile number; a landline gets the copy button alone.
  const waText = wa && /wa\.me\/316/.test(wa) && client.openerDm ? `${wa}?text=${encodeURIComponent(client.openerDm)}` : null;
  const mail = client.openerMail ? splitMail(client.openerMail) : null;
  const mailHref =
    mail && client.email
      ? `mailto:${client.email}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`
      : null;

  return (
    <section className={tabStyles.panel}>
      <div className={tabStyles.panelHead}>
        <div>
          <h2 className={tabStyles.h2}>Lead-onderzoek</h2>
          <p className={tabStyles.muted}>
            {client.researchedOn ? `Gecheckt op ${formatDate(client.researchedOn)}` : "Uit de leads-skill"}
            {client.leadSource && ` · ${client.leadSource}`}
          </p>
        </div>
        <TierBadge tier={client.leadTier} score={client.leadScore} />
      </div>

      {client.leadHook && <p className={styles.hookLead}>{client.leadHook}</p>}

      <dl className={tabStyles.facts}>
        {reviews && (
          <div>
            <dt>Google-reviews</dt>
            <dd>{reviews}</dd>
          </div>
        )}
        {(client.websiteStatus || client.websiteUrl) && (
          <div>
            <dt>Website nu</dt>
            <dd>
              {client.websiteStatus}
              {client.websiteUrl && (
                <>
                  {client.websiteStatus && " · "}
                  <a href={client.websiteUrl} target="_blank" rel="noreferrer">
                    bekijk ↗
                  </a>
                </>
              )}
            </dd>
          </div>
        )}
        {evidence.length > 0 && (
          <div>
            <dt>Bewijs</dt>
            <dd>
              <ul className={styles.evidence}>
                {evidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {client.mapsUrl && (
          <div>
            <dt>Google Maps</dt>
            <dd>
              <a href={client.mapsUrl} target="_blank" rel="noreferrer">
                Open het profiel ↗
              </a>
            </dd>
          </div>
        )}
        {client.routeOrder && (
          <div>
            <dt>Looproute</dt>
            <dd>
              <Link href="/leads/looproute">
                Stop {client.routeOrder}
                {client.routeName && ` · ${client.routeName}`}
              </Link>
            </dd>
          </div>
        )}
      </dl>

      {(client.openerDoor || client.openerDm || mail) && (
        <div className={styles.openers}>
          {client.openerDoor && (
            <Opener title="Aan de deur" text={client.openerDoor}>
              <CopyButton text={client.openerDoor} />
            </Opener>
          )}
          {client.openerDm && (
            <Opener title="WhatsApp of DM" text={client.openerDm}>
              {waText && (
                <a href={waText} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">
                  Open in WhatsApp
                </a>
              )}
              <CopyButton text={client.openerDm} />
            </Opener>
          )}
          {mail && (
            <Opener title={mail.subject ? `E-mail: ${mail.subject}` : "E-mail"} text={mail.body}>
              {mailHref && (
                <a href={mailHref} className="btn btn-sm btn-primary">
                  Open in mail
                </a>
              )}
              <CopyButton text={mail.body} />
            </Opener>
          )}
          <p className={tabStyles.muted}>
            Concepten uit de leads-skill. Kijk even naar hun site voordat je het bewijs noemt, en maak de tekst van jezelf.
          </p>
        </div>
      )}
    </section>
  );
}

function Opener({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className={styles.opener}>
      <div className={styles.openerHead}>
        <h3>{title}</h3>
        <div>{children}</div>
      </div>
      <p className={styles.notes}>{text}</p>
    </div>
  );
}
