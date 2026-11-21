import { PageSkeleton } from "@/components/Skeleton";

// Shown below the tab bar the moment you switch tabs, until the tab has rendered.
export default function Loading() {
  return <PageSkeleton head={false} />;
}
