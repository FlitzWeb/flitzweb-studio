import type { Metadata } from "next";
import Link from "next/link";
import { ImportForm } from "@/features/clients/ImportForm";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Leads importeren" };

export default function ImportLeadsPage() {
  return (
    <>
      <Link href="/leads" className="back-link">
        ← Leads
      </Link>
      <h1 className={styles.title}>Leads importeren</h1>
      <ImportForm />
    </>
  );
}
