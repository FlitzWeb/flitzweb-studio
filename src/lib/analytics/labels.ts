// Human-readable Dutch labels for analytics values.

const regionNames = new Intl.DisplayNames("nl", { type: "region" });
const languageNames = new Intl.DisplayNames("nl", { type: "language" });

/** "NL" → "🇳🇱 Nederland" */
export function countryLabel(code: string) {
  const flag = /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)))
    : "";
  let name = code;
  try {
    name = regionNames.of(code) ?? code;
  } catch {}
  return `${flag} ${name}`.trim();
}

/** "NL-NB" → "NB, Nederland" */
export function regionLabel(code: string) {
  const [country, region] = code.split("-");
  if (!region) return code;
  let name = country;
  try {
    name = regionNames.of(country) ?? country;
  } catch {}
  return `${region}, ${name}`;
}

/** "nl-NL" → "Nederlands (Nederland)" */
export function languageLabel(code: string) {
  try {
    const name = languageNames.of(code);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : code;
  } catch {
    return code;
  }
}

const BROWSERS: Record<string, string> = {
  chrome: "Chrome",
  crios: "Chrome (iOS)",
  "edge-chromium": "Edge",
  edge: "Edge (oud)",
  edgios: "Edge (iOS)",
  firefox: "Firefox",
  fxios: "Firefox (iOS)",
  ios: "Safari (iOS)",
  "ios-webview": "iOS-app",
  safari: "Safari",
  samsung: "Samsung Internet",
  opera: "Opera",
  "chromium-webview": "Android-app",
  "facebook": "Facebook-app",
  instagram: "Instagram-app",
};

export const browserLabel = (b: string) => BROWSERS[b] ?? b.charAt(0).toUpperCase() + b.slice(1);

const DEVICES: Record<string, string> = {
  desktop: "Desktop",
  laptop: "Laptop",
  mobile: "Mobiel",
  tablet: "Tablet",
  smarttv: "Smart-tv",
  console: "Spelcomputer",
  wearable: "Wearable",
};

export const deviceLabel = (d: string) => DEVICES[d] ?? d;
