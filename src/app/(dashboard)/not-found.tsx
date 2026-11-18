import Link from "next/link";
import styles from "./overview.module.css";

// Shown inside the dashboard when a site, client or page does not exist (any more).
export default function NotFound() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Niet gevonden</h1>
          <p className="page-sub">Deze pagina bestaat niet (meer). Misschien is de klant of site verwijderd.</p>
        </div>
      </header>
      <div className={styles.empty}>
        <p>Gebruik de zoekbalk, of ga terug naar het overzicht.</p>
        <Link href="/" className="btn btn-primary">
          Naar het overzicht
        </Link>
      </div>
    </>
  );
}
