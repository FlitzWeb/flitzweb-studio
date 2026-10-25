// Session cookie helpers. Kept free of Node-only and DB imports so the
// proxy (src/proxy.ts) can use them too.
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "fw_session";
export const SESSION_DAYS = 30;

const key = () => new TextEncoder().encode(process.env.AUTH_SECRET);

export async function createSessionToken(email: string) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

/** Returns the email in the token, or null if it is missing/invalid/expired. */
export async function verifySessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
    });
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}
