import type { Metadata, Viewport } from 'next';
import { DM_Sans, Space_Mono, Bebas_Neue } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { isRtl, type Locale } from '@/i18n/routing';
import './globals.css';

const dmSans = DM_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
});

const spaceMono = Space_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const bebasNeue = Bebas_Neue({
  variable: '--font-display',
  subsets: ['latin'],
  weight: '400',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: 'OpenSyber — Runtime Security for AI Agents',
    template: '%s | OpenSyber',
  },
  description:
    'The Trivy attack ran for 12 hours before anyone noticed. 45 organizations had their secrets stolen. OpenSyber exists so that doesn\'t happen to you.',
  keywords: [
    'AI agent security',
    'AI coding agent security',
    'secure AI agents',
    'AI agent monitoring',
    'AI agent runtime security',
    'credential vaulting for AI agents',
    'supply chain security AI agents',
    'opensyber',
    'AI agent compliance',
    'SOC2 AI agents',
    'behavioral monitoring AI agents',
    'prompt injection prevention',
    'device-bound sessions',
    'tokenforge',
    'OASF framework',
    'AI agent sandboxing',
  ],
  authors: [{ name: 'OpenSyber' }],
  alternates: {
    canonical: 'https://opensyber.cloud',
    languages: {
      en: 'https://opensyber.cloud',
      he: 'https://opensyber.cloud/he',
      ar: 'https://opensyber.cloud/ar',
    },
    types: {
      'text/html': [
        { url: 'https://opensyber.dev', title: 'OpenSyber Developer Docs' },
        { url: 'https://opensyber.com', title: 'OpenSyber' },
        { url: 'https://opensyber.io', title: 'OpenSyber' },
      ],
    },
  },
  metadataBase: new URL('https://opensyber.cloud'),
  openGraph: {
    title: 'OpenSyber — Runtime Security for AI Agents',
    description:
      'The Trivy attack ran for 12 hours before anyone noticed. 45 organizations had their secrets stolen. OpenSyber exists so that doesn\'t happen to you.',
    url: 'https://opensyber.cloud',
    siteName: 'OpenSyber',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'OpenSyber — Runtime Security for AI Agents' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenSyber — Runtime Security for AI Agents',
    description:
      'The Trivy attack ran for 12 hours before anyone noticed. 45 organizations had their secrets stolen. OpenSyber exists so that doesn\'t happen to you.',
    images: ['/og.png'],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const rtl = isRtl(locale);

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'OpenSyber',
    url: 'https://opensyber.cloud',
    logo: 'https://opensyber.cloud/og.png',
    foundingDate: '2026',
    description: 'The first dedicated security platform for autonomous AI agents. Real-time behavioral monitoring, credential vaulting, and compliance enforcement.',
    sameAs: [
      'https://github.com/finsavvyai/opensyber',
      'https://opensyber.dev',
      'https://opensyber.com',
      'https://opensyber.io',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@opensyber.cloud',
      contactType: 'customer support',
    },
  };

  const appJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'OpenSyber',
    applicationCategory: 'SecurityApplication',
    applicationSubCategory: 'AI Agent Security',
    operatingSystem: 'Web',
    url: 'https://opensyber.cloud',
    description: 'Enterprise AI agent runtime security platform. Detects and blocks threats to AI coding agents in 340ms. Behavioral monitoring, credential vaulting, supply chain scanning, and compliance enforcement for Cursor, Claude Code, Devin, and other autonomous agents.',
    featureList: 'Behavioral Baselines, Credential Vault, Supply Chain Scanning, Network Isolation, Security Scoring, SIEM Integration, Compliance Frameworks, Skill Marketplace',
    screenshot: 'https://opensyber.cloud/og.png',
    softwareVersion: '0.9.7',
    offers: [
      { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free', description: '1 agent, 10 runs/day, full security dashboard' },
      { '@type': 'Offer', price: '49', priceCurrency: 'USD', name: 'Pro', description: '5 agents, 1K runs/month, skill marketplace access' },
      { '@type': 'Offer', price: '199', priceCurrency: 'USD', name: 'Team', description: '20 agents, 10K runs/month, SSO integration' },
    ],
    publisher: orgJsonLd,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '12',
      bestRating: '5',
    },
  };

  const tokenForgeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: 'TokenForge',
    description: 'Device-bound session security SDK using ECDSA P-256. Binds sessions to physical devices so stolen tokens are mathematically useless.',
    codeRepository: 'https://github.com/finsavvyai/opensyber',
    programmingLanguage: ['TypeScript', 'Go', 'Python', 'Kotlin', 'Swift'],
    runtimePlatform: ['Node.js', 'Cloudflare Workers', 'Browser'],
    url: 'https://tokenforge.opensyber.cloud',
    publisher: orgJsonLd,
  };

  return (
    <html lang={locale} dir={rtl ? 'rtl' : 'ltr'} className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(tokenForgeJsonLd) }}
        />
        <script
          src="https://tokenforge-api.opensyber.cloud/sdk.js"
          data-api-key="tf_187a2d7d219c235105258941fb1c3d62"
          defer
        />
        <script src="https://app.lemonsqueezy.com/js/lemon.js" defer />
      </head>
      <body className={`${dmSans.variable} ${spaceMono.variable} ${bebasNeue.variable} antialiased`}>
        <SessionProvider>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded focus:bg-signal focus:px-4 focus:py-2 focus:text-void focus:text-sm focus:font-bold">
              {rtl ? 'דלג לתוכן' : 'Skip to content'}
            </a>
            <div id="main-content">{children}</div>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
