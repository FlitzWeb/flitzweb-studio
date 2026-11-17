import { z } from "zod";
import { optionalDate, optionalText, optionalUrl, requiredText } from "@/lib/forms";

export const siteSchema = z.object({
  clientId: z.coerce.number({ message: "Kies een klant" }).int().positive("Kies een klant"),
  name: requiredText("Geef de site een naam"),
  url: optionalUrl.refine((v) => v !== null, "Vul de URL in"),
  hosting: z.enum(["vercel", "cloudflare", "other"]),
  hostingDashboardUrl: optionalUrl,
  registrar: optionalText,
  goLiveDate: optionalDate,
  status: z.enum(["live", "in_progress", "paused"]),
  repo: z
    .string()
    .trim()
    // Accept a pasted GitHub link as well as "owner/name".
    .transform((v) => v.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, ""))
    .pipe(z.union([z.literal(""), z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Schrijf het als eigenaar/naam, bijv. FlitzWeb/Hakiki-Doner")]))
    .transform((v) => v || null),
  conceptBranch: z
    .string()
    .trim()
    .transform((v) => v || "concept")
    .pipe(z.string().regex(/^[\w./-]+$/, "Alleen letters, cijfers, - _ . en /")),
  conceptUrl: optionalUrl,
});

export const hostingLabels = {
  vercel: "Vercel",
  cloudflare: "Cloudflare",
  other: "Anders",
} as const;

export const siteStatusLabels = {
  live: "Live",
  in_progress: "In aanbouw",
  paused: "Gepauzeerd",
} as const;
