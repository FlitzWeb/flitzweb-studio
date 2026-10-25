import { ContactCard } from "@/features/clients/ContactCard";
import type { SiteWithClient } from "@/lib/sites";

export function ContactTab({ site }: { site: SiteWithClient }) {
  return <ContactCard client={site.client} showClientLink />;
}
