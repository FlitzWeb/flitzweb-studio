import type { Metadata } from "next";
import Link from "next/link";
import { ClientForm } from "@/features/clients/ClientForm";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Nieuwe klant" };

export default function NewClientPage() {
  return (
    <>
      <Link href="/klanten" className="back-link">
        ← Klanten
      </Link>
      <h1 className={styles.title}>Nieuwe klant</h1>
      <ClientForm />
    </>
  );
}
