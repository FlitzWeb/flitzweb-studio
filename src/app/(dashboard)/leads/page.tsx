import { Footprints, Plus, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactActions } from "@/features/clients/ContactActions";
import { getLeads, getStageCounts } from "@/features/clients/queries";
import { hasSocials, SocialLinks } from "@/features/clients/SocialLinks";
import { StageSelect } from "@/features/clients/StageSelect";
import { contactKindLabels, hookDetail, isStage, isTier, OPEN_STAGES, stageLabels, TIERS, type Stage } from "@/features/clients/stages";
import { TierBadge } from "@/features/clients/TierBadge";
import styles from "@/features/clients/clients.module.css";
import { formatAgo, formatDue, todayISO } from "@/lib/dates";
import { formatRating } from "@/lib/format";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Leads" };

const FILTERS: Stage[] = [...OPEN_STAGES, "lost"];

type Search = { fase?: string; tier?: string; site?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireSession(); // the real check (the proxy only redirects early)
  const { fase, tier, site } = await searchParams;
  const active = isStage(fase) && FILTERS.includes(fase) ? fase : null;
  const today = todayISO();
  const [inStage, counts] = await Promise.all([getLeads(active ? [active] : OPEN_STAGES, today), getStageCounts()]);

  // Tier and "website now" narrow the stage's list; their counts follow each other.
  const sites = [...new Set(inStage.map((l) => l.websiteStatus).filter((s): s is string => !!s))].sort((a, b) =>
    a.localeCompare(b, "nl"),
  );
  const activeTier = isTier(tier) ? tier : null;
  const activeSite = site && sites.includes(site) ? site : null;
  const bySite = activeSite ? inStage.filter((l) => l.websiteStatus === activeSite) : inStage;
  const byTier = activeTier ? inStage.filter((l) => l.leadTier === activeTier) : inStage;
  const leads = activeTier ? bySite.filter((l) => l.leadTier === activeTier) : bySite;
  const hasResearch = inStage.some((l) => l.leadTier);
  const onRoute = inStage.some((l) => l.routeOrder);

  const href = (next: Search) => {
    const q = new URLSearchParams();
    const merged = { fase: active ?? undefined, tier: activeTier ?? undefined, site: activeSite ?? undefined, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/leads?${s}` : "/leads";
  };

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
          {onRoute && (
            <Link href="/leads/looproute" className="btn">
              <Footprints aria-hidden="true" />
              Looproute
            </Link>
          )}
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
        <Link href={href({ fase: undefined })} className={styles.chip} aria-current={!active ? "page" : undefined}>
          Open <span>{open}</span>
        </Link>
        {FILTERS.map((s) => (
          <Link key={s} href={href({ fase: s })} className={styles.chip} aria-current={active === s ? "page" : undefined}>
            {stageLabels[s]} <span>{counts[s]}</span>
          </Link>
        ))}
      </nav>

      {hasResearch && (
        <nav className={`${styles.chips} ${styles.chipsSub}`} aria-label="Tier">
          <Link href={href({ tier: undefined })} className={styles.chip} aria-current={!activeTier ? "page" : undefined}>
            Alle tiers <span>{bySite.length}</span>
          </Link>
          {TIERS.map((t) => (
            <Link key={t} href={href({ tier: t })} className={styles.chip} aria-current={activeTier === t ? "page" : undefined}>
              Tier {t} <span>{bySite.filter((l) => l.leadTier === t).length}</span>
            </Link>
          ))}
        </nav>
      )}

      {sites.length > 1 && (
        <nav className={`${styles.chips} ${styles.chipsSub}`} aria-label="Website nu">
          <Link href={href({ site: undefined })} className={styles.chip} aria-current={!activeSite ? "page" : undefined}>
            Elke website <span>{byTier.length}</span>
          </Link>
          {sites.map((s) => (
            <Link key={s} href={href({ site: s })} className={styles.chip} aria-current={activeSite === s ? "page" : undefined}>
              {s} <span>{byTier.filter((l) => l.websiteStatus === s).length}</span>
            </Link>
          ))}
        </nav>
      )}

      {leads.length === 0 ? (
        <p className={styles.muted}>
          {activeTier || activeSite
            ? "Geen leads met deze filters."
            : active
              ? `Niemand in de fase ${stageLabels[active]}.`
              : "Nog geen leads. Voeg er een toe, of importeer een run van de leads-skill."}
        </p>
      ) : (
        <ul className={styles.list}>
          {leads.map((lead) => {
            const reviews = formatRating(lead.rating, lead.reviewCount);
            const hook = hookDetail(lead.leadHook);
            return (
              <li key={lead.id} className={styles.row}>
                <div className={styles.rowBody}>
                  <Link href={`/klanten/${lead.id}`} className={styles.rowMain}>
                    <h2>
                      <TierBadge tier={lead.leadTier} score={lead.leadScore} />
                      {lead.name}
                    </h2>
                    <div className={styles.rowMeta}>
                      {lead.nextFollowUp ? (
                        <span className={styles.due} data-due={lead.nextFollowUp <= today || undefined}>
                          Opvolgen {formatDue(lead.nextFollowUp, today)}
                        </span>
                      ) : (
                        lead.stage !== "lost" && lead.stage !== "lead" && <span className={styles.due} data-warn>Geen opvolgdatum</span>
                      )}
                      {reviews && <span className={styles.reviews}>{reviews}</span>}
                      {lead.industry && <span>{lead.industry}</span>}
                      {lead.websiteStatus && <span>{lead.websiteStatus}</span>}
                      {lead.lastContact && (
                        <span>
                          {contactKindLabels[lead.lastContact.kind]} {formatAgo(lead.lastContact.occurredOn, today)}
                        </span>
                      )}
                    </div>
                    {hook && <p className={styles.hook}>{hook}</p>}
                  </Link>
                  {hasSocials(lead) && <SocialLinks client={lead} />}
                </div>
                <div className={styles.rowTools}>
                  <ContactActions client={lead} compact />
                  <StageSelect id={lead.id} stage={lead.stage} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
