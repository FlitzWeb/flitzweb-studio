import { LiveView } from "@/features/stats/LiveView";
import { getRealtimeData } from "@/lib/analytics/realtime";
import type { TabProps } from "./registry";

export async function LiveTab({ site }: TabProps) {
  return <LiveView siteId={site.id} initial={await getRealtimeData(site.id)} />;
}
