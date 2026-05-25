import bundleAnalyzerInit from '@next/bundle-analyzer';

const bundleAnalyzer = bundleAnalyzerInit({
  enabled: process.env.ANALYZE === 'true',
});

// Marketing-specific configuration
const marketingConfig = {
  // Core settings
  reactStrictMode: true,
  poweredByHeader: false,

  // Transpile packages
  transpilePackages: [
    '@mcpoverflow/ui',
    '@mcpoverflow/config',
    '@mcpoverflow/frontend-config',
    '@mcpoverflow/frontend-hooks',
  ],

  // Marketing-specific optimizations
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react', 'react-icons'],
  },

  // Marketing-specific output for static export
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
    domains: ['mcpoverflow.com', 'www.mcpoverflow.com'],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_DOMAIN_TYPE: 'marketing',
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Marketing-specific redirects
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
      {
        source: '/pricing',
        destination: '/#pricing',
        permanent: true,
      },
      {
        source: '/features',
        destination: '/#features',
        permanent: true,
      },
      // Domain redirects
      {
        source: '/docs',
        destination: 'https://mcpoverflow.dev',
        permanent: true,
      },
      {
        source: '/app',
        destination: 'https://app.mcpoverflow.io',
        permanent: true,
      },
      {
        source: '/ai',
        destination: 'https://mcpoverflow.ai',
        permanent: true,
      },
    ];
  },

  // Marketing-specific headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Domain-Purpose',
            value: 'marketing',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

// Sentry temporarily disabled - re-enable once project is configured in Sentry dashboard
// import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = bundleAnalyzer(marketingConfig);

// Export without Sentry wrapper for now
export default nextConfig;

/* Re-enable Sentry with:
export default withSentryConfig(
  nextConfig,
  {
    silent: true,
    org: "mcpoverflow",
    project: "marketing",
  },
  {
    widenClientFileUpload: true,
    transpileClientSDK: true,
    tunnelRoute: "/monitoring",
    hideSourceMaps: true,
    disableLogger: true,
  }
);
*/