import "server-only";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
// Alerts (site down, SSL, overdue payments, traffic spikes) can use their own key, so a flood
// of login emails can never use up the sending limit the alerts need. Falls back to the main key.
const alertResend = process.env.RESEND_ALERTS_API_KEY
  ? new Resend(process.env.RESEND_ALERTS_API_KEY)
  : resend;

type Email = { to: string; subject: string; text: string };

/** Sends an alert email (uses RESEND_ALERTS_API_KEY when set). */
export const sendAlert = (email: Email) => sendEmail(email, alertResend);

/**
 * Sends a plain-text email via Resend. Without RESEND_API_KEY (local dev)
 * the email is printed to the terminal instead.
 */
export async function sendEmail({ to, subject, text }: Email, client: Resend | null = resend) {
  if (!client) {
    console.log(`\n✉️  [email → ${to}] ${subject}\n${text}\n`);
    return;
  }
  const { error } = await client.emails.send({
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
