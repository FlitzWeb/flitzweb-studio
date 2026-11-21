import { PageSkeleton } from "@/components/Skeleton";

// Shown the moment you open this page, until it has rendered. One loading.tsx per section
// on purpose: a single one for the whole dashboard nested with the site tabs' loading.tsx
// made the first tab switch after a page load reload the whole page (Next.js 16).
export default function Loading() {
  return <PageSkeleton />;
}
