import { z } from "zod";
import { optionalDate, optionalText, requiredText } from "@/lib/forms";
import { STAGES } from "./stages";

export const clientSchema = z.object({
  name: requiredText("Geef de klant een naam"),
  businessName: optionalText,
  contactPerson: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: z
    .string()
    .trim()
    .pipe(z.union([z.literal(""), z.email({ message: "Geen geldig e-mailadres" })]))
    .transform((v) => v || null),
  preferredChannel: z
    .enum(["", "phone", "whatsapp", "email"])
    .transform((v) => v || null),
  address: optionalText,
  notes: optionalText,
  billingType: z.enum(["paying", "no_billing"]),
  stage: z.enum(STAGES),
  nextFollowUp: optionalDate,
  industry: optionalText,
  websiteStatus: optionalText,
});

export const contactSchema = z.object({
  kind: z.enum(["whatsapp", "phone", "email", "meeting", "note"]),
  body: optionalText,
  occurredOn: z.iso.date({ message: "Kies een datum" }),
  // "" = leave the follow-up date alone, "none" = clear it, a number = days from today.
  followUp: z.enum(["", "none", "1", "3", "7", "14", "30"]),
});

export const channelLabels = {
  phone: "Bellen",
  whatsapp: "WhatsApp",
  email: "E-mail",
} as const;

export const billingLabels = {
  paying: "Betalend",
  no_billing: "Geen facturatie",
} as const;
