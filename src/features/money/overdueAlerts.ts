import "server-only";
import { inArray } from "drizzle-orm";
import { db, payments, subscriptionCharges } from "@/db";
import { alertEmail, appUrl, sendAlert } from "@/lib/email";
import { formatDate, formatEuro } from "@/lib/format";
import { getMoneyItems } from "./queries";

/**
 * Emails you once when an invoice or monthly charge passes its due date.
 * Called from the cron job. If sending fails the items stay unmarked, so the
 * next run tries again.
 */
export async function sendOverdueAlerts() {
  const overdue = (await getMoneyItems({ unpaid: true })).filter((i) => i.status === "overdue");
  const fresh = overdue.filter((i) => !i.alertSent);
  if (fresh.length === 0) return 0;

  const total = overdue.reduce((t, i) => t + i.amountCents, 0);
  const line = (i: (typeof fresh)[number]) =>
    `- ${i.clientName}: ${formatEuro(i.amountCents)} voor ${i.description} (vervallen ${formatDate(i.dueDate)})`;
  await sendAlert({
    to: alertEmail(),
    subject:
      fresh.length === 1
        ? `💶 Te laat: ${fresh[0].clientName} · ${formatEuro(fresh[0].amountCents)}`
        : `💶 ${fresh.length} betalingen te laat`,
    text: `Nieuw over de vervaldatum:\n${fresh.map(line).join("\n")}\n\nTotaal te laat: ${formatEuro(total)}\n\nStuur een herinnering of markeer als betaald: ${appUrl()}/geld`,
  });

  const ids = (kind: "invoice" | "charge") => fresh.filter((i) => i.kind === kind).map((i) => i.id);
  if (ids("invoice").length) {
    await db.update(payments).set({ overdueAlertSent: true }).where(inArray(payments.id, ids("invoice")));
  }
  if (ids("charge").length) {
    await db.update(subscriptionCharges).set({ overdueAlertSent: true }).where(inArray(subscriptionCharges.id, ids("charge")));
  }
  return fresh.length;
}
