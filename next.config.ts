import type { NextConfig } from "next";

// Cache Components is deliberately off: this is a single-user dashboard where
// every page reads the session and should always show fresh data, so plain
// request-time rendering is simpler. See README → "Next.js notes".
const nextConfig: NextConfig = {
  experimental: {
    // The leads import posts a whole run of the leads skill in one go
    // (about 2.5 kB per lead); the default limit is 1 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
