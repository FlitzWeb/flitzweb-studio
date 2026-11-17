import type { Metadata } from "next";
import Link from "next/link";
import { ClientForm } from "@/features/clients/ClientForm";
import { isStage } from "@/features/clients/stages";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Nieuwe klant of lead" };

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ fase?: string }> }) {
  const { fase } = await searchParams;
  const stage = isStage(fase) ? fase : "client";
  const isLead = stage !== "client";

  return (
    <>
      <Link href={isLead ? "/leads" : "/klanten"} className="back-link">
        ← {isLead ? "Leads" : "Klanten"}
      </Link>
      <h1 className={styles.title}>{isLead ? "Nieuwe lead" : "Nieuwe klant"}</h1>
      <ClientForm defaultStage={stage} />
    </>
  );
}
