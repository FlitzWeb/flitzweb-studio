// Turns a pasted spreadsheet (copied cells from Google Sheets, or CSV) into
// lead rows. Pure code: the import page uses it for the preview and the
// server action uses it again for the real import.
import type { Stage } from "./stages";

export type ImportRow = {
  name: string;
  industry: string | null;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  websiteStatus: string | null;
  stage: Stage;
  notes: string | null;
};

type Field = "name" | "industry" | "address" | "contactPerson" | "phone" | "email" | "websiteStatus" | "status" | "lastContact" | "notes" | "skip";

// Column order of the "Bedrijven Overzicht" sheet, used when there is no header row.
const SHEET_ORDER: Field[] = ["name", "industry", "address", "contactPerson", "phone", "email", "websiteStatus", "skip", "status", "lastContact", "notes"];

const HEADERS: [RegExp, Field][] = [
  [/^(bedrijfsnaam|bedrijf|naam|name)$/, "name"],
  [/^(branche|categorie|category|soort)$/, "industry"],
  [/^(locatie|adres|address|plaats|stad)$/, "address"],
  [/^(contactpersoon|contact)$/, "contactPerson"],
  [/^(telefoonnummer|telefoon|tel|phone|mobiel)$/, "phone"],
  [/^(email|e-mail|mail)$/, "email"],
  [/^(website status|websitestatus|website)$/, "websiteStatus"],
  [/^(status|fase)$/, "status"],
  [/^(laatste contact)$/, "lastContact"],
  [/^(notities|notitie|opmerkingen|opmerking|notes)$/, "notes"],
  [/^(gevonden door)$/, "skip"],
];

/** Splits delimited text into rows of cells; handles "quoted cells" with line breaks. */
function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** The sheet's free-text status → a pipeline stage. Unknown text stays a plain lead. */
export function stageFromStatus(status: string): Stage {
  const s = status.toLowerCase();
  if (!s.trim()) return "lead";
  if (/geen interesse|niet ge[iï]nteresseerd|afgewezen|afgevallen|nee\b|niet meer|gestopt/.test(s)) return "lost";
  if (/klant|gewonnen|akkoord|deal/.test(s)) return "client";
  if (/afspraak|meeting|gesprek|langs/.test(s)) return "meeting";
  if (/gereageerd|reactie|antwoord|interesse|ge[iï]nteresseerd|terug/.test(s)) return "replied";
  if (/benaderd|bericht|gemaild|gebeld|gestuurd|verstuurd|contact|gesproken/.test(s)) return "contacted";
  return "lead";
}

const clean = (v: string | undefined) => v?.trim().replace(/\s+\n/g, "\n") || null;

// The sheet says "Geen", "-" or "onbekend" where there is no number or address.
const cleanPhone = (v: string | undefined) => {
  const s = clean(v);
  return s && /\d/.test(s) ? s : null;
};
const cleanEmail = (v: string | undefined) => {
  const s = clean(v);
  return s && s.includes("@") ? s : null;
};

export function parseLeadSheet(text: string): { rows: ImportRow[]; columns: Field[]; hadHeader: boolean } {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";
  const table = parseDelimited(text, delimiter);
  if (table.length === 0) return { rows: [], columns: [], hadHeader: false };

  const header = table[0].map((h) => {
    const key = h.trim().toLowerCase();
    return HEADERS.find(([re]) => re.test(key))?.[1];
  });
  const hadHeader = header.includes("name");
  const columns: Field[] = hadHeader ? header.map((f) => f ?? "skip") : SHEET_ORDER;
  const body = hadHeader ? table.slice(1) : table;

  const rows: ImportRow[] = [];
  for (const cells of body) {
    const get = (f: Field) => {
      const i = columns.indexOf(f);
      return i === -1 ? undefined : cells[i];
    };
    const name = clean(get("name"));
    if (!name) continue;
    const status = clean(get("status"));
    const lastContact = clean(get("lastContact"));
    const notes = [
      clean(get("notes")),
      status && `Status in sheet: ${status}`,
      lastContact && `Laatste contact (sheet): ${lastContact}`,
    ]
      .filter(Boolean)
      .join("\n");
    rows.push({
      name,
      industry: clean(get("industry")),
      address: clean(get("address")),
      contactPerson: clean(get("contactPerson")),
      phone: cleanPhone(get("phone")),
      email: cleanEmail(get("email")),
      websiteStatus: clean(get("websiteStatus")),
      stage: stageFromStatus(status ?? ""),
      notes: notes || null,
    });
  }
  return { rows, columns, hadHeader };
}
