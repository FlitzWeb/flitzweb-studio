import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { consumeMagicLink } from "@/lib/auth";
import styles from "../../login/login.module.css";

export const metadata: Metadata = { title: "Inloggen" };

// The link from the email lands here. Logging in takes one extra tap on
// purpose: mail scanners that "click" links with a GET can't burn the token.
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  async function confirm() {
    "use server";
    const ok = await consumeMagicLink(token);
    redirect(ok ? "/" : "/login?error=1");
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <Logo className={styles.logo} studio />
        <h1 className={styles.title}>Welkom terug.</h1>
        <p className={styles.lead}>Tik op de knop om in te loggen.</p>
        <form action={confirm} className={styles.form}>
          <button className="btn btn-primary" type="submit">
            Inloggen
          </button>
        </form>
      </div>
    </main>
  );
}
