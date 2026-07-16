import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
  },
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
