// Per client site: which files the Aanpassen tab edits. A site that isn't listed gets the default
// (its index.html), so a new plain site works without an entry here.

export type EditorPage = { path: string; label: string };

export type EditorSite = {
  /** Source files, relative to the repo root. The first one opens by default. */
  pages: EditorPage[];
  /** Popups that would cover the page while editing (CSS selectors). */
  hide?: string[];
  /** Texts the site's own scripts fill in (CSS selectors); a text containing one can't be edited. */
  lock?: string[];
  /** Every text has an English version in data-en (the NL/EN switch on flitzweb.nl). */
  english?: boolean;
  /** One line under the editor about what can't be done here (yet). */
  note?: string;
};

const DEFAULT: EditorSite = { pages: [{ path: "index.html", label: "Homepage" }] };

const SITES: Record<string, EditorSite> = {
  "flitzweb/hakiki-doner": {
    pages: [{ path: "index.html", label: "Homepage" }],
    // The holiday and pick-up popups open on every load in the editor (it has no memory of them).
    hide: [".vmodal"],
    // Filled in by main.js: the discount percentage (KORTING), today's hours, the year, holiday and
    // pick-up dates. (data-role="korting" only shows or hides its text, so that stays editable.)
    lock: [
      '[data-role="korting-pct"]', '[data-role="status"]', '[data-role="hours"]', '[data-role="today-hours"]',
      '[data-role="year"]', '[data-role$="-datums"]', '[data-role$="-open"]', '[data-role^="vakantie-"]',
      '[data-role^="afhaal-"]', '[data-role^="amodal-"]',
    ],
    note: "De menukaart en het kortingspercentage komen uit menu-data.js en main.js; die krijgen later een eigen formulier.",
  },
  "flitzweb/rijschool-veilig": {
    // v4/ is the real site; live-site/ is built from it on every push (build-live.sh), never edit that.
    pages: [{ path: "v4/index.html", label: "Homepage" }],
  },
  "flitzweb/flitzweb-site": {
    english: true,
    pages: [
      { path: "index.html", label: "Homepage" },
      { path: "prijzen/index.html", label: "Prijzen" },
      { path: "over/index.html", label: "Over" },
      { path: "contact/index.html", label: "Contact" },
      { path: "website-restaurant/index.html", label: "Website voor een restaurant" },
      { path: "website-rijschool/index.html", label: "Website voor een rijschool" },
      { path: "werk/hakiki-doner-eindhoven/index.html", label: "Case: Hakiki Döner" },
      { path: "werk/rijschool-veilig-eindhoven/index.html", label: "Case: Rijschool Veilig" },
    ],
    note: "De kop, het menu en de afsluiting staan op elke pagina apart: pas ze op elke pagina aan.",
  },
};

export const editorSite = (repo: string): EditorSite => SITES[repo.toLowerCase()] ?? DEFAULT;
