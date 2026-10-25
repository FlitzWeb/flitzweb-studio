import type { Client } from "@/db";
import { telLink, whatsappLink } from "@/lib/phone";
import { channelLabels } from "./schema";
import styles from "./clients.module.css";

type Channel = keyof typeof channelLabels;

/**
 * One-tap call / WhatsApp / email buttons. The client's preferred channel
 * comes first and is highlighted. WhatsApp falls back to the phone number.
 */
export function ContactActions({
  client,
  compact,
}: {
  client: Pick<Client, "phone" | "whatsapp" | "email" | "preferredChannel">;
  compact?: boolean;
}) {
  const links: Record<Channel, string | null> = {
    phone: telLink(client.phone),
    whatsapp: whatsappLink(client.whatsapp ?? client.phone),
    email: client.email ? `mailto:${client.email}` : null,
  };
  const order = (Object.keys(links) as Channel[]).sort(
    (a, b) => Number(b === client.preferredChannel) - Number(a === client.preferredChannel),
  );
  const available = order.filter((c) => links[c]);

  if (available.length === 0) {
    return compact ? null : <p className={styles.muted}>Nog geen contactgegevens.</p>;
  }

  return (
    <div className={compact ? styles.actionsCompact : styles.actions}>
      {available.map((channel) => {
        const preferred = channel === client.preferredChannel;
        return (
          <a
            key={channel}
            href={links[channel]!}
            target={channel === "whatsapp" ? "_blank" : undefined}
            rel={channel === "whatsapp" ? "noreferrer" : undefined}
            className={`btn ${preferred ? "btn-primary" : ""} ${compact ? "btn-sm" : ""} ${styles.action}`}
            aria-label={`${channelLabels[channel]}${preferred ? " (voorkeur)" : ""}`}
          >
            <ChannelIcon channel={channel} />
            {!compact && <span>{channelLabels[channel]}</span>}
            {!compact && preferred && <span className={styles.prefTag}>voorkeur</span>}
          </a>
        );
      })}
    </div>
  );
}

function ChannelIcon({ channel }: { channel: Channel }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (channel === "phone")
    return (
      <svg {...common}>
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />
      </svg>
    );
  if (channel === "whatsapp")
    return (
      <svg {...common}>
        <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5Z" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}
