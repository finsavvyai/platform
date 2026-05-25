import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      cta: {
        heading: 'STOP FLYING BLIND',
        description: "Your AI agents are running right now. On your code. With your credentials. Making network calls you don't know about. You can keep not knowing. Or you can spend 60 seconds.",
        noCreditCard: 'No credit card. No vendor lock-in. No sales call. No excuse.',
      },
      demo: {
        liveDemo: 'Live Demo',
      },
      footer: {
        product: 'Product',
        pricing: 'Pricing',
        marketplace: 'Marketplace',
        liveDemo: 'Live Demo',
        auditMethodology: 'Audit Methodology',
        legal: 'Legal',
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
        security: 'Security Policy',
        community: 'Community',
        github: 'GitHub',
        blog: 'Blog',
        about: 'About',
        support: 'Support',
        ecosystem: 'Ecosystem',
        sessionSecurity: 'Session security',
      },
      common: {
        tagline: "We watch your AI agents so you don't have to. That's it. That's the product.",
        copyright: '© 2026 OpenSyber. All rights reserved.',
        builtOn: "Built to protect. Deployed on Cloudflare Edge. Because we're not monsters.",
      },
    };
    return (key: string) => messages[namespace]?.[key] ?? `${namespace}.${key}`;
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import { FinalCTASection, Footer } from '@/app/HomeFooter';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@/components/AuthNav', () => ({
  AuthCTA: ({ className }: any) => (
    <button className={className}>Get Started</button>
  ),
}));
vi.mock('@/components/motion/FadeIn', () => ({
  FadeIn: ({ children }: any) => <div>{children}</div>,
}));

describe('FinalCTASection', () => {
  it('renders heading', () => {
    render(<FinalCTASection />);
    expect(screen.getByText('STOP FLYING BLIND')).toBeInTheDocument();
  });

  it('renders CTA buttons', () => {
    render(<FinalCTASection />);
    expect(screen.getByText('Get Started')).toBeInTheDocument();
    expect(screen.getByText(/Live Demo/)).toBeInTheDocument();
  });

  it('renders no-credit-card note', () => {
    render(<FinalCTASection />);
    expect(
      screen.getByText(/No credit card/),
    ).toBeInTheDocument();
  });
});

describe('Footer', () => {
  it('renders product links', () => {
    render(<Footer />);
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
  });

  it('renders legal links', () => {
    render(<Footer />);
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    expect(screen.getByText('Security Policy')).toBeInTheDocument();
  });

  it('renders copyright', () => {
    render(<Footer />);
    expect(screen.getByText(/2026 OpenSyber/)).toBeInTheDocument();
  });

  it('renders community links', () => {
    render(<Footer />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Blog')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
  });
});
