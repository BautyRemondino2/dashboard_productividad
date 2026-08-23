import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@anthropic-ai/sdk", "yahoo-finance2"],
  // La DB se abre por path armado en runtime, así que el tracing no la ve:
  // sin esto la función serverless arranca sin datos.
  outputFileTracingIncludes: {
    "/**": ["./data/dashboard.db", "./data/dashboard.db-wal"],
  },
  experimental: {
    serverActions: {
      // Folder uploads can be hundreds of MB (PDF slides + Excel + etc.)
      bodySizeLimit: "300mb",
    },
  },
};

export default nextConfig;
