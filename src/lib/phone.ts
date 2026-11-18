/**
 * Turns one Dutch-style phone number into international digits without "+":
 * "06 1234 5678" → "31612345678", "+31 6 ..." → "316...", "0032..." → "32...".
 */
function oneNumber(raw: string) {
  let s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("00")) s = s.slice(2);
  else if (s.startsWith("0")) s = "31" + s.slice(1);
  // E.164: at most 15 digits. Longer means two numbers got glued together.
  return s.length >= 8 && s.length <= 15 ? s : null;
}

/** A field can hold two numbers ("040-1234567 of 06 12345678"): every valid one, in order. */
function allNumbers(raw: string | null | undefined) {
  if (!raw) return [];
  return raw
    .split(/\s+(?:of|en|or)\s+|[/,;|&]/i)
    .map(oneNumber)
    .filter((n): n is string => n !== null);
}

/** The (first) number in the field as international digits, or null. */
export const phoneDigits = (raw: string | null | undefined) => allNumbers(raw)[0] ?? null;

export const telLink = (raw: string | null | undefined) => {
  const d = phoneDigits(raw);
  return d ? `tel:+${d}` : null;
};

/** WhatsApp prefers a mobile number (06) when the field has both a landline and a mobile. */
export const whatsappLink = (raw: string | null | undefined) => {
  const all = allNumbers(raw);
  const d = all.find((n) => n.startsWith("316")) ?? all[0];
  return d ? `https://wa.me/${d}` : null;
};
