import { z } from "zod";

// Parameters per report type. Steps match a page path ("/prijzen") or an
// event name ("bel_klik"); a leading or trailing * is a wildcard ("/blog/*").

const step = z.object({
  type: z.enum(["path", "event"]),
  value: z.string().trim().min(1, "Vul een pagina of event in").max(200),
});
export type Step = z.infer<typeof step>;

const name = z.string().trim().min(1, "Geef het rapport een naam").max(80);

export const reportSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("funnel"),
    name,
    params: z.object({
      steps: z.array(step).min(2, "Minstens 2 stappen").max(8, "Maximaal 8 stappen"),
      // Minutes allowed between one step and the next.
      window: z.coerce.number().int().min(1).max(60 * 24 * 7).default(60),
    }),
  }),
  z.object({
    type: z.literal("journey"),
    name,
    params: z.object({
      steps: z.coerce.number().int().min(3).max(7).default(5),
      startStep: z.string().trim().max(200).optional().transform((v) => v || undefined),
      endStep: z.string().trim().max(200).optional().transform((v) => v || undefined),
    }),
  }),
  z.object({ type: z.literal("retention"), name, params: z.object({}) }),
  z.object({ type: z.literal("goal"), name, params: step }),
]);
export type ReportInput = z.infer<typeof reportSchema>;

export const REPORT_TYPES = {
  funnel: { label: "Funnel", help: "Hoeveel bezoekers stap voor stap doorlopen, bijv. home → prijzen → afspraak." },
  journey: { label: "Route", help: "De meest gevolgde routes langs pagina's en events binnen een bezoek." },
  retention: { label: "Retentie", help: "Hoeveel bezoekers na hun eerste bezoek terugkomen, per dag." },
  goal: { label: "Doel", help: "Welk deel van de bezoekers een pagina of event bereikt." },
} as const;
