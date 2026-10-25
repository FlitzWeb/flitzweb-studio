import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { checks, db, sites, type Site } from "@/db";
import { alertEmail, appUrl, sendEmail } from "@/lib/email";
import { daysUntil, formatDate, formatDateTime, formatDuration } from "@/lib/format";
import { probe, type ProbeResult } from "./probe";

export const SSL_WARN_DAYS = 14;
const KEEP_CHECKS_DAYS = 90;
const CONCURRENCY = 5;

/**
 * Checks all live sites (or just the given ids), stores the results and
 * emails on state changes. Used by the cron route and the "Check nu" buttons.
 */
export async function runChecks(siteIds?: number[]) {
  const targets = await db
    .select()
    .from(sites)
    .where(
      and(
        eq(sites.status, "live"),
        siteIds ? inArray(sites.id, siteIds) : undefined,
      ),
    );

  const results: { site: string; isUp: boolean }[] = [];
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (site) => {
        const result = await probe(site.url);
        await db.insert(checks).values({ siteId: site.id, ...result });
        await applyStateChange(site, result);
        results.push({ site: site.name, isUp: result.isUp });
      }),
    );
  }

  await db
    .delete(checks)
    .where(lt(checks.checkedAt, new Date(Date.now() - KEEP_CHECKS_DAYS * 86400000)));

  return results;
}

/**
 * Compares the new result with the stored state and alerts only on changes:
 * up → down, down → up, and SSL dropping below the warning threshold.
 * If an email fails we don't save the new state, so the next run retries it.
 */
async function applyStateChange(site: Site, result: ProbeResult) {
  const now = new Date();
  const update: Partial<Site> = {};
  const link = `${appUrl()}/sites/${site.id}`;

  try {
    if (!result.isUp && site.isUp !== false) {
      await sendEmail({
        to: alertEmail(),
        subject: `🔴 ${site.name} ligt eruit`,
        text: `${site.name} (${site.url}) reageert niet sinds ${formatDateTime(now)}.\n\nFout: ${result.error ?? "onbekend"}\n\n${link}`,
      });
      update.isUp = false;
      update.downSince = now;
    } else if (result.isUp && site.isUp !== true) {
      if (site.isUp === false) {
        const downFor = site.downSince
          ? ` na ${formatDuration(now.getTime() - site.downSince.getTime())}`
          : "";
        await sendEmail({
          to: alertEmail(),
          subject: `🟢 ${site.name} is weer online`,
          text: `${site.name} (${site.url}) is weer bereikbaar${downFor}.\n\n${link}`,
        });
      }
      update.isUp = true;
      update.downSince = null;
    }

    if (result.sslExpiresAt) {
      const days = daysUntil(result.sslExpiresAt, now);
      if (days < SSL_WARN_DAYS && !site.sslAlertSent) {
        await sendEmail({
          to: alertEmail(),
          subject:
            days < 0
              ? `🔒 SSL van ${site.name} is verlopen`
              : `🔒 SSL van ${site.name} verloopt over ${days} ${days === 1 ? "dag" : "dagen"}`,
          text: `Het SSL-certificaat van ${site.url} ${days < 0 ? "is verlopen op" : "verloopt op"} ${formatDate(result.sslExpiresAt)}.\n\nOp Vercel wordt dit normaal automatisch vernieuwd. Gebeurt dat niet, kijk dan of het domein nog naar Vercel wijst.\n\n${link}`,
        });
        update.sslAlertSent = true;
      } else if (days >= SSL_WARN_DAYS && site.sslAlertSent) {
        update.sslAlertSent = false; // renewed, re-arm the warning
      }
    }
  } catch (err) {
    console.error(`Alert for ${site.name} failed, will retry next run:`, err);
  }

  if (Object.keys(update).length) {
    await db.update(sites).set(update).where(eq(sites.id, site.id));
  }
}
