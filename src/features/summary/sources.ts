// Referrer hosts as a client would say them: "l.instagram.com" and
// "m.facebook.com" mean nothing to a shop owner, "Instagram" does.

const NAMES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(facebook|fb)\.com$|^fb\.me$/, "Facebook"],
  [/(^|\.)google\.[a-z.]+$|^com\.google\./, "Google"],
  [/(^|\.)brave\.com$/, "Brave"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)ecosia\.org$/, "Ecosia"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(twitter|x)\.com$|^t\.co$/, "X"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, "WhatsApp"],
  [/(^|\.)snapchat\.com$/, "Snapchat"],
  [/(^|\.)pinterest\.[a-z.]+$/, "Pinterest"],
  [/(^|\.)thuisbezorgd\.nl$/, "Thuisbezorgd"],
  [/(^|\.)chatgpt\.com$/, "ChatGPT"],
];

export const sourceName = (host: string) => {
  const h = host.trim().toLowerCase();
  return NAMES.find(([re]) => re.test(h))?.[1] ?? h.replace(/^(www|m|l|lm)\./, "");
};

// Our own preview addresses and local test runs are not where visitors come from.
const OWN = /(^|\.)(workers\.dev|pages\.dev|vercel\.app|netlify\.app)$|^(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Merges hosts that are the same place ("facebook.com" + "m.facebook.com"), biggest first. */
export function friendlySources(rows: readonly { label: string; count: number }[]) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (OWN.test(r.label.trim().toLowerCase())) continue;
    const name = sourceName(r.label);
    totals.set(name, (totals.get(name) ?? 0) + r.count);
  }
  return [...totals].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}
