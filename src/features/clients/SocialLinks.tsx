import type { Client } from "@/db";
import { SOCIALS, socialLabels, socialLink, socialText, type Social } from "@/lib/socials";
import styles from "./clients.module.css";

type Profiles = Pick<Client, Social>;

export const hasSocials = (client: Profiles) => SOCIALS.some((kind) => client[kind]);

/** The lead's social profiles as "@naam" links that open in a new tab. */
export function SocialLinks({ client }: { client: Profiles }) {
  return (
    <div className={styles.socials}>
      {SOCIALS.map((kind) => {
        const value = client[kind];
        if (!value) return null;
        return (
          <a
            key={kind}
            href={socialLink(kind, value)}
            target="_blank"
            rel="noreferrer"
            className={styles.social}
            aria-label={`${socialLabels[kind]}: ${socialText(kind, value)}`}
            title={socialLabels[kind]}
          >
            <SocialIcon kind={kind} />
            <span>{socialText(kind, value)}</span>
          </a>
        );
      })}
    </div>
  );
}

function SocialIcon({ kind }: { kind: Social }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "instagram")
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17.5 6.5h.01" />
      </svg>
    );
  if (kind === "facebook")
    return (
      <svg {...common}>
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M9 12a4 4 0 1 0 4 4V3c.5 2.5 2.5 4.5 5 5" />
    </svg>
  );
}
