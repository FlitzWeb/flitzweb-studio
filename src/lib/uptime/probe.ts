import "server-only";
import tls from "node:tls";

export type ProbeResult = {
  isUp: boolean;
  httpStatus: number | null;
  responseMs: number | null;
  sslExpiresAt: Date | null;
  error: string | null;
};

const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 3_000;

/**
 * Checks one URL: a GET that follows redirects (10s timeout), plus a TLS
 * handshake to read the certificate expiry. A failure is retried once
 * before we call the site down, so a single blip doesn't page anyone.
 */
export async function probe(url: string): Promise<ProbeResult> {
  const first = await probeOnce(url);
  if (first.isUp) return first;
  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  return probeOnce(url);
}

async function probeOnce(url: string): Promise<ProbeResult> {
  const [http, sslExpiresAt] = await Promise.all([
    httpCheck(url),
    readCertExpiry(url),
  ]);
  return { ...http, sslExpiresAt };
}

async function httpCheck(url: string) {
  const started = performance.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "FlitzWeb-Monitor/1.0 (+https://flitzweb.nl)" },
      cache: "no-store",
    });
    const responseMs = Math.round(performance.now() - started);
    await res.body?.cancel(); // we only need the status
    return {
      isUp: res.status < 400,
      httpStatus: res.status,
      responseMs,
      error: res.status < 400 ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      isUp: false,
      httpStatus: null,
      responseMs: null,
      error: describeError(err),
    };
  }
}

/** Opens a TLS connection and returns the certificate's expiry date. */
function readCertExpiry(url: string): Promise<Date | null> {
  const { protocol, hostname, port } = new URL(url);
  if (protocol !== "https:") return Promise.resolve(null);

  return new Promise((resolve) => {
    const socket = tls.connect({
      host: hostname,
      port: Number(port) || 443,
      servername: hostname,
      // Still read the cert if it's invalid/expired; that's what we want to see.
      rejectUnauthorized: false,
      timeout: TIMEOUT_MS,
    });
    const done = (value: Date | null) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("secureConnect", () => {
      const validTo = socket.getPeerCertificate()?.valid_to;
      done(validTo ? new Date(validTo) : null);
    });
    socket.once("timeout", () => done(null));
    socket.once("error", () => done(null));
  });
}

function describeError(err: unknown) {
  if (err instanceof Error) {
    if (err.name === "TimeoutError") return "Geen antwoord binnen 10 s";
    const cause = (err as { cause?: { code?: string } }).cause;
    if (cause?.code === "ENOTFOUND") return "Domein niet gevonden (DNS)";
    if (cause?.code === "ECONNREFUSED") return "Verbinding geweigerd";
    if (cause?.code === "CERT_HAS_EXPIRED") return "SSL-certificaat verlopen";
    if (cause?.code) return cause.code;
    return err.message;
  }
  return String(err);
}
