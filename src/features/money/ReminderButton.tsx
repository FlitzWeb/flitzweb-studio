import { BellRing } from "lucide-react";
import type { MoneyItem } from "./queries";
import { reminderLink } from "./reminder";

/** Opens WhatsApp or mail with a payment reminder ready to send. Only for late items. */
export function ReminderButton({ item }: { item: MoneyItem }) {
  if (item.status !== "overdue") return null;
  const link = reminderLink(item);
  if (!link) return null;
  return (
    <a
      href={link.href}
      target={link.channel === "whatsapp" ? "_blank" : undefined}
      rel={link.channel === "whatsapp" ? "noreferrer" : undefined}
      className="btn btn-sm"
      title={link.channel === "whatsapp" ? "Herinnering via WhatsApp" : "Herinnering via e-mail"}
    >
      <BellRing aria-hidden="true" />
      Herinnering
    </a>
  );
}
