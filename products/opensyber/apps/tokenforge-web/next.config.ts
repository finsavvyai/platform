import type { NextConfig } from "next";

// Security headers applied via src/middleware.ts because OpenNext's routing
// layer (path-to-regexp v8) rejects Next.js's documented `/:path*` catch-all
// source pattern used by headers()/rewrites(). Keeping redirects() here
// because those use fully-qualified source paths that path-to-regexp accepts.
const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/quick-start', destination: '/docs', permanent: true },
      { source: '/sdks', destination: '/docs/integrations', permanent: true },
    ];
  },
};

export default nextConfig;
