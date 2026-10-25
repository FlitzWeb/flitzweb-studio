// Small helpers for dashboard forms: server actions validate FormData with
// zod and hand back errors + the submitted values so the form can re-render.
import { z } from "zod";

export type FormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
  /** Changes on every failed submit, used as the form's `key`. */
  at?: number;
};

/** Text field; empty becomes null. */
export const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null);

export const requiredText = (message = "Verplicht") =>
  z.string().trim().min(1, message);

/** URL field; adds https:// when left out. Empty becomes null. */
export const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .pipe(z.union([z.literal(""), z.url({ message: "Geen geldige URL" })]))
  .transform((v) => v || null);

export const optionalDate = z
  .string()
  .trim()
  .pipe(z.union([z.literal(""), z.iso.date({ message: "Geen geldige datum" })]))
  .transform((v) => v || null);

/** Parses FormData. Returns `{ data }` or `{ state }` with Dutch error messages. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { data: z.output<S>; state?: never } | { data?: never; state: FormState } {
  const values = Object.fromEntries(
    [...formData.entries()]
      .filter(([k, v]) => !k.startsWith("$") && typeof v === "string")
      .map(([k, v]) => [k, v as string]),
  );
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return { state: { errors, values, at: Date.now() } };
}
