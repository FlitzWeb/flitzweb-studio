import { formatDate, formatEuro } from "@/lib/format";
import { whatsappLink } from "@/lib/phone";
import type { MoneyItem } from "./queries";

/** The friendly reminder you send a client about a late payment. Edit it before sending. */
export function reminderText(item: MoneyItem) {
  const firstName = item.contact.contactPerson?.trim().split(/\s+/)[0];
  return [
    `Hoi${firstName ? ` ${firstName}` : ""}, even een herinnering: de betaling van ${formatEuro(item.amountCents)} voor ${item.description} stond open tot ${formatDate(item.dueDate)}.`,
    "Zou je die deze week willen overmaken?",
    item.paymentUrl ? `Betalen kan hier: ${item.paymentUrl}` : null,
    "Alvast bedankt! Groet, FlitzWeb",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * A link that opens WhatsApp or the mail app with the reminder filled in.
 * Nothing is sent until you press send there. Null when there is no way to reach the client.
 */
export function reminderLink(item: MoneyItem): { href: string; channel: "whatsapp" | "email" } | null {
  const { phone, whatsapp, email, preferredChannel } = item.contact;
  const text = reminderText(item);
  const wa = whatsappLink(whatsapp ?? phone);
  const mail = email
    ? `mailto:${email}?subject=${encodeURIComponent(`Herinnering: ${item.description}`)}&body=${encodeURIComponent(text)}`
    : null;
  if (mail && (preferredChannel === "email" || !wa)) return { href: mail, channel: "email" };
  if (wa) return { href: `${wa}?text=${encodeURIComponent(text)}`, channel: "whatsapp" };
  return null;
}
