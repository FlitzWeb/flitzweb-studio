import "server-only";
import { jwtVerify, SignJWT } from "jose";

// The editor frame loads a client's page and its files from /edit-frame/<token>/... The frame is
// sandboxed, so those requests carry no login cookie; this signed token is what lets them through.
// It names one repo at one exact commit and lasts a few hours. It has no iat, and its expiry is
// rounded to the hour, so the same commit gets the same token (and the browser cache keeps working).

const AUDIENCE = "edit-frame";

const key = () => {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) throw new Error("AUTH_SECRET is missing or too short");
  return new TextEncoder().encode(secret);
};

export async function frameToken(repo: string, sha: string) {
  const expires = (Math.floor(Date.now() / 3_600_000) + 4) * 3600;
  return new SignJWT({ r: repo, c: sha }).setProtectedHeader({ alg: "HS256" }).setAudience(AUDIENCE).setExpirationTime(expires).sign(key());
}

export async function readFrameToken(token: string): Promise<{ repo: string; sha: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], audience: AUDIENCE });
    if (typeof payload.r !== "string" || typeof payload.c !== "string") return null;
    return { repo: payload.r, sha: payload.c };
  } catch {
    return null;
  }
}
