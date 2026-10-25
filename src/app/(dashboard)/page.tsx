import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CheckNowButton } from "@/features/uptime/CheckNowButton";
import { SiteCard } from "@/features/uptime/SiteCard";
import { getSiteOverviews } from "@/lib/uptime/queries";
import styles from "./overview.module.css";

export default async function OverviewPage() {
  const sites = await getSiteOverviews();
  const monitored = sites.filter((s) => s.monitored);
  const down = monitored.filter((s) => s.isUp === false);

  return (
    <>
      <AutoRefresh seconds={60} />
      <section className={styles.head}>
        <div>
          <p className="eyebrow">Overzicht · {monitored.length} sites gemonitord</p>
          <h1 className={styles.title} data-down={down.length > 0 || undefined}>
            {headline(monitored.length, down.length)}
          </h1>
        </div>
        <div className={styles.actions}>
          <Link href="/sites/nieuw" className="btn">
            + Site
          </Link>
          <CheckNowButton />
        </div>
      </section>

      {sites.length === 0 ? (
        <p className={styles.empty}>
          Nog geen sites. <Link href="/klanten/nieuw">Voeg een klant toe</Link> en daarna een site.
        </p>
      ) : (
        <div className={styles.grid}>
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}
    </>
  );
}

function headline(total: number, down: number) {
  if (total === 0) return "Nog niets te monitoren.";
  if (down === 0) return total === 1 ? "Je site draait." : "Alles draait.";
  if (down === total && total > 1) return "Alle sites liggen eruit.";
  return down === 1 ? "Eén site ligt eruit." : `${down} sites liggen eruit.`;
}
