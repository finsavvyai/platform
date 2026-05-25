import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MCPOverflow AI - Intelligent Agent Management Platform',
  description: 'Advanced AI platform for managing, visualizing, and interacting with intelligent agents. Real-time monitoring, 3D visualizations, and powerful analytics.',
  keywords: ['AI', 'agents', 'machine learning', 'visualization', 'analytics', 'MCP', 'automation'],
  authors: [{ name: 'MCPOverflow Team' }],
  openGraph: {
    title: 'MCPOverflow AI - Intelligent Agent Management',
    description: 'Advanced AI platform for managing intelligent agents with real-time visualizations',
    url: 'https://mcpoverflow.ai',
    siteName: 'MCPOverflow AI',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MCPOverflow AI Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCPOverflow AI - Intelligent Agent Management',
    description: 'Advanced AI platform for managing intelligent agents',
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