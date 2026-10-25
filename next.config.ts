import type { NextConfig } from "next";

// Cache Components is deliberately off: this is a single-user dashboard where
// every page reads the session and should always show fresh data, so plain
// request-time rendering is simpler. See README → "Next.js notes".
const nextConfig: NextConfig = {};

export default nextConfig;
