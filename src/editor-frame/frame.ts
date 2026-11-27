// Runs inside the editor frame of the Aanpassen tab (built to public/edit-frame.js by
// `npm run build:frame`; do not edit that file). The Studio serves a copy of the client's page in which
// every editable text carries data-fz="<id>" (features/editor/html.ts). This script makes those texts
// editable in place and reports every change to the Studio with postMessage. It never saves anything
// itself: the Studio does that, from the source on GitHub.
//
// The frame is sandboxed without allow-same-origin, so this page (and the site's own scripts) can't
// reach the Studio's login. Messages to the Studio go to the origin given in data-origin; messages
// are only taken from the parent window.

type ToStudio =
  | { type: "ready"; locked: number[] }
  | { type: "select"; id: number }
  | { type: "change"; id: number; html: string; text: string; changed: boolean }
  | { type: "done"; id: number }
  | { type: "locked"; id: number };

type FromStudio =
  | { fz: 1; type: "mode"; mode: "edit" | "browse" }
  | { fz: 1; type: "focus"; id: number }
  | { fz: 1; type: "revert"; id: number }
  | { fz: 1; type: "text"; id: number; value: string };

(() => {
  const script = document.currentScript as HTMLScriptElement | null;
  const origin = script?.dataset.origin || "*";
  const post = (msg: ToStudio) => parent.postMessage({ fz: 1, ...msg }, origin);

  // A sandboxed frame has no storage; sites that read it without try/catch would stop working.
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      void window[name];
    } catch {
      const data = new Map<string, string>();
      const shim = {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, String(v)),
        removeItem: (k: string) => void data.delete(k),
        clear: () => data.clear(),
        key: (i: number) => [...data.keys()][i] ?? null,
        get length() {
          return data.size;
        },
      };
      try {
        Object.defineProperty(window, name, { value: shim, configurable: true });
      } catch {
        /* leave it */
      }
    }
  }

  const style = document.createElement("style");
  style.textContent = `
html.fz-edit [data-fz]:not([data-fz-locked]) { cursor: text; }
html.fz-edit [data-fz]:not([data-fz-locked]):hover { outline: 2px dashed rgb(47 91 255 / .85) !important; outline-offset: 3px; }
html [data-fz][data-fz-changed]:not([data-fz-locked]):not([contenteditable="true"]):not([data-fz-flash]) { outline: 2px solid rgb(245 165 36 / .95) !important; outline-offset: 3px; }
html [data-fz][contenteditable="true"]:not([data-fz-locked]):not([data-fz-x]):not([data-fz-y]) { outline: 2px solid #2f5bff !important; outline-offset: 3px; cursor: text; }
html [data-fz][data-fz-flash]:not([data-fz-x]):not([data-fz-y]):not([data-fz-z]) { outline: 3px solid #2f5bff !important; outline-offset: 4px; }
`;
  document.documentElement.appendChild(style);
  document.documentElement.classList.add("fz-edit");

  const INLINE = new Set([
    "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "del", "dfn", "em", "i", "ins", "kbd", "mark",
    "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr",
  ]);
  const VOID = new Set(["br", "wbr"]);
  const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, "&nbsp;");
  const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/ /g, "&nbsp;");

  type Expected = { t: string; n: number };
  let expected: Record<string, Expected> = {};
  let lockSelectors: string[] = [];
  const originals = new WeakSet<Element>(); // elements that came from the source (they keep their attributes)
  const baseline = new Map<number, { html: string; clone: Node }>();
  /** Per text: its icons, and whether each one sat before the words (so a lost one can go back). */
  const leading = new Map<Element, boolean>();
  const lastHtml = new Map<number, string>();
  const atoms = new Map<number, Element[]>();
  let editing: HTMLElement | null = null;
  let startClone: Node | null = null;
  let mode: "edit" | "browse" = "edit";

  const idOf = (el: Element) => Number(el.getAttribute("data-fz"));
  const blockById = (id: number) => document.querySelector<HTMLElement>(`[data-fz="${id}"]`);

  /** Icons and pictures directly in a text (not one inside another). */
  const topAtoms = (root: Element) =>
    [...root.querySelectorAll("svg, img")].filter((el) => !el.parentElement?.closest("svg"));

  /** Elements inside, counting an icon as one (the same count the Studio made from the source). */
  function countElements(root: Element) {
    let n = 0;
    const walk = (el: Element) => {
      for (const c of el.children) {
        n++;
        if (c.tagName.toLowerCase() !== "svg") walk(c);
      }
    };
    walk(root);
    return n;
  }

  const markOriginal = (root: Element) => root.querySelectorAll("*").forEach((el) => originals.add(el));

  /** The inside of a text as clean HTML, the way the Studio will save it. */
  function clean(root: Element): string {
    const list = atoms.get(idOf(root)) ?? [];
    const out = (node: Node): string => {
      let html = "";
      node.childNodes.forEach((c) => {
        if (c.nodeType === Node.TEXT_NODE) {
          html += esc(c.nodeValue ?? "");
          return;
        }
        if (c.nodeType !== Node.ELEMENT_NODE) return;
        const el = c as Element;
        const atom = list.indexOf(el);
        if (atom >= 0) {
          html += `<fz-atom n="${atom}"></fz-atom>`;
          return;
        }
        const tag = el.tagName.toLowerCase();
        if (!INLINE.has(tag)) {
          html += out(el); // a <div> or <font> the browser added while typing: keep only its text
          return;
        }
        const original = originals.has(el);
        let attrs = "";
        for (const a of el.attributes) {
          if (a.name.startsWith("data-fz") || a.name === "contenteditable") continue;
          if (!original && a.name !== "href") continue; // the browser's own style="" spans
          attrs += ` ${a.name}="${escAttr(a.value)}"`;
        }
        if (!original && tag === "span" && !attrs) {
          html += out(el);
          return;
        }
        html += VOID.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>${out(el)}</${tag}>`;
      });
      return html;
    };
    // Spaces the browser turned into non-breaking ones while typing go back to normal spaces.
    return out(root)
      .replace(/&nbsp;(?=\s)|(?<=\s)&nbsp;/g, " ")
      .replace(/^&nbsp;|&nbsp;$/g, " ");
  }

  /** Is there visible text before `node` inside `root`? */
  function textBefore(root: Element, node: Node) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (node.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) return false;
      if ((t.nodeValue ?? "").trim()) return true;
    }
    return false;
  }

  /** Select-all-and-type deletes a button's icon; nobody means that, so it goes back where it was. */
  function keepIcons(el: HTMLElement) {
    for (const icon of atoms.get(idOf(el)) ?? []) {
      if (el.contains(icon)) continue;
      if (leading.get(icon)) el.prepend(icon);
      else el.append(icon);
    }
  }

  function lock(el: HTMLElement) {
    el.setAttribute("data-fz-locked", "");
    el.removeAttribute("data-fz-changed");
  }

  function takeBaseline() {
    try {
      const data = JSON.parse(document.getElementById("__fz-texts")?.textContent || "{}");
      expected = data.blocks ?? {};
      lockSelectors = data.lock ?? [];
    } catch {
      expected = {};
    }
    const lockedBySite = (el: Element) =>
      lockSelectors.some((sel) => {
        try {
          return el.matches(sel) || el.querySelector(sel) !== null;
        } catch {
          return false;
        }
      });
    const locked: number[] = [];
    document.querySelectorAll<HTMLElement>("[data-fz]").forEach((el) => {
      const id = idOf(el);
      const want = expected[id];
      // Filled or rebuilt by the site's own script (the menu, a discount percentage, words split
      // for an animation): what's on screen is not what's in the file, so it can't be edited here.
      if (!want || collapse(el.textContent ?? "") !== want.t || countElements(el) !== want.n || lockedBySite(el)) {
        lock(el);
        locked.push(id);
        return;
      }
      markOriginal(el);
      const icons = topAtoms(el);
      atoms.set(id, icons);
      icons.forEach((icon) => leading.set(icon, !textBefore(el, icon)));
      const html = clean(el);
      baseline.set(id, { html, clone: el.cloneNode(true) });
      lastHtml.set(id, html);
    });
    post({ type: "ready", locked });
  }

  function report(el: HTMLElement) {
    const id = idOf(el);
    const html = clean(el);
    lastHtml.set(id, html);
    const changed = html !== baseline.get(id)?.html;
    el.toggleAttribute("data-fz-changed", changed && el !== editing);
    post({ type: "change", id, html, text: collapse(el.innerText || el.textContent || ""), changed });
  }

  function restore(el: HTMLElement, from: Node) {
    const copy = from.cloneNode(true);
    el.replaceChildren(...Array.from(copy.childNodes));
    markOriginal(el);
    atoms.set(idOf(el), topAtoms(el));
  }

  function placeCaret(x: number, y: number) {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    const range = document.createRange();
    const pos = doc.caretPositionFromPoint?.(x, y);
    if (pos) range.setStart(pos.offsetNode, pos.offset);
    else {
      const r = document.caretRangeFromPoint?.(x, y);
      if (!r) return;
      range.setStart(r.startContainer, r.startOffset);
    }
    range.collapse(true);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  let pending: number | undefined;
  const onInput = () => {
    if (!editing) return;
    const el = editing;
    clearTimeout(pending);
    pending = window.setTimeout(() => report(el), 120);
  };

  function finish(cancel = false) {
    const el = editing;
    if (!el) return;
    if (cancel && startClone) restore(el, startClone);
    editing = null;
    startClone = null;
    clearTimeout(pending);
    el.removeAttribute("contenteditable");
    keepIcons(el);
    (atoms.get(idOf(el)) ?? []).forEach((a) => a.removeAttribute("contenteditable"));
    el.removeEventListener("input", onInput);
    el.removeEventListener("keydown", onKey);
    el.removeEventListener("blur", onBlur);
    report(el);
    post({ type: "done", id: idOf(el) });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) document.execCommand("insertLineBreak");
      else finish();
    }
  }
  const onBlur = () => finish();

  function start(el: HTMLElement, x?: number, y?: number) {
    const id = idOf(el);
    if (editing === el) return;
    finish();
    // The site's own script changed this text after it loaded (the language button, a timer).
    if (!baseline.has(id) || clean(el) !== lastHtml.get(id)) {
      lock(el);
      post({ type: "locked", id });
      return;
    }
    editing = el;
    startClone = el.cloneNode(true);
    el.removeAttribute("data-fz-changed");
    (atoms.get(id) ?? []).forEach((a) => a.setAttribute("contenteditable", "false"));
    el.setAttribute("contenteditable", "true");
    el.addEventListener("input", onInput);
    el.addEventListener("keydown", onKey);
    el.addEventListener("blur", onBlur);
    el.focus({ preventScroll: true });
    if (x !== undefined && y !== undefined) placeCaret(x, y);
    post({ type: "select", id });
  }

  document.addEventListener(
    "click",
    (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const block = target.closest<HTMLElement>("[data-fz]");
      const link = target.closest("a[href]");
      // Nothing navigates away from the page while editing (in-page # links still scroll).
      if (link && !(link.getAttribute("href") ?? "").startsWith("#")) e.preventDefault();
      if (mode !== "edit" || e.altKey || !block) return;
      e.preventDefault();
      e.stopPropagation();
      if (block.hasAttribute("data-fz-locked")) {
        post({ type: "locked", id: idOf(block) });
        return;
      }
      start(block, e.clientX, e.clientY);
    },
    true,
  );
  document.addEventListener("submit", (e) => e.preventDefault(), true);
  document.addEventListener("dragover", (e) => editing && e.preventDefault(), true);
  document.addEventListener("drop", (e) => e.preventDefault(), true);
  document.addEventListener(
    "paste",
    (e) => {
      if (!editing) return;
      e.preventDefault();
      const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/\s*\n\s*/g, " ");
      document.execCommand("insertText", false, text);
    },
    true,
  );

  window.addEventListener("message", (e: MessageEvent<FromStudio>) => {
    if (e.source !== parent || !e.data || e.data.fz !== 1) return;
    const msg = e.data;
    if (msg.type === "mode") {
      mode = msg.mode;
      finish();
      document.documentElement.classList.toggle("fz-edit", mode === "edit");
      return;
    }
    const el = blockById(msg.id);
    if (!el) return;
    if (msg.type === "focus") {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.setAttribute("data-fz-flash", "");
      setTimeout(() => el.removeAttribute("data-fz-flash"), 1200);
    } else if (msg.type === "revert") {
      if (editing === el) finish(true);
      const base = baseline.get(msg.id);
      if (base) restore(el, base.clone);
      report(el);
    } else if (msg.type === "text") {
      // Typed in the Studio's side panel (plain texts only, so nothing inside gets lost).
      if (!baseline.has(msg.id) || el.children.length) return;
      if (editing === el) finish();
      el.textContent = msg.value;
      report(el);
    }
  });

  // The site's scripts fill things in on load; compare with the file once they have run.
  const ready = () => setTimeout(takeBaseline, 400);
  if (document.readyState === "complete") ready();
  else window.addEventListener("load", ready, { once: true });
})();
