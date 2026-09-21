import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@huntos/core", "maplibre-contour"],
  poweredByHeader: false,
  output: "standalone",
};

export default nextConfig;
