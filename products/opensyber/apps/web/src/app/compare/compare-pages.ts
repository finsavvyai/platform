import type { Metadata } from 'next';

const BASE_URL = 'https://opensyber.cloud';

export type ComparePageConfig = {
  href: string;
  title: string;
  cardDescription: string;
  metaTitle: string;
  metaDescription: string;
};

export const comparePages: ComparePageConfig[] = [
  {
    href: '/compare/opensyber-vs-modal',
    title: 'OpenSyber vs Modal',
    cardDescription: 'Runtime security layer vs compute-first sandbox model.',
    metaTitle: 'OpenSyber vs Modal for AI Agent Security',
    metaDescription:
      'Compare OpenSyber and Modal. Modal provides strong compute isolation, while OpenSyber adds runtime attestation, verified skill marketplace, and compliance-ready security evidence.',
  },
  {
    href: '/compare/opensyber-vs-lasso',
    title: 'OpenSyber vs Lasso',
    cardDescription: 'Full runtime + marketplace trust stack vs gateway-focused MCP security.',
    metaTitle: 'OpenSyber vs Lasso MCP Security',
    metaDescription:
      'OpenSyber vs Lasso: MCP security comparison. OpenSyber combines runtime telemetry, verified skill marketplace, and attestation workflows; Lasso focuses on MCP gateway controls.',
  },
  {
    href: '/compare/opensyber-vs-protect-ai',
    title: 'OpenSyber vs Protect AI',
    cardDescription: 'Developer-first self-serve deployment vs enterprise-led buying motion.',
    metaTitle: 'OpenSyber vs Protect AI',
    metaDescription:
      'Compare OpenSyber and Protect AI. OpenSyber emphasizes self-serve deployment, runtime monitoring, and a verified skill marketplace for agent teams shipping now.',
  },
  {
    href: '/compare/opensyber-vs-diy-monitoring',
    title: 'OpenSyber vs DIY Monitoring',
    cardDescription: 'Purpose-built AI agent security vs stitched Datadog + Sentry stack.',
    metaTitle: 'OpenSyber vs DIY Monitoring (Datadog + Sentry + Scripts)',
    metaDescription:
      'Compare OpenSyber to DIY AI agent monitoring with Datadog, Sentry, and custom scripts. OpenSyber detects behavioral anomalies in 340ms, deploys in 60 seconds, and costs 75% less.',
  },
  {
    href: '/compare/opensyber-vs-dropzone',
    title: 'OpenSyber vs Dropzone AI',
    cardDescription: 'Open AI security platform with skill marketplace vs closed AI SOC analyst.',
    metaTitle: 'OpenSyber vs Dropzone AI — AI SOC Comparison',
    metaDescription:
      'OpenSyber vs Dropzone AI: open AI security platform at $99/mo with skill marketplace and device-bound sessions, compared to Dropzone\'s $50K+ ACV closed AI SOC analyst. 60-second deploy vs 4-8 week implementation.',
  },
  {
    href: '/compare/tokenforge-vs-traditional-sessions',
    title: 'TokenForge vs Traditional Sessions',
    cardDescription: 'Device-bound cryptographic sessions vs reusable JWT and IP-binding.',
    metaTitle: 'TokenForge vs Traditional Session Security (JWT + IP Binding)',
    metaDescription:
      'Compare TokenForge device-bound ECDSA P-256 sessions to traditional JWT + refresh tokens and IP binding. See why stolen tokens become useless with cryptographic device proof.',
  },
];

const comparePageByHref = new Map(comparePages.map((page) => [page.href, page]));

export function getComparePage(href: string): ComparePageConfig {
  const page = comparePageByHref.get(href);
  if (!page) {
    throw new Error(`Missing compare page config for "${href}"`);
  }
  return page;
}

export function buildCompareMetadata(page: ComparePageConfig): Metadata {
  const url = `${BASE_URL}${page.href}`;
  return {
    title: `${page.metaTitle} — OpenSyber`,
    description: page.metaDescription,
    alternates: { canonical: page.href },
    openGraph: {
      title: `${page.metaTitle} — OpenSyber`,
      description: page.metaDescription,
      url,
      type: 'article',
    },
  };
}
