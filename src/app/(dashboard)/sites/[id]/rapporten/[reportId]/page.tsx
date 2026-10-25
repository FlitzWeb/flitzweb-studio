import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/form/DeleteButton";
import { db, reports } from "@/db";
import { deleteReport } from "@/features/reports/actions";
import { ReportForm } from "@/features/reports/ReportForm";
import { getStepSuggestions } from "@/lib/analytics/reports";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Rapport bewerken" };

export default async function EditReportPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const { id, reportId } = await params;
  const siteId = Number(id);
  const report = Number.isInteger(siteId) && Number.isInteger(Number(reportId))
    ? await db.query.reports.findFirst({ where: and(eq(reports.id, Number(reportId)), eq(reports.siteId, siteId)) })
    : undefined;
  if (!report) notFound();
  const suggestions = await getStepSuggestions(siteId);

  return (
    <>
      <Link href={`/sites/${siteId}/rapporten`} className="back-link">
        ← Rapporten
      </Link>
      <h1 className={styles.title}>Rapport bewerken</h1>
      <ReportForm siteId={siteId} report={report} suggestions={suggestions} />
      <div className={styles.danger}>
        <DeleteButton
          action={deleteReport.bind(null, siteId, report.id)}
          label="Rapport verwijderen"
          confirmText={`Rapport "${report.name}" verwijderen? De data zelf blijft bewaard.`}
        />
      </div>
    </>
  );
}
