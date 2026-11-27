import { Pencil } from "lucide-react";
import Link from "next/link";
import { PageEditor } from "@/features/editor/PageEditor";
import styles from "@/features/editor/editor.module.css";
import { frameToken } from "@/features/editor/frameToken";
import { mapEditable } from "@/features/editor/html";
import { editorSite } from "@/features/editor/sites";
import { branchHead, hasGithubToken, listBranches, readRepoText } from "@/lib/github";
import type { TabProps } from "./registry";
import tabStyles from "./tabs.module.css";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

function Notice({ title, children, siteId }: { title: string; children: React.ReactNode; siteId?: number }) {
  return (
    <section className={tabStyles.panel}>
      <h2 className={tabStyles.h2}>{title}</h2>
      <p className={tabStyles.muted}>{children}</p>
      {siteId && (
        <p className={styles.setup}>
          <Link href={`/sites/${siteId}/bewerken`} className="btn">
            <Pencil aria-hidden="true" />
            Instellen
          </Link>
        </p>
      )}
    </section>
  );
}

/**
 * Change the texts of a client's site yourself: the page from GitHub in a frame, click a text and
 * type, save as one commit on the concept. See features/editor and README → "Aanpassen".
 */
export async function EditTab({ site, searchParams }: TabProps) {
  if (!site.repo) {
    return (
      <Notice title="Nog geen GitHub-repo" siteId={site.id}>
        Vul eerst de repo van deze site in onder Bewerken → Versies. Daarna kun je hier de teksten zelf aanpassen.
      </Notice>
    );
  }
  const repo = site.repo;
  const config = editorSite(repo);
  const page = config.pages.find((p) => p.path === one(searchParams.pagina)) ?? config.pages[0];

  // Never main: changes go to a work branch and reach the live site through Versies → Zet live.
  const branches = ((await listBranches(repo)) ?? [site.conceptBranch]).filter((b) => b !== "main");
  if (!branches.includes(site.conceptBranch)) branches.unshift(site.conceptBranch);
  const asked = one(searchParams.versie);
  const branch = asked && branches.includes(asked) ? asked : site.conceptBranch;

  const head = await branchHead(repo, branch);
  if (!head) {
    return (
      <Notice title="Versie niet gevonden" siteId={site.id}>
        {`De Studio kan de versie “${branch}” van ${repo} niet lezen. Bestaat die branch op GitHub? Voor een privé-repo is een GitHub-sleutel nodig (GITHUB_TOKEN).`}
      </Notice>
    );
  }
  const source = await readRepoText(repo, head, page.path);
  if (source === null) {
    return <Notice title="Pagina niet gevonden">{`${page.path} staat niet in “${branch}”.`}</Notice>;
  }

  const blocks = mapEditable(source).map((b) => ({
    id: b.id,
    label: b.label,
    text: b.text,
    en: b.en?.value ?? null,
    // Only text, no formatting or icons: it can also be typed in the side panel.
    plain: !b.inner.includes("<"),
  }));

  return (
    <PageEditor
      key={`${branch}:${page.path}`}
      siteId={site.id}
      branch={branch}
      branches={branches}
      conceptBranch={site.conceptBranch}
      pages={config.pages}
      page={page.path}
      baseSha={head}
      frameSrc={`/edit-frame/${await frameToken(repo, head)}/${page.path}`}
      blocks={blocks}
      english={Boolean(config.english)}
      note={config.note ?? null}
      conceptUrl={site.conceptUrl}
      canSave={hasGithubToken()}
      // Claude's browser pane refuses frames with an opaque origin; for testing there only (never in
      // production) EDITOR_FRAME_SAME_ORIGIN=1 lets the frame keep its origin.
      sandbox={process.env.NODE_ENV !== "production" && process.env.EDITOR_FRAME_SAME_ORIGIN === "1" ? "allow-scripts allow-same-origin" : "allow-scripts"}
    />
  );
}
