import "server-only";
import { eq } from "drizzle-orm";
import { db, subscriptionCharges, subscriptions } from "@/db";
import { addMonths, dayInMonth, monthStart, todayISO } from "@/lib/dates";

/**
 * Makes sure every active subscription has a charge row for each month from
 * its start up to the current month (or its end date). Idempotent, cheap,
 * and called whenever money pages load and from the cron job.
 */
export async function ensureCharges() {
  const today = todayISO();
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.active, true));

  const rows: (typeof subscriptionCharges.$inferInsert)[] = [];
  for (const sub of subs) {
    const last = monthStart(sub.endDate && sub.endDate < today ? sub.endDate : today);
    for (let period = monthStart(sub.startDate); period <= last; period = addMonths(period, 1)) {
      const billing = dayInMonth(period, sub.billingDay);
      rows.push({
        subscriptionId: sub.id,
        period,
        amountCents: sub.amountCents,
        // The first month can't be due before the subscription started.
        dueDate: billing < sub.startDate ? sub.startDate : billing,
      });
    }
  }
  if (rows.length) {
    await db.insert(subscriptionCharges).values(rows).onConflictDoNothing();
  }
}
