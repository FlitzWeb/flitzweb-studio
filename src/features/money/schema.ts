import { z } from "zod";
import { optionalDate, requiredText } from "@/lib/forms";
import { parseEuro } from "./status";

const euro = z
  .string()
  .transform((v, ctx) => {
    const cents = parseEuro(v);
    if (cents === null || cents <= 0) {
      ctx.addIssue({ code: "custom", message: "Vul een bedrag in, bijv. 450 of 24,50" });
      return z.NEVER;
    }
    return cents;
  });

const clientId = z.coerce.number().int().positive("Kies een klant");
const siteId = z
  .string()
  .transform((v) => (v ? Number(v) : null));
const requiredDate = z.iso.date({ message: "Kies een datum" });

export const paymentSchema = z
  .object({
    clientId,
    siteId,
    description: requiredText("Waar is deze factuur voor?"),
    amountCents: euro,
    issueDate: requiredDate,
    dueDate: requiredDate,
    paidDate: optionalDate,
  })
  .refine((p) => p.dueDate >= p.issueDate, {
    path: ["dueDate"],
    message: "Vervaldatum ligt vóór de factuurdatum",
  });

export const subscriptionSchema = z
  .object({
    clientId,
    siteId,
    description: requiredText("Waar is dit abonnement voor?"),
    amountCents: euro,
    startDate: requiredDate,
    billingDay: z.coerce
      .number()
      .int()
      .min(1, "Kies een dag van 1 t/m 28")
      .max(28, "Kies een dag van 1 t/m 28"),
    endDate: optionalDate,
    active: z.enum(["true", "false"]).transform((v) => v === "true"),
  })
  .refine((s) => !s.endDate || s.endDate >= s.startDate, {
    path: ["endDate"],
    message: "Einddatum ligt vóór de startdatum",
  });
