import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

afterEach(cleanup);

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      headlineTop: 'Runtime.',
      headlineBottom: 'Security.',
      headlineHighlight: 'Marketplace.',
      description: 'OpenSyber is the only platform that ships runtime isolation',
      ctaPrimary: 'Start free — 60 seconds',
      ctaSecondary: 'See live security telemetry',
      freeForever: 'Free tier included. No sales call required.',
      trivyDate: 'Trivy attack: Mar 19, 2026',
      trivyOrgs: '45 orgs. 12 hours.',
      score: 'SCORE',
      agents: 'Agents',
      threatsLabel: 'Threats',
      uptime: 'Uptime',
      credentialBlocked: 'Credential exfiltration blocked',
      skillAudit: 'Skill audit passed',
      heartbeatRestored: 'Heartbeat restored',
    };
    return messages[key] ?? key;
  },
}));

vi.mock('@/components/AuthNav', () => ({
  AuthCTA: ({ className, label }: any) => (
    <button className={className}>{label ?? 'Get Started'}</button>
  ),
}));

import { HeroSection } from '@/app/HeroSection';

describe('HeroSection', () => {
  it('renders the headline', () => {
    render(<HeroSection />);
    expect(
      screen.getByRole('heading', { name: /Runtime\.\s*Security\.\s*Marketplace\./ }),
    ).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    render(<HeroSection />);
    expect(
      screen.getByText(/OpenSyber is the only platform that ships runtime isolation/),
    ).toBeInTheDocument();
  });

  it('renders the CTA buttons', () => {
    render(<HeroSection />);
    expect(screen.getByText(/Start free/)).toBeInTheDocument();
    expect(screen.getByText(/See live security telemetry/)).toBeInTheDocument();
  });

  it('renders the free-tier message', () => {
    render(<HeroSection />);
    expect(
      screen.getByText(/Free tier included/),
    ).toBeInTheDocument();
  });

  it('links Trivy button to blog post', () => {
    render(<HeroSection />);
    const trivyLinks = screen.getAllByText(/Trivy/);
    const ctaLink = trivyLinks.find((el) => el.closest('a')?.getAttribute('href') === '/blog/trivy-attack-inevitable');
    expect(ctaLink).toBeDefined();
  });

  it('shows dashboard mockup metrics', () => {
    render(<HeroSection />);
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('99.9%')).toBeInTheDocument();
  });
});
