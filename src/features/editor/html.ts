// The HTML side of the Aanpassen tab: which parts of a page are editable text, the copy of the page
// shown in the editor frame, and putting edits back into the source.
//
// The source file is never re-serialised. Everything works on character offsets from parse5's source
// locations, so an edit replaces exactly the inside of one element and every other byte of the file
// (indentation, comments, attribute order, entities) stays as it was.
import { parse, parseFragment, type DefaultTreeAdapterTypes as T } from "parse5";

type Element = T.Element;
type ChildNode = T.ChildNode;
type ParentNode = T.ParentNode;

/** Formatting that may sit inside an editable text. Anything else makes the element a container. */
const INLINE = new Set([
  "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "del", "dfn", "em", "i", "ins", "kbd", "mark",
  "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr",
]);
const VOID = new Set(["br", "wbr"]);
/**
 * Icons and pictures inside a text (a button's arrow). They can't be edited, so they travel as
 * `<fz-atom n="0">` placeholders and come back from the source exactly as they were.
 */
const ATOMS = new Set(["svg", "img"]);

/** Never editable, and never looked inside. */
const SKIP = new Set([
  "head", "script", "style", "template", "noscript", "svg", "math", "textarea", "select", "option", "optgroup",
  "iframe", "object", "video", "audio", "canvas", "picture",
]);

/** One editable text on the page. */
export type Block = {
  /** Number in document order; only valid for the exact source it was made from. */
  id: number;
  tag: string;
  /** What the editor calls it ("Kop · #prijzen"). */
  label: string;
  /** Where ` data-fz="id"` goes in the frame copy (right after the tag name). */
  insertAt: number;
  /** The element's content in the source: `source.slice(innerStart, innerEnd) === inner`. */
  innerStart: number;
  innerEnd: number;
  inner: string;
  /** The visible text, whitespace collapsed (what the browser's textContent should match). */
  text: string;
  /** The English version on flitzweb.nl (`data-en` on the element itself), with its place in the start tag. */
  en: { value: string; start: number; end: number } | null;
  /** Source of each icon or picture inside, in order (see ATOMS). */
  atoms: string[];
  /** Elements inside (an icon counts as one): the frame checks the site's scripts didn't rebuild it. */
  elements: number;
};

const isElement = (node: ChildNode | ParentNode): node is Element => "tagName" in node;
const children = (node: ParentNode): ChildNode[] => ("content" in node && node.nodeName === "template" ? [] : node.childNodes);

export const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

function textOf(node: ChildNode | ParentNode): string {
  if (node.nodeName === "#text") return (node as T.TextNode).value;
  if (!("childNodes" in node)) return "";
  return children(node as ParentNode).map(textOf).join("");
}

/** True when everything inside is text, formatting or an icon (no comments: those would be lost on save). */
function inlineOnly(el: Element): boolean {
  return el.childNodes.every((c) => {
    if (c.nodeName === "#text") return true;
    if (!isElement(c)) return false;
    if (ATOMS.has(c.tagName)) return Boolean(c.sourceCodeLocation);
    return INLINE.has(c.tagName) && inlineOnly(c);
  });
}

/** Text a reader sees, icons left out (an icon alone doesn't make an editable text). */
function readableText(node: ChildNode | ParentNode): string {
  if (isElement(node) && ATOMS.has(node.tagName)) return "";
  if (node.nodeName === "#text") return (node as T.TextNode).value;
  if (!("childNodes" in node)) return "";
  return children(node as ParentNode).map(readableText).join("");
}

/** Elements inside, an icon counted as one (the frame counts the same way). */
function countElements(el: Element): number {
  return elementChildren(el).reduce((n, c) => n + 1 + (c.tagName === "svg" ? 0 : countElements(c)), 0);
}

/** The source of every icon inside an editable text, in document order. */
function atomsOf(el: Element, source: string): string[] {
  const found: string[] = [];
  const walk = (node: Element) => {
    for (const c of node.childNodes) {
      if (!isElement(c)) continue;
      const loc = c.sourceCodeLocation;
      if (ATOMS.has(c.tagName) && loc) found.push(source.slice(loc.startOffset, loc.endOffset));
      else walk(c);
    }
  };
  walk(el);
  return found;
}

const KIND: Record<string, string> = {
  h1: "Hoofdkop", h2: "Kop", h3: "Kop", h4: "Kop", h5: "Kop", h6: "Kop", p: "Tekst", a: "Link of knop",
  button: "Knop", li: "Lijstregel", label: "Label", figcaption: "Bijschrift", blockquote: "Citaat", td: "Tabelcel",
  th: "Tabelkop", dt: "Begrip", dd: "Uitleg", summary: "Vraag", caption: "Bijschrift", legend: "Kop",
};
const AREA: Record<string, string> = { header: "bovenaan", footer: "onderaan", nav: "menu" };

function context(stack: Element[]): string {
  for (let i = stack.length - 1; i >= 0; i--) {
    const el = stack[i];
    const id = el.attrs.find((a) => a.name === "id")?.value;
    if (id && ["section", "header", "footer", "nav", "main", "article", "aside", "div"].includes(el.tagName)) return `#${id}`;
    if (AREA[el.tagName]) return AREA[el.tagName];
  }
  return "";
}

function parseDoc(source: string) {
  return parse(source, { sourceCodeLocationInfo: true });
}

/** Layout elements: never one editable text themselves, even when they only hold links (a menu). */
const CONTAINER = new Set([
  "html", "body", "nav", "ul", "ol", "menu", "section", "header", "footer", "main", "article", "aside", "form",
  "fieldset", "table", "thead", "tbody", "tfoot", "tr", "dl", "figure", "details", "address",
]);

const elementChildren = (el: Element) => el.childNodes.filter(isElement);
const hasDirectText = (el: Element) =>
  el.childNodes.some((c) => c.nodeName === "#text" && (c as T.TextNode).value.trim() !== "");

/** Every editable text of a page, in document order. */
export function mapEditable(source: string): Block[] {
  const blocks: Block[] = [];

  /** `outer` names it and may carry the English version; `el` is what gets edited. */
  const add = (outer: Element, el: Element, stack: Element[]) => {
    const loc = el.sourceCodeLocation;
    if (!loc?.startTag || !loc.endTag) return;
    const withEn = [outer, el].find((e) => e.attrs.some((a) => a.name === "data-en"));
    const enLoc = withEn?.sourceCodeLocation?.attrs?.["data-en"];
    const enValue = withEn?.attrs.find((a) => a.name === "data-en")?.value;
    const named = /^h[1-6]$/.test(outer.tagName) ? outer.tagName : el.tagName;
    const where = context(stack);
    blocks.push({
      id: blocks.length,
      tag: el.tagName,
      label: `${KIND[named] ?? "Tekst"}${where ? ` · ${where}` : ""}`,
      insertAt: loc.startTag.startOffset + 1 + el.tagName.length,
      innerStart: loc.startTag.endOffset,
      innerEnd: loc.endTag.startOffset,
      inner: source.slice(loc.startTag.endOffset, loc.endTag.startOffset),
      text: collapse(textOf(el)),
      en: enLoc && enValue !== undefined ? { value: enValue, start: enLoc.startOffset, end: enLoc.endOffset } : null,
      atoms: atomsOf(el, source),
      elements: countElements(el),
    });
  };

  const walk = (node: ParentNode, stack: Element[]) => {
    for (const child of children(node)) {
      if (!isElement(child) || SKIP.has(child.tagName)) continue;
      const inside = [...stack, child];
      if (CONTAINER.has(child.tagName) || !inlineOnly(child) || collapse(readableText(child)) === "") {
        walk(child, inside);
        continue;
      }
      // A sentence (text with formatting) is one editable text. A row of links without text of its
      // own is a text per link. A lone wrapper (<li><a>…</a></li>) is edited at the innermost element,
      // so typing can never remove the link around the words.
      let el = child;
      while (!hasDirectText(el)) {
        const kids = elementChildren(el).filter((k) => !ATOMS.has(k.tagName));
        if (kids.length !== 1 || elementChildren(el).length !== 1) break;
        el = kids[0];
      }
      if (!hasDirectText(el) && elementChildren(el).length > 1) walk(child, inside);
      else add(child, el, stack);
    }
  };
  walk(parseDoc(source), []);
  return blocks;
}

// ---------------------------------------------------------------------------
// Escaping and cleaning edited text

export const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, "&nbsp;");
export const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/ /g, "&nbsp;");

const URL_ATTRS = new Set(["href", "src", "xlink:href", "action", "formaction"]);

/** Attributes that may be written back: no event handlers, no script URLs, nothing the editor added. */
function keepAttr(name: string, value: string) {
  if (name.startsWith("on") || name.startsWith("data-fz") || name === "contenteditable" || name === "spellcheck") return false;
  if (URL_ATTRS.has(name) && /^\s*(javascript|vbscript|data):/i.test(value)) return false;
  return true;
}

/**
 * The edited inside of an element as safe HTML: text plus the formatting tags in INLINE, everything
 * else unwrapped to its text. `<fz-atom n="k">` becomes the block's k-th icon from the source (an icon
 * the editor left out stays out: it was deleted). The frame cleans the same way before sending; this
 * is the check that counts.
 */
export function sanitizeInline(html: string, atoms: string[] = []): string {
  const out = (nodes: ChildNode[]): string =>
    nodes
      .map((node) => {
        if (node.nodeName === "#text") return escapeText((node as T.TextNode).value);
        if (!isElement(node)) return "";
        if (node.tagName === "fz-atom") return atoms[Number(node.attrs.find((a) => a.name === "n")?.value)] ?? "";
        if (!INLINE.has(node.tagName)) return out(node.childNodes);
        const attrs = node.attrs
          .filter((a) => keepAttr(a.name.toLowerCase(), a.value))
          .map((a) => ` ${a.name}="${escapeAttr(a.value)}"`)
          .join("");
        return VOID.has(node.tagName) ? `<${node.tagName}${attrs}>` : `<${node.tagName}${attrs}>${out(node.childNodes)}</${node.tagName}>`;
      })
      .join("");
  return out(parseFragment(html).childNodes);
}

/** The words of an HTML snippet (for labels and commit messages). */
export function plainText(html: string): string {
  return collapse(textOf(parseFragment(html)));
}

// ---------------------------------------------------------------------------
// Splicing

type Op = { start: number; end: number; text: string };

/** Applies non-overlapping replacements; later ones first so earlier offsets stay right. */
function splice(source: string, ops: Op[]): string {
  const sorted = [...ops].sort((a, b) => b.start - a.start || b.end - a.end);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].end > sorted[i - 1].start) throw new Error("overlapping edits");
  }
  let result = source;
  for (const op of sorted) result = result.slice(0, op.start) + op.text + result.slice(op.end);
  return result;
}

/**
 * The page's element tree with every editable text left out: two versions of a page with the same
 * outline differ only inside their texts. Used to check that saving touched nothing else.
 */
function outline(source: string): string {
  const parts: string[] = [];
  const blockStarts = new Set(mapEditable(source).map((b) => b.insertAt));
  const walk = (node: ParentNode) => {
    for (const child of children(node)) {
      if (!isElement(child)) continue;
      const loc = child.sourceCodeLocation;
      const start = loc?.startTag ? loc.startTag.startOffset + 1 + child.tagName.length : -1;
      if (blockStarts.has(start)) {
        parts.push(`[${child.tagName}]`);
        continue;
      }
      parts.push(`<${child.tagName}>`);
      if (!SKIP.has(child.tagName)) walk(child);
      parts.push(`</${child.tagName}>`);
    }
  };
  walk(parseDoc(source));
  return parts.join("");
}

/** One change from the editor: new content for a text, a new English version, or both. */
export type Edit = { id: number; html?: string; en?: string };

export type ApplyResult = { ok: true; content: string } | { ok: false; reason: "unknown-block" | "structure" };

/** Puts edits into the source they were made against (ids from mapEditable on that same source). */
export function applyEdits(source: string, edits: Edit[]): ApplyResult {
  const blocks = mapEditable(source);
  const ops: Op[] = [];
  for (const edit of edits) {
    const block = blocks[edit.id];
    if (!block) return { ok: false, reason: "unknown-block" };
    if (edit.html !== undefined) ops.push({ start: block.innerStart, end: block.innerEnd, text: sanitizeInline(edit.html, block.atoms) });
    if (edit.en !== undefined) {
      if (!block.en) return { ok: false, reason: "unknown-block" };
      ops.push({ start: block.en.start, end: block.en.end, text: `data-en="${escapeAttr(edit.en)}"` });
    }
  }
  let content: string;
  try {
    content = splice(source, ops);
  } catch {
    return { ok: false, reason: "structure" };
  }
  if (outline(content) !== outline(source)) return { ok: false, reason: "structure" };
  return { ok: true, content };
}

/**
 * The same edits for a newer version of the page (someone changed it on GitHub in the meantime).
 * Each text is found again by its old content; one that changed or appears more than once can't be
 * placed, and comes back in `lost` (by its old id) instead of being guessed.
 */
export function relocateEdits(oldSource: string, newSource: string, edits: Edit[]): { edits: Edit[]; lost: number[] } {
  if (oldSource === newSource) return { edits, lost: [] };
  const before = mapEditable(oldSource);
  const after = mapEditable(newSource);
  const moved: Edit[] = [];
  const lost: number[] = [];
  const same = (a: Block, b: Block) => a.tag === b.tag && a.inner === b.inner && (a.en?.value ?? null) === (b.en?.value ?? null);
  for (const edit of edits) {
    const old = before[edit.id];
    if (!old) {
      lost.push(edit.id);
      continue;
    }
    // A text that appears several times (a menu in the header and again in the footer) is matched by
    // its position among its copies, but only when the number of copies didn't change.
    const was = before.filter((b) => same(b, old));
    const now = after.filter((b) => same(b, old));
    if (now.length === was.length && now.length > 0) moved.push({ ...edit, id: now[was.indexOf(old)].id });
    else lost.push(edit.id);
  }
  return { edits: moved, lost };
}

// ---------------------------------------------------------------------------
// The copy of the page shown in the editor frame

/** Elements whose URL attributes load something (a link's href is left alone: it isn't loaded). */
const RESOURCE_ATTRS: Record<string, string[]> = {
  link: ["href"], script: ["src"], img: ["src", "srcset"], source: ["src", "srcset"], video: ["src", "poster"],
  audio: ["src"], track: ["src"], input: ["src"], use: ["href", "xlink:href"], image: ["href", "xlink:href"],
};

/** Scripts that must not run in the editor: visitor counting would count you. */
const STRIP_SCRIPTS = [/studio\.flitzweb\.nl\/t\.js/, /cloudflareinsights\.com/, /flitz-track\.js/, /googletagmanager\.com/];

const rootRelative = (url: string) => url.startsWith("/") && !url.startsWith("//");

/** `/assets/x.css` → `<base>/assets/x.css`, for root-relative URLs only. */
export function rewriteUrl(url: string, base: string) {
  const trimmed = url.trim();
  return rootRelative(trimmed) ? `${base}${trimmed}` : url;
}

const rewriteSrcset = (value: string, base: string) =>
  value
    .split(",")
    .map((part) => part.replace(/^(\s*)(\S+)/, (_, space: string, url: string) => `${space}${rewriteUrl(url, base)}`))
    .join(",");

/** `url(/x)` and `@import "/x"` in CSS. */
export function rewriteCss(css: string, base: string) {
  return css
    .replace(/url\(\s*(['"]?)(\/(?!\/)[^'")]*)\1\s*\)/g, (_, q: string, url: string) => `url(${q}${base}${url}${q})`)
    .replace(/@import\s+(['"])(\/(?!\/)[^'"]*)\1/g, (_, q: string, url: string) => `@import ${q}${base}${url}${q}`);
}

export type FrameOptions = {
  /** Path prefix that serves the repo's root (`/edit-frame/<token>`). */
  base: string;
  /** Where the editor script is, and the Studio origin it may talk to. */
  scriptUrl: string;
  origin: string;
  /** CSS selectors to hide while editing (popups that would cover the page). */
  hide?: string[];
  /** CSS selectors of texts the site's scripts own; a text containing one can't be edited. */
  lock?: string[];
};

/** The page as the editor frame shows it: markers on every editable text, the editor script, no counters. */
export function frameCopy(source: string, blocks: Block[], opts: FrameOptions): string {
  const ops: Op[] = blocks.map((b) => ({ start: b.insertAt, end: b.insertAt, text: ` data-fz="${b.id}"` }));
  let headAt = 0;

  const walk = (node: ParentNode) => {
    for (const child of children(node)) {
      if (!isElement(child)) continue;
      const loc = child.sourceCodeLocation;
      if (child.tagName === "head" && loc?.startTag) headAt = loc.startTag.endOffset;
      if (child.tagName === "html" && loc?.startTag && !headAt) headAt = loc.startTag.endOffset;

      const src = child.attrs.find((a) => a.name === "src")?.value ?? "";
      if (child.tagName === "script" && loc && STRIP_SCRIPTS.some((re) => re.test(src))) {
        ops.push({ start: loc.startOffset, end: loc.endOffset, text: "<!-- (weggelaten in de editor) -->" });
        continue;
      }

      for (const name of RESOURCE_ATTRS[child.tagName] ?? []) {
        const attr = child.attrs.find((a) => a.name === name);
        const attrLoc = loc?.attrs?.[name];
        if (!attr || !attrLoc) continue;
        const value = name === "srcset" ? rewriteSrcset(attr.value, opts.base) : rewriteUrl(attr.value, opts.base);
        if (value !== attr.value) ops.push({ start: attrLoc.startOffset, end: attrLoc.endOffset, text: `${name}="${escapeAttr(value)}"` });
      }
      const style = child.attrs.find((a) => a.name === "style");
      const styleLoc = loc?.attrs?.style;
      if (style && styleLoc) {
        const value = rewriteCss(style.value, opts.base);
        if (value !== style.value) ops.push({ start: styleLoc.startOffset, end: styleLoc.endOffset, text: `style="${escapeAttr(value)}"` });
      }
      if (child.tagName === "style") {
        const text = child.childNodes[0];
        const textLoc = text?.sourceCodeLocation;
        if (text && textLoc && text.nodeName === "#text") {
          const css = (text as T.TextNode).value;
          const value = rewriteCss(css, opts.base);
          if (value !== css) ops.push({ start: textLoc.startOffset, end: textLoc.endOffset, text: value });
        }
        continue;
      }
      walk(child);
    }
  };
  walk(parseDoc(source));

  const texts = Object.fromEntries(blocks.map((b) => [b.id, { t: b.text, n: b.elements }]));
  const json = JSON.stringify({ blocks: texts, lock: opts.lock ?? [] }).replace(/</g, "\\u003c");
  const hide = opts.hide?.length ? `<style>${opts.hide.join(",")}{display:none!important}</style>` : "";
  ops.push({
    start: headAt,
    end: headAt,
    text:
      `<script src="${escapeAttr(opts.scriptUrl)}" data-origin="${escapeAttr(opts.origin)}"></script>` +
      `<script type="application/json" id="__fz-texts">${json}</script>${hide}`,
  });
  return splice(source, ops);
}
