import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import '../styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#09090b',
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://agents.lunaos.ai'),
  title: {
    default: 'LunaOS — AI Agent Dashboard',
    template: '%s | LunaOS',
  },
  description:
    '140+ AI commands. 33 MCP servers. Code, deploy, design, create music, generate videos — all powered by LunaOS.',
  keywords: [
    'LunaOS', 'AI agents', 'code review', 'automated testing', 'deployment',
    'Luna Agents', 'developer tools', 'SDLC automation',
  ],
  authors: [{ name: 'LunaOS' }],
  creator: 'LunaOS',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://agents.lunaos.ai',
    siteName: 'LunaOS',
    title: 'LunaOS — AI Agent Dashboard',
    description: '140+ AI commands with 33 MCP servers — from your browser.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LunaOS AI Agent Dashboard' }],
  },
  icons: {
    icon: [
      { url: '/luna-icon.png', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/luna-icon.png' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.lunaos.ai" />
      </head>
      <body className="min-h-screen bg-neutral-950 text-neutral-50 antialiased overflow-x-hidden">
        {/* Animated Background Orbs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>

        {/* Grid Background */}
        <div className="fixed inset-0 bg-grid pointer-events-none z-0" aria-hidden="true" />

        {/* Main Content */}
        <main className="relative z-10">
          {children}
        </main>

        {/* LemonSqueezy Overlay Checkout — opens on-site, no redirect */}
        <Script src="https://assets.lemonsqueezy.com/lemon.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
