/**
 * Turns a Dutch-style phone number into international digits without "+":
 * "06 1234 5678" → "31612345678", "+31 6 ..." → "316...", "0032..." → "32...".
 */
export function phoneDigits(raw: string | null | undefined) {
  if (!raw) return null;
  let s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("00")) s = s.slice(2);
  else if (s.startsWith("0")) s = "31" + s.slice(1);
  return s.length >= 8 ? s : null;
}

export const telLink = (raw: string | null | undefined) => {
  const d = phoneDigits(raw);
  return d ? `tel:+${d}` : null;
};

export const whatsappLink = (raw: string | null | undefined) => {
  const d = phoneDigits(raw);
  return d ? `https://wa.me/${d}` : null;
};
