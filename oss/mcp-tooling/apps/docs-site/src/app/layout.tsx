import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MCPOverflow Documentation | Complete Guide to AI Agent Management',
  description: 'Comprehensive documentation for MCPOverflow - AI agent management platform, API reference, getting started guides, and interactive examples.',
  keywords: ['documentation', 'API', 'guides', 'MCP', 'AI agents', 'development', 'reference'],
  authors: [{ name: 'MCPOverflow Team' }],
  openGraph: {
    title: 'MCPOverflow Documentation',
    description: 'Complete documentation for AI agent management platform',
    url: 'https://mcpoverflow.dev',
    siteName: 'MCPOverflow Docs',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MCPOverflow Documentation',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCPOverflow Documentation',
    description: 'Complete documentation for AI agent management platform',
    images: ['/og-image.jpg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="min-h-screen bg-background text-foreground">
          {children}
        </div>
      </body>
    </html>
  )
}