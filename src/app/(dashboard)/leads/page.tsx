import { Plus, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactActions } from "@/features/clients/ContactActions";
import { getLeads, getStageCounts } from "@/features/clients/queries";
import { StageSelect } from "@/features/clients/StageSelect";
import { contactKindLabels, isStage, OPEN_STAGES, stageLabels, type Stage } from "@/features/clients/stages";
import styles from "@/features/clients/clients.module.css";
import { formatAgo, formatDue, todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Leads" };

const FILTERS: Stage[] = [...OPEN_STAGES, "lost"];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ fase?: string }> }) {
  const { fase } = await searchParams;
  const active = isStage(fase) && FILTERS.includes(fase) ? fase : null;
  const [leads, counts] = await Promise.all([getLeads(active ? [active] : OPEN_STAGES), getStageCounts()]);
  const today = todayISO();
  const open = OPEN_STAGES.reduce((t, s) => t + counts[s], 0);
  const due = leads.filter((l) => l.nextFollowUp && l.nextFollowUp <= today).length;

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-sub">
            {open} in de pijplijn{due > 0 && ` · ${due} vandaag opvolgen`}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/leads/importeren" className="btn">
            <Upload aria-hidden="true" />
            Importeren
          </Link>
          <Link href="/klanten/nieuw?fase=lead" className="btn btn-primary">
            <Plus aria-hidden="true" />
            Nieuwe lead
          </Link>
        </div>
      </header>

      <nav className={styles.chips} aria-label="Fase">
        <Link href="/leads" className={styles.chip} aria-current={!active ? "page" : undefined}>
          Open <span>{open}</span>
        </Link>
        {FILTERS.map((s) => (
          <Link key={s} href={`/leads?fase=${s}`} className={styles.chip} aria-current={active === s ? "page" : undefined}>
            {stageLabels[s]} <span>{counts[s]}</span>
          </Link>
        ))}
      </nav>

      {leads.length === 0 ? (
        <p className={styles.muted}>
          {active
            ? `Niemand in de fase ${stageLabels[active]}.`
            : "Nog geen leads. Voeg er een toe, of importeer je sheet in één keer."}
        </p>
      ) : (
        <ul className={styles.list}>
          {leads.map((lead) => (
            <li key={lead.id} className={styles.row}>
              <Link href={`/klanten/${lead.id}`} className={styles.rowMain}>
                <h2>{lead.name}</h2>
                <div className={styles.rowMeta}>
                  {lead.nextFollowUp ? (
                    <span className={styles.due} data-due={lead.nextFollowUp <= today || undefined}>
                      Opvolgen {formatDue(lead.nextFollowUp, today)}
                    </span>
                  ) : (
                    lead.stage !== "lost" && lead.stage !== "lead" && <span className={styles.due} data-warn>Geen opvolgdatum</span>
                  )}
                  {lead.industry && <span>{lead.industry}</span>}
                  {lead.websiteStatus && <span>{lead.websiteStatus}</span>}
                  {lead.lastContact && (
                    <span>
                      {contactKindLabels[lead.lastContact.kind]} {formatAgo(lead.lastContact.occurredOn, today)}
                    </span>
                  )}
                </div>
              </Link>
              <div className={styles.rowTools}>
                <ContactActions client={lead} compact />
                <StageSelect id={lead.id} stage={lead.stage} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
