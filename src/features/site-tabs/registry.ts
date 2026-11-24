// The tabs on a site's detail page. To add a tab:
//   1. create a component in this folder that takes { site, searchParams }
//   2. add one entry below.
// `slug` becomes the URL: /sites/12/<slug> ("" is the default tab).
import type { ComponentType } from "react";
import type { SiteWithClient } from "@/lib/sites";
import { ContactTab } from "./ContactTab";
import { EventsTab } from "./EventsTab";
import { GoogleTab } from "./GoogleTab";
import { LiveTab } from "./LiveTab";
import { OverviewTab } from "./OverviewTab";
import { PaymentsTab } from "./PaymentsTab";
import { ReportsTab } from "./ReportsTab";
import { StatsTab } from "./StatsTab";
import { SummaryTab } from "./SummaryTab";
import { TrackingTab } from "./TrackingTab";
import { VersionsTab } from "./VersionsTab";
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
  /**
   * Left out of the tab bar, but the page still works at its URL
   * (/sites/12/<slug>). Remove `hidden` to bring the tab back.
   */
  hidden?: boolean;
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
  { slug: "versies", label: "Versies", component: VersionsTab },
  { slug: "stats", label: "Stats", component: StatsTab },
  { slug: "google", label: "Google", component: GoogleTab },
  { slug: "maandrapport", label: "Maandrapport", component: SummaryTab },
  { slug: "events", label: "Events", component: EventsTab, hidden: true },
  { slug: "bezoekers", label: "Bezoekers", component: VisitorsTab, hidden: true },
  { slug: "rapporten", label: "Rapporten", component: ReportsTab, hidden: true },
  { slug: "live", label: "Live", component: LiveTab, hidden: true },
  { slug: "tracking", label: "Tracking", component: TrackingTab },
];

/** Every tab that exists for this site, including hidden ones (for routing). */
export const tabsFor = (site: SiteWithClient) =>
  siteTabs.filter((t) => !t.visible || t.visible(site));
