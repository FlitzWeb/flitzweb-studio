import "server-only";
import { browserName, detectOS } from "detect-browser";
import UAParser from "ua-parser-js";

// Visitor details derived from request headers, the same way Umami does it
// (src/lib/detect.ts). The IP and user agent are only used to build the
// anonymous session id and are never stored.

export type ClientInfo = {
  ip: string;
  userAgent: string;
  browser: string | null;
  os: string | null;
  device: string;
  country: string | null;
  region: string | null;
  city: string | null;
};

export function getClientInfo(request: Request, screen?: string): ClientInfo {
  const h = request.headers;
  const userAgent = h.get("user-agent") ?? "";
  const ip = (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim();

  // Vercel adds these geo headers for free. Locally they're absent.
  const country = decodeHeader(h.get("x-vercel-ip-country"));
  const region = decodeHeader(h.get("x-vercel-ip-country-region"));
  const city = decodeHeader(h.get("x-vercel-ip-city"));

  return {
    ip,
    userAgent,
    browser: browserName(userAgent) ?? null,
    os: (detectOS(userAgent) as string | null) ?? null,
    device: getDevice(userAgent, screen),
    country,
    region: country && region ? (region.includes("-") ? region : `${country}-${region}`) : null,
    city,
  };
}

/** desktop | laptop | mobile | tablet | ...; big screens are "desktop", the rest "laptop". */
function getDevice(userAgent: string, screen = "") {
  const type = new UAParser(userAgent).getDevice().type || "desktop";
  const width = Number(screen.split("x")[0]);
  if (type === "desktop" && screen && width <= 1920) return "laptop";
  return type;
}

function decodeHeader(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(Buffer.from(value, "latin1").toString("utf-8"));
  } catch {
    return value;
  }
}
