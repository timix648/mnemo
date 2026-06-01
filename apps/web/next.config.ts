import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a fully static site (no Node server) for Walrus Sites hosting.
  output: "export",
  // Static export can't use the Next image optimizer; serve images as-is.
  images: { unoptimized: true },
  // Emit /route/index.html for each page so deep-link refreshes (e.g. /search)
  // resolve correctly on a static host / Walrus portal.
  trailingSlash: true,
};

export default nextConfig;