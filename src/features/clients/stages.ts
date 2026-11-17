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
  note: "Notitie",
} as const;
export type ContactKind = keyof typeof contactKindLabels;
