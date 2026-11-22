import type { Metadata } from "next";
import Link from "next/link";
import { getRouteLeads } from "@/features/clients/queries";
import { StageSelect } from "@/features/clients/StageSelect";
import { contactKindLabels } from "@/features/clients/stages";
import { TierBadge } from "@/features/clients/TierBadge";
import { VisitButton } from "@/features/clients/VisitButton";
import styles from "@/features/clients/clients.module.css";
import { formatAgo, todayISO } from "@/lib/dates";
import { formatRating } from "@/lib/format";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Looproute" };

/** The door-to-door walk: leads in the order you pass them, with what to say at the door. */
export default async function RoutePage() {
  await requireSession(); // the real check (the proxy only redirects early)
  const leads = await getRouteLeads();
  const today = todayISO();
  const routes = [...new Set(leads.map((l) => l.routeName ?? "Looproute"))];
  // "Done" = you were there, or the lead moved on in the pipeline some other way.
  const done = (l: (typeof leads)[number]) => l.stage !== "lead" || l.lastContact?.kind === "visit";
  const visited = leads.filter(done).length;

  return (
    <>
      <Link href="/leads" className="back-link">
        ← Leads
      </Link>
      <header className="page-head">
        <div>
          <h1 className="page-title">Looproute</h1>
          <p className="page-sub">
            {leads.length === 0
              ? "Nog geen route. Importeer een run van de leads-skill met een looproute."
              : `${visited} van ${leads.length} gehad · oneven kant heen, even kant terug`}
          </p>
        </div>
      </header>

      {routes.map((route) => (
        <section key={route} className={styles.route}>
          {routes.length > 1 && <h2 className={styles.routeTitle}>{route}</h2>}
          <ol className={styles.list}>
            {leads
              .filter((l) => (l.routeName ?? "Looproute") === route)
              .map((lead) => {
                const reviews = formatRating(lead.rating, lead.reviewCount);
                const street = lead.address?.split(",")[0];
                return (
                  <li key={lead.id} className={`${styles.row} ${styles.stop}`} data-done={done(lead) || undefined}>
                    <span className={styles.stopNumber} aria-hidden="true">
                      {lead.routeOrder}
                    </span>
                    <div className={styles.rowBody}>
                      <Link href={`/klanten/${lead.id}`} className={styles.stopMain}>
                        <h3>
                          <TierBadge tier={lead.leadTier} score={lead.leadScore} />
                          {lead.name}
                        </h3>
                        <div className={styles.rowMeta}>
                          {street && <span className={styles.due}>{street}</span>}
                          {reviews && <span className={styles.reviews}>{reviews}</span>}
                          {lead.websiteStatus && <span>{lead.websiteStatus}</span>}
                          {lead.lastContact && (
                            <span>
                              {contactKindLabels[lead.lastContact.kind]} {formatAgo(lead.lastContact.occurredOn, today)}
                            </span>
                          )}
                        </div>
                      </Link>
                      {lead.openerDoor && <p className={styles.pitch}>{lead.openerDoor}</p>}
                    </div>
                    <div className={styles.rowTools}>
                      <VisitButton id={lead.id} visitedToday={lead.lastContact?.kind === "visit" && lead.lastContact.occurredOn === today} />
                      <StageSelect id={lead.id} stage={lead.stage} />
                    </div>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
    </>
  );
}
