import { z } from "zod";
import { optionalDate, optionalText, optionalUrl, requiredText } from "@/lib/forms";
import { parseEuro } from "../money/status";

export const costSchema = z
  .object({
    name: requiredText("Waar betaal je voor?"),
    category: z.enum(["software", "ai", "domain", "hosting", "hardware", "other"]),
    amountCents: z.string().transform((v, ctx) => {
      const cents = parseEuro(v);
      if (cents === null || cents <= 0) {
        ctx.addIssue({ code: "custom", message: "Vul een bedrag in, bijv. 20 of 9,99" });
        return z.NEVER;
      }
      return cents;
    }),
    interval: z.enum(["monthly", "yearly", "once"]),
    startDate: z.iso.date({ message: "Kies een datum" }),
    endDate: optionalDate,
    url: optionalUrl,
    notes: optionalText,
  })
  .refine((c) => !c.endDate || c.endDate >= c.startDate, {
    path: ["endDate"],
    message: "Opzegdatum ligt vóór de eerste betaling",
  });
