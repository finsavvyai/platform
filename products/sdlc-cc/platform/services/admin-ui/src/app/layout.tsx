import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { AuthProvider } from '@/components/providers/auth-provider'
import { Toaster } from '@/components/ui/toaster'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Skip static prerendering globally — several pages wire up client-only
// libs (monaco-editor, reactflow) that break static export.
export const dynamic = 'force-dynamic'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'SDLC.ai Admin',
    template: '%s | SDLC.ai Admin'
  },
  description: 'Admin interface for SDLC.ai platform - Manage your software development lifecycle',
  keywords: ['SDLC', 'admin', 'management', 'software development', 'lifecycle'],
  authors: [{ name: 'SDLC.ai Team' }],
  creator: 'SDLC.ai',
  publisher: 'SDLC.ai',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'SDLC.ai Admin',
    description: 'Admin interface for SDLC.ai platform',
    siteName: 'SDLC.ai Admin',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SDLC.ai Admin',
    description: 'Admin interface for SDLC.ai platform',
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>
              <div className="min-h-screen bg-background font-sans antialiased">
                {children}
              </div>
              <Toaster />
              {process.env.NODE_ENV === 'development' && (
                <ReactQueryDevtools initialIsOpen={false} />
              )}
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
