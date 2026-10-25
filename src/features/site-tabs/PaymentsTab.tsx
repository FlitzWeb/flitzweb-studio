import { ClientMoney } from "@/features/money/ClientMoney";
import type { SiteWithClient } from "@/lib/sites";

// Payments belong to the client, so this shows the client's full picture.
export function PaymentsTab({ site }: { site: SiteWithClient }) {
  return <ClientMoney client={site.client} returnTo={`/sites/${site.id}/betalingen`} />;
}
