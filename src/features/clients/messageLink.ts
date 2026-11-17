import type { Client } from "@/db";
import { whatsappLink } from "@/lib/phone";

export type Reachable = Pick<Client, "phone" | "whatsapp" | "email" | "preferredChannel">;

/**
 * A link that opens WhatsApp or the mail app with `text` filled in. Nothing
 * is sent until you press send there. Email when that is the client's
 * preference or the only option, otherwise WhatsApp. Null when there is no
 * way to reach the client.
 */
export function messageLink(
  contact: Reachable,
  text: string,
  subject: string,
): { href: string; channel: "whatsapp" | "email" } | null {
  const wa = whatsappLink(contact.whatsapp ?? contact.phone);
  const mail = contact.email
    ? `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
    : null;
  if (mail && (contact.preferredChannel === "email" || !wa)) return { href: mail, channel: "email" };
  if (wa) return { href: `${wa}?text=${encodeURIComponent(text)}`, channel: "whatsapp" };
  return null;
}
