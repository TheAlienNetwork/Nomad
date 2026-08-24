import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@huntos/core"],
  poweredByHeader: false,
};

export default nextConfig;
