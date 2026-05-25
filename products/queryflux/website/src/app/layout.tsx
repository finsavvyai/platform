import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'QueryFlux',
  description: 'AI-powered database management platform with real-time collaboration',
  url: 'https://queryflux.com',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: ['Windows', 'macOS', 'Linux'],
  offers: [
    {
      '@type': 'Offer',
      name: 'Free Plan',
      price: '0',
      priceCurrency: 'USD',
    },
    {
      '@type': 'Offer',
      name: 'Pro Plan',
      price: '29',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '29',
        priceCurrency: 'USD',
        billingDuration: 'P1M',
      },
    },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '1250',
  },
}

export const metadata: Metadata = {
  metadataBase: new URL('https://queryflux.com'),
  title: 'QueryFlux - AI-Powered Database Management Platform',
  description: 'The most advanced database management platform with AI-powered query optimization, real-time collaboration, and support for 35+ database types.',
  keywords: [
    'database management',
    'SQL editor',
    'AI query optimization',
    'database collaboration',
    'PostgreSQL',
    'MySQL',
    'MongoDB',
    'Redis',
    'database administration',
    'query builder',
    'data visualization'
  ],
  authors: [{ name: 'QueryFlux Team' }],
  creator: 'QueryFlux',
  publisher: 'QueryFlux',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://queryflux.com',
    siteName: 'QueryFlux',
    title: 'QueryFlux - AI-Powered Database Management',
    description: 'AI-powered database management platform with real-time collaboration',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'QueryFlux - Database Management Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QueryFlux - AI-Powered Database Management',
    description: 'AI-powered database management platform with real-time collaboration',
    images: ['/og-image.jpg'],
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
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
  },
  manifest: '/site.webmanifest',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <div className="min-h-screen flex flex-col">
          <Navigation />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
