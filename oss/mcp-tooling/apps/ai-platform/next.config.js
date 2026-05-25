import { createNextConfig } from '@mcpoverflow/frontend-config'

// Create AI platform-specific configuration
const config = createNextConfig('ai')

// Add AI platform-specific customizations
const aiPlatformConfig = {
  ...config,

  // AI platform optimizations
  transpilePackages: ['@mcpoverflow/ui'],
  experimental: {
    ...config.experimental,
    optimizePackageImports: ['openai', '@react-three/fiber', 'react-flow-renderer', 'recharts'],
  },

  // Environment variables
  env: {
    ...config.env,
    NEXT_PUBLIC_DOMAIN_TYPE: 'ai',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.mcpoverflow.ai',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.mcpoverflow.ai',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },

  // AI platform specific headers
  async headers() {
    const aiPlatformHeaders = [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Domain-Purpose',
            value: 'ai-platform',
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
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
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
      {
        source: '/models/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ]

    return [...(config.headers ? await config.headers() : []), ...aiPlatformHeaders]
  },

  // AI platform redirects
  async redirects() {
    const aiPlatformRedirects = [
      {
        source: '/chat',
        destination: '/',
        permanent: false,
      },
      {
        source: '/dashboard',
        destination: '/',
        permanent: false,
      },
      // External redirects
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
    ];

    return [...(config.redirects ? await config.redirects() : []), ...aiPlatformRedirects];
  },

  // Webpack configuration for 3D and AI models
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Custom webpack config for 3D models and AI assets
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      }
    }

    return config
  },
}

import { withSentryConfig } from '@sentry/nextjs';

// ... config definition ...

export default withSentryConfig(
  aiPlatformConfig,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,
    org: "mcpoverflow",
    project: "ai-platform",
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: true,

    // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
    tunnelRoute: "/monitoring",

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  }
);