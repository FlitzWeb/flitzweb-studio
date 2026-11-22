// Pipeline stages, shared by server and client code (no database imports here).
export const STAGES = ["lead", "contacted", "replied", "meeting", "client", "lost"] as const;
export type Stage = (typeof STAGES)[number];

/** Stages that are still being worked on (shown on the Leads page by default). */
export const OPEN_STAGES: Stage[] = ["lead", "contacted", "replied", "meeting"];

export const stageLabels: Record<Stage, string> = {
  lead: "Lead",
  contacted: "Benaderd",
  replied: "Gereageerd",
  meeting: "Afspraak",
  client: "Klant",
  lost: "Afgevallen",
};

export const stageTone: Record<Stage, "ok" | "warn" | "danger" | "plain" | undefined> = {
  lead: "plain",
  contacted: undefined,
  replied: "warn",
  meeting: "warn",
  client: "ok",
  lost: "plain",
};

export const isStage = (v: unknown): v is Stage => typeof v === "string" && (STAGES as readonly string[]).includes(v);

export const contactKindLabels = {
  whatsapp: "WhatsApp",
  phone: "Gebeld",
  email: "E-mail",
  meeting: "Afspraak",
  visit: "Langs geweest",
  note: "Notitie",
} as const;
export type ContactKind = keyof typeof contactKindLabels;

/** Lead tiers from the leads skill: A = go first, C = only when you are nearby anyway. */
export const TIERS = ["A", "B", "C"] as const;
export type Tier = (typeof TIERS)[number];
export const isTier = (v: unknown): v is Tier => typeof v === "string" && (TIERS as readonly string[]).includes(v);
export const tierTone: Record<Tier, "ok" | "warn" | "plain"> = { A: "ok", B: "warn", C: "plain" };

/**
 * The hook for a list row, where the reviews and "website now" already sit
 * next to it: drops the "4,6 sterren (96 reviews), " start and returns null
 * when nothing new is left ("geen eigen website").
 */
export function hookDetail(hook: string | null): string | null {
  const rest = hook?.replace(/^[\d,.]+ sterren \(\d+ reviews\), /, "") ?? "";
  return rest && rest !== "geen eigen website" ? rest : null;
}
