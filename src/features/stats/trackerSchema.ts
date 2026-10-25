import { z } from "zod";
import { requiredText } from "@/lib/forms";

export const trackerSchema = z.object({
  name: requiredText("Geef de tracker een naam"),
  eventKey: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{1,39}$/, "Alleen kleine letters, cijfers en _, bijv. order_placed")
    .refine((k) => k !== "pageview", "pageview wordt al automatisch gemeten"),
  aggregation: z.enum(["count", "sum"]),
  monthlyGoal: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Een heel getal groter dan 0"),
});
