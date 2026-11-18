import "server-only";
import { and, eq, isNull, lt } from "drizzle-orm";
import { cache } from "react";
import { db, subscriptionCharges, subscriptions } from "@/db";
import { addMonths, dayInMonth, monthStart, todayISO } from "@/lib/dates";
import { payingFrom } from "./subscriptionState";

/**
 * Makes sure every active subscription has a charge row for each month from
 * its start up to the current month (or its end date). Free months are
 * skipped. Idempotent, cheap, and called whenever money pages load and from
 * the cron job. `cache` makes it run once per page load, however many lists
 * on that page ask for money items.
 */
export const ensureCharges = cache(async function ensureCharges() {
  const today = todayISO();
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.active, true));

  const rows: (typeof subscriptionCharges.$inferInsert)[] = [];
  for (const sub of subs) {
    const first = payingFrom(sub);

    // Free months added after charges already existed: drop those unpaid charges.
    if (sub.freeMonths > 0) {
      await db
        .delete(subscriptionCharges)
        .where(
          and(
            eq(subscriptionCharges.subscriptionId, sub.id),
            lt(subscriptionCharges.period, first),
            isNull(subscriptionCharges.paidDate),
          ),
        );
    }

    const last = monthStart(sub.endDate && sub.endDate < today ? sub.endDate : today);
    for (let period = first; period <= last; period = addMonths(period, 1)) {
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
});
