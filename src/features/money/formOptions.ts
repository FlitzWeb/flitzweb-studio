import "server-only";
import { getPayingClientOptions, getSiteOptions } from "./queries";
import type { MoneyFormOptions } from "./SubscriptionForm";

export async function getMoneyFormOptions(): Promise<MoneyFormOptions> {
  const [clients, sites] = await Promise.all([getPayingClientOptions(), getSiteOptions()]);
  return { clients, sites };
}

/** Reads ?klant= and ?terug= from a form page URL. */
export function formParams(params: { klant?: string; terug?: string }) {
  const clientId = Number(params.klant) || undefined;
  const to = params.terug ?? "";
  return { clientId, returnTo: to.startsWith("/") && !to.startsWith("//") ? to : "/geld" };
}
