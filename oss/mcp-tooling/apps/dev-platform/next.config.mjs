import { createNextConfig } from '@mcpoverflow/frontend-config'

// Create developer platform-specific configuration
const config = createNextConfig('developer')

// Add developer platform-specific customizations
const devPlatformConfig = {
  ...config,

  // Developer platform optimizations
  transpilePackages: ['@mcpoverflow/ui'],
  experimental: {
    ...config.experimental,
    optimizePackageImports: ['@tanstack/react-query', '@monaco-editor/react', 'recharts'],
    optimizeCss: true,
  },

  // Environment variables
  env: {
    ...config.env,
    NEXT_PUBLIC_DOMAIN_TYPE: 'developer',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.mcpoverflow.io',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.mcpoverflow.io',
  },

  // Developer platform specific headers
  async headers() {
    const devPlatformHeaders = [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Domain-Purpose',
            value: 'developer-platform',
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
    ]

    return [...(config.headers ? await config.headers() : []), ...devPlatformHeaders]
  },

  // Developer platform redirects
  async redirects() {
    const devPlatformRedirects = [
      {
        source: '/dashboard',
        destination: '/',
        permanent: false,
      },
      {
        source: '/auth',
        destination: '/login',
        permanent: true,
      },
      // External redirects
      {
        source: '/docs',
        destination: 'https://mcpoverflow.dev',
        permanent: true,
      },
      {
        source: '/ai',
        destination: 'https://mcpoverflow.ai',
        permanent: true,
      },
    ];

    return [...(config.redirects ? await config.redirects() : []), ...devPlatformRedirects];
  },
}

export default devPlatformConfig