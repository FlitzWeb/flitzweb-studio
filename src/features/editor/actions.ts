"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, sites } from "@/db";
import { requireSession } from "@/lib/auth";
import { branchHead, commitFiles, isValidBranch, readRepoText } from "@/lib/github";
import { applyEdits, mapEditable, plainText, relocateEdits, type Edit } from "./html";
import { editorSite } from "./sites";

const LIVE_BRANCH = "main";

const input = z.object({
  siteId: z.number().int().positive(),
  branch: z.string().min(1).max(100),
  page: z.string().min(1).max(200),
  baseSha: z.string().regex(/^[0-9a-f]{40}$/),
  note: z.string().max(120).optional(),
  edits: z
    .array(z.object({ id: z.number().int().min(0), html: z.string().max(20_000).optional(), en: z.string().max(20_000).optional() }))
    .min(1)
    .max(300),
});

export type SaveResult = { ok: true; sha: string } | { ok: false; error: string; lost?: string[] };

const failures = {
  "no-token": "De Studio heeft geen GitHub-sleutel (GITHUB_TOKEN), dus opslaan kan hier niet.",
  "no-access": "GitHub weigert het opslaan. Controleer de sleutel en de naam van de repo.",
  error: "Opslaan lukte niet: GitHub gaf geen goed antwoord. Probeer het zo nog eens.",
} as const;

const quote = (text: string, max = 48) => `“${text.length > max ? `${text.slice(0, max - 1)}…` : text}”`;

/**
 * Saves the edits of one page as one commit on a work branch (never main). The edits were made on
 * the page as it was at `baseSha`; if the branch moved on since (Claude pushed something), each text
 * is found again in the newer page, and nothing is saved when one can't be found for certain.
 */
export async function saveEdits(raw: z.input<typeof input>): Promise<SaveResult> {
  await requireSession();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Er klopt iets niet aan de wijzigingen. Herlaad de pagina." };
  const { siteId, branch, page, baseSha, note, edits } = parsed.data;

  const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId) });
  if (!site?.repo) return { ok: false, error: "Deze site heeft nog geen GitHub-repo." };
  if (branch === LIVE_BRANCH || !isValidBranch(branch)) {
    return { ok: false, error: "Opslaan op de live site kan niet. Kies het concept of een andere werk-versie." };
  }
  const config = editorSite(site.repo);
  const pageInfo = config.pages.find((p) => p.path === page);
  if (!pageInfo) return { ok: false, error: "Deze pagina kan de Studio niet aanpassen." };

  const base = await readRepoText(site.repo, baseSha, page);
  if (base === null) return { ok: false, error: failures.error };
  const blocks = mapEditable(base);

  const wanted: Edit[] = edits.filter((e) => e.html !== undefined || e.en !== undefined);
  // The first line is what the Versies tab lists; the rest says what changed where.
  const described = wanted.map((e) => ({
    label: blocks[e.id]?.label ?? "Tekst",
    words: e.html !== undefined ? plainText(e.html) : `Engels: ${plainText(e.en ?? "")}`,
  }));
  const title = note?.trim()
    ? `Studio: ${note.trim()}`
    : described.length === 1
      ? `Studio: ${quote(described[0].words)} (${pageInfo.label})`
      : `Studio: ${described.length} teksten aangepast (${pageInfo.label})`;
  const lines = described.map((d) => `- ${d.label}: ${quote(d.words, 80)}`);
  const message = `${title}\n\nAangepast in FlitzWeb Studio, ${page}:\n${lines.join("\n")}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const head = await branchHead(site.repo, branch);
    if (!head) return { ok: false, error: `De versie “${branch}” is niet te vinden op GitHub.` };

    let source = base;
    let toApply = wanted;
    if (head !== baseSha) {
      const newer = await readRepoText(site.repo, head, page);
      if (newer === null) return { ok: false, error: `${pageInfo.label} bestaat niet meer op “${branch}”.` };
      const moved = relocateEdits(base, newer, wanted);
      if (moved.lost.length) {
        return {
          ok: false,
          error: "De pagina is intussen op GitHub veranderd en deze teksten kon ik daarin niet terugvinden. Er is niets opgeslagen. Herlaad de pagina en doe ze opnieuw.",
          lost: moved.lost.map((id) => `${blocks[id]?.label ?? "Tekst"}: ${quote(blocks[id]?.text ?? "")}`),
        };
      }
      source = newer;
      toApply = moved.edits;
    }

    const applied = applyEdits(source, toApply);
    if (!applied.ok) return { ok: false, error: "Opslaan zou meer veranderen dan alleen de teksten, dus de Studio deed het niet. Herlaad de pagina." };
    if (applied.content === source) return { ok: false, error: "Dat staat er al zo: er is niets veranderd." };

    const result = await commitFiles(site.repo, branch, head, [{ path: page, content: applied.content }], message);
    if (result.ok) {
      // The concept changed, so an earlier "sent" or "approved" no longer covers it.
      if (branch === site.conceptBranch) {
        await db.update(sites).set({ conceptSentAt: null, conceptApprovedAt: null }).where(eq(sites.id, siteId));
      }
      revalidatePath(`/sites/${siteId}`, "layout");
      return { ok: true, sha: result.sha };
    }
    if (result.reason !== "moved") return { ok: false, error: failures[result.reason] };
    // Someone pushed between reading and saving: start over on top of that.
  }
  return { ok: false, error: "De versie veranderde steeds tijdens het opslaan. Probeer het zo nog eens." };
}
