const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),

  // Do not use output: "standalone" — @cloudflare/next-on-pages expects default Next build output (.vercel/output/static)
  // Enable server external packages for Cloudflare Pages
  serverExternalPackages: ["@cloudflare/next-on-pages"],

  // Environment variables
  env: {
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    NEXT_PUBLIC_LEMONSQUEEZY_STORE_URL:
      process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_URL ||
      "https://finsavvy.lemonsqueezy.com",
    NEXT_PUBLIC_LEMONSQUEEZY_TEAM_URL:
      process.env.NEXT_PUBLIC_LEMONSQUEEZY_TEAM_URL ||
      process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_URL ||
      "https://finsavvy.lemonsqueezy.com",
    NEXT_PUBLIC_LEMONSQUEEZY_BUSINESS_URL:
      process.env.NEXT_PUBLIC_LEMONSQUEEZY_BUSINESS_URL ||
      process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_URL ||
      "https://finsavvy.lemonsqueezy.com",
    NEXT_PUBLIC_GATEWAY_URL:
      process.env.NEXT_PUBLIC_GATEWAY_URL || "https://api.sdlc.cc",
  },

  // Image optimization (disabled for static export, but we'll handle with Cloudflare Image Resizing)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "sdlc.finsavvyai.com",
      },
      {
        protocol: "https",
        hostname: "staging.sdlc.finsavvyai.com",
      },
      {
        protocol: "https",
        hostname: "assets.sdlc.finsavvyai.com",
      },
      {
        protocol: "https",
        hostname: "lemonsqueezy.com",
      },
      {
        protocol: "https",
        hostname: "cdn.lemonsqueezy.com",
      },
    ],
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    unoptimized: true, // Required for static export
  },

  // Turbopack configuration (Next.js 16)
  turbopack: {},

  // Compression
  compress: true,

  // Powered by header
  poweredByHeader: false,

  // React strict mode
  reactStrictMode: true,

  // Minification (swcMinify is default in Next.js 15)

  // Headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.sdlc.cc https://*.finsavvyai.com https://*.lemonsqueezy.com; frame-ancestors 'none';",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.CORS_ORIGIN || "https://sdlc.finsavvyai.com",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400",
          },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, immutable",
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      { source: "/signup", destination: "/sign-up", permanent: true },
      {
        source: "/demo",
        destination: "/#demo",
        permanent: false,
      },
      {
        source: "/contact",
        destination: "/#contact",
        permanent: false,
      },
      {
        source: "/features",
        destination: "/#features",
        permanent: false,
      },
    ];
  },

  // Rewrites for API routes
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/health",
          destination: "/api/health",
        },
      ],
    };
  },

  // Webpack configuration
  webpack: (config, { isServer, dev }) => {
    // Enable Cloudflare Workers optimizations
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Add custom aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
      "@/components": path.resolve(__dirname, "components"),
      "@/lib": path.resolve(__dirname, "lib"),
      "@/styles": path.resolve(__dirname, "styles"),
      "@/types": path.resolve(__dirname, "types"),
      "@/utils": path.resolve(__dirname, "utils"),
    };

    if (process.env.ANALYZE === "true") {
      const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: "static",
          openAnalyzer: false,
        }),
      );
    }

    return config;
  },
};

module.exports = nextConfig;
