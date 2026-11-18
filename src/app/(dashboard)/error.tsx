"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import styles from "./overview.module.css";

// Shown inside the dashboard when a page fails to load, for example when the
// database does not answer in time. The menu keeps working.
export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Er ging iets mis</h1>
          <p className="page-sub">Deze pagina kon niet geladen worden. Vaak helpt het om het nog een keer te proberen.</p>
        </div>
      </header>
      <div className={styles.empty}>
        <p>Blijft het misgaan? Kijk dan in de Vercel-logs wat de fout is.</p>
        <button type="button" className="btn btn-primary" onClick={() => retry()}>
          Opnieuw proberen
        </button>
      </div>
    </>
  );
}
