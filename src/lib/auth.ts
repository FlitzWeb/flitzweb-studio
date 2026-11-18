import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { authState, db, loginTokens } from "@/db";
import { isMissingTable } from "./dbErrors";
import { adminEmail, appUrl, sendEmail } from "./email";
import {
  createSessionToken,
  readSessionToken,
  SESSION_COOKIE,
  SESSION_DAYS,
} from "./session";

const TOKEN_MINUTES = 15;

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** Sessions issued before this moment are refused ("Overal uitloggen"). Once per request. */
const sessionsValidAfter = cache(async () => {
  try {
    const [row] = await db.select().from(authState).where(eq(authState.id, 1));
    return row?.sessionsValidAfter ?? new Date(0);
  } catch (error) {
    // Deployed before migration 0016 ran: nobody has used "Overal uitloggen" yet either.
    if (isMissingTable(error)) return new Date(0);
    throw error;
  }
});

/**
 * The logged-in admin's email, or null: a valid cookie for the admin address, issued after
 * the last "Overal uitloggen". Used by requireSession and the API routes that need a login.
 */
export async function sessionEmail() {
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || session.email !== adminEmail()) return null;
  if (session.iat < Math.floor((await sessionsValidAfter()).getTime() / 1000)) return null;
  return session.email;
}

/**
 * Use at the top of every page and server action that needs a login.
 * The proxy only redirects early (it cannot see the database); this is the real check.
 */
export async function requireSession() {
  const email = await sessionEmail();
  if (!email) redirect("/login");
  return { email };
}

const TOKEN_LIMIT = 3; // links per TOKEN_MINUTES
const TOKEN_GAP_SECONDS = 60; // no new link while one younger than this is still unused

/**
 * Emails a magic link, but only if the address is the admin's. At most TOKEN_LIMIT per
 * TOKEN_MINUTES and none while a fresh unused one exists, counted under a database lock so
 * requests at the same moment cannot all pass the check. The row is removed again when the
 * email could not be sent. Old tokens are cleaned up by the cron (pruneLoginTokens).
 */
export async function sendMagicLink(email: string) {
  if (email.trim().toLowerCase() !== adminEmail()) return;

  const token = randomBytes(32).toString("base64url");
  const inserted = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('studio-magic-link'))`);
    const since = new Date(Date.now() - TOKEN_MINUTES * 60_000);
    const [{ recent }] = await tx
      .select({ recent: count() })
      .from(loginTokens)
      .where(gt(loginTokens.createdAt, since));
    if (recent >= TOKEN_LIMIT) return false;
    const [{ fresh }] = await tx
      .select({ fresh: count() })
      .from(loginTokens)
      .where(
        and(
          isNull(loginTokens.usedAt),
          gt(loginTokens.createdAt, new Date(Date.now() - TOKEN_GAP_SECONDS * 1000)),
        ),
      );
    if (fresh > 0) return false;
    await tx.insert(loginTokens).values({
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000),
    });
    return true;
  });
  if (!inserted) return;

  const link = `${appUrl()}/auth/verify?token=${token}`;
  try {
    await sendEmail({
      to: adminEmail(),
      subject: "Inloggen bij FlitzWeb Studio",
      text: `Klik om in te loggen (${TOKEN_MINUTES} minuten geldig):\n\n${link}\n\nHeb je dit niet aangevraagd? Dan kun je deze mail negeren.`,
    });
  } catch (error) {
    await db.delete(loginTokens).where(eq(loginTokens.tokenHash, hash(token)));
    throw error;
  }
}

/** Removes login tokens that expired more than a day ago (run by the cron). */
export async function pruneLoginTokens() {
  await db.delete(loginTokens).where(lt(loginTokens.expiresAt, new Date(Date.now() - 86400_000)));
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

/** Ends every session, on every device (this one too): sessions issued before now stop working. */
export async function logoutEverywhere() {
  const now = new Date();
  await db
    .insert(authState)
    .values({ id: 1, sessionsValidAfter: now })
    .onConflictDoUpdate({ target: authState.id, set: { sessionsValidAfter: now } });
  (await cookies()).delete(SESSION_COOKIE);
}
