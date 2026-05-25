import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import '../styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://mcpoverflow.com'),
  title: {
    default: 'MCPOverflow - Connect Every API to Every AI Agent',
    template: '%s | MCPOverflow'
  },
  description: 'Generate MCP connectors from OpenAPI, GraphQL, and Postman specs in seconds. Deploy to Cloudflare Workers and let AI agents interact with any API instantly.',
  keywords: [
    'MCP',
    'Model Context Protocol',
    'AI Agents',
    'OpenAPI',
    'GraphQL',
    'Postman',
    'Claude',
    'GPT',
    'API Integration',
    'Cloudflare Workers',
    'AgentKit',
    'AI Tools',
    'LLM Tools',
    'API Automation'
  ],
  authors: [{ name: 'MCPOverflow Team', url: 'https://mcpoverflow.com' }],
  creator: 'MCPOverflow',
  publisher: 'MCPOverflow',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://mcpoverflow.com',
    title: 'MCPOverflow - Every API. Every AI. Connected.',
    description: 'Generate MCP connectors from your API specs in seconds. Let AI agents interact with any API instantly.',
    siteName: 'MCPOverflow',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MCPOverflow - Connect Every API to Every AI Agent',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCPOverflow - Every API. Every AI. Connected.',
    description: 'Generate MCP connectors from your API specs in seconds. Let AI agents interact with any API instantly.',
    creator: '@mcpoverflow',
    site: '@mcpoverflow',
    images: ['/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://mcpoverflow.com',
  },
  category: 'technology',
}

// JSON-LD Structured Data
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'MCPOverflow',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  description: 'AI-powered MCP connector generation platform. Generate tools for Claude, GPT, and other AI agents from any API specification.',
  url: 'https://mcpoverflow.com',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  creator: {
    '@type': 'Organization',
    name: 'MCPOverflow',
    url: 'https://mcpoverflow.com',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`scroll-smooth ${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <div className="min-h-screen bg-black noise">
          {children}
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}