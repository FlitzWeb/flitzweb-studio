import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db, reports } from "@/db";
import { REPORT_TYPES } from "@/features/reports/schema";
import { ReportView } from "@/features/reports/ReportView";
import reportStyles from "@/features/reports/reports.module.css";
import { FilterBar } from "@/features/stats/FilterBar";
import { PeriodPicker } from "@/features/stats/PeriodPicker";
import styles from "@/features/stats/stats.module.css";
import { parseFilters } from "@/lib/analytics/filters";
import { getPeriod, isPeriodKey } from "@/lib/analytics/periods";
import type { TabProps } from "./registry";

/** Saved reports (Umami's Reports): funnels, routes, retention and goals. */
export async function ReportsTab({ site, searchParams }: TabProps) {
  const filters = parseFilters(searchParams);
  const period = getPeriod(isPeriodKey(searchParams.periode) ? searchParams.periode : "30d", filters);
  const list = await db.select().from(reports).where(eq(reports.siteId, site.id)).orderBy(asc(reports.createdAt));

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <PeriodPicker active={period.key} basePath={`/sites/${site.id}/rapporten`} filters={filters} />
        <Link href={`/sites/${site.id}/rapporten/nieuw`} className="btn btn-sm btn-primary">
          + Rapport
        </Link>
      </div>
      <FilterBar filters={filters} />

      {list.length === 0 ? (
        <section className={`${reportStyles.panel} ${reportStyles.empty}`}>
          <h2 className={reportStyles.h2}>Nog geen rapporten</h2>
          <ul className={reportStyles.muted}>
            {Object.values(REPORT_TYPES).map((t) => (
              <li key={t.label}>
                <strong>{t.label}:</strong> {t.help}
              </li>
            ))}
          </ul>
          <Link href={`/sites/${site.id}/rapporten/nieuw`} className="btn btn-primary">
            Eerste rapport maken
          </Link>
        </section>
      ) : (
        <div className={reportStyles.list}>
          {list.map((r) => (
            <ReportView key={r.id} report={r} period={period} />
          ))}
        </div>
      )}
    </div>
  );
}
