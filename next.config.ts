import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@anthropic-ai/sdk"],
  experimental: {
    serverActions: {
      // Folder uploads can be hundreds of MB (PDF slides + Excel + etc.)
      bodySizeLimit: "300mb",
    },
  },
};

export default nextConfig;
