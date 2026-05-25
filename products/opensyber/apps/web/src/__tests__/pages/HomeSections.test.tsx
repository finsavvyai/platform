import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      trustBar: {
        zeroTrust: 'Zero-Trust Architecture',
        cloudflare: 'Cloudflare Edge',
        soc2: 'SOC 2 Type II',
        gdpr: 'GDPR compliant',
      },
      problem: {
        sectionLabel: 'Let me ask you something',
        heading: 'THIS IS YOUR SECURITY PLAN?',
        description: '68% of AI agents store API keys in plaintext. They can reach any IP. They run shell commands. And your audit trail is empty. OpenSyber fixes all of this in 60 seconds.',
        withoutTitle: 'Your current setup',
        withoutCaption: 'No alerts. No logs. You went to lunch.',
        withTitle: 'With OpenSyber',
        withCaption: 'Detected. Blocked. Logged. Before you finished your coffee.',
        blocked: 'NOPE',
        alert: 'ALERT',
        scanned: 'CAUGHT',
        sshDenied: 'SSH key access denied — agent quarantined',
        exfilAlert: 'Exfiltration attempt → PagerDuty alerted',
        packageFlagged: 'Malicious package blocked before install',
      },
      solution: {
        sectionLabel: 'The obvious answer',
        heading: 'THREE LAYERS',
        description: 'Purpose-built for AI agent security. Hardening, detection, and response in one surface.',
      },
      tokenforge: {
        sectionLabel: 'Session Security',
        heading: 'TOKENFORGE',
        description: 'A session cookie. In 2026. For something with access to your AWS keys. We fixed that. Every session is cryptographically bound to your device. Stolen tokens are worthless.',
        f1: 'Non-extractable keypairs via Web Crypto API',
        f2: 'Challenge-response signing on every request',
        f3: 'Trust score engine with 7 weighted signals',
        f4: 'Automatic step-up auth on anomaly detection',
      },
    };
    return (key: string) => messages[namespace]?.[key] ?? `${namespace}.${key}`;
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import { TrustBar, ProblemSection, SolutionSection, TokenForgeSection } from '@/app/HomeSections';

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
vi.mock('@/app/TypedTerminal', () => ({
  TypedTerminal: () => <div data-testid="typed-terminal" />,
}));
vi.mock('@/app/home-data', () => ({
  threats: [],
  solutionLayers: [
    {
      icon: () => <span />,
      title: 'Layer One',
      features: ['Feature A', 'Feature B'],
    },
  ],
}));

describe('TrustBar', () => {
  it('renders trust badges', () => {
    render(<TrustBar />);
    expect(screen.getByText('Zero-Trust Architecture')).toBeInTheDocument();
    expect(screen.getByText('Cloudflare Edge')).toBeInTheDocument();
    expect(screen.getByText('GDPR compliant')).toBeInTheDocument();
  });
});

describe('ProblemSection', () => {
  it('renders before/after panels', () => {
    render(<ProblemSection />);
    expect(screen.getByText('THIS IS YOUR SECURITY PLAN?')).toBeInTheDocument();
    expect(screen.getByText('Your current setup')).toBeInTheDocument();
    expect(screen.getByText('With OpenSyber')).toBeInTheDocument();
  });

  it('renders attack examples', () => {
    render(<ProblemSection />);
    expect(screen.getByText(/SSH key access denied/)).toBeInTheDocument();
    expect(screen.getByText('NOPE')).toBeInTheDocument();
  });
});

describe('SolutionSection', () => {
  it('renders solution layers', () => {
    render(<SolutionSection />);
    expect(screen.getByText('THREE LAYERS')).toBeInTheDocument();
    expect(screen.getByText('Layer One')).toBeInTheDocument();
    expect(screen.getByText('Feature A')).toBeInTheDocument();
  });
});

describe('TokenForgeSection', () => {
  it('renders tokenforge heading and features', () => {
    render(<TokenForgeSection />);
    expect(screen.getByText('TOKENFORGE')).toBeInTheDocument();
    expect(
      screen.getByText(/Non-extractable keypairs/),
    ).toBeInTheDocument();
  });

  it('renders the typed terminal', () => {
    render(<TokenForgeSection />);
    expect(screen.getByTestId('typed-terminal')).toBeInTheDocument();
  });
});
