import { z } from "zod";
import { optionalDate, optionalText, optionalUrl, requiredText } from "@/lib/forms";

export const siteSchema = z.object({
  clientId: z.coerce.number({ message: "Kies een klant" }).int().positive("Kies een klant"),
  name: requiredText("Geef de site een naam"),
  url: optionalUrl.refine((v) => v !== null, "Vul de URL in"),
  hosting: z.enum(["vercel", "other"]),
  hostingDashboardUrl: optionalUrl,
  registrar: optionalText,
  goLiveDate: optionalDate,
  status: z.enum(["live", "in_progress", "paused"]),
});

export const siteStatusLabels = {
  live: "Live",
  in_progress: "In aanbouw",
  paused: "Gepauzeerd",
} as const;
