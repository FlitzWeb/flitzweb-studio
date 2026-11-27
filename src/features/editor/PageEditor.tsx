"use client";

import { ExternalLink, Monitor, MousePointerClick, Save, Smartphone, Type, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { saveEdits } from "./actions";
import type { EditorPage } from "./sites";
import styles from "./editor.module.css";

type BlockInfo = { id: number; label: string; text: string; en: string | null; plain: boolean };

type Props = {
  siteId: number;
  branch: string;
  branches: string[];
  conceptBranch: string;
  pages: EditorPage[];
  page: string;
  baseSha: string;
  frameSrc: string;
  blocks: BlockInfo[];
  english: boolean;
  note: string | null;
  conceptUrl: string | null;
  canSave: boolean;
  sandbox: string;
};

/** What changed in one text: its new inside (absent = unchanged) and/or its new English version. */
type Change = { html?: string; text: string; en?: string };

type FrameMessage =
  | { fz: 1; type: "ready"; locked: number[] }
  | { fz: 1; type: "select"; id: number }
  | { fz: 1; type: "change"; id: number; html: string; text: string; changed: boolean }
  | { fz: 1; type: "done"; id: number }
  | { fz: 1; type: "locked"; id: number };

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; sha: string; tries: number }
  | { kind: "error"; error: string; lost?: string[] };

const WIDTH = { phone: 390, desktop: 1280 } as const;

const noSubscribe = () => () => {};
/** False while rendering on the server and hydrating, true after. */
const useHydrated = () => useSyncExternalStore(noSubscribe, () => true, () => false);
const snippet = (text: string, max = 70) => (text.length > max ? `${text.slice(0, max - 1)}…` : text) || "(leeg)";

export function PageEditor(props: Props) {
  const { siteId, branch, branches, conceptBranch, pages, page, english, note, conceptUrl, canSave, sandbox } = props;
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  // The frame keeps showing the version it was opened on while there are unsaved changes; a newer
  // version from the server (after saving) is taken over once everything is saved.
  const [shown, setShown] = useState({ baseSha: props.baseSha, frameSrc: props.frameSrc, blocks: props.blocks });
  const [changes, setChanges] = useState<Record<number, Change>>({});
  const dirty = Object.keys(changes).length > 0;
  if (shown.baseSha !== props.baseSha && !dirty) {
    setShown({ baseSha: props.baseSha, frameSrc: props.frameSrc, blocks: props.blocks });
  }
  const blocks = shown.blocks;

  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [panelText, setPanelText] = useState<{ id: number; value: string } | null>(null);
  const [mode, setMode] = useState<"edit" | "browse">("edit");
  const [width, setWidth] = useState<keyof typeof WIDTH>("desktop");
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [noteText, setNoteText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();
  // A streamed page moves its parts into place after they arrive, and moving an iframe reloads it.
  // So the frame only gets its address once the page is settled in the browser.
  const hydrated = useHydrated();

  const send = (msg: Record<string, unknown>) => frame.current?.contentWindow?.postMessage({ fz: 1, ...msg }, "*");

  useEffect(() => {
    const onMessage = (e: MessageEvent<FrameMessage>) => {
      if (e.source !== frame.current?.contentWindow || !e.data || e.data.fz !== 1) return;
      const msg = e.data;
      if (msg.type === "ready") {
        setReady(true);
        setLocked(new Set(msg.locked));
      } else if (msg.type === "select") {
        setSelected(msg.id);
      } else if (msg.type === "locked") {
        setSelected(msg.id);
        setLocked((prev) => new Set(prev).add(msg.id));
      } else if (msg.type === "change") {
        setChanges((prev) => {
          const next = { ...prev };
          const current = next[msg.id];
          if (msg.changed) next[msg.id] = { ...current, html: msg.html, text: msg.text };
          else if (current?.en !== undefined) next[msg.id] = { en: current.en, text: msg.text };
          else delete next[msg.id];
          return next;
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // After saving: wait for the page with the new commit (GitHub can take a moment to report it).
  const savedSha = status.kind === "saved" ? status.sha : null;
  const savedTries = status.kind === "saved" ? status.tries : 0;
  const waiting = savedSha !== null && shown.baseSha !== savedSha;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      if (savedTries >= 3) {
        // Saved, but GitHub still reports the old version: stop waiting and say so.
        setReady(true);
        setStatus({ kind: "error", error: "Opgeslagen, maar GitHub laat de nieuwe versie nog niet zien. Herlaad de pagina over een minuutje." });
        return;
      }
      setStatus((s) => (s.kind === "saved" ? { ...s, tries: s.tries + 1 } : s));
      startTransition(() => router.refresh());
    }, 2500);
    return () => clearTimeout(timer);
  }, [waiting, savedTries, router]);

  const frameWidth = WIDTH[width];
  const scale = box.w ? Math.min(1, box.w / frameWidth) : 1;
  const left = Math.max(0, (box.w - frameWidth * scale) / 2);

  const go = (next: { pagina?: string; versie?: string }) => {
    if (dirty && !window.confirm("Je hebt wijzigingen die nog niet zijn opgeslagen. Weggooien?")) return;
    const q = new URLSearchParams({ pagina: next.pagina ?? page, versie: next.versie ?? branch });
    setChanges({});
    router.push(`/sites/${siteId}/aanpassen?${q}`, { scroll: false });
  };

  const switchMode = (next: "edit" | "browse") => {
    setMode(next);
    send({ type: "mode", mode: next });
  };

  const revert = (id: number) => {
    send({ type: "revert", id });
    setChanges((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const setEnglish = (id: number, value: string) => {
    const original = blocks[id]?.en ?? "";
    setChanges((prev) => {
      const next = { ...prev };
      const current = next[id];
      const text = current?.text ?? blocks[id]?.text ?? "";
      if (value === original) {
        if (current?.html !== undefined) next[id] = { html: current.html, text };
        else delete next[id];
      } else next[id] = { ...current, text, en: value };
      return next;
    });
  };

  const save = () => {
    const edits = Object.entries(changes).map(([id, c]) => ({ id: Number(id), html: c.html, en: c.en }));
    if (!edits.length) return;
    setStatus({ kind: "saving" });
    startTransition(async () => {
      const result = await saveEdits({ siteId, branch, page, baseSha: shown.baseSha, note: noteText || undefined, edits });
      if (!result.ok) {
        setStatus({ kind: "error", error: result.error, lost: result.lost });
        return;
      }
      setChanges({});
      setNoteText("");
      setSelected(null);
      setReady(false);
      setStatus({ kind: "saved", sha: result.sha, tries: 0 });
      router.refresh();
    });
  };

  const changed = Object.entries(changes)
    .map(([id, c]) => ({ id: Number(id), ...c }))
    .sort((a, b) => a.id - b.id);
  const sel = selected !== null ? blocks[selected] : null;
  const selChange = selected !== null ? changes[selected] : undefined;
  const pageLabel = pages.find((p) => p.path === page)?.label ?? page;
  const onConcept = branch === conceptBranch;

  return (
    <div className={styles.editor}>
      <div className={styles.main}>
        <div className={styles.toolbar}>
          {pages.length > 1 && (
            <label className={styles.pick}>
              <span>Pagina</span>
              <select className="input" value={page} onChange={(e) => go({ pagina: e.target.value })}>
                {pages.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {branches.length > 1 && (
            <label className={styles.pick}>
              <span>Versie</span>
              <select className="input" value={branch} onChange={(e) => go({ versie: e.target.value })}>
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b === conceptBranch ? `${b} (voor de klant)` : b}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={styles.pills} role="group" aria-label="Klikken in de pagina">
            <button type="button" className={styles.pill} aria-pressed={mode === "edit"} onClick={() => switchMode("edit")}>
              <Type aria-hidden="true" />
              Aanpassen
            </button>
            <button type="button" className={styles.pill} aria-pressed={mode === "browse"} onClick={() => switchMode("browse")}>
              <MousePointerClick aria-hidden="true" />
              Klikken
            </button>
          </div>
          <div className={styles.pills} role="group" aria-label="Breedte">
            <button type="button" className={styles.pill} aria-pressed={width === "phone"} onClick={() => setWidth("phone")} title="Telefoon (390 px)">
              <Smartphone aria-hidden="true" />
              <span className={styles.pillText}>Telefoon</span>
            </button>
            <button type="button" className={styles.pill} aria-pressed={width === "desktop"} onClick={() => setWidth("desktop")} title="Computer (1280 px)">
              <Monitor aria-hidden="true" />
              <span className={styles.pillText}>Computer</span>
            </button>
          </div>
          {onConcept && conceptUrl && (
            <a href={conceptUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
              Concept-adres
              <ExternalLink aria-hidden="true" />
            </a>
          )}
        </div>

        <div className={styles.stage} ref={stage}>
          <iframe
            ref={frame}
            key={shown.frameSrc}
            src={hydrated ? shown.frameSrc : undefined}
            title={`${pageLabel} om aan te passen`}
            // Scripts run (the site needs them), but without allow-same-origin the page can't reach the Studio.
            sandbox={sandbox}
            onLoad={() => send({ type: "mode", mode })}
            style={{ width: frameWidth, height: box.h / scale || "100%", left, transform: `scale(${scale})` }}
          />
          {(!ready || waiting) && <div className={styles.loading}>{waiting ? "Nieuwe versie laden…" : "Pagina laden…"}</div>}
        </div>
      </div>

      <aside className={styles.side}>
        <section className={styles.card}>
          {sel ? (
            <>
              <div className={styles.cardHead}>
                <h2>{sel.label}</h2>
                {selChange && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => revert(sel.id)}>
                    <Undo2 aria-hidden="true" />
                    Terug
                  </button>
                )}
              </div>
              {locked.has(sel.id) ? (
                <p className={styles.hint} data-tone="warn">
                  Deze tekst vult de site zelf in (bijvoorbeeld uit de menukaart of een kortingsactie), of de site veranderde hem na het laden.
                  Die kun je hier niet aanpassen.
                </p>
              ) : (
                <>
                  {sel.plain && (
                    <label className="field">
                      <span className="label">Tekst</span>
                      <textarea
                        className="input"
                        rows={3}
                        value={panelText?.id === sel.id ? panelText.value : (selChange?.text ?? sel.text)}
                        onChange={(e) => {
                          setPanelText({ id: sel.id, value: e.target.value });
                          send({ type: "text", id: sel.id, value: e.target.value });
                        }}
                        onBlur={() => setPanelText(null)}
                      />
                    </label>
                  )}
                  {!sel.plain && <p className={styles.hint}>Typ in de pagina. Vet en cursief blijven staan.</p>}
                  {english && sel.en !== null && (
                    <label className="field">
                      <span className="label">Engels</span>
                      <textarea
                        className="input"
                        rows={3}
                        value={selChange?.en ?? sel.en}
                        onChange={(e) => setEnglish(sel.id, e.target.value)}
                      />
                      {selChange?.html !== undefined && selChange.en === undefined && (
                        <span className={styles.hint} data-tone="warn">
                          Je hebt de Nederlandse tekst aangepast. Klopt het Engels nog?
                        </span>
                      )}
                    </label>
                  )}
                  {english && sel.en === null && <p className={styles.hint}>Deze tekst heeft geen Engelse versie.</p>}
                </>
              )}
            </>
          ) : (
            <>
              <h2>Teksten aanpassen</h2>
              <p className={styles.hint}>
                Klik op een tekst in de pagina en typ. <kbd className="kbd">Enter</kbd> is klaar, <kbd className="kbd">Shift</kbd>+<kbd className="kbd">Enter</kbd> een nieuwe regel,{" "}
                <kbd className="kbd">Esc</kbd> zet hem terug. Wil je een knop of menu gebruiken, kies dan Klikken (of houd <kbd className="kbd">⌥</kbd> ingedrukt).
              </p>
            </>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2>Wijzigingen{changed.length ? ` (${changed.length})` : ""}</h2>
          </div>
          {changed.length === 0 ? (
            <p className={styles.hint}>
              {status.kind === "saved" ? (
                <>
                  Opgeslagen op {branch}.{" "}
                  {onConcept ? (
                    <>
                      Bij <Link href={`/sites/${siteId}/versies`}>Versies</Link> staat het klaar om naar de klant te sturen.
                    </>
                  ) : (
                    "Het staat nog niet op het concept."
                  )}
                </>
              ) : (
                "Nog niets aangepast."
              )}
            </p>
          ) : (
            <ul className={styles.changes}>
              {changed.map((c) => (
                <li key={c.id}>
                  <button type="button" className={styles.changeText} onClick={() => {
                      setSelected(c.id);
                      send({ type: "focus", id: c.id });
                    }}>
                    <span className={styles.changeLabel}>{blocks[c.id]?.label ?? "Tekst"}</span>
                    {c.html !== undefined && <span>{snippet(c.text)}</span>}
                    {c.en !== undefined && <span className={styles.changeEn}>EN: {snippet(c.en.replace(/<[^>]*>/g, ""))}</span>}
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => revert(c.id)} aria-label="Terugzetten">
                    <Undo2 aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {status.kind === "error" && (
            <div className={styles.error} role="alert">
              <p>{status.error}</p>
              {status.lost && (
                <ul>
                  {status.lost.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {changed.length > 0 && (
            <div className={styles.saveRow}>
              <input
                className="input"
                value={noteText}
                maxLength={120}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Wat heb je aangepast? (optioneel)"
                aria-label="Korte omschrijving voor bij Versies"
              />
              <button type="button" className="btn btn-primary" disabled={!canSave || status.kind === "saving"} onClick={save}>
                <Save aria-hidden="true" />
                {status.kind === "saving" ? "Opslaan…" : `Opslaan op ${branch}`}
              </button>
              {!canSave && <p className={styles.hint} data-tone="warn">De Studio heeft hier geen GitHub-sleutel (GITHUB_TOKEN), dus opslaan kan niet.</p>}
            </div>
          )}
        </section>

        {note && <p className={styles.footnote}>{note}</p>}
      </aside>
    </div>
  );
}
