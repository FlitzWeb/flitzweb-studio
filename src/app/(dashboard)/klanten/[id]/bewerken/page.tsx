import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/form/DeleteButton";
import { deleteClient } from "@/features/clients/actions";
import { ClientForm } from "@/features/clients/ClientForm";
import { getClient } from "@/features/clients/queries";
import styles from "@/components/form/form.module.css";

export const metadata: Metadata = { title: "Klant bewerken" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const client = Number.isInteger(id) ? await getClient(id) : undefined;
  if (!client) notFound();

  return (
    <>
      <Link href={`/klanten/${client.id}`} className="back-link">
        ← {client.name}
      </Link>
      <h1 className={styles.title}>Klant bewerken</h1>
      <ClientForm client={client} />
      <div className={styles.danger}>
        <DeleteButton
          action={deleteClient.bind(null, client.id)}
          label="Klant verwijderen"
          confirmText={`${client.name} verwijderen? Al hun sites en uptime-geschiedenis worden ook verwijderd.`}
        />
      </div>
    </>
  );
}
