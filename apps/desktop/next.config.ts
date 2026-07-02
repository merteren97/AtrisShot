import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "../..");
const { combinedEnv } = loadEnvConfig(
  repositoryRoot,
  process.env.NODE_ENV !== "production",
  console,
  true,
);

const isExport = process.env.EXPORT_STATIC === "true";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: isExport ? "export" : undefined,
  env: {
    NEXT_PUBLIC_ATRIS_HUB_URL:
      combinedEnv.NEXT_PUBLIC_ATRIS_HUB_URL || "https://atrishub.com",
  },
  images: { unoptimized: true },
  transpilePackages: ["@atris-shot/api-contracts", "@atris-shot/shot-core"],
  turbopack: {
    root: repositoryRoot
  }
};

export default nextConfig;
