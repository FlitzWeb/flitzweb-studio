"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { contactLog, db, sites } from "@/db";
import { requireSession } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { conceptState, matchBranch, mergeBranch } from "@/lib/github";

const LIVE_BRANCH = "main";

/** Remembers that the concept link went to the client (so the Studio can say "waiting for approval"). */
export async function markConceptSent(siteId: number) {
  await requireSession();
  await db.update(sites).set({ conceptSentAt: new Date(), conceptApprovedAt: null }).where(eq(sites.id, siteId));
  revalidatePath("/", "layout");
}

/** The client said yes (or you undo that). */
export async function setConceptApproved(siteId: number, approved: boolean) {
  await requireSession();
  await db.update(sites).set({ conceptApprovedAt: approved ? new Date() : null }).where(eq(sites.id, siteId));
  revalidatePath("/", "layout");
}

const publishErrors = {
  "no-token": "De Studio heeft nog geen GitHub-sleutel (GITHUB_TOKEN), dus kan niet publiceren.",
  conflict: "Live en concept botsen met elkaar. Los dat eerst op in de code (main in de concept-branch mergen).",
  "no-access": "GitHub weigert toegang tot deze repo. Controleer de sleutel en de naam van de repo.",
  error: "Publiceren lukte niet. Probeer het zo nog eens.",
} as const;

/**
 * Puts the concept live: merges the concept branch into main on GitHub, after
 * which the host deploys it. Notes it in the client's contact log.
 */
export async function publishConcept(siteId: number): Promise<{ error?: string; done?: boolean }> {
  await requireSession();
  const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId) });
  if (!site?.repo) return { error: "Vul eerst de GitHub-repo in bij Bewerken." };

  const state = await conceptState(site.repo, LIVE_BRANCH, site.conceptBranch);
  if (state.ok && state.notLive.length === 0) return { error: "Er is niets nieuws om live te zetten." };

  const result = await mergeBranch(site.repo, LIVE_BRANCH, site.conceptBranch, `Zet concept live (${site.name})`);
  if (!result.ok) return { error: publishErrors[result.reason] };

  await db.update(sites).set({ conceptSentAt: null, conceptApprovedAt: null }).where(eq(sites.id, siteId));
  const changes = state.ok && state.conceptCommits.length ? `: ${state.conceptCommits.slice(0, 5).map((c) => c.message).join("; ")}` : "";
  await db.insert(contactLog).values({
    clientId: site.clientId,
    kind: "note",
    body: `Concept van ${site.name} live gezet${changes}`.slice(0, 600),
    occurredOn: todayISO(),
  });
  revalidatePath("/", "layout");
  return { done: true };
}

/**
 * Brings another branch's changes onto the concept branch (a merge on GitHub),
 * so work pushed under its own branch name shows up as the concept.
 */
export async function moveToConcept(siteId: number, branch: string): Promise<{ error?: string; done?: boolean }> {
  await requireSession();
  if (!/^[\w./-]+$/.test(branch)) return { error: "Onbekende branch." };
  const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId) });
  if (!site?.repo) return { error: "Vul eerst de GitHub-repo in bij Bewerken." };
  if (branch === LIVE_BRANCH || branch === site.conceptBranch) return { error: "Die branch is al live of al het concept." };

  const result = await mergeBranch(site.repo, site.conceptBranch, branch, `Zet ${branch} op ${site.conceptBranch}`);
  if (!result.ok) {
    return {
      error:
        result.reason === "conflict"
          ? `“${branch}” botst met wat al op het concept staat. Los dat op in de code.`
          : publishErrors[result.reason],
    };
  }
  // The concept changed, so an earlier "sent" or "approved" no longer covers it.
  await db.update(sites).set({ conceptSentAt: null, conceptApprovedAt: null }).where(eq(sites.id, siteId));
  revalidatePath("/", "layout");
  return { done: true };
}

/**
 * The concept is behind: brings what changed on live into it (a merge on GitHub). The concept's own
 * work stays, so an earlier "sent" or "approved" still holds.
 */
export async function pullLiveIntoConcept(siteId: number): Promise<{ error?: string; done?: boolean }> {
  await requireSession();
  const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId) });
  if (!site?.repo) return { error: "Vul eerst de GitHub-repo in bij Bewerken." };

  const result = await mergeBranch(site.repo, site.conceptBranch, LIVE_BRANCH, `Haal live binnen in ${site.conceptBranch}`);
  if (!result.ok) {
    return {
      error:
        result.reason === "conflict"
          ? "Live en concept hebben hetzelfde stuk anders aangepast. Los dat op in de code, of zet het concept gelijk aan live."
          : publishErrors[result.reason],
    };
  }
  revalidatePath("/", "layout");
  return { done: true };
}

/**
 * Makes the concept exactly the live site again. Its own changes leave the concept (GitHub keeps them
 * in the history), so there is nothing left to send or approve.
 */
export async function resetConceptToLive(siteId: number): Promise<{ error?: string; done?: boolean }> {
  await requireSession();
  const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId) });
  if (!site?.repo) return { error: "Vul eerst de GitHub-repo in bij Bewerken." };

  const result = await matchBranch(site.repo, site.conceptBranch, LIVE_BRANCH, `Zet ${site.conceptBranch} gelijk aan live`);
  if (!result.ok) {
    return {
      error:
        result.reason === "conflict"
          ? "Het concept veranderde net op GitHub. Ververs de pagina en probeer het opnieuw."
          : publishErrors[result.reason],
    };
  }
  await db.update(sites).set({ conceptSentAt: null, conceptApprovedAt: null }).where(eq(sites.id, siteId));
  revalidatePath("/", "layout");
  return { done: true };
}
