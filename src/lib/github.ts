import "server-only";

// The little bit of GitHub the Studio needs: what differs between two branches,
// and merging one into the other. Set GITHUB_TOKEN (a fine-grained token with
// "Contents: read and write" on the site repos) to use private repos and to
// publish; without it only public repos can be compared.

const API = "https://api.github.com";

export const hasGithubToken = () => Boolean(process.env.GITHUB_TOKEN);

const headers = () => ({
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "flitzweb-studio",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

const VALID_REPO = /^[\w.-]+\/[\w.-]+$/;

export type Comparison =
  | {
      ok: true;
      /** Commits on the concept branch that are not live yet. */
      ahead: number;
      /** Commits that went live without being on the concept branch. */
      behind: number;
      commits: { sha: string; message: string; date: string | null }[];
      files: string[];
    }
  | { ok: false; reason: "no-branch" | "no-access" | "error" };

/** What `head` has that `base` doesn't. */
export async function compareBranches(repo: string, base: string, head: string): Promise<Comparison> {
  if (!VALID_REPO.test(repo)) return { ok: false, reason: "error" };
  try {
    const res = await fetch(`${API}/repos/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, {
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return { ok: false, reason: hasGithubToken() ? "no-branch" : "no-access" };
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "no-access" };
    if (!res.ok) return { ok: false, reason: "error" };
    const data = (await res.json()) as {
      ahead_by: number;
      behind_by: number;
      commits: { sha: string; parents?: unknown[]; commit: { message: string; author: { date?: string } | null } }[];
      files?: { filename: string }[];
    };
    return {
      ok: true,
      ahead: data.ahead_by,
      behind: data.behind_by,
      // Merge commits only join branches; they are not a change the client would recognise.
      commits: data.commits
        .filter((c) => (c.parents?.length ?? 1) < 2)
        .map((c) => ({ sha: c.sha, message: c.commit.message.split("\n")[0], date: c.commit.author?.date ?? null }))
        .reverse(),
      files: (data.files ?? []).map((f) => f.filename),
    };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Branch names of a repo (first 50), or null when GitHub can't be read. */
export async function listBranches(repo: string): Promise<string[] | null> {
  if (!VALID_REPO.test(repo)) return null;
  try {
    const res = await fetch(`${API}/repos/${repo}/branches?per_page=50`, {
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { name: string }[]).map((b) => b.name);
  } catch {
    return null;
  }
}

export type MergeResult = { ok: true; merged: boolean } | { ok: false; reason: "no-token" | "conflict" | "no-access" | "error" };

/** Merges `head` into `base` (a normal merge commit). `merged: false` means there was nothing to merge. */
export async function mergeBranch(repo: string, base: string, head: string, message: string): Promise<MergeResult> {
  if (!hasGithubToken()) return { ok: false, reason: "no-token" };
  if (!VALID_REPO.test(repo)) return { ok: false, reason: "error" };
  try {
    const res = await fetch(`${API}/repos/${repo}/merges`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ base, head, commit_message: message }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 201) return { ok: true, merged: true };
    if (res.status === 204) return { ok: true, merged: false };
    if (res.status === 409) return { ok: false, reason: "conflict" };
    if (res.status === 401 || res.status === 403 || res.status === 404) return { ok: false, reason: "no-access" };
    return { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}
