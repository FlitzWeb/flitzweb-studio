// Session cookie helpers. Kept free of Node-only and DB imports so the
// proxy (src/proxy.ts) can use them too.
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "fw_session";
export const SESSION_DAYS = 30;

/** AUTH_SECRET as a key. Refuses to work without a real secret (at least 32 characters). */
const key = () => {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or too short (use: openssl rand -base64 32)");
  }
  return new TextEncoder().encode(secret);
};

export async function createSessionToken(email: string) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

/** The email and issue time (seconds) in the token, or null if it is missing/invalid/expired. */
export async function readSessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.email !== "string" || typeof payload.iat !== "number") return null;
    return { email: payload.email, iat: payload.iat };
  } catch {
    return null;
  }
}

/** Returns the email in the token, or null if it is missing/invalid/expired. */
export async function verifySessionToken(token: string | undefined) {
  return (await readSessionToken(token))?.email ?? null;
}
