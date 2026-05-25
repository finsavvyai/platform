import { createNextConfig } from '@mcpoverflow/frontend-config'
import withMDX from '@next/mdx'
import remarkGfm from 'remark-gfm'
import remarkToc from 'remark-toc'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeMermaid from 'rehype-mermaid'
import remarkNextImages from '@theguild/remark-next-images'

const mdxConfig = withMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkGfm, remarkToc],
    rehypePlugins: [rehypePrettyCode, rehypeMermaid, remarkNextImages],
  },
})

// Create documentation site-specific configuration
const config = createNextConfig('docs')

// Add documentation site-specific customizations
const docsSiteConfig = {
  ...config,

  // Enable MDX
  experimental: {
    ...config.experimental,
    optimizePackageImports: ['react-markdown', 'react-syntax-highlighter', 'mermaid'],
    mdxRs: false, // Disable MDX rust compiler in favor of withMDX
  },

  // Page extensions for MDX
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],

  // Documentation site output (static export)
  output: 'export',
  trailingSlash: true,
  images: {
    ...config.images,
    unoptimized: true,
    domains: ['mcpoverflow.dev', 'www.mcpoverflow.dev'],
  },

  // Environment variables
  env: {
    ...config.env,
    NEXT_PUBLIC_DOMAIN_TYPE: 'docs',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.mcpoverflow.dev',
  },

  // Documentation site specific headers
  async headers() {
    const docsSiteHeaders = [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Domain-Purpose',
            value: 'documentation',
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
        source: '/docs/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
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
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]

    return [...(config.headers ? await config.headers() : []), ...docsSiteHeaders]
  },

  // Documentation site redirects
  async redirects() {
    const docsSiteRedirects = [
      {
        source: '/getting-started',
        destination: '/docs/getting-started',
        permanent: true,
      },
      {
        source: '/api',
        destination: '/docs/api-reference',
        permanent: true,
      },
      // External redirects
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
      {
        source: '/pricing',
        destination: 'https://mcpoverflow.com/#pricing',
        permanent: true,
      },
    ];

    return [...(config.redirects ? await config.redirects() : []), ...docsSiteRedirects];
  },
}

export default mdxConfig(docsSiteConfig)