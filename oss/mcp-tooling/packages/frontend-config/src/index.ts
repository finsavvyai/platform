import type { NextConfig } from 'next'

export interface DomainConfig {
  name: string
  url: string
  title: string
  description: string
  theme: string
  apiBaseUrl: string
  wsUrl?: string
  brandColor: string
  favicon: string
  logo: string
  ogImage: string
  analyticsId?: string
  features: {
    auth: boolean
    analytics: boolean
    websocket: boolean
    darkMode: boolean
    i18n: boolean
  }
  seo: {
    keywords: string[]
    twitterCard: string
    twitterSite: string
    structuredData: boolean
  }
  security: {
    csp: boolean
    hsts: boolean
    frameOptions: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM'
  }
}

export interface FrontendConfig {
  domains: {
    marketing: DomainConfig
    developer: DomainConfig
    ai: DomainConfig
    docs: DomainConfig
  }
  currentDomain: string
  isProduction: boolean
  isDevelopment: boolean
  apiUrls: {
    base: string
    auth: string
    connectors: string
    parsers: string
    generation: string
    agents: string
    analytics: string
  }
  build: {
    output: 'standalone' | 'export'
    trailingSlash: boolean
    compress: boolean
    poweredByHeader: boolean
  }
  performance: {
    enableSwcMinify: boolean
    optimizeFonts: boolean
    optimizeImages: boolean
    swcPlugins: string[]
  }
}

export const DOMAIN_CONFIGS: Record<string, DomainConfig> = {
  marketing: {
    name: 'MCPOverflow Marketing',
    url: 'https://mcpoverflow.com',
    title: 'MCPOverflow - AI-Powered MCP Connector Platform',
    description: 'Generate MCP connectors instantly from OpenAPI, GraphQL, and Postman collections. Build powerful AI agent workflows with automatic tool generation.',
    theme: 'marketing',
    apiBaseUrl: 'https://mcpoverflow.com/api',
    brandColor: '#3b82f6',
    favicon: '/favicon.ico',
    logo: '/logo.png',
    ogImage: '/og-image.png',
    analyticsId: process.env.NEXT_PUBLIC_ANALYTICS_ID,
    features: {
      auth: false,
      analytics: true,
      websocket: false,
      darkMode: true,
      i18n: true
    },
    seo: {
      keywords: ['MCP', 'AI', 'OpenAPI', 'GraphQL', 'Postman', 'connector', 'agent', 'automation', 'API'],
      twitterCard: 'summary_large_image',
      twitterSite: '@mcpoverflow',
      structuredData: true
    },
    security: {
      csp: true,
      hsts: true,
      frameOptions: 'SAMEORIGIN'
    }
  },

  developer: {
    name: 'MCPOverflow Developer Platform',
    url: 'https://app.mcpoverflow.io',
    title: 'MCPOverflow Developer Platform - Build MCP Connectors',
    description: 'Access powerful tools to create, test, and deploy MCP connectors. Integrate AI agents with any API instantly.',
    theme: 'developer',
    apiBaseUrl: 'https://app.mcpoverflow.io/api',
    brandColor: '#10b981',
    favicon: '/favicon.ico',
    logo: '/logo.png',
    ogImage: '/og-image.png',
    analyticsId: process.env.NEXT_PUBLIC_ANALYTICS_ID,
    features: {
      auth: true,
      analytics: true,
      websocket: false,
      darkMode: true,
      i18n: false
    },
    seo: {
      keywords: ['MCP', 'API', 'development', 'connectors', 'OpenAPI', 'GraphQL', 'Postman', 'builder'],
      twitterCard: 'summary_large_image',
      twitterSite: '@mcpoverflow',
      structuredData: true
    },
    security: {
      csp: true,
      hsts: true,
      frameOptions: 'DENY'
    }
  },

  ai: {
    name: 'MCPOverflow AI Platform',
    url: 'https://mcpoverflow.ai',
    title: 'MCPOverflow AI - Intelligent Agent Management',
    description: 'Deploy and manage AI agents with automatic MCP connector generation. Build intelligent workflows that understand your APIs.',
    theme: 'ai',
    apiBaseUrl: 'https://mcpoverflow.ai/api',
    wsUrl: 'wss://mcpoverflow.ai/ws',
    brandColor: '#8b5cf6',
    favicon: '/favicon.ico',
    logo: '/logo.png',
    ogImage: '/og-image.png',
    analyticsId: process.env.NEXT_PUBLIC_ANALYTICS_ID,
    features: {
      auth: true,
      analytics: true,
      websocket: true,
      darkMode: true,
      i18n: false
    },
    seo: {
      keywords: ['MCP', 'AI', 'agents', 'chat', 'workflows', 'automation', 'LLM', 'OpenAI'],
      twitterCard: 'summary_large_image',
      twitterSite: '@mcpoverflow',
      structuredData: true
    },
    security: {
      csp: true,
      hsts: true,
      frameOptions: 'DENY'
    }
  },

  docs: {
    name: 'MCPOverflow Documentation',
    url: 'https://mcpoverflow.dev',
    title: 'MCPOverflow Documentation - Developer Guide',
    description: 'Complete guide to building MCP connectors, integrating AI agents, and deploying with the MCPOverflow platform.',
    theme: 'docs',
    apiBaseUrl: 'https://mcpoverflow.dev/api',
    brandColor: '#f59e0b',
    favicon: '/favicon.ico',
    logo: '/logo.png',
    ogImage: '/og-image.png',
    analyticsId: process.env.NEXT_PUBLIC_ANALYTICS_ID,
    features: {
      auth: false,
      analytics: true,
      websocket: false,
      darkMode: true,
      i18n: true
    },
    seo: {
      keywords: ['MCP', 'documentation', 'guide', 'tutorial', 'API', 'connectors', 'development'],
      twitterCard: 'summary_large_image',
      twitterSite: '@mcpoverflow',
      structuredData: true
    },
    security: {
      csp: true,
      hsts: true,
      frameOptions: 'SAMEORIGIN'
    }
  }
}

export function getCurrentDomain(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname

    if (hostname === 'mcpoverflow.com' || hostname === 'www.mcpoverflow.com') {
      return 'marketing'
    } else if (hostname === 'app.mcpoverflow.io') {
      return 'developer'
    } else if (hostname === 'mcpoverflow.ai') {
      return 'ai'
    } else if (hostname === 'mcpoverflow.dev') {
      return 'docs'
    }
  }

  // Fallback to environment variable or default
  return process.env.NEXT_PUBLIC_DOMAIN_TYPE || 'marketing'
}

export function getDomainConfig(domain?: string): DomainConfig {
  const domainType = domain || getCurrentDomain()
  return DOMAIN_CONFIGS[domainType] || DOMAIN_CONFIGS.marketing
}

export function createFrontendConfig(): FrontendConfig {
  const currentDomain = getCurrentDomain()
  const domainConfig = getDomainConfig(currentDomain)
  const isProduction = process.env.NODE_ENV === 'production'
  const isDevelopment = process.env.NODE_ENV === 'development'

  return {
    domains: {
      marketing: DOMAIN_CONFIGS.marketing,
      developer: DOMAIN_CONFIGS.developer,
      ai: DOMAIN_CONFIGS.ai,
      docs: DOMAIN_CONFIGS.docs
    },
    currentDomain,
    isProduction,
    isDevelopment,
    apiUrls: {
      base: domainConfig.apiBaseUrl,
      auth: `${domainConfig.apiBaseUrl}/v1/auth`,
      connectors: `${domainConfig.apiBaseUrl}/v1/connectors`,
      parsers: `${domainConfig.apiBaseUrl}/v1/parser`,
      generation: `${domainConfig.apiBaseUrl}/v1/generation`,
      agents: `${domainConfig.apiBaseUrl}/v1/agents`,
      analytics: `${domainConfig.apiBaseUrl}/v1/analytics`
    },
    build: {
      output: isProduction ? 'standalone' : 'export',
      trailingSlash: false,
      compress: true,
      poweredByHeader: false
    },
    performance: {
      enableSwcMinify: true,
      optimizeFonts: true,
      optimizeImages: true,
      swcPlugins: []
    }
  }
}

export function createNextConfig(domain: string): NextConfig {
  const domainConfig = getDomainConfig(domain)
  const frontendConfig = createFrontendConfig()

  return {
    output: frontendConfig.build.output as 'standalone' | 'export',
    trailingSlash: frontendConfig.build.trailingSlash,
    compress: frontendConfig.build.compress,
    poweredByHeader: frontendConfig.build.poweredByHeader,

    // Environment variables
    env: {
      NEXT_PUBLIC_DOMAIN_TYPE: domain,
      NEXT_PUBLIC_API_URL: domainConfig.apiBaseUrl,
      NEXT_PUBLIC_WS_URL: domainConfig.wsUrl || '',
      NEXT_PUBLIC_DOMAIN_NAME: domainConfig.name,
      NEXT_PUBLIC_BRAND_COLOR: domainConfig.brandColor,
      NEXT_PUBLIC_ANALYTICS_ID: domainConfig.analyticsId || '',
    },

    // Performance optimizations
    swcMinify: frontendConfig.performance.enableSwcMinify,
    optimizeFonts: frontendConfig.performance.optimizeFonts,
    experimental: {
      optimizePackageImports: ['@mcpoverflow/ui', 'lucide-react'],
    },

    // Image optimization
    images: {
      domains: ['mcpoverflow.com', 'app.mcpoverflow.io', 'mcpoverflow.ai', 'mcpoverflow.dev'],
      formats: ['image/webp', 'image/avif'],
    },

    // Rewrites for API proxying
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: `${domainConfig.apiBaseUrl}/:path*`,
        },
      ]
    },

    // Security headers
    async headers() {
      const headers = [
        {
          key: 'X-Domain-Name',
          value: domainConfig.name,
        },
        {
          key: 'X-Domain-Theme',
          value: domainConfig.theme,
        },
        {
          key: 'X-Brand-Color',
          value: domainConfig.brandColor,
        },
      ]

      // Add security headers based on domain configuration
      if (domainConfig.security.hsts) {
        headers.push({
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        })
      }

      if (domainConfig.security.frameOptions) {
        headers.push({
          key: 'X-Frame-Options',
          value: domainConfig.security.frameOptions,
        })
      }

      headers.push(
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        }
      )

      // Add CSP header if enabled
      if (domainConfig.security.csp) {
        const csp = generateCSP(domainConfig)
        headers.push({
          key: 'Content-Security-Policy',
          value: csp,
        })
      }

      return [{ source: '/(.*)', headers }]
    },

    // Webpack configuration
    webpack: (config, { isServer }) => {
      // Add domain-specific configurations
      config.resolve.alias = {
        ...config.resolve.alias,
        '@domain': `${__dirname}/domains/${domain}`,
      }

      return config
    },
  }
}

function generateCSP(domainConfig: DomainConfig): string {
  const baseDirectives = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: https:`,
    `connect-src 'self' ${domainConfig.apiBaseUrl}`,
  ]

  // Add domain-specific CSP directives
  if (domainConfig.features.websocket && domainConfig.wsUrl) {
    const wsOrigin = domainConfig.wsUrl.replace('wss://', 'https://').replace('ws://', 'http://')
    baseDirectives[baseDirectives.length - 1] += ` ${wsOrigin}`
  }

  if (domainConfig.analyticsId) {
    baseDirectives[1] += ' https://www.googletagmanager.com https://www.google-analytics.com'
    baseDirectives.push(`frame-src 'self' https://www.googletagmanager.com`)
  }

  // Theme-specific additions
  switch (domainConfig.theme) {
    case 'marketing':
      baseDirectives[1] += ' https://www.googletagmanager.com'
      break
    case 'developer':
      baseDirectives[1] += ' https://cdnjs.cloudflare.com'
      break
    case 'ai':
      baseDirectives[1] += ' https://cdn.jsdelivr.net'
      if (domainConfig.wsUrl) {
        baseDirectives.push(`connect-src 'self' ${domainConfig.apiBaseUrl} ${domainConfig.wsUrl}`)
      }
      break
    case 'docs':
      baseDirectives[1] += ' https://unpkg.com'
      break
  }

  return baseDirectives.join('; ')
}

export function generateSEOHead(domainConfig: DomainConfig, pathname: string = '/') {
  return {
    title: domainConfig.title,
    description: domainConfig.description,
    keywords: domainConfig.seo.keywords.join(', '),
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: `${domainConfig.url}${pathname}`,
      title: domainConfig.title,
      description: domainConfig.description,
      siteName: 'MCPOverflow',
      images: [
        {
          url: domainConfig.ogImage,
          width: 1200,
          height: 630,
          alt: domainConfig.title,
        },
      ],
    },
    twitter: {
      card: domainConfig.seo.twitterCard as 'summary' | 'summary_large_image',
      site: domainConfig.seo.twitterSite,
      title: domainConfig.title,
      description: domainConfig.description,
      images: [domainConfig.ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

export default {
  DOMAIN_CONFIGS,
  getCurrentDomain,
  getDomainConfig,
  createFrontendConfig,
  createNextConfig,
  generateSEOHead,
}