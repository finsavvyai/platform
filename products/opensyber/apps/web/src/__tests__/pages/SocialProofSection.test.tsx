import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      socialProof: {
        sectionLabel: 'Real attacks. Real orgs. Real bad.',
        heading: 'THIS ALREADY HAPPENED',
        description: "These aren't hypotheticals. These attacks hit real organizations in 2025-2026. Most found out from the news. The ones with monitoring found out in milliseconds.",
        opensyberStops: 'OpenSyber catches this',
      },
    };
    return (key: string) => messages[namespace]?.[key] ?? `${namespace}.${key}`;
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import { SocialProofSection } from '@/app/SocialProofSection';

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

describe('SocialProofSection', () => {
  it('renders attacks heading', () => {
    render(<SocialProofSection />);
    expect(screen.getByText('THIS ALREADY HAPPENED')).toBeInTheDocument();
  });

  it('renders attack cards', () => {
    render(<SocialProofSection />);
    expect(screen.getByText('Trivy Supply Chain Attack')).toBeInTheDocument();
    expect(screen.getByText('Clinejection')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<SocialProofSection />);
    expect(
      screen.getByText(/These attacks hit real organizations in 2025-2026/),
    ).toBeInTheDocument();
  });
});
