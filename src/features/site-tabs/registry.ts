// The tabs on a site's detail page. To add a tab:
//   1. create a component in this folder that takes { site, searchParams }
//   2. add one entry below.
// `slug` becomes the URL: /sites/12/<slug> ("" is the default tab).
import type { ComponentType } from "react";
import type { SiteWithClient } from "@/lib/sites";
import { ContactTab } from "./ContactTab";
import { EventsTab } from "./EventsTab";
import { LiveTab } from "./LiveTab";
import { OverviewTab } from "./OverviewTab";
import { PaymentsTab } from "./PaymentsTab";
import { ReportsTab } from "./ReportsTab";
import { StatsTab } from "./StatsTab";
import { TrackingTab } from "./TrackingTab";
import { VisitorsTab } from "./VisitorsTab";

export type TabProps = {
  site: SiteWithClient;
  searchParams: Record<string, string | string[] | undefined>;
};

export type SiteTab = {
  slug: string;
  label: string;
  component: ComponentType<TabProps>;
  /** Optional: hide the tab for some sites. */
  visible?: (site: SiteWithClient) => boolean;
};

export const siteTabs: SiteTab[] = [
  { slug: "", label: "Overzicht", component: OverviewTab },
  { slug: "contact", label: "Contact", component: ContactTab },
  {
    slug: "betalingen",
    label: "Betalingen",
    component: PaymentsTab,
    // Family / pro bono clients have nothing to bill.
    visible: (site) => site.client.billingType === "paying",
  },
  { slug: "stats", label: "Stats", component: StatsTab },
  { slug: "events", label: "Events", component: EventsTab },
  { slug: "bezoekers", label: "Bezoekers", component: VisitorsTab },
  { slug: "rapporten", label: "Rapporten", component: ReportsTab },
  { slug: "live", label: "Live", component: LiveTab },
  { slug: "tracking", label: "Tracking", component: TrackingTab },
];

export const tabsFor = (site: SiteWithClient) =>
  siteTabs.filter((t) => !t.visible || t.visible(site));
