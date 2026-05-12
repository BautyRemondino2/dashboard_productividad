import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@anthropic-ai/sdk"],
};

export default nextConfig;
