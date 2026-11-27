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

type FileChange = { filename: string; status: string; sha: string | null };

export type Comparison =
  | {
      ok: true;
      /** Commits on the concept branch that are not live yet. */
      ahead: number;
      /**
       * Commits on `base` that `head` lacks. On main this includes the merge commit every "Zet live"
       * leaves behind, so it is not a count of real changes (compare the other way and look at `files`).
       */
      behind: number;
      commits: { sha: string; message: string; date: string | null }[];
      files: string[];
      /** The same files with what they became on `head`, to tell identical changes on both sides apart. */
      changes: FileChange[];
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
      files?: { filename: string; status: string; sha?: string | null }[];
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
      changes: (data.files ?? []).map((f) => ({ filename: f.filename, status: f.status, sha: f.sha ?? null })),
    };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export type ConceptState =
  | {
      ok: true;
      /** Live and concept hold exactly the same files. */
      equal: boolean;
      /** Files whose concept version is not live yet. */
      notLive: string[];
      /** Commits behind `notLive`, newest first (merge commits and ones already live under the same message left out). */
      conceptCommits: { sha: string; message: string; date: string | null }[];
      /** Files changed on live that the concept doesn't have: the concept is behind. */
      missing: string[];
      /** Commits behind `missing` (same filtering). */
      liveCommits: { sha: string; message: string; date: string | null }[];
    }
  | { ok: false; reason: "no-branch" | "no-access" | "error" };

/**
 * Where the concept stands against live, judged by content. Commit counts lie here: every "Zet live"
 * leaves a merge commit on live, and a fix copied to both branches shows up as a commit on each side.
 * So both sides' changes since the branches split are compared file by file, and a file changed the
 * same way on both sides counts as neither new nor missing.
 */
export async function conceptState(repo: string, live: string, concept: string): Promise<ConceptState> {
  const [toConcept, toLive] = await Promise.all([compareBranches(repo, live, concept), compareBranches(repo, concept, live)]);
  if (!toConcept.ok) return toConcept;
  if (!toLive.ok) return toLive;

  const outcome = (c: FileChange) => (c.status === "removed" ? "removed" : c.sha);
  const onLive = new Map(toLive.changes.map((c) => [c.filename, outcome(c)]));
  const onConcept = new Map(toConcept.changes.map((c) => [c.filename, outcome(c)]));
  const notLive = toConcept.changes.filter((c) => onLive.get(c.filename) !== outcome(c)).map((c) => c.filename);
  const missing = toLive.changes.filter((c) => onConcept.get(c.filename) !== outcome(c)).map((c) => c.filename);

  // A commit copied to the other branch keeps its message, so those are left out of both lists.
  const liveMessages = new Set(toLive.commits.map((c) => c.message));
  const conceptMessages = new Set(toConcept.commits.map((c) => c.message));
  return {
    ok: true,
    equal: notLive.length === 0 && missing.length === 0,
    notLive,
    conceptCommits: notLive.length ? toConcept.commits.filter((c) => !liveMessages.has(c.message)) : [],
    missing,
    liveCommits: missing.length ? toLive.commits.filter((c) => !conceptMessages.has(c.message)) : [],
  };
}

const refPath = (branch: string) => `heads/${branch.split("/").map(encodeURIComponent).join("/")}`;

/** One JSON call to a repo's API (no caching), with the status and the parsed body when it succeeded. */
async function repoCall(repo: string, path: string, init?: { method: string; body: unknown }) {
  const res = await fetch(`${API}/repos/${repo}/${path}`, {
    method: init?.method ?? "GET",
    headers: { ...headers(), ...(init ? { "Content-Type": "application/json" } : {}) },
    body: init ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  return { status: res.status, data: res.ok ? ((await res.json()) as Record<string, unknown>) : null };
}

const denied = (status: number) => status === 401 || status === 403 || status === 404;

/**
 * Makes `branch` hold exactly what `target` holds, as one new commit on top of `branch` whose parents
 * are both branches. Nothing is force-pushed: the old work stays in the history, and because `target`
 * becomes part of `branch`'s history, the two count as level afterwards.
 */
export async function matchBranch(repo: string, branch: string, target: string, message: string): Promise<MergeResult> {
  if (!hasGithubToken()) return { ok: false, reason: "no-token" };
  if (!VALID_REPO.test(repo)) return { ok: false, reason: "error" };
  const call = (path: string, init?: { method: string; body: unknown }) => repoCall(repo, path, init);
  try {
    const [from, to] = await Promise.all([call(`git/ref/${refPath(branch)}`), call(`git/ref/${refPath(target)}`)]);
    if (!from.data || !to.data) return { ok: false, reason: denied(from.status) || denied(to.status) ? "no-access" : "error" };
    const fromSha = (from.data.object as { sha: string }).sha;
    const toSha = (to.data.object as { sha: string }).sha;

    const [fromCommit, toCommit] = await Promise.all([call(`git/commits/${fromSha}`), call(`git/commits/${toSha}`)]);
    if (!fromCommit.data || !toCommit.data) return { ok: false, reason: "error" };
    const tree = (toCommit.data.tree as { sha: string }).sha;
    // Same files already: nothing to change.
    if ((fromCommit.data.tree as { sha: string }).sha === tree) return { ok: true, merged: false };

    const created = await call("git/commits", { method: "POST", body: { message, tree, parents: [fromSha, toSha] } });
    if (!created.data) return { ok: false, reason: denied(created.status) ? "no-access" : "error" };
    // No force: if someone pushed to the branch in the meantime this fails instead of dropping their work.
    const moved = await call(`git/refs/${refPath(branch)}`, { method: "PATCH", body: { sha: created.data.sha, force: false } });
    if (moved.status === 422) return { ok: false, reason: "conflict" };
    if (!moved.data) return { ok: false, reason: denied(moved.status) ? "no-access" : "error" };
    return { ok: true, merged: true };
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

// ---------------------------------------------------------------------------
// Reading files and committing them (the Aanpassen tab, features/editor).

const VALID_BRANCH = /^[\w.-]+(?:\/[\w.-]+)*$/;
export const isValidBranch = (branch: string) => VALID_BRANCH.test(branch) && !branch.includes("..");

/** The commit a branch points at now, or null (no such branch, no access, GitHub down). */
export async function branchHead(repo: string, branch: string): Promise<string | null> {
  if (!VALID_REPO.test(repo) || !isValidBranch(branch)) return null;
  try {
    const ref = await repoCall(repo, `git/ref/${refPath(branch)}`);
    const sha = (ref.data?.object as { sha?: string } | undefined)?.sha;
    return typeof sha === "string" ? sha : null;
  } catch {
    return null;
  }
}

const VALID_SHA = /^[0-9a-f]{40}$/;

export type RepoFile = { ok: true; bytes: ArrayBuffer } | { ok: false; reason: "not-found" | "no-access" | "error" };

/**
 * One file of a repo at an exact commit. A commit never changes, so the answer is kept in Next's data
 * cache. With GITHUB_TOKEN this uses the API (private repos too); without it the public raw host,
 * which has no tight rate limit.
 */
export async function readRepoFile(repo: string, sha: string, path: string): Promise<RepoFile> {
  if (!VALID_REPO.test(repo) || !VALID_SHA.test(sha)) return { ok: false, reason: "error" };
  const filePath = path.split("/").map(encodeURIComponent).join("/");
  const url = hasGithubToken()
    ? `${API}/repos/${repo}/contents/${filePath}?ref=${sha}`
    : `https://raw.githubusercontent.com/${repo}/${sha}/${filePath}`;
  try {
    const res = await fetch(url, {
      headers: hasGithubToken() ? { ...headers(), Accept: "application/vnd.github.raw+json" } : { "User-Agent": "flitzweb-studio" },
      cache: "force-cache",
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404) return { ok: false, reason: "not-found" };
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "no-access" };
    if (!res.ok) return { ok: false, reason: "error" };
    return { ok: true, bytes: await res.arrayBuffer() };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** The same, as text (HTML, CSS, JS), or null when it can't be read. */
export async function readRepoText(repo: string, sha: string, path: string): Promise<string | null> {
  const file = await readRepoFile(repo, sha, path);
  return file.ok ? new TextDecoder().decode(file.bytes) : null;
}

export type CommitResult =
  | { ok: true; sha: string }
  | { ok: false; reason: "no-token" | "moved" | "no-access" | "error" };

/**
 * Writes text files as one new commit on `branch`, on top of `parent`. The branch only moves if it
 * still points at `parent` (no force), so work pushed in the meantime is never overwritten: that
 * comes back as "moved" and the caller decides what to do.
 */
export async function commitFiles(
  repo: string,
  branch: string,
  parent: string,
  files: { path: string; content: string }[],
  message: string,
): Promise<CommitResult> {
  if (!hasGithubToken()) return { ok: false, reason: "no-token" };
  if (!VALID_REPO.test(repo) || !isValidBranch(branch) || !VALID_SHA.test(parent)) return { ok: false, reason: "error" };
  const call = (path: string, init?: { method: string; body: unknown }) => repoCall(repo, path, init);
  try {
    const parentCommit = await call(`git/commits/${parent}`);
    if (!parentCommit.data) return { ok: false, reason: denied(parentCommit.status) ? "no-access" : "error" };
    const tree = await call("git/trees", {
      method: "POST",
      body: {
        base_tree: (parentCommit.data.tree as { sha: string }).sha,
        tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })),
      },
    });
    if (!tree.data) return { ok: false, reason: denied(tree.status) ? "no-access" : "error" };
    const created = await call("git/commits", { method: "POST", body: { message, tree: tree.data.sha, parents: [parent] } });
    if (!created.data) return { ok: false, reason: denied(created.status) ? "no-access" : "error" };
    const moved = await call(`git/refs/${refPath(branch)}`, { method: "PATCH", body: { sha: created.data.sha, force: false } });
    if (moved.status === 422) return { ok: false, reason: "moved" };
    if (!moved.data) return { ok: false, reason: denied(moved.status) ? "no-access" : "error" };
    return { ok: true, sha: created.data.sha as string };
  } catch {
    return { ok: false, reason: "error" };
  }
}
