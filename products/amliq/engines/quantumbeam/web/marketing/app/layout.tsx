import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AMLIQ Fraud Engine - Machine-Learning Fraud Detection',
  description: 'Real-time fraud detection powered by classical machine learning. Identify fraudulent transactions with ensemble ML models and graph-based ring detection.',
  keywords: [
    'fraud detection',
    'machine learning',
    'AI security',
    'transaction monitoring',
    'financial security',
    'ensemble models',
    'fraud prevention',
    'regtech',
    'fintech',
    'real-time scoring'
  ],
  authors: [{ name: 'QuantumBeam Team' }],
  creator: 'QuantumBeam',
  publisher: 'QuantumBeam Inc.',
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
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://quantumbeam.io',
    title: 'AMLIQ Fraud Engine - Machine-Learning Fraud Detection',
    description: 'Real-time fraud detection powered by classical machine learning.',
    siteName: 'QuantumBeam',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'AMLIQ Fraud Engine - ML Fraud Detection',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AMLIQ Fraud Engine - Machine-Learning Fraud Detection',
    description: 'Real-time fraud detection powered by classical machine learning.',
    images: ['/twitter-image.jpg'],
    creator: '@quantumbeam',
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
    yahoo: 'your-yahoo-verification-code',
  },
  alternates: {
    canonical: 'https://quantumbeam.io',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5" />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#ffffff" />

        {/* Preload critical fonts and assets */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "QuantumBeam",
              "url": "https://quantumbeam.io",
              "logo": "https://quantumbeam.io/logo.png",
              "description": "Machine-learning fraud detection and financial security platform",
              "foundingDate": "2024",
              "contactPoint": {
                "@type": "ContactPoint",
                "email": "contact@quantumbeam.io",
                "contactType": "customer service"
              },
              "sameAs": [
                "https://twitter.com/quantumbeam",
                "https://linkedin.com/company/quantumbeam"
              ]
            })
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}