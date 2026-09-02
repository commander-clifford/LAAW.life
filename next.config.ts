import type { NextConfig } from "next";

const pagesBasePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  reactStrictMode: true,
  ...(pagesBasePath ? { basePath: pagesBasePath } : {}),
};

export default nextConfig;
