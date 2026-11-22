// Reads the import file that the leads skill writes per run
// (`~/.claude/skills/leads/scripts/export_studio.py` → studio-import.json).
// Pure code: the import page uses it for the preview and the server action
// uses it again for the real import.
import { z } from "zod";
import { normalizeSocial, type Social } from "@/lib/socials";
import { TIERS } from "./stages";

/** A string, cut to `max`; missing, null or empty becomes null. */
const text = (max: number) =>
  z
    .string()
    .nullish()
    .transform((v) => v?.trim().slice(0, max) || null);

/** Only http(s) links are kept: these end up in an `href`. */
const link = z
  .string()
  .nullish()
  .transform((v) => {
    const s = v?.trim() ?? "";
    return /^https?:\/\/\S+$/i.test(s) && s.length <= 2000 ? s : null;
  });

/** "instagram.com/naam", "@naam" or a full link → the stored handle; anything odd becomes null. */
const social = (kind: Social) =>
  z
    .string()
    .nullish()
    .transform((v) => (v?.trim() ? normalizeSocial(kind, v) : null));

const leadSchema = z.object({
  placeId: text(200),
  name: z.string().trim().min(1).max(200),
  industry: text(120),
  address: text(300),
  phone: text(60),
  email: z
    .string()
    .nullish()
    .transform((v) => (v && z.email().safeParse(v.trim()).success ? v.trim() : null)),
  instagram: social("instagram"),
  facebook: social("facebook"),
  tiktok: social("tiktok"),
  websiteStatus: text(120),
  websiteUrl: link,
  mapsUrl: link,
  rating: z
    .number()
    .nullish()
    .transform((v) => (v != null && v >= 1 && v <= 5 ? Math.round(v * 10) / 10 : null)),
  reviewCount: z
    .number()
    .nullish()
    .transform((v) => (v != null && v >= 0 ? Math.round(v) : null)),
  score: z.number().min(0).max(100).transform(Math.round),
  tier: z.enum(TIERS),
  hook: text(500),
  evidence: text(2000),
  openerDoor: text(3000),
  openerDm: text(3000),
  openerMail: text(5000),
  routeOrder: z
    .number()
    .nullish()
    .transform((v) => (v != null && v > 0 ? Math.round(v) : null)),
  /** A note carried over from an older list. Only used for a business that is new here. */
  note: text(2000),
});

const fileSchema = z.object({
  format: z.literal("flitzweb-leads"),
  version: z.literal(2),
  label: text(200),
  date: z.iso.date(),
  routeName: text(120),
  leads: z.array(leadSchema).min(1).max(2000),
});

export type ResearchLead = z.output<typeof leadSchema>;
export type ResearchFile = z.output<typeof fileSchema>;

export function parseResearchFile(raw: string): { file: ResearchFile; error?: never } | { file?: never; error: string } {
  if (!raw.trim()) return { error: "Kies eerst het bestand." };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "Dit is geen geldig bestand van de leads-skill (geen JSON)." };
  }
  const parsed = fileSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: `Dit bestand klopt niet: ${issue?.path.join(".") || "inhoud"} (${issue?.message ?? "onbekend"}). Maak het opnieuw met de leads-skill.`,
    };
  }
  return { file: parsed.data };
}

/** "Onderwerp: …" on the first line, then the body: how the skill writes the mail draft. */
export function splitMail(draft: string): { subject: string; body: string } {
  const m = draft.match(/^Onderwerp:\s*(.+)\r?\n\s*\r?\n?([\s\S]*)$/);
  return m ? { subject: m[1].trim(), body: m[2].trim() } : { subject: "", body: draft.trim() };
}
