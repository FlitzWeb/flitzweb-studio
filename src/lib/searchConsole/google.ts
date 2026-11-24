import "server-only";
import { importPKCS8, SignJWT } from "jose";

// Google Search Console, read-only, through a service account (a Google robot
// account with its own key, no person's login). GSC_SERVICE_ACCOUNT holds the
// account's JSON key: the whole file as it was downloaded, or base64 of it.
// The account sees a property only after it is added as a user in Search Console
// (Instellingen → Gebruikers en rechten → Gebruiker toevoegen, "Beperkt" is enough).

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://searchconsole.googleapis.com/webmasters/v3";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
/** Google's maximum rows per request; more are fetched page by page. */
const ROW_LIMIT = 25_000;

/** A failure worth showing as it is, in Dutch. */
export class SearchConsoleError extends Error {}

type ServiceAccount = { email: string; key: string };

/** The configured service account, or why there is none (null + null = not set up). */
export function readServiceAccount(): { account: ServiceAccount | null; problem: string | null } {
  const raw = process.env.GSC_SERVICE_ACCOUNT?.trim();
  if (!raw) return { account: null, problem: null };
  try {
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const json = JSON.parse(text) as { client_email?: unknown; private_key?: unknown };
    if (typeof json.client_email === "string" && typeof json.private_key === "string") {
      // A key pasted with literal "\n" instead of newlines still works.
      return { account: { email: json.client_email, key: json.private_key.replace(/\\n/g, "\n") }, problem: null };
    }
  } catch {}
  return {
    account: null,
    problem: "GSC_SERVICE_ACCOUNT staat ingesteld, maar is geen JSON-sleutel van een service-account.",
  };
}

function account() {
  const { account, problem } = readServiceAccount();
  if (!account) throw new SearchConsoleError(problem ?? "Er is nog geen service-account ingesteld (GSC_SERVICE_ACCOUNT).");
  return account;
}

let token: { email: string; value: string; expires: number } | null = null;

/** An access token for the service account, reused until a minute before it runs out. */
async function accessToken(a: ServiceAccount) {
  if (token && token.email === a.email && token.expires > Date.now() + 60_000) return token.value;
  let key: CryptoKey;
  try {
    key = await importPKCS8(a.key, "RS256");
  } catch {
    throw new SearchConsoleError("De private key in GSC_SERVICE_ACCOUNT kan niet worden gelezen.");
  }
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(a.email)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !body.access_token) {
    throw new SearchConsoleError(`Google weigerde de sleutel van het service-account (${body.error_description ?? body.error ?? `HTTP ${res.status}`}).`);
  }
  token = { email: a.email, value: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const a = account();
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${await accessToken(a)}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) {
    if (res.status === 403) {
      throw new SearchConsoleError(`Geen toegang. Voeg ${a.email} in Search Console toe als gebruiker van deze property.`);
    }
    if (res.status === 429) throw new SearchConsoleError("Google geeft even geen gegevens (te veel verzoeken). Het wordt later vanzelf opnieuw geprobeerd.");
    throw new SearchConsoleError(`Search Console gaf een fout: ${json.error?.message ?? `HTTP ${res.status}`}`);
  }
  return json as T;
}

export type Property = { siteUrl: string; permissionLevel: string };

/** The properties the service account has been added to. */
export async function listProperties(): Promise<Property[]> {
  const r = await call<{ siteEntry?: Property[] }>("/sites");
  return (r.siteEntry ?? []).filter((p) => p.permissionLevel !== "siteUnverifiedUser");
}

export type SearchRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

/**
 * Search Analytics for web search: one row per combination of `dimensions`, all pages of it.
 * Dates are Google's days (Pacific time), "YYYY-MM-DD". Fresh, not yet final days are included.
 */
export async function querySearchAnalytics(
  property: string,
  q: { startDate: string; endDate: string; dimensions: string[] },
): Promise<SearchRow[]> {
  const rows: SearchRow[] = [];
  for (let startRow = 0; ; startRow += ROW_LIMIT) {
    const r = await call<{ rows?: SearchRow[] }>(`/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
      ...q,
      type: "web",
      dataState: "all",
      rowLimit: ROW_LIMIT,
      startRow,
    });
    rows.push(...(r.rows ?? []));
    if (!r.rows || r.rows.length < ROW_LIMIT || startRow >= 40 * ROW_LIMIT) return rows;
  }
}

/** The property that belongs to a site's address: the domain property first, else the URL-prefix one. */
export function matchProperty(siteUrl: string, properties: Property[]) {
  let host: string;
  try {
    host = new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const want = [
    `sc-domain:${host}`,
    `https://${host}/`,
    `https://www.${host}/`,
    `http://${host}/`,
    `http://www.${host}/`,
  ];
  for (const w of want) if (properties.some((p) => p.siteUrl === w)) return w;
  return null;
}

/** "sc-domain:hakiki.nl" → "hakiki.nl (hele domein)", "https://hakiki.nl/" stays as it is. */
export const propertyLabel = (p: string) => (p.startsWith("sc-domain:") ? `${p.slice(10)} (hele domein)` : p);
