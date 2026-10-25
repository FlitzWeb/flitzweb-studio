import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { requestLogin } from "./actions";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Inloggen" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <Logo className={styles.logo} studio />
        {sent ? (
          <>
            <h1 className={styles.title}>Check je mail.</h1>
            <p className={styles.lead}>
              Als dit adres toegang heeft, staat er nu een inloglink in je
              inbox. Hij is 15 minuten geldig.
            </p>
            <a className={styles.again} href="/login">
              Ander adres proberen
            </a>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Inloggen bij Studio</h1>
            <p className={styles.lead}>
              Log in met je e-mailadres. Je krijgt een link, geen wachtwoord.
            </p>
            {error && (
              <p className={styles.error}>
                Die link is verlopen of al gebruikt. Vraag een nieuwe aan.
              </p>
            )}
            <form action={requestLogin} className={styles.form}>
              <label className="label" htmlFor="email">
                E-mailadres
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="jij@flitzweb.nl"
              />
              <button className="btn btn-primary" type="submit">
                Stuur inloglink
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
