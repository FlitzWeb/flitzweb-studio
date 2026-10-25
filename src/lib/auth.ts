import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, loginTokens } from "@/db";
import { adminEmail, appUrl, sendEmail } from "./email";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_DAYS,
  verifySessionToken,
} from "./session";

const TOKEN_MINUTES = 15;

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * Use at the top of every page and server action that needs a login.
 * The proxy already redirects logged-out visitors; this is the real check.
 */
export async function requireSession() {
  const email = await verifySessionToken(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (email !== adminEmail()) redirect("/login");
  return { email };
}

/** Emails a magic link, but only if the address is the admin's. */
export async function sendMagicLink(email: string) {
  if (email.trim().toLowerCase() !== adminEmail()) return;

  // Don't let someone flood the inbox: max 5 links per 15 minutes.
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(loginTokens)
    .where(gt(loginTokens.createdAt, new Date(Date.now() - TOKEN_MINUTES * 60_000)));
  if (recent >= 5) return;

  const token = randomBytes(32).toString("base64url");
  await db.insert(loginTokens).values({
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000),
  });

  const link = `${appUrl()}/auth/verify?token=${token}`;
  await sendEmail({
    to: adminEmail(),
    subject: "Inloggen bij FlitzWeb Studio",
    text: `Klik om in te loggen (${TOKEN_MINUTES} minuten geldig):\n\n${link}\n\nHeb je dit niet aangevraagd? Dan kun je deze mail negeren.`,
  });
}

/** Consumes a magic-link token and sets the session cookie. */
export async function consumeMagicLink(token: string) {
  const [row] = await db
    .update(loginTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(loginTokens.tokenHash, hash(token)),
        isNull(loginTokens.usedAt),
        gt(loginTokens.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!row) return false;

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(adminEmail()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return true;
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}
