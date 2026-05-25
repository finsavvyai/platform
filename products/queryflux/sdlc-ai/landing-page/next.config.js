/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Cloudflare
  output: 'standalone',

  // Enable server external packages for Cloudflare
  serverExternalPackages: ['@cloudflare/next-on-pages'],

  // Environment variables
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    NEXT_PUBLIC_LEMONSQUEEZY_STORE_URL: process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_URL || 'https://sdlc.lemonsqueezy.com',
  },

  // Image optimization (disabled for static export, but we'll handle with Cloudflare Image Resizing)
  images: {
    domains: [
      'sdlc.finsavvyai.com',
      'staging.sdlc.finsavvyai.com',
      'assets.sdlc.finsavvyai.com',
      'lemonsqueezy.com',
      'cdn.lemonsqueezy.com',
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    unoptimized: true, // Required for static export
  },

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
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400'
          }
        ]
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, immutable'
          }
        ]
      }
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/demo',
        destination: '/#demo',
        permanent: false,
      },
      {
        source: '/contact',
        destination: '/#contact',
        permanent: false,
      },
      {
        source: '/features',
        destination: '/#features',
        permanent: false,
      }
    ];
  },

  // Rewrites for API routes
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/health',
          destination: '/api/health',
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
      '@': './',
      '@/components': './components',
      '@/lib': './lib',
      '@/styles': './styles',
      '@/types': './types',
      '@/utils': './utils',
    };

    return config;
  },

  // Build configuration
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config) => {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        })
      );
      return config;
    },
  }),
};

module.exports = nextConfig;