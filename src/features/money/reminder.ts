import { formatDate, formatEuro } from "@/lib/format";
import { messageLink } from "@/features/clients/messageLink";
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

/** Opens WhatsApp or mail with the reminder filled in; null when the client can't be reached. */
export const reminderLink = (item: MoneyItem) =>
  messageLink(item.contact, reminderText(item), `Herinnering: ${item.description}`);
