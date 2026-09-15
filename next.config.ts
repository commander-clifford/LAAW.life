import type { NextConfig } from "next";

const pagesBasePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: pagesBasePath,
  },
  // ESLint uses the TypeScript 6 compatibility API while the standalone
  // typecheck command continues to run the native TypeScript 7 CLI.
  experimental: {
    useTypeScriptCli: false,
  },
  ...(pagesBasePath ? { basePath: pagesBasePath } : {}),
};

export default nextConfig;
