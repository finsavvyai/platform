import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'TokenForge — Device-Bound Session Security',
    template: '%s | TokenForge',
  },
  description:
    'Cryptographically bind browser sessions to the device that created them. A stolen cookie without the device key is useless.',
  keywords: [
    'session security',
    'device binding',
    'ECDSA P-256',
    'session hijacking prevention',
    'token theft protection',
    'Web Crypto API',
    'device-bound sessions',
    'session token security',
    'prevent session hijacking',
    'cryptographic session binding',
    'tokenforge',
    'step-up authentication',
    'trust scoring',
  ],
  authors: [{ name: 'OpenSyber' }],
  metadataBase: new URL('https://tokenforge.opensyber.cloud'),
  openGraph: {
    title: 'TokenForge — Device-Bound Session Security',
    description: 'Cryptographically bind browser sessions to the device that created them. A stolen cookie without the device key is useless.',
    url: 'https://tokenforge.opensyber.cloud',
    siteName: 'TokenForge',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'TokenForge — Device-Bound Session Security' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TokenForge — Device-Bound Session Security',
    description: 'Post-authentication session security. ECDSA P-256 device binding.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TokenForge',
    applicationCategory: 'SecurityApplication',
    applicationSubCategory: 'Session Security',
    operatingSystem: 'Web',
    url: 'https://tokenforge.opensyber.cloud',
    description: 'Device-bound session security SDK using ECDSA P-256 cryptographic signatures. Binds browser sessions to physical devices — stolen tokens are mathematically useless without the original device. SDKs for TypeScript, Go, Python, Kotlin, Swift, React Native.',
    featureList: 'ECDSA P-256 Device Binding, Trust Score Engine, Step-Up Authentication, Express Adapter, Fastify Adapter, Hono Adapter, Next.js Adapter, Multi-Language SDKs',
    offers: [
      { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free', description: '10K verifications/month, 1K sessions' },
      { '@type': 'Offer', price: '49', priceCurrency: 'USD', name: 'Pro', description: '50K verifications/month, 5K sessions' },
      { '@type': 'Offer', price: '199', priceCurrency: 'USD', name: 'Team', description: '250K verifications/month, 25K sessions' },
    ],
    publisher: {
      '@type': 'Organization',
      name: 'OpenSyber',
      url: 'https://opensyber.cloud',
    },
  };

  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Prevent Session Hijacking with Device-Bound Tokens',
    description: 'Integrate TokenForge in 5 minutes to cryptographically bind sessions to physical devices using ECDSA P-256.',
    step: [
      { '@type': 'HowToStep', name: 'Install TokenForge', text: 'Run: npm install @opensyber/tokenforge' },
      { '@type': 'HowToStep', name: 'Add server middleware', text: 'Import the adapter for your framework (Express, Fastify, Hono, or Next.js) and mount the TokenForge endpoints.' },
      { '@type': 'HowToStep', name: 'Initialize client', text: 'Create a TokenForgeClient instance in the browser and call tf.bind() on login to generate the device-bound keypair.' },
      { '@type': 'HowToStep', name: 'Protect routes', text: 'Add tf.verify() middleware to protected routes. Requests without valid device signatures are rejected.' },
    ],
    totalTime: 'PT5M',
  };

  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
        />
        <script
          src="https://tokenforge-api.opensyber.cloud/sdk.js"
          data-api-key="tf_187a2d7d219c235105258941fb1c3d62"
          defer
        />
        <script src="https://app.lemonsqueezy.com/js/lemon.js" defer />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-void text-text-primary`}
      >
        <SessionProvider>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded focus:bg-info focus:px-4 focus:py-2 focus:text-white focus:text-sm focus:font-bold">
            Skip to content
          </a>
          <div id="main-content">{children}</div>
        </SessionProvider>
      </body>
    </html>
  );
}
