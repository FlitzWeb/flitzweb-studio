import type { Metadata } from "next";
import Link from "next/link";
import { CostForm } from "@/features/costs/CostForm";
import { todayISO } from "@/lib/dates";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Nieuwe kosten" };

export default function NewCostPage() {
  return (
    <>
      <Link href="/kosten" className="back-link">
        ← Terug
      </Link>
      <h1 className={styles.title}>Nieuwe kosten</h1>
      <CostForm today={todayISO()} />
    </>
  );
}
