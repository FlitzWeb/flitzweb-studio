// Social media profiles of a lead or client. Stored as the bare handle
// (Instagram, TikTok) or the path after facebook.com/, never a full URL.

export const SOCIALS = ["instagram", "facebook", "tiktok"] as const;
export type Social = (typeof SOCIALS)[number];

export const socialLabels: Record<Social, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
};

const HOSTS: Record<Social, RegExp> = {
  instagram: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i,
  facebook: /^(?:https?:\/\/)?(?:www\.|m\.|nl-nl\.)?(?:facebook|fb)\.com\//i,
  tiktok: /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\//i,
};

const VALID: Record<Social, RegExp> = {
  instagram: /^[a-z0-9._]{1,30}$/i,
  // A page name, "p/Name-123", "people/Name/123" or "profile.php?id=123".
  facebook: /^(?:profile\.php\?id=\d+|[\p{L}\p{N}._%-]+(?:\/[\p{L}\p{N}._%-]+){0,2})$/u,
  tiktok: /^[a-z0-9._]{2,24}$/i,
};

/**
 * Cleans up what someone typed or pasted ("@naam", a full profile link) into
 * the stored form. Returns null when it cannot be a profile on that platform.
 */
export function normalizeSocial(kind: Social, raw: string): string | null {
  let v = raw.trim().replace(HOSTS[kind], "");
  if (kind === "facebook") {
    const id = v.match(/^profile\.php\?id=(\d+)/i);
    v = id ? `profile.php?id=${id[1]}` : v.replace(/[?#].*$/, "").replace(/\/+$/, "");
  } else {
    v = v.replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/^@/, "").toLowerCase();
  }
  return VALID[kind].test(v) ? v : null;
}

export function socialLink(kind: Social, value: string) {
  if (kind === "instagram") return `https://www.instagram.com/${value}/`;
  if (kind === "tiktok") return `https://www.tiktok.com/@${value}`;
  return `https://www.facebook.com/${value}`;
}

/** What to show for a profile: "@naam", or the page name for Facebook. */
export function socialText(kind: Social, value: string) {
  if (kind !== "facebook") return `@${value}`;
  if (value.startsWith("profile.php")) return "Facebook";
  // "p/Cafetaria-Nicky-1000123" and "people/Naam/123" carry the name in one part.
  const parts = value.split("/");
  const name = parts[0] === "p" || parts[0] === "people" ? parts[1] : parts[0];
  return decodeURIComponent(name ?? "").replace(/-\d{6,}$/, "").replace(/-/g, " ") || "Facebook";
}
