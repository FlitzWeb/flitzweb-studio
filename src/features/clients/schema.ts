import { z } from "zod";
import { optionalText, requiredText } from "@/lib/forms";

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
