"use client"; // Error boundaries must be Client Components

import DashboardError from "./(dashboard)/error";

// The same message when the dashboard frame itself can't load (it reads the
// site list from the database), so there is no menu to show it in.
export default function RootError(props: { error: unknown; retry: () => void }) {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-7) var(--space-5)" }}>
      <DashboardError {...props} />
    </main>
  );
}
