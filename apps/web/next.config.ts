import type { NextConfig } from "next";
import path from "node:path";

const minioPublic = process.env.MINIO_PUBLIC_URL ?? "http://localhost:9000";
const minioURL = new URL(minioPublic);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@pokermap/ui", "@pokermap/types"],
  typedRoutes: true,
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
  images: {
    remotePatterns: [
      {
        protocol: minioURL.protocol.replace(":", "") as "http" | "https",
        hostname: minioURL.hostname,
        port: minioURL.port || undefined,
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
