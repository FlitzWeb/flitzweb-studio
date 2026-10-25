import "server-only";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

type Email = { to: string; subject: string; text: string };

/**
 * Sends a plain-text email via Resend. Without RESEND_API_KEY (local dev)
 * the email is printed to the terminal instead.
 */
export async function sendEmail({ to, subject, text }: Email) {
  if (!resend) {
    console.log(`\n✉️  [email → ${to}] ${subject}\n${text}\n`);
    return;
  }
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "FlitzWeb Studio <onboarding@resend.dev>",
    to,
    subject,
    text,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

export const adminEmail = () => process.env.ADMIN_EMAIL!.trim().toLowerCase();
export const alertEmail = () => process.env.ALERT_EMAIL || adminEmail();
export const appUrl = () =>
  (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
