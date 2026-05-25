import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      pillars: {
        sectionLabel: 'What we actually do',
        heading: 'THREE LAYERS',
        'infrastructure.title': 'HARDENED INFRASTRUCTURE',
        'infrastructure.desc': 'Every agent runs in an isolated container with encrypted credential vaults, per-agent firewalls, and automatic security patching.',
        'infrastructure.f1': 'AES-256 encrypted secrets',
        'infrastructure.f2': 'Per-agent isolation',
        'infrastructure.f3': 'Automatic security patching',
        'marketplace.title': 'VERIFIED MARKETPLACE',
        'marketplace.desc': '22+ audited skills with a 4-stage review pipeline. Every skill version is signature-verified with SBOM attached.',
        'marketplace.f1': 'Manifest + source code scanning',
        'marketplace.f2': 'Sandbox testing',
        'marketplace.f3': 'Publisher verification',
        'monitoring.title': 'BEHAVIORAL DETECTION',
        'monitoring.desc': 'Per-agent baselines track every tool call, argument shape, and egress pattern. When something deviates — a read_file to a path never touched, a POST body that matches context window size — we catch it in milliseconds.',
        'monitoring.f1': 'Tool-call anomaly detection',
        'monitoring.f2': '5-layer prompt injection defense',
        'monitoring.f3': 'Egress fingerprinting (DNS tunnel, SNI lookalike, slow exfil)',
      },
      common: {
        explore: 'Explore',
      },
      demo: {
        heading: 'SEE IT. THEN PANIC.',
        description: 'Explore a live dashboard. See what your agents are actually doing. No signup. No commitment. Just... awareness.',
        openDemo: 'Open Live Demo',
        liveDemo: 'Live Demo',
      },
      howItWorks: {
        sectionLabel: 'The actual flow',
        heading: 'DEPLOY. CONNECT. WATCH.',
        description: 'No configuration. No forwarding rules. No YAML pilgrimage.',
        step1Title: 'DEPLOY AN AGENT',
        step1Desc: 'One click. 60 seconds. A hardened agent spins up on an isolated container.',
        step2Title: 'CONNECT YOUR MACHINE',
        step2Desc: 'One command installs the CLI and pairs your laptop.',
        step3Title: 'SEE EVERY ACTION',
        step3Desc: 'Every file read, shell command, and network call shows up in your dashboard.',
        installCommand: 'npm i -g @opensyber/cli && opensyber login',
        ctaText: 'Read the connect guide',
      },
    };
    return (key: string) => messages[namespace]?.[key] ?? `${namespace}.${key}`;
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import { PillarsSection, DemoEmbedSection, HowItWorksSection } from '@/app/HomeFeatures';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@/components/motion/FadeIn', () => ({
  FadeIn: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/motion/StaggerChildren', () => ({
  StaggerChildren: ({ children }: any) => <div>{children}</div>,
  StaggerItem: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/app/home-data', () => ({
  steps: [],
  comparisonRows: [],
  earlyAccessFeatures: [],
}));

describe('PillarsSection', () => {
  it('renders three pillar titles', () => {
    render(<PillarsSection />);
    expect(screen.getByText('HARDENED INFRASTRUCTURE')).toBeInTheDocument();
    expect(screen.getByText('VERIFIED MARKETPLACE')).toBeInTheDocument();
    expect(screen.getByText('BEHAVIORAL DETECTION')).toBeInTheDocument();
  });

  it('renders section heading', () => {
    render(<PillarsSection />);
    expect(screen.getByText('THREE LAYERS')).toBeInTheDocument();
  });

  it('renders feature lists', () => {
    render(<PillarsSection />);
    expect(screen.getByText('AES-256 encrypted secrets')).toBeInTheDocument();
    expect(screen.getByText('Sandbox testing')).toBeInTheDocument();
    expect(screen.getByText('Egress fingerprinting (DNS tunnel, SNI lookalike, slow exfil)')).toBeInTheDocument();
  });
});

describe('DemoEmbedSection', () => {
  it('renders demo CTA', () => {
    render(<DemoEmbedSection />);
    expect(screen.getByText('SEE IT. THEN PANIC.')).toBeInTheDocument();
    expect(screen.getByText(/Open Live Demo/)).toBeInTheDocument();
  });

  it('links to /demo', () => {
    render(<DemoEmbedSection />);
    const link = screen.getByText(/Open Live Demo/);
    expect(link.closest('a')).toHaveAttribute('href', '/demo');
  });
});

describe('HowItWorksSection', () => {
  it('renders the three real-flow steps', () => {
    render(<HowItWorksSection />);
    expect(screen.getByText('DEPLOY AN AGENT')).toBeInTheDocument();
    expect(screen.getByText('CONNECT YOUR MACHINE')).toBeInTheDocument();
    expect(screen.getByText('SEE EVERY ACTION')).toBeInTheDocument();
  });

  it('renders the deploy-connect-watch heading', () => {
    render(<HowItWorksSection />);
    expect(screen.getByText('DEPLOY. CONNECT. WATCH.')).toBeInTheDocument();
  });

  it('renders the install command in a terminal block', () => {
    render(<HowItWorksSection />);
    expect(
      screen.getByText('npm i -g @opensyber/cli && opensyber login'),
    ).toBeInTheDocument();
  });

  it('links to the connect-agent docs page', () => {
    render(<HowItWorksSection />);
    const cta = screen.getByText(/Read the connect guide/).closest('a');
    expect(cta).toHaveAttribute('href', '/docs/connect-agent');
  });
});
