import type { NextConfig } from "next";

// GitHub Pages can only host static files, and serves a project site from
// /<repo> rather than the root. Both are switched on by the Pages workflow
// alone, so `npm run dev` still runs a normal Next server at the root.
const forPages = process.env.GITHUB_PAGES === "true";
const basePath = forPages ? "/cadence" : "";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(forPages ? { output: "export" as const, basePath, assetPrefix: basePath } : {}),
  // The export has no server to optimise images on demand.
  images: { unoptimized: true },
  experimental: { optimizePackageImports: ["motion"] },
};

export default config;
