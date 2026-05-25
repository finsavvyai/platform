import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import { ComparisonSection, StatsSection, WhySection } from '@/app/HomeFeaturesExtra';

vi.mock('framer-motion', () => ({
  motion: {
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  },
}));
vi.mock('@/components/motion/FadeIn', () => ({
  FadeIn: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/motion/StaggerChildren', () => ({
  StaggerChildren: ({ children }: any) => <div>{children}</div>,
  StaggerItem: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/motion/CountUp', () => ({
  CountUp: ({ end, suffix }: any) => <span>{end}{suffix}</span>,
}));
vi.mock('@/app/home-data', () => ({
  comparisonRows: [
    ['Container Isolation', 'Manual', 'Built-in'],
    ['Credential Vault', 'No', 'AES-256'],
  ],
  earlyAccessFeatures: [
    {
      icon: () => <span data-testid="icon" />,
      title: 'Feature One',
      description: 'Desc one',
    },
  ],
}));

describe('ComparisonSection', () => {
  it('renders table header', () => {
    render(<ComparisonSection />);
    expect(screen.getByText('THE UNCOMFORTABLE TRUTH')).toBeInTheDocument();
    expect(screen.getByText('Capability')).toBeInTheDocument();
  });

  it('renders comparison rows', () => {
    render(<ComparisonSection />);
    expect(screen.getByText('Container Isolation')).toBeInTheDocument();
    expect(screen.getByText('AES-256')).toBeInTheDocument();
  });
});

describe('StatsSection', () => {
  it('renders stat labels', () => {
    render(<StatsSection />);
    expect(screen.getByText('IOCs In Threat Feed')).toBeInTheDocument();
    expect(screen.getByText('Deploy Time')).toBeInTheDocument();
    expect(screen.getByText('Alert Channels')).toBeInTheDocument();
  });
});

describe('WhySection', () => {
  it('renders heading and features', () => {
    render(<WhySection />);
    expect(screen.getByText("LOOK, IT'S OBVIOUS")).toBeInTheDocument();
    expect(screen.getByText('Feature One')).toBeInTheDocument();
    expect(screen.getByText('Desc one')).toBeInTheDocument();
  });
});
